// Demo 数据生成：模拟 3 天抓取，让周/月榜立刻有效果展示
// 注意：这是模拟数据，用于演示 UI/聚合效果，不是真实抓取
// 真实数据由 GitHub Actions cron 每天跑一次累积

import { readFile, writeFile, mkdir } from 'node:fs/promises';

const ROOT = '/Users/linweiheng/.openclaw/workspace/projects/tiktokshop-trend';
const REAL_DATE = '2026-08-12';
const DEMO_DATES = ['2026-08-10', '2026-08-11', REAL_DATE]; // 3 天
const REGIONS = ['US', 'SG', 'MY', 'PH', 'ID', 'TH', 'VN'];
const RANKS = [
  { page: 1, suffix: 'daily' },
  { page: 2, suffix: 'total' },
];

// 用真实数据 + 扰动生成 demo 数据
async function readReal(region, suffix) {
  const f = `${ROOT}/data/${REAL_DATE}/${region}_${suffix}.json`;
  return JSON.parse(await readFile(f, 'utf8'));
}

// 扰动：每个产品的销量按日期偏移有不同变化
function perturb(products, dateIdx) {
  return products.map((p, i) => {
    const seed = (dateIdx + 1) * 13 + i * 7;
    const factor = 0.7 + ((seed * 9301 + 49297) % 1000) / 1000 * 0.6; // 0.7-1.3 随机
    const newSold = Math.round(p.sold_count * factor);
    const oldSold = Math.round(newSold * (0.7 + ((seed * 1103 + 7919) % 1000) / 1000 * 0.5));
    const growth = ((newSold - oldSold) / Math.max(oldSold, 1) * 100).toFixed(2) + '%';
    return {
      ...p,
      sold_count: newSold,
      yd_sold_count: oldSold,
      sold_count_show: newSold >= 1000 ? (newSold / 1000).toFixed(1) + 'k' : String(newSold),
      sale_amount: Math.round(p.sale_amount * factor),
      yd_sale_amount: Math.round(p.sale_amount * factor * 0.8),
      sale_amount_show: '$' + (p.sale_amount * factor >= 1000 ? (p.sale_amount * factor / 1000).toFixed(1) + 'k' : Math.round(p.sale_amount * factor)),
      sold_count_inc_rate: growth,
      sold_count_inc_rate_show: (growth.startsWith('-') ? growth : '+' + growth),
    };
  });
}

async function main() {
  console.log('=== 生成 demo 数据 (3 天) ===');
  for (let d = 0; d < DEMO_DATES.length; d++) {
    const date = DEMO_DATES[d];
    const outDir = `${ROOT}/data/${date}`;
    await mkdir(outDir, { recursive: true });
    for (const region of REGIONS) {
      for (const rank of RANKS) {
        const real = await readReal(region, rank.suffix);
        const perturbed = perturb(real.rank_list, d);
        const payload = {
          region,
          page: real.page,
          rank_type: rank.suffix,
          fetched_at: new Date().toISOString(),
          source_update_at: real.source_update_at,
          total_count: real.total_count,
          rank_list: perturbed,
          _demo: 'simulated for 3-day aggregate demo',
        };
        await writeFile(`${outDir}/${region}_${rank.suffix}.json`, JSON.stringify(payload, null, 2));
      }
    }
    console.log(`✓ ${date}: 14 JSONs`);
  }

  // 同时把 demo 数据复制到 latest/，让前端立刻显示
  const latestDir = `${ROOT}/data/latest`;
  await mkdir(latestDir, { recursive: true });
  for (const region of REGIONS) {
    for (const rank of RANKS) {
      const src = `${ROOT}/data/${REAL_DATE}/${region}_${rank.suffix}.json`;
      const dst = `${latestDir}/${region}_${rank.suffix}.json`;
      await writeFile(dst, await readFile(src, 'utf8'));
    }
  }
  await writeFile(`${latestDir}/_meta.json`, JSON.stringify({
    date: REAL_DATE,
    fetched_at: new Date().toISOString(),
    regions: REGIONS,
    note: 'demo data for 3-day aggregate preview',
  }, null, 2));
  console.log(`✓ Synced to latest/`);

  // Manifest
  await writeFile(`${ROOT}/data/_latest.json`, JSON.stringify({
    date: REAL_DATE, fetched_at: new Date().toISOString(), dir: REAL_DATE,
  }, null, 2));
}

main().catch(err => { console.error(err); process.exit(1); });