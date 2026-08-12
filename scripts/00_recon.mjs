// 路线 B 侦察：fastmoss 真实页面渲染检测
// 用 Playwright 真实浏览器访问 /e-commerce/saleslist，看页面实际显示哪个 region 的数据
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const URL = 'https://www.fastmoss.com/e-commerce/saleslist';

async function main() {
  console.log('=== 启动浏览器 ===');
  const browser = await chromium.launch({
    headless: true,
    channel: 'chrome', // 用本机 Google Chrome，避开 chromium 版本不匹配
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'en-US',
    timezoneId: 'Asia/Singapore',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await ctx.newPage();

  console.log('=== 抓响应头 ===');
  const responseHeaders = [];
  page.on('response', (resp) => {
    const url = resp.url();
    if (url.includes('fastmoss.com') || url.includes('tiktok')) {
      const h = resp.headers();
      responseHeaders.push({
        url: url.slice(0, 120),
        status: resp.status(),
        xRegion: h['x-region'],
        xPath: h['x-path'],
      });
    }
  });

  console.log(`=== 访问 ${URL} ===`);
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  console.log('DOMContentLoaded done, waiting for client-side data...');

  // 等客户端 JS 渲染 + 数据加载
  await page.waitForTimeout(8000);

  // 触发滚动看是否 lazy load
  console.log('=== 触发滚动加载更多数据 ===');
  for (let i = 0; i < 5; i++) {
    await page.mouse.wheel(0, 2000);
    await page.waitForTimeout(1500);
  }

  // 抓所有文字内容看看实际显示什么
  console.log('=== 抓页面真实文字内容 ===');
  const pageData = await page.evaluate(() => {
    return {
      title: document.title,
      h1: [...document.querySelectorAll('h1')].map(e => e.textContent.trim()),
      h2: [...document.querySelectorAll('h2')].slice(0, 20).map(e => e.textContent.trim()),
      // 抓所有包含国家/区域标识的元素
      countryHints: [...document.querySelectorAll('*')]
        .filter(e => /SG|US|MY|PH|TH|VN|ID|Singapore|United States|Malaysia|Philippines|Thailand|Vietnam|Indonesia/i.test(e.textContent.slice(0, 100)) && e.children.length < 5)
        .slice(0, 20)
        .map(e => e.textContent.trim().slice(0, 100)),
      // 抓产品名（如果有）
      productNames: [...document.querySelectorAll('[class*="product"], [class*="item"], [class*="title"], [class*="name"]')]
        .slice(0, 30)
        .map(e => e.textContent.trim().slice(0, 80))
        .filter(t => t.length > 5 && t.length < 100),
      // 抓价格（数字 + 货币符号）
      prices: [...document.querySelectorAll('*')]
        .filter(e => /^[$€£¥₩฿₫₱RpS\$][\d,.]+$/.test(e.textContent.trim()))
        .slice(0, 20)
        .map(e => e.textContent.trim()),
      // 抓 body 文字前 3000 字
      bodyText: document.body.textContent.slice(0, 3000),
      // 看 __NEXT_DATA__ 是否在
      hasNextData: !!window.__NEXT_DATA__,
      // 看 URL
      currentUrl: window.location.href,
      // 抓 localStorage / sessionStorage 看有没有 region info
      localStorage: Object.keys(localStorage).map(k => ({ key: k, value: localStorage.getItem(k).slice(0, 200) })),
      sessionStorage: Object.keys(sessionStorage).map(k => ({ key: k, value: sessionStorage.getItem(k).slice(0, 200) })),
    };
  });

  console.log('=== 抓 network 响应（找 API endpoint）===');
  const apiCalls = responseHeaders.filter(h =>
    h.url.includes('/api') || h.url.includes('graphql') || h.url.includes('query') || h.url.includes('saleslist')
  );

  console.log('\n=== Page Data ===');
  console.log(JSON.stringify(pageData, null, 2));

  console.log('\n=== API Calls ===');
  console.log(JSON.stringify(apiCalls.slice(0, 30), null, 2));

  // 截图
  await page.screenshot({ path: '/tmp/fm_recon_full.png', fullPage: true });
  console.log('\n=== 截图保存到 /tmp/fm_recon_full.png ===');

  // 保存 HTML
  const html = await page.content();
  writeFileSync('/tmp/fm_recon_rendered.html', html);
  console.log('=== 渲染后 HTML 保存到 /tmp/fm_recon_rendered.html ===');

  await browser.close();
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});