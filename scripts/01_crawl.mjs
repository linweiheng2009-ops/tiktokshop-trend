// 路线 B 抓取脚本
// 数据源: FastMoss 公开 API（不要钱 / 不要代理 / 不要登录）
// 端点: https://www.fastmoss.com/api/goods/saleRank
// 参数: page=1(当日榜) / page=2(累计榜), pagesize=10, region=US|SG|MY|PH|ID|TH|VN
//
// 输出: data/YYYY-MM-DD/{region}.json
//   - {region}_daily.json   当日实时榜（按当日销量排）
//   - {region}_total.json   累计销量榜（按累计销量排）

import { writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

// ROOT: 本地 Mac 跑 → /Users/.../tiktokshop-trend；GitHub Actions 容器跑 → /home/runner/work/...
// 统一用 process.cwd()（两者 cwd 都是 repo 根），不再硬编码 Mac 绝对路径
const ROOT = process.cwd();

const REGIONS = ['US', 'SG', 'MY', 'PH', 'ID', 'TH', 'VN'];
const PAGES = [
  { page: 1, suffix: 'daily', label: 'Daily (today)' },
  { page: 2, suffix: 'total', label: 'Total (cumulative)' },
];
const BASE = 'https://www.fastmoss.com/api/goods/saleRank';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function todayStr() {
  const d = new Date();
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

async function fetchRank(region, page, order = '1,2') {
  const url = `${BASE}?page=${page}&pagesize=10&order=${order}&region=${region}`;
  const resp = await fetch(url, {
    headers: {
      'User-Agent': UA,
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://www.fastmoss.com/e-commerce/saleslist',
      'Origin': 'https://www.fastmoss.com',
      'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"macOS"',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-origin',
    },
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${region} page=${page}`);
  const json = await resp.json();
  // fastmoss 在某些情况下返回 MAG_AUTH_3004 但 data.rank_list 仍然填充
  // 我们接受这种情况，只在 rank_list 为空时报错
  if (!json.data?.rank_list || json.data.rank_list.length === 0) {
    throw new Error(`API code=${json.code} msg=${json.msg?.slice(0, 80)} - empty rank_list`);
  }
  return { ...json.data, _auth_warning: json.code !== 200 ? json.msg : null };
}

async function exists(p) {
  try { await access(p); return true; } catch { return false; }
}

async function main() {
  const date = todayStr();
  const outDir = `${ROOT}/data/${date}`;
  await mkdir(outDir, { recursive: true });

  const manifest = {
    date,
    fetched_at: new Date().toISOString(),
    source: 'fastmoss.com/api/goods/saleRank',
    regions: REGIONS,
    pages: PAGES.map(p => p.suffix),
    files: [],
  };

  for (const region of REGIONS) {
    for (const p of PAGES) {
      const fname = `${region}_${p.suffix}.json`;
      const fpath = `${outDir}/${fname}`;
      try {
        const data = await fetchRank(region, p.page);
        const payload = {
          region,
          page: p.page,
          rank_type: p.suffix,
          fetched_at: new Date().toISOString(),
          source_update_at: data.update_at,
          total_count: data.total_count,
          rank_list: data.rank_list,
        };
        await writeFile(fpath, JSON.stringify(payload, null, 2));
        manifest.files.push({ region, rank_type: p.suffix, count: data.rank_list.length });
        console.log(`✓ ${region} ${p.suffix} → ${data.rank_list.length} items`);
      } catch (err) {
        console.error(`✗ ${region} ${p.suffix}: ${err.message}`);
        manifest.files.push({ region, rank_type: p.suffix, error: err.message });
      }
      // Be nice to FastMoss
      await new Promise(r => setTimeout(r, 800));
    }
  }

  // Manifest file
  await writeFile(`${outDir}/_manifest.json`, JSON.stringify(manifest, null, 2));
  console.log(`\n✓ Wrote manifest: ${outDir}/_manifest.json`);

  // Latest pointer (always point to most recent fetch)
  await writeFile(
    `${ROOT}/data/_latest.json`,
    JSON.stringify({ date, fetched_at: manifest.fetched_at, dir: date }, null, 2),
  );
  console.log(`✓ Updated _latest.json pointer`);

  // Copy latest to data/latest/ for static page (predictable path)
  const latestDir = `${ROOT}/data/latest`;
  await mkdir(latestDir, { recursive: true });
  for (const region of REGIONS) {
    for (const p of PAGES) {
      const fname = `${region}_${p.suffix}.json`;
      await writeFile(`${latestDir}/${fname}`,
        JSON.stringify(JSON.parse(await (await import('node:fs/promises')).readFile(`${outDir}/${fname}`, 'utf8')), null, 2));
    }
  }
  await writeFile(`${latestDir}/_meta.json`, JSON.stringify({
    date, fetched_at: manifest.fetched_at, regions: REGIONS,
  }, null, 2));
  console.log(`✓ Synced latest/ for static page`);
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});