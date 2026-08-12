// 截图脚本：生成 4 张展示页面的 PNG
// 用法：node 03_screenshot.mjs
// 前置：本地 http server 跑在 8765 端口

import { chromium } from 'playwright';
import { execSync } from 'node:child_process';

const URL = 'http://localhost:8765/';

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();
page.setDefaultTimeout(30000);

// Block external image fetches to keep screenshot fast (we use placeholders)
await page.route('**/*.{png,jpg,jpeg,webp,gif,svg}', route => {
  const url = route.request().url();
  if (url.includes('localhost') || url.startsWith('data:')) {
    return route.continue();
  }
  return route.abort();
});

console.log('===截图 4 张===');

await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);

// Screenshot 1: US 每日销量榜 (默认状态)
await page.screenshot({ path: '/tmp/snap_us_daily.png', fullPage: true });
console.log('✓ /tmp/snap_us_daily.png');

// Screenshot 2: VN 每月增长率榜
await page.click('.region-tab[data-region="VN"]');
await page.waitForTimeout(1500);
await page.click('#periodTabs .tab[data-period="monthly"]');
await page.waitForTimeout(1500);
await page.click('#rankTabs .tab[data-rank="growth_top"]');
await page.waitForTimeout(2500);
await page.screenshot({ path: '/tmp/snap_vn_monthly_growth.png', fullPage: true });
console.log('✓ /tmp/snap_vn_monthly_growth.png');

// Screenshot 3: TH 每周累计榜
await page.click('.region-tab[data-region="TH"]');
await page.waitForTimeout(1500);
await page.click('#periodTabs .tab[data-period="weekly"]');
await page.waitForTimeout(1500);
await page.click('#rankTabs .tab[data-rank="total_top"]');
await page.waitForTimeout(2500);
await page.screenshot({ path: '/tmp/snap_th_weekly_total.png', fullPage: true });
console.log('✓ /tmp/snap_th_weekly_total.png');

// Screenshot 4: ID 每日累计
await page.click('.region-tab[data-region="ID"]');
await page.waitForTimeout(1500);
await page.click('#periodTabs .tab[data-period="daily"]');
await page.waitForTimeout(1500);
await page.click('#rankTabs .tab[data-rank="total_top"]');
await page.waitForTimeout(2500);
await page.screenshot({ path: '/tmp/snap_id_daily_total.png', fullPage: true });
console.log('✓ /tmp/snap_id_daily_total.png');

await browser.close();
console.log('===完成===');