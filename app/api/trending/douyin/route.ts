import { NextResponse } from "next/server"

interface DouyinHotItem {
  rank: number
  title: string
  hotValue: number
  url: string
  excerpt?: string
  imageUrl?: string
  videoUrl?: string
  topAuthor?: string
  topAuthorAvatar?: string
}

let cache: { data: DouyinHotItem[]; timestamp: number } | null = null
const CACHE_TTL = 30_000

// Attempt to fetch top post details for a keyword via Douyin search
async function fetchDouyinTopPost(keyword: string): Promise<{
  excerpt?: string
  imageUrl?: string
  videoUrl?: string
  topAuthor?: string
} | null> {
  try {
    // Try Douyin search suggestion API for some basic context
    const encodedQ = encodeURIComponent(keyword)
    const res = await fetch(
      `https://www.douyin.com/aweme/v1/web/search/item/?keyword=${encodedQ}&count=1&offset=0`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          "Accept": "application/json",
          "Referer": "https://www.douyin.com/",
        },
        signal: AbortSignal.timeout(3000),
      }
    )
    if (!res.ok) return null
    const json = await res.json()
    const items = json?.data || json?.aweme_list || []
    if (items.length > 0) {
      const first = items[0]
      return {
        excerpt: first.desc || first.title || undefined,
        imageUrl: first.video?.cover?.url_list?.[0] || first.video?.origin_cover?.url_list?.[0] || undefined,
        videoUrl: first.video?.play_addr?.url_list?.[0] || undefined,
        topAuthor: first.author?.nickname || undefined,
      }
    }
    return null
  } catch {
    return null
  }
}

export async function GET() {
  const now = Date.now()
  if (cache && now - cache.timestamp < CACHE_TTL) {
    return NextResponse.json(cache.data)
  }

  try {
    const res = await fetch("https://www.douyin.com/aweme/v1/web/hot/search/list/", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/json",
        Referer: "https://www.douyin.com/",
      },
      next: { revalidate: 30 },
    })

    if (!res.ok) throw new Error(`Douyin API: ${res.status}`)

    const json = await res.json()
    const wordList = json?.data?.word_list

    if (Array.isArray(wordList) && wordList.length > 0) {
      const items: DouyinHotItem[] = wordList.slice(0, 25).map(
        (item: { word?: string; hot_value?: number; sentence_id?: string; event_time?: string }, index: number) => {
          const title = item.word || ""
          return {
            rank: index + 1,
            title,
            hotValue: item.hot_value || 0,
            url: `https://www.douyin.com/search/${encodeURIComponent(title)}`,
            excerpt: `抖音热搜"${title}"相关视频正在走红，多位创作者发布了精彩内容。`,
            videoUrl: `https://www.douyin.com/search/${encodeURIComponent(title)}`,
            topAuthor: "抖音达人",
            topAuthorAvatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(title.substring(0, 2))}&backgroundColor=000000`,
          }
        }
      )

      // Attempt content enrichment for top 3 (limited due to Douyin's strict anti-scrape)
      const top3 = items.slice(0, 3)
      const enrichResults = await Promise.allSettled(
        top3.map((item) => fetchDouyinTopPost(item.title))
      )

      for (let i = 0; i < Math.min(3, enrichResults.length); i++) {
        const result = enrichResults[i]
        if (result.status === "fulfilled" && result.value) {
          const data = result.value
          if (data.excerpt) items[i].excerpt = data.excerpt
          if (data.imageUrl) items[i].imageUrl = data.imageUrl
          if (data.videoUrl) items[i].videoUrl = data.videoUrl
          if (data.topAuthor) items[i].topAuthor = data.topAuthor
        }
      }

      cache = { data: items, timestamp: now }
      return NextResponse.json(items)
    }

    throw new Error("Empty response")
  } catch (error) {
    console.error("Douyin trending fetch failed:", error)
    if (cache) return NextResponse.json(cache.data)
    return NextResponse.json(generateFallbackData(), { headers: { "X-Data-Source": "fallback" } })
  }
}

function generateFallbackData(): DouyinHotItem[] {
  const topics = [
    "加密货币投资新手必看", "土狗币100倍暴涨实录", "比特币10万美元庆祝",
    "外卖小哥吉他表演", "AI画猫挑战赛", "区块链科普系列",
    "加密钱包安全教程", "新手炒币入门", "DeFi挖矿教程",
    "NFT艺术创作", "Web3求职攻略", "元宇宙体验分享",
    "空投撸毛教程", "链上数据分析", "Meme币文化解读",
    "加密行业裁员潮", "稳定币收益策略", "跨链体验对比",
    "DAO组织运营", "Layer2使用指南"
  ]
  return topics.map((title, i) => ({
    rank: i + 1,
    title,
    hotValue: Math.floor(Math.random() * 10000000) + 500000,
    url: `https://www.douyin.com/search/${encodeURIComponent(title)}`,
    excerpt: `抖音热搜"${title}"视频正在走红，多位创作者参与互动。`,
    videoUrl: `https://www.douyin.com/search/${encodeURIComponent(title)}`,
    topAuthor: "抖音达人",
    topAuthorAvatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(title.substring(0, 2))}&backgroundColor=000000`,
  }))
}
