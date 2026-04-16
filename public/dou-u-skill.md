# 兜U新闻 · Agent Skill

供 AI Agent 通过 HTTPS 读取本站的**热搜 JSON**与**10 分钟级趋势变动**，无需浏览器。

## 基础 URL

将 `https://你的域名` 替换为实际部署地址（如 `https://10unews.com`）。

更换 **crawl4weibo / 新抖音 / 新公众号** 爬取机制时，请阅读站内说明：**[crawler-new-mechanism.md](/crawler-new-mechanism.md)**。

## HTTP 接口一览

| 说明 | 方法 | 路径 |
|------|------|------|
| 微博热搜（已映射为站内格式） | GET | `/api/trending/weibo` |
| 抖音热搜 | GET | `/api/trending/douyin` |
| 公众号热文 | GET | `/api/trending/gzh` |
| 三端趋势变动（10 分钟窗口，供「热点速览」同源） | GET | `/api/trending/diff` |
| 12 小时升幅 TOP10（热点速览优先；无独立上游时由 diff 近似） | GET | `/api/trending/rise12h` |
| 聚合当前榜 | GET | `/api/trending/current` |

### 趋势 diff 返回字段（节选）

每条一般包含：`title`, `platform`（weibo|douyin|gzh）, `rank`, `prevRank`, `rankChange`, `status`, `url`。

## 抓取正文与深度内容（微博反爬）

本站榜单接口主要提供**标题、热度、链接**。若需**正文级抓取**，建议在**同一内网**单独部署 Python 服务，使用开源库 **[crawl4weibo](https://github.com/Praeviso/crawl4weibo)**（无 Cookie 场景下可试用），将其输出再通过你的爬虫网关汇总；**不要在浏览器端直连微博**，以免触发反爬。

## Next 服务端环境变量（爬虫双上游 / 回退）

| 变量 | 说明 |
|------|------|
| `UPSTREAM_TRENDING_3001` | 主爬虫基址（默认 `http://127.0.0.1:3001`） |
| `UPSTREAM_TRENDING_ALT` | 可选第二套爬虫基址 |
| `TRENDING_SOURCE` | `legacy`（默认，仅用主站） / `alt`（仅用 ALT） / `alt_fallback`（先 ALT，失败再主站） |
| `TRENDING_ENRICH` | `1` 或 `true` 时，在榜单 JSON 映射后再请求深度合并（见下） |
| `UPSTREAM_ENRICH_BASE` | 可选；只用于 `GET /api/enrich/*`；不填则与主榜单同一上游 |

新爬虫建议在**新基址**实现与主站相同路径：`/api/trending/{weibo|douyin|gzh}`，并可选实现 **`GET /api/enrich/{weibo|douyin|gzh}`** 返回与榜单等长的数组（或按 `title` 匹配），条目可含：`summary`、`detailContent`、`author`、`authorAvatar`、`publishedAt`（毫秒）等，用于新鲜度与正文预览对齐。

榜单单条也可直接带 `publishedAt` / `publish_time` 等字段，Next 会解析为新鲜度排序。

## 授权说明

若部署时关闭了前端密钥门，上述 JSON 为**公开只读**；若开启密钥体系，请仅在内网或带 Token 的反代后调用。
