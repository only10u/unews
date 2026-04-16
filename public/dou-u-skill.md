# 兜U新闻 · Agent Skill

供 AI Agent 通过 HTTPS 读取本站的**热搜 JSON**与**10 分钟级趋势变动**，无需浏览器。

## 基础 URL

将 `https://你的域名` 替换为实际部署地址（如 `https://10unews.com`）。

## HTTP 接口一览

| 说明 | 方法 | 路径 |
|------|------|------|
| 微博热搜（已映射为站内格式） | GET | `/api/trending/weibo` |
| 抖音热搜 | GET | `/api/trending/douyin` |
| 公众号热文 | GET | `/api/trending/gzh` |
| 三端趋势变动（10 分钟窗口，供「热点速览」同源） | GET | `/api/trending/diff` |
| 聚合当前榜 | GET | `/api/trending/current` |

### 趋势 diff 返回字段（节选）

每条一般包含：`title`, `platform`（weibo|douyin|gzh）, `rank`, `prevRank`, `rankChange`, `status`, `url`。

## 抓取正文与深度内容（微博反爬）

本站榜单接口主要提供**标题、热度、链接**。若需**正文级抓取**，建议在**同一内网**单独部署 Python 服务，使用开源库 **[crawl4weibo](https://github.com/Praeviso/crawl4weibo)**（无 Cookie 场景下可试用），将其输出再通过你的爬虫网关汇总；**不要在浏览器端直连微博**，以免触发反爬。

## 授权说明

若部署时关闭了前端密钥门，上述 JSON 为**公开只读**；若开启密钥体系，请仅在内网或带 Token 的反代后调用。
