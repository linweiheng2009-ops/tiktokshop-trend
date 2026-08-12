import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
page.on('response', r => {
  if (r.url().includes('linweiheng') || r.url().includes('echarts') || r.url().includes('jsdelivr')) {
    console.log('[resp]', r.status(), r.url().slice(0, 80));
  }
});
page.on('requestfailed', r => console.log('[fail]', r.url().slice(0, 80), r.failure()?.errorText));

await page.route('**/*.{png,jpg,jpeg,webp,gif,svg}', route => {
  const url = route.request().url();
  if (url.includes('github.io') || url.includes('localhost') || url.startsWith('data:')) return route.continue();
  return route.abort();
});

await page.goto('https://linweiheng2009-ops.github.io/tiktokshop-trend/?nocache=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(8000);

const r = await page.evaluate(() => ({
  stats: document.getElementById('statsRow').innerText,
  meta: document.getElementById('meta').innerText,
  echarts_loaded: typeof echarts !== 'undefined',
}));
console.log('===STATE===');
console.log(JSON.stringify(r, null, 2));
await browser.close();
