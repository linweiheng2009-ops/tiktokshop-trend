# TikTok Shop 趋势榜

> 基于 FastMoss 公开榜的 **TikTok Shop 每日 / 每周 / 每月趋势榜** —— 反映曝光/GMV 估算，适合看 **趋势**，不适合看 **绝对销量**。

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
- ✅ Demo 数据演示 3 天累积
- ⏳ 等待 GitHub Actions cron 真实数据累积 7 天 → 周榜完整
- ⏳ 等待真实数据累积 30 天 → 月榜完整
- ⏳ 部署到公网域名

## 已知限制

1. **FastMoss API 单次最多 10 条**：page≥3 都 fallback，所以每个榜单最多 10 条
2. **增长率榜需要 ≥2 天快照**：新部署后前几天会是空
3. **累计榜要登录**：但 fastmoss 实际仍返回数据（带 `code=MAG_AUTH_3004` 警告），前端忽略
4. **数据时间**：fastmoss 数据更新有时延（`update_at` 字段），不是当日实时

## License

仅供学习研究使用，请遵守 FastMoss 的服务条款。