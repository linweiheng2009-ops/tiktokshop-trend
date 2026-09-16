// scripts/sources/public-api.mjs
// 源 1:第三方公开 API(原路线 A,挂在 9-07)
// 端点见 BASE 常量;返回 schema 见 RawRankItem

import { SourceAdapter } from './_base.mjs'

const BASE = 'https://www.fastmoss.com/api/goods/saleRank'
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

export class PublicApiSource extends SourceAdapter {
  constructor() {
    super()
    this.name = 'public-api'
    this.enabled = true
  }

  async fetchRank(region, page, order = '1,2') {
    const url = `${BASE}?page=${page}&pagesize=10&order=${order}&region=${region}`
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
    })
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const json = await resp.json()
    if (!json.data?.rank_list || json.data.rank_list.length === 0) {
      throw new Error(`API code=${json.code} msg=${(json.msg || '').slice(0, 80)} - empty rank_list`)
    }
    return {
      rank_list: json.data.rank_list,
      total_count: json.data.total_count,
      source_update_at: json.data.update_at,
      _auth_warning: json.code !== 200 ? json.msg : null,
    }
  }
}
