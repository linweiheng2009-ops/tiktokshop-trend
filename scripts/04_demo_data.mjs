// 生成多天 demo 数据（基于真实 product_id + 反推历史销量轨迹）
// 让前端立刻有"过去 N 天"的趋势效果
//
// 数据策略：
// - 保留 product_id, title, cover, detail_url, launch_time 等真实信息
// - 用 total_sold_count (累计) 反推历史每日 sold_count
// - 不同日期用不同扰动种子，让排名有起伏、增长率有正负
//
// 注意：这是 demo，README 明确标注 "X-Y 为基于真实数据的演示"

import { readFile, writeFile, mkdir } from 'node:fs/promises';

const ROOT = '/Users/linweiheng/.openclaw/workspace/projects/tiktokshop-trend';
const REAL_DATE = '2026-08-12';

// N 天窗口（昨天向前推 (N-1) 天 + 今天真实）
function getDateRange(days = 7) {
  const dates = [];
  const base = new Date(REAL_DATE + 'T00:00:00Z');
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(base);
    d.setUTCDate(base.getUTCDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

const REGIONS = ['US', 'SG', 'MY', 'PH', 'ID', 'TH', 'VN'];
const RANKS = [
  { page: 1, suffix: 'daily' },
  { page: 2, suffix: 'total' },
];

const DEMO_DAYS = parseInt(process.argv[2] || '7', 10);
const DEMO_DATES = getDateRange(DEMO_DAYS);

function seededRand(seed) {
  let x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

// 基于真实 daily 数据 + 反推历史轨迹
function buildHistory(realProducts, days, kind) {
  // 累计榜（page=2）有 total_sold_count，可以反推
  // 当日榜（page=1）没有历史信息，只能纯扰动
  if (kind === 'total') {
    // 假设过去 N 天累计 = 当前累计 - 这几天累加 delta
    return realProducts.map((p, i) => {
      const totalSold = p.total_sold_count || p.sold_count || 0;
      const history = [];
      let runningTotal = 0;
      for (let d = 0; d < days - 1; d++) {
        // 每天新增占总体的某个比例
        const seed = (d + 1) * 31 + i * 17;
        const dailySold = Math.round(totalSold * (0.005 + seededRand(seed) * 0.025));
        runningTotal += dailySold;
        const dailySale = Math.round((p.total_sale_amount || p.sale_amount || 0) * (0.005 + seededRand(seed + 999) * 0.025));
        history.push({
          date: DEMO_DATES[d],
          sold: dailySold,
          sale_amount: dailySale,
        });
      }
      // 最后一天（真实）
      history.push({
        date: DEMO_DATES[days - 1],
        sold: p.sold_count,
        sale_amount: p.sale_amount,
      });
      return history;
    });
  } else {
    // daily: 纯扰动
    return realProducts.map((p, i) => {
      const history = [];
      for (let d = 0; d < days; d++) {
        const seed = (d + 1) * 13 + i * 7;
        const factor = 0.7 + seededRand(seed) * 0.6;
        const sold = Math.round(p.sold_count * factor);
        const sale = Math.round(p.sale_amount * factor);
        history.push({ date: DEMO_DATES[d], sold, sale_amount: sale });
      }
      return history;
    });
  }
}

// 给历史销量添加 yd_sold_count / growth_rate 字段
function enrichWithGrowth(history, kind) {
  return history.map(dayList => {
    return dayList.map((d, idx) => {
      let ydSold = d.sold, growth = 0;
      if (idx > 0) {
        const prevSold = dayList[idx - 1].sold;
        ydSold = prevSold;
        growth = prevSold > 0 ? ((d.sold - prevSold) / prevSold * 100) : 0;
      }
      return {
        ...d,
        yd_sold_count: ydSold,
        yd_sale_amount: idx > 0 ? dayList[idx - 1].sale_amount : 0,
        sold_count_inc_rate: growth.toFixed(2) + '%',
      };
    });
  });
}

async function readReal(region, suffix) {
  const f = `${ROOT}/data/${REAL_DATE}/${region}_${suffix}.json`;
  return JSON.parse(await readFile(f, 'utf8'));
}

async function main() {
  console.log(`=== 生成 ${DEMO_DAYS} 天 demo 数据 ===`);
  console.log(`日期范围: ${DEMO_DATES[0]} → ${DEMO_DATES[DEMO_DATES.length - 1]}`);
  console.log(`(仅 ${REAL_DATE} 是真实抓取，${DEMO_DATES.length - 1} 天为基于真实数据的演示)\n`);

  for (const region of REGIONS) {
    for (const rank of RANKS) {
      const real = await readReal(region, rank.suffix);
      const histories = buildHistory(real.rank_list, DEMO_DAYS, rank.suffix);
      const enriched = enrichWithGrowth(histories, rank.suffix);

      for (let d = 0; d < DEMO_DATES.length; d++) {
        const date = DEMO_DATES[d];
        const outDir = `${ROOT}/data/${date}`;
        await mkdir(outDir, { recursive: true });

        // 把当日数据按 rank_list 结构组装
        const dailyData = enriched.map((hist, i) => {
          const dayRow = hist[d];
          return {
            ...real.rank_list[i],
            sold_count: dayRow.sold,
            yd_sold_count: dayRow.yd_sold_count,
            sale_amount: dayRow.sale_amount,
            yd_sale_amount: dayRow.yd_sale_amount,
            sold_count_inc_rate: dayRow.sold_count_inc_rate,
            sold_count_show: dayRow.sold >= 1000 ? (dayRow.sold / 1000).toFixed(1) + 'k' : String(dayRow.sold),
            sale_amount_show: '$' + (dayRow.sale_amount >= 1000 ? (dayRow.sale_amount / 1000).toFixed(1) + 'k' : Math.round(dayRow.sale_amount)),
          };
        });

        const payload = {
          region,
          page: real.page,
          rank_type: rank.suffix,
          fetched_at: new Date(date + 'T08:00:00Z').toISOString(),
          source_update_at: real.source_update_at,
          total_count: real.total_count,
          rank_list: dailyData,
          _demo: date === REAL_DATE ? 'real fetch 2026-08-12' : `demo ${date} (rebuilt from real product_ids)`,
        };
        await writeFile(`${outDir}/${region}_${rank.suffix}.json`, JSON.stringify(payload, null, 2));
      }
      console.log(`✓ ${region} ${rank.suffix}: ${DEMO_DAYS} 天`);
    }
  }

  // 同步 today 到 latest/
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
    note: `${DEMO_DAYS}-day demo data for full UI preview`,
  }, null, 2));
  console.log(`\n✓ Synced today to latest/`);
}

main().catch(err => { console.error(err); process.exit(1); });