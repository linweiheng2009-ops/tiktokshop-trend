// 01_crawl.mjs · 多源抓取 orchestrator
//
// 并行抓取所有 enabled source,合并同 region/rank 结果,写数据 + manifest + latest/
//
// Source adapter 列表(优先级 = 数组顺序):
//   1. public-api · 第三方公开 API(原路线 A,挂在 9-07,恢复即用)
//   2. playwright-official · Playwright 抓 TikTok 官方页(占位,实现后启用)
//
// 合并策略:见 scripts/sources/_base.mjs mergeRanks()
//   - 主源(数组第一个 enabled 且成功)产品全保留
//   - 辅源按 product_id 补缺
//   - 全部失败时,保留 graceful 行为(写 error 标记 + 删空 outDir)
//
// 输出: data/YYYY-MM-DD/{region}_{daily|total}.json + _manifest.json
//      data/latest/ 镜像 + _meta.json

import { writeFile, mkdir, access, readFile, rm } from 'node:fs/promises'
import { PublicApiSource } from './sources/public-api.mjs'
import { PlaywrightOfficialSource } from './sources/playwright-official.mjs'
import { mergeRanks } from './sources/_base.mjs'

const ROOT = process.cwd()

const REGIONS = ['US', 'SG', 'MY', 'PH', 'ID', 'TH', 'VN']
const PAGES = [
  { page: 1, suffix: 'daily', label: 'Daily (today)' },
  { page: 2, suffix: 'total', label: 'Total (cumulative)' },
]

// 源优先级(数组顺序):前面的 = 主源
const SOURCES = [
  new PublicApiSource(),
  new PlaywrightOfficialSource(),
]

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

async function runSources(region, page) {
  // 并行抓所有 enabled source,任一失败不阻塞其它
  const runs = await Promise.all(SOURCES.map(async (src) => {
    if (!src.enabled) return { name: src.name, enabled: false }
    try {
      const result = await src.fetchRank(region, page)
      return { name: src.name, enabled: true, result }
    } catch (err) {
      return { name: src.name, enabled: true, error: err }
    }
  }))
  return runs
}

async function main() {
  const date = todayStr()
  const outDir = `${ROOT}/data/${date}`
  await mkdir(outDir, { recursive: true })

  const manifest = {
    date,
    fetched_at: new Date().toISOString(),
    sources: SOURCES.filter(s => s.enabled).map(s => s.name),
    regions: REGIONS,
    pages: PAGES.map(p => p.suffix),
    files: [],
  }

  let totalSynced = 0
  let totalExtras = 0

  for (const region of REGIONS) {
    for (const p of PAGES) {
      const fname = `${region}_${p.suffix}.json`
      const fpath = `${outDir}/${fname}`

      // 跳过未启用的源 log
      const sourceRuns = await runSources(region, p.page)
      const enabledCount = sourceRuns.filter(r => r.enabled).length
      const skipped = sourceRuns.filter(r => !r.enabled).map(r => r.name)
      if (skipped.length > 0) {
        console.log(`  (skipped sources: ${skipped.join(', ')})`)
      }

      try {
        const merged = mergeRanks(sourceRuns)

        // 标记主源 + 辅源补缺统计
        const extrasCount = merged.extras?.length ?? 0
        const extrasNote = extrasCount > 0 ? ` (${extrasCount} extra from fallback)` : ''

        const payload = {
          region,
          page: p.page,
          rank_type: p.suffix,
          fetched_at: new Date().toISOString(),
          source_update_at: merged.primary_source_update_at,
          total_count: merged.total_count,
          sources_used: merged.sources_used,
          rank_list: merged.rank_list,
        }
        await writeFile(fpath, JSON.stringify(payload, null, 2))
        manifest.files.push({
          region,
          rank_type: p.suffix,
          count: merged.rank_list.length,
          sources: merged.sources_used,
          extras: extrasCount,
        })
        totalSynced += merged.rank_list.length
        totalExtras += extrasCount
        console.log(`✓ ${region} ${p.suffix} → ${merged.rank_list.length} items (${merged.sources_used.join('+')})${extrasNote}`)

        // 各 source 单独 log 状态
        for (const r of sourceRuns.filter(r => r.enabled)) {
          if (r.error) console.log(`  ✗ ${r.name}: ${r.error.message}`)
          else if (r.result) console.log(`  ✓ ${r.name}: ${r.result.rank_list.length} items`)
        }
      } catch (err) {
        console.error(`✗ ${region} ${p.suffix}: ${err.message}`)
        manifest.files.push({
          region,
          rank_type: p.suffix,
          error: err.message,
          source_errors: sourceRuns.filter(r => r.error).map(r => ({ name: r.name, msg: r.error.message })),
        })
      }

      // Be nice to upstream
      await new Promise(r => setTimeout(r, 800))
    }
  }

  // Manifest
  await writeFile(`${outDir}/_manifest.json`, JSON.stringify(manifest, null, 2))
  console.log(`\n✓ Wrote manifest: ${outDir}/_manifest.json (${totalSynced} items, ${totalExtras} extras from fallback)`)

  // Latest pointer
  await writeFile(
    `${ROOT}/data/_latest.json`,
    JSON.stringify({ date, fetched_at: manifest.fetched_at, dir: date }, null, 2),
  )
  console.log(`✓ Updated _latest.json pointer`)

  // Sync to data/latest/
  const latestDir = `${ROOT}/data/latest`
  await mkdir(latestDir, { recursive: true })
  let synced = 0
  for (const region of REGIONS) {
    for (const p of PAGES) {
      const fname = `${region}_${p.suffix}.json`
      const srcPath = `${outDir}/${fname}`
      try {
        await access(srcPath)
      } catch {
        console.warn(`⊘ Skip ${fname} (not in this snapshot)`)
        continue
      }
      const text = await readFile(srcPath, 'utf8')
      await writeFile(`${latestDir}/${fname}`, JSON.stringify(JSON.parse(text), null, 2))
      synced++
    }
  }
  console.log(`✓ Synced ${synced}/${REGIONS.length * PAGES.length} files to latest/`)

  // 合并 _meta.json (前端用):含 sources 字段,提示数据源情况
  await writeFile(`${latestDir}/_meta.json`, JSON.stringify({
    date,
    fetched_at: manifest.fetched_at,
    regions: REGIONS,
    sources: manifest.sources,
  }, null, 2))
  console.log(`✓ Synced latest/ for static page`)

  // 全部失败 graceful:error 标记 + 清空 outDir
  if (synced === 0) {
    console.warn(`⚠ No files synced — all sources failed. _latest.json marked as error; latest/ keeps previous snapshot.`)
    await writeFile(`${ROOT}/data/_latest.json`, JSON.stringify({
      date: null,
      fetched_at: manifest.fetched_at,
      regions: REGIONS,
      error: 'all sources failed (no data fetched)',
    }, null, 2))
    await rm(outDir, { recursive: true, force: true })
  }
}

main().catch(err => {
  console.error('FATAL:', err)
  process.exit(1)
})
