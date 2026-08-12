// 截图脚本：把页面渲染后的样子截下来给恒哥看
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const BASE = 'http://localhost:8765';

async function main() {
  const browser = await chromium.launch({
    headless: true,
    channel: 'chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'zh-CN',
  });
  const page = await ctx.newPage();

  // Screenshot 1: 默认首页 (US daily)
  await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: '/tmp/snap_us_daily.png', fullPage: true });
  console.log('✓ /tmp/snap_us_daily.png');

  // Screenshot 2: 切到 VN (越南) + 月度 + 增长率榜
  await page.click('.region-tab[data-region="VN"]');
  await page.waitForTimeout(1500);
  await page.waitForFunction(() => {
    const m = document.getElementById('meta');
    return m && m.textContent.includes('天快照');
  }, { timeout: 10000 });
  await page.click('#periodTabs .tab[data-period="monthly"]');
  await page.waitForTimeout(1500);
  await page.waitForFunction(() => {
    const m = document.getElementById('meta');
    return m && m.textContent.includes('2026-08-10');
  }, { timeout: 10000 });
  await page.click('#rankTabs .tab[data-rank="growth_top"]');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: '/tmp/snap_vn_monthly_growth.png', fullPage: true });
  console.log('✓ /tmp/snap_vn_monthly_growth.png');

  // Screenshot 3: TH 每周累计榜
  await page.click('.region-tab[data-region="TH"]');
  await page.waitForTimeout(1500);
  await page.click('#periodTabs .tab[data-period="weekly"]');
  await page.waitForTimeout(1500);
  await page.click('#rankTabs .tab[data-rank="total_top"]');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: '/tmp/snap_th_weekly_total.png', fullPage: true });
  console.log('✓ /tmp/snap_th_weekly_total.png');

  // Screenshot 4: ID 每日累计
  await page.click('.region-tab[data-region="ID"]');
  await page.waitForTimeout(1500);
  await page.click('#periodTabs .tab[data-period="daily"]');
  await page.waitForTimeout(1500);
  await page.click('#rankTabs .tab[data-rank="total_top"]');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: '/tmp/snap_id_daily_total.png', fullPage: true });
  console.log('✓ /tmp/snap_id_daily_total.png');

  await browser.close();
}

main().catch(err => { console.error(err); process.exit(1); });