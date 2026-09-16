// scripts/sources/playwright-official.mjs
// 源 2:Playwright 抓 TikTok Shop 官方页
//
// 状态:占位(throw not-implemented)。后续侦察路线 B 可行性后再实现。
//
// 计划(待 playwright 侦察通过后填):
// 1. 用 chromium 打开 https://www.tiktok.com/shop/s/{region} 排行页
// 2. 等 client-side 渲染(等到 product card DOM 出现)
// 3. extract product_id / title / sold_count / price / cover
// 4. 翻页或滚动加载更多
// 5. 注意 CF puzzle 验证码 — 可能需要 2captcha / scraperapi fallback
//
// GitHub Actions 集成:workflow 需要先 npx playwright install chromium,
// 容器 cold start +30s,每次 cron 启动慢但可接受

import { SourceAdapter } from './_base.mjs'

export class PlaywrightOfficialSource extends SourceAdapter {
  constructor() {
    super()
    this.name = 'playwright-official'
    this.enabled = false  // 默认禁用,实现后改为 true
  }

  async fetchRank(region, page) {
    throw new Error('not-implemented: Playwright source requires route-B recon pass first (see scripts/00_recon.mjs)')
  }
}
