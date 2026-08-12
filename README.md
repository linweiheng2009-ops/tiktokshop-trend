# TikTok Shop 趋势榜

[![Live](https://img.shields.io/badge/🌐_主入口-shop.laowe.club-ff2d7a?style=for-the-badge)](https://shop.laowe.club/)
[![Cloudflare](https://img.shields.io/badge/Cloudflare-Workers_F5C242?style=for-the-badge&logo=cloudflare&logoColor=white)](https://tiktokshop-trend.linweiheng2009.workers.dev)
[![GitHub Pages](https://img.shields.io/badge/GitHub_Pages-Mirror-181717?style=for-the-badge&logo=github&logoColor=white)](https://linweiheng2009-ops.github.io/tiktokshop-trend/)
[![License](https://img.shields.io/badge/license-仅供学习-blue?style=for-the-badge)](#license)

> 基于 FastMoss 公开榜的 **TikTok Shop 每日 / 每周 / 每月趋势榜** —— 反映曝光/GMV 估算，适合看 **趋势**，不适合看 **绝对销量**。

> 🌐 **主入口**：https://shop.laowe.club/ （Cloudflare Workers · 全球 CDN · HTTPS 自动签）
> 备份入口：https://tiktokshop-trend.linweiheng2009.workers.dev
> GitHub Pages：https://linweiheng2009-ops.github.io/tiktokshop-trend/（仅作 mirror）

## 数据源

- **FastMoss 公开 API**：`https://www.fastmoss.com/api/goods/saleRank`
- **参数**：`page=1` (当日榜) / `page=2` (累计榜), `region=US|SG|MY|PH|ID|TH|VN`
- **国家**：7 国（美国 + 东南亚 6 国）
- **成本**：**$0**（不要代理 / 不要登录 / 不要付费 API）

## 数据定位

公开榜的 "销量" 是 **曝光/GMV 估算**，不是真实销量。所以：

✅ **适合**：看哪些 SKU 在涨、哪些区域在变、新品冲榜速度  
❌ **不适合**：把 "今日 9.7k" 当真实销量做投资/采购决策

## 项目结构

```
tiktokshop-trend/
├── index.html              # 静态页面（深色主题，tab 切换）
├── package.json
├── .github/workflows/
│   └── daily.yml           # GitHub Actions cron（每天 UTC 0 点跑）
├── scripts/
│   ├── 01_crawl.mjs        # 抓取 7 国 × 2 榜单 = 14 JSON
│   ├── 02_aggregate.mjs    # 聚合日/周/月 = 21 JSON
│   ├── 03_screenshot.mjs   # Playwright 截图
│   └── 04_demo_data.mjs    # 3 天 demo 数据（演示周/月效果）
└── data/
    ├── YYYY-MM-DD/         # 每日原始抓取
    ├── latest/             # 同步最新（前端 fetch 用）
    └── aggregated/         # 日/周/月聚合
```

## 本地运行

```bash
# 安装依赖
npm install

# 抓数据
npm run crawl

# 聚合
npm run aggregate

# 启动静态服务（localhost:8765）
npm run serve

# 截图预览
npm run screenshot
```

## 部署

### GitHub Pages（推荐）

1. Push 到 GitHub repo
2. Settings → Pages → Source 选 `main` 分支根目录
3. 访问 `https://<user>.github.io/tiktokshop-trend/`

### Cloudflare Pages

1. 连接 GitHub repo
2. Build command 留空
3. Build output 选根目录 `/`
4. 自定义域名直接绑

## Cron 自动抓取

`.github/workflows/daily.yml` 配置：

- **每天 UTC 00:00 / SGT 08:00** 自动跑
- 抓 7 国 × 2 榜单 → 聚合 → commit + push JSON

需要：

1. 创建 GitHub repo
2. Push 代码
3. 启用 Actions（默认开启）
4. 等明天 8 点 SGT 自动跑

## 数据展示

页面支持：

- **时间维度**：每日 / 每周 / 每月 tab
- **榜单类型**：销量榜 / 累计榜 / 增长率榜
- **区域切换**：🇺🇸 美 / 🇸🇬 新 / 🇲🇾 马 / 🇵🇭 菲 / 🇮🇩 印 / 🇹🇭 泰 / 🇻🇳 越

## 当前状态

- ✅ 抓取脚本 + 聚合脚本 + 静态页面
- ✅ 部署上线：https://linweiheng2009-ops.github.io/tiktokshop-trend/
- ✅ 10 天数据预览（9 天 demo + 1 天真实）
- ⏳ 等 GitHub Actions cron 跑出 8/13 真实数据
- ⏳ 真实数据累积 7 天后 → 周榜完全真实
- ⏳ 真实数据累积 30 天后 → 月榜完全真实

## 数据来源说明（重要）

| 日期 | 类型 | 说明 |
|------|------|------|
| 2026-08-12 | ✅ 真实抓取 | FastMoss 公开 API 实际响应 |
| 2026-08-03 ~ 2026-08-11 | ⚠️ 演示数据 | 基于 8/12 真实数据 + 趋势扰动生成的 demo（仅供 UI 预览） |

**运行 `node scripts/04_demo_data.mjs` 可重新生成 demo 数据。**

## 已知限制

1. **FastMoss API 单次最多 10 条**：page≥3 都 fallback，所以每个榜单最多 10 条
2. **增长率榜需要 ≥2 天快照**：新部署后前几天会是空
3. **累计榜要登录**：但 fastmoss 实际仍返回数据（带 `code=MAG_AUTH_3004` 警告），前端忽略
4. **数据时间**：fastmoss 数据更新有时延（`update_at` 字段），不是当日实时

## License

仅供学习研究使用，请遵守 FastMoss 的服务条款。
## 部署架构

```
GitHub repo (main)
    │
    │ git push (10s)
    ▼
┌──────────────────────────────────────────┐
│ Cloudflare Workers + Static Assets        │
│   • Auto build (wrangler deploy)         │
│   • Global CDN (Singapore edge node)      │
│   • Custom domain: shop.laowe.club        │
│   • Web Analytics (auto enabled)          │
│   • Cache rules (_headers)                │
└──────────────────────────────────────────┘
    │
    ▼
https://shop.laowe.club/  ← 主入口 (推荐)
https://tiktokshop-trend.linweiheng2009.workers.dev  ← Workers 默认域名

GitHub Pages (mirror, 备份)
https://linweiheng2009-ops.github.io/tiktokshop-trend/
```

## 部署文件

| 文件 | 作用 |
|---|---|
| `wrangler.jsonc` | Cloudflare Workers 配置（assets, compatibility_date） |
| `.cloudflareignore` | 排除 node_modules/scripts/snapshots 等大文件 |
| `_headers` | HTTP 缓存策略 + 安全头 |
| `404.html` | 友好 404 页面 |
| `.github/workflows/daily.yml` | GitHub Actions cron（每天 UTC 0 点爬数据） |

## Cloudflare Web Analytics

项目启动时已接入 Cloudflare Web Analytics：

- **服务端 NEL**：Cloudflare 自动采集 HTTP 性能（CF-NEL header）
- **浏览器 RUM**：在 `index.html` 里加了 beacon.min.js 接入位
  - 默认 token 是 `PLACEHOLDER_TOKEN`，需要在 Cloudflare Dashboard 启用后替换
  - 不启用也不影响功能（服务端一直在采）

## 已知页面特性

- **货币显示**：根据 region 自动切 USD/₫ 等
- **空状态文案**：数据累积 < 7 天时，月榜增长率显示"还需 X 天"
- **趋势图**：需要 ≥ 2 天数据，1 天时显示空状态
- **搜索**：商品名 / 店铺名实时过滤
- **筛选**：价格区间、销量阈值
- **排序**：销量/价格/增长率升降序

