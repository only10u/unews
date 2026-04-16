# 新鲜度 + 深度内容 · 新爬取机制（crawl4weibo / 抖音 / 公众号）

本站 **Next** 不直接跑 Python，只通过 **HTTP** 拉取你部署的爬虫服务。  
更换新机制时，在 **新进程/新端口** 实现下列接口，再在 **`.env.production`** 里切换即可。

---

## 1. 总体架构

```
[爬虫服务 A 旧]  :3001  ← 回退
[爬虫服务 B 新]  :3002  ← 主试（新鲜度 + 可选第二跳深度）
        ↓
Next  env: UPSTREAM_TRENDING_ALT + TRENDING_SOURCE=alt_fallback
        ↓
可选: UPSTREAM_ENRICH_BASE（仅 GET /api/enrich/*）
可选: TRENDING_ENRICH=1
```

---

## 2. 微博：crawl4weibo

- 库：<https://github.com/Praeviso/crawl4weibo>（Python，独立进程或同网关内调用）。
- **榜单层**：仍输出与现网一致的 **`GET /api/trending/weibo`**（数组或 `{ data: [] }`）。  
  每条尽量带 **`publishedAt`（毫秒）** 或 `publish_time` / `created_at`；正文可放 `summary` / `text`，长文放 **`detailContent`**。
- **深度层（推荐）**：在 **`GET /api/enrich/weibo`** 返回与榜单 **同序** 或 **同 title** 的数组，字段可含：`summary`、`detailContent`、`author`、`authorAvatar`、`publishedAt`；若与 crawl4weibo 返回的 **`mblog`** 结构一致，Next 已尝试解析 **`mblog.created_at`**、**`mblog.text`** 做时间与摘要。

---

## 3. 抖音：新热榜/详情源

- 可用自建服务或开源思路（如热榜 JSON + 详情补全），**不要**在 Next 里直连抖音 Web。
- 必须实现 **`GET /api/trending/douyin`**；深度 **`GET /api/enrich/douyin`**（字段同微博条）。
- 每条带 **`publishedAt`** 或视频 **`create_time`**（由你在网关映射为毫秒）。

---

## 4. 公众号：新文章抓取

- 可用自建 + 开源文章库思路（需 Cookie/Token 的自行维护）。
- **`GET /api/trending/gzh`**：与现网一致；优先「人民日报 / 新华社 / 央视新闻」可在 **爬虫侧排序**，Next 侧也有央媒加权。
- **`GET /api/enrich/gzh`**：长摘要、正文片段、`publishedAt`。

---

## 5. Next 环境变量（切换新机制）

```env
UPSTREAM_TRENDING_3001=http://127.0.0.1:3001
UPSTREAM_TRENDING_ALT=http://127.0.0.1:3002
TRENDING_SOURCE=alt_fallback
TRENDING_ENRICH=1
# 可选：深度只打到专门服务
# UPSTREAM_ENRICH_BASE=http://127.0.0.1:3003
```

- **先** 只配 **`ALT` + `alt_fallback`**，不配 **`TRENDING_ENRICH`**，确认榜单正常。  
- **再** 打开 **`TRENDING_ENRICH=1`**，确认 **`/api/enrich/*`** 已部署。

---

## 6. 回退

- 仅旧源：`TRENDING_SOURCE=legacy`  
- 或停掉新服务，**`alt_fallback`** 会自动用 **3001**。

---

## 7. 合规

- 遵守各平台服务条款与法律法规；生产环境建议合法数据源或官方合作。
