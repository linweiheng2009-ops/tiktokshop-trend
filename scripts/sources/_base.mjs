// scripts/sources/_base.mjs
// 数据源 adapter 公共契约

/**
 * @typedef {Object} RawRankItem
 * @property {string|number} product_id  // 用于跨源去重
 * @property {string} title
 * @property {number} [sold_count]
 * @property {number} [sale_amount]
 * @property {string} [currency]
 * @property {number} [real_price]
 * @property {string} [all_category_name]
 * @property {string} [category_name]
 * @property {string} [cover]
 * @property {string} [detail_url]
 * @property {Object} [shop_info]
 * @property {string} [_source]  // 由 adapter 注入:'public-api' | 'playwright-official'
 */

/**
 * @typedef {Object} FetchResult
 * @property {RawRankItem[]} rank_list
 * @property {number} [total_count]
 * @property {string} [source_update_at]  // 上游数据本身的更新时间
 * @property {string|null} [_auth_warning]
 */

/**
 * 数据源 adapter 抽象类
 *
 * 子类必须实现:
 * - name: string  (e.g. 'public-api')
 * - enabled: boolean  (默认 true;占位 adapter 设为 false)
 * - async fetchRank(region, page) → FetchResult
 */
export class SourceAdapter {
  constructor() {
    this.name = 'base'
    this.enabled = true
  }

  /**
   * @param {string} region - US/SG/MY/PH/ID/TH/VN
   * @param {number} page - 1=daily, 2=total
   * @returns {Promise<FetchResult>}
   */
  async fetchRank(region, page) {
    throw new Error(`${this.name}: fetchRank() not implemented`)
  }
}

/**
 * 合并多个源同 region/page 的结果
 *
 * 策略:
 * - 主源(数组第一个 enabled)产品全保留
 * - 辅源按 product_id 补缺,加 _extra_sources 字段标记
 * - 主源完全失败时,辅源整体接管
 *
 * @param {Array<{name: string, enabled: boolean, result?: FetchResult, error?: Error}>} sourceRuns
 * @returns {{ rank_list: RawRankItem[], sources_used: string[], total_count: number|null, _auth_warning: string|null }}
 */
export function mergeRanks(sourceRuns) {
  const enabledRuns = sourceRuns.filter(r => r.enabled)
  const successful = enabledRuns.filter(r => r.result && r.result.rank_list?.length > 0)

  if (successful.length === 0) {
    // 所有源都失败,抛错让 orchestrator 写 error manifest
    const errs = enabledRuns.map(r => `${r.name}: ${r.error?.message || 'empty'}`).join('; ')
    throw new Error(`all sources failed: ${errs}`)
  }

  // 主源 = 第一个成功的
  const primary = successful[0]
  const seen = new Set()
  const merged = []

  // 先放主源
  for (const item of primary.result.rank_list) {
    const pid = String(item.product_id)
    if (seen.has(pid)) continue
    seen.add(pid)
    merged.push({ ...item, _source: primary.name })
  }

  // 辅源补缺
  const extraSources = []
  for (const run of successful.slice(1)) {
    let added = 0
    for (const item of run.result.rank_list) {
      const pid = String(item.product_id)
      if (seen.has(pid)) continue
      seen.add(pid)
      merged.push({ ...item, _source: run.name, _extra: true })
      added++
    }
    if (added > 0) extraSources.push(`${run.name}+${added}`)
  }

  return {
    rank_list: merged,
    sources_used: [primary.name, ...successful.slice(1).map(r => r.name)],
    extras: extraSources,
    total_count: primary.result.total_count ?? merged.length,
    _auth_warning: primary.result._auth_warning ?? null,
    primary_source_update_at: primary.result.source_update_at ?? null,
  }
}
