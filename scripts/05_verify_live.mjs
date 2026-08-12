// 验证线上 URL 是否真的能拉到数据
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });

// 拦截外部图片
await page.route('**/*.{png,jpg,jpeg,webp,gif,svg}', route => {
  const url = route.request().url();
  if (url.includes('localhost') || url.startsWith('data:')) return route.continue();
  return route.abort();
});

console.log('===访问线上 URL===');
await page.goto('https://linweiheng2009-ops.github.io/tiktokshop-trend/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(5000);

// 截图：默认状态
await page.screenshot({ path: '/tmp/live_us_daily.png', fullPage: true });
console.log('✓ /tmp/live_us_daily.png');

// 切到 VN 每月增长率
await page.click('.region-tab[data-region="VN"]');
await page.waitForTimeout(1500);
await page.click('#periodTabs .tab[data-period="monthly"]');
await page.waitForTimeout(1500);
await page.click('#rankTabs .tab[data-rank="growth_top"]');
await page.waitForTimeout(2500);
await page.screenshot({ path: '/tmp/live_vn_monthly_growth.png', fullPage: true });
console.log('✓ /tmp/live_vn_monthly_growth.png');

// TH 每周累计
await page.click('.region-tab[data-region="TH"]');
await page.waitForTimeout(1500);
await page.click('#periodTabs .tab[data-period="weekly"]');
await page.waitForTimeout(1500);
await page.click('#rankTabs .tab[data-rank="total_top"]');
await page.waitForTimeout(2500);
await page.screenshot({ path: '/tmp/live_th_weekly_total.png', fullPage: true });
console.log('✓ /tmp/live_th_weekly_total.png');

// ID 每日累计
await page.click('.region-tab[data-region="ID"]');
await page.waitForTimeout(1500);
await page.click('#periodTabs .tab[data-period="daily"]');
await page.waitForTimeout(1500);
await page.click('#rankTabs .tab[data-rank="total_top"]');
await page.waitForTimeout(2500);
await page.screenshot({ path: '/tmp/live_id_daily_total.png', fullPage: true });
console.log('✓ /tmp/live_id_daily_total.png');

await browser.close();
console.log('===完成===');