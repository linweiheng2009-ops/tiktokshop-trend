// 聚合脚本：日/周/月 Top 聚合
// 输入：data/YYYY-MM-DD/{region}_daily.json, data/YYYY-MM-DD/{region}_total.json
// 输出：data/aggregated/{period}_{region}.json
//   period = daily | weekly | monthly
//   包含：date_range, top_products (去重 + 按 growth/sold 排序), summary stats

import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = '/Users/linweiheng/.openclaw/workspace/projects/tiktokshop-trend';
const DATA = `${ROOT}/data`;
const AGG = `${DATA}/aggregated`;

const REGIONS = ['US', 'SG', 'MY', 'PH', 'ID', 'TH', 'VN'];

// 周期定义（天）
const PERIODS = {
  daily: 1,
  weekly: 7,
  monthly: 30,
};

async function listDates() {
  const entries = await readdir(DATA, { withFileTypes: true });
  return entries
    .filter(e => e.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(e.name))
    .map(e => e.name)
    .sort()
    .reverse(); // 最新在前
}

async function loadRegionDates(region, dates, kind = 'daily') {
  const rows = [];
  for (const date of dates) {
    const f = `${DATA}/${date}/${region}_${kind}.json`;
    try {
      const j = JSON.parse(await readFile(f, 'utf8'));
      for (const p of j.rank_list) rows.push({ ...p, _date: date });
    } catch {}
  }
  return rows;
}

// 聚合：按 product_id 去重，跨天求和 sold/sale_amount，按总销量排
function aggregateByProduct(rows) {
  const map = new Map();
  for (const r of rows) {
    const id = r.product_id;
    if (!map.has(id)) {
      map.set(id, {
        product_id: id,
        title: r.title,
        cover: r.cover,
        detail_url: r.detail_url,
        region: r.region,
        currency: r.currency,
        real_price: r.real_price,
        category_name: r.category_name,
        shop_name: r.shop_info?.name,
        shop_sold_count: r.shop_info?.sold_count,
        aweme_count: r.aweme_count,
        live_count: r.live_count,
        author_count: r.author_count,
        launch_time: r.launch_time,
        _first_seen: r._date,
        _last_seen: r._date,
        _appearances: 0,
        _total_sold: 0,
        _total_sale: 0,
        _growth_sum: 0,
        _growth_count: 0,
        _trend: [], // [{date, sold, sale_amount}, ...]
      });
    }
    const e = map.get(id);
    e._appearances++;
    e._total_sold += r.sold_count || 0;
    e._total_sale += r.sale_amount || 0;
    if (r._date < e._first_seen) e._first_seen = r._date;
    if (r._date > e._last_seen) e._last_seen = r._date;
    if (r.sold_count_inc_rate) {
      e._growth_sum += parseFloat(String(r.sold_count_inc_rate).replace('%', '')) || 0;
      e._growth_count++;
    }
    e._trend.push({ date: r._date, sold: r.sold_count || 0, sale_amount: r.sale_amount || 0 });
  }
  return [...map.values()].map(e => {
    e._trend.sort((a, b) => a.date.localeCompare(b.date));
    return {
      ...e,
      // 顶层字段供前端直接使用（daily 用当日销量，total 用累计）
      sold_count: e._total_sold,
      sale_amount: e._total_sale,
      sold_count_inc_rate: e._avg_growth ? e._avg_growth.toFixed(2) + '%' : '0%',
      _avg_growth: e._growth_count ? +(e._growth_sum / e._growth_count).toFixed(2) : 0,
      _total_sold_show: humanNum(e._total_sold),
      _total_sale_show: '$' + humanNum(e._total_sale),
    };
  });
}

function humanNum(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k';
  return String(n);
}

async function main() {
  const allDates = await listDates();
  if (allDates.length === 0) {
    console.log('No data dates found, run 01_crawl.mjs first.');
    return;
  }
  await mkdir(AGG, { recursive: true });

  const today = allDates[0];
  const summary = {
    generated_at: new Date().toISOString(),
    available_dates: allDates.length,
    latest_date: today,
    periods: {},
  };

  for (const [period, days] of Object.entries(PERIODS)) {
    const useDates = allDates.slice(0, days).reverse(); // 升序
    summary.periods[period] = { days, dates_used: useDates.length, date_range: [useDates[0], useDates[useDates.length - 1]], dates: useDates };

    for (const region of REGIONS) {
      const dailyRows = await loadRegionDates(region, useDates, 'daily');
      const totalRows = await loadRegionDates(region, useDates, 'total');
      const agg = {
        period,
        region,
        generated_at: new Date().toISOString(),
        date_range: summary.periods[period].date_range,
        daily_count: dailyRows.length,
        total_count: totalRows.length,
        // Daily top: 按时段内总销量排
        daily_top: aggregateByProduct(dailyRows).sort((a, b) => b._total_sold - a._total_sold),
        // Total top: 累计销量（直接用最近一天的 total_rank 即可）
        total_top: aggregateByProduct(totalRows).sort((a, b) => b._total_sold - a._total_sold),
        // Growth top: 按时段内平均增长率排（只取 >=2 次出现的）
        growth_top: aggregateByProduct(dailyRows).filter(p => p._appearances >= 2).sort((a, b) => b._avg_growth - a._avg_growth),
      };
      const f = `${AGG}/${period}_${region}.json`;
      await writeFile(f, JSON.stringify(agg, null, 2));
      console.log(`✓ ${period} ${region}: daily_top=${agg.daily_top.length} total_top=${agg.total_top.length} growth_top=${agg.growth_top.length}`);
    }
  }

  // Summary file
  await writeFile(`${AGG}/_summary.json`, JSON.stringify(summary, null, 2));
  console.log(`\n✓ Aggregated data written to ${AGG}`);
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});