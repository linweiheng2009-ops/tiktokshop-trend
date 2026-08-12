// 拉实时汇率，写 data/fx.json
// 数据源：Frankfurter API (https://frankfurter.dev/)
// VND 不在 API 里，用近似硬编码 25000

import { writeFile, mkdir } from 'node:fs/promises';

const ROOT = '/Users/linweiheng/.openclaw/workspace/projects/tiktokshop-trend';
const OUT = `${ROOT}/data/fx.json`;

// Frankfurter 不支持 VND，硬编码（最近 6 个月波动 23000-26000）
const VND_PER_USD = 25000;

async function main() {
  console.log('=== 拉实时汇率 ===');
  const url = 'https://api.frankfurter.dev/v1/latest?base=USD&symbols=CNY,SGD,MYR,PHP,IDR,THB';
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`FX API error: ${resp.status}`);
  const data = await resp.json();

  // 把 USD 作为基准（1 USD = X local currency）
  // 加上 VND
  const rates = {
    ...data.rates,
    VND: VND_PER_USD,
  };

  // 也算 CNY = 1 unit local (前端用 amount × rate)
  // CNY per unit local = 6.7432 / rates.X
  const toCNY = {};
  for (const [code, rate] of Object.entries(rates)) {
    if (code === 'CNY') toCNY[code] = 1;
    else toCNY[code] = +(data.rates.CNY / rate).toFixed(6);
  }

  const fx = {
    fetched_at: new Date().toISOString(),
    source_date: data.date,
    base: 'USD',
    rates,           // 1 USD = X local
    to_cny: toCNY,   // 1 local = X CNY
    note: 'Rates from Frankfurter (no VND, hardcoded 25000)',
  };

  await mkdir(`${ROOT}/data`, { recursive: true });
  await writeFile(OUT, JSON.stringify(fx, null, 2));
  console.log(`✓ Wrote ${OUT}`);
  console.log(`  Date: ${data.date}`);
  console.log(`  1 USD = ${data.rates.CNY} CNY`);
  console.log(`  1 USD = ${VND_PER_USD} VND (hardcoded)`);
}

main().catch(e => { console.error(e); process.exit(1); });