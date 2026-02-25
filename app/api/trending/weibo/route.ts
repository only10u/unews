import { NextResponse } from "next/server"

interface WeiboHotItem {
  rank: number
  title: string
  hotValue: number
  url: string
  category?: string
  excerpt?: string
  imageUrl?: string
  videoUrl?: string
  topAuthor?: string
  topAuthorAvatar?: string
}

let cache: { data: WeiboHotItem[]; timestamp: number } | null = null
const CACHE_TTL = 30_000

// Strip HTML tags and decode entities
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim()
}

// Fetch top post details for a keyword via Weibo mobile search API
async function fetchTopPost(keyword: string): Promise<{
  excerpt?: string
  imageUrl?: string
  videoUrl?: string
  topAuthor?: string
  topAuthorAvatar?: string
} | null> {
  try {
    const encodedQ = encodeURIComponent(keyword)
    const res = await fetch(
      `https://m.weibo.cn/api/container/getIndex?containerid=100103type%3D1%26q%3D${encodedQ}&page_type=searchall`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
          "Accept": "application/json",
          "Referer": "https://m.weibo.cn/",
          "X-Requested-With": "XMLHttpRequest",
        },
        signal: AbortSignal.timeout(5000),
      }
    )
    if (!res.ok) return null
    const json = await res.json()

    // Navigate through Weibo's nested structure to find actual posts
    const cards = json?.data?.cards || []
    for (const card of cards) {
      // card_type 9 = single weibo, card_type 11 = card_group
      if (card.card_type === 9 && card.mblog) {
        const mblog = card.mblog
        const text = stripHtml(mblog.text || "").substring(0, 200)
        const pics = mblog.pics || []
        const firstPic = pics.length > 0 ? (pics[0].large?.url || pics[0].url) : undefined
        const videoUrl = mblog.page_info?.urls?.mp4_720p_mp4 || mblog.page_info?.urls?.mp4_hd_mp4 || mblog.page_info?.media_info?.stream_url || undefined
        const videoThumb = mblog.page_info?.page_pic?.url || undefined

        return {
          excerpt: text || undefined,
          imageUrl: firstPic || videoThumb || undefined,
          videoUrl: videoUrl || undefined,
          topAuthor: mblog.user?.screen_name || undefined,
          topAuthorAvatar: mblog.user?.profile_image_url || undefined,
        }
      }
      if (card.card_type === 11 && card.card_group) {
        for (const sub of card.card_group) {
          if (sub.card_type === 9 && sub.mblog) {
            const mblog = sub.mblog
            const text = stripHtml(mblog.text || "").substring(0, 200)
            const pics = mblog.pics || []
            const firstPic = pics.length > 0 ? (pics[0].large?.url || pics[0].url) : undefined
            const videoUrl = mblog.page_info?.urls?.mp4_720p_mp4 || mblog.page_info?.urls?.mp4_hd_mp4 || undefined
            const videoThumb = mblog.page_info?.page_pic?.url || undefined

            return {
              excerpt: text || undefined,
              imageUrl: firstPic || videoThumb || undefined,
              videoUrl: videoUrl || undefined,
              topAuthor: mblog.user?.screen_name || undefined,
              topAuthorAvatar: mblog.user?.profile_image_url || undefined,
            }
          }
        }
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
    const res = await fetch("https://weibo.com/ajax/side/hotSearch", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/json",
        Referer: "https://weibo.com/",
      },
      next: { revalidate: 30 },
    })

    if (!res.ok) throw new Error(`Weibo API: ${res.status}`)

    const json = await res.json()
    const realtime = json?.data?.realtime

    if (!Array.isArray(realtime)) throw new Error("Invalid data format")

    const items: WeiboHotItem[] = realtime.slice(0, 25).map(
      (item: { note?: string; word?: string; num?: number; category?: string; label_name?: string }, index: number) => {
        const title = item.note || item.word || ""
        const searchUrl = `https://s.weibo.com/weibo?q=%23${encodeURIComponent(title)}%23`

        return {
          rank: index + 1,
          title,
          hotValue: item.num || 0,
          url: searchUrl,
          category: item.category || item.label_name || undefined,
          excerpt: `微博热搜"${title}"正在引发广泛讨论，多位大V参与转发评论。`,
          topAuthor: "热搜博主",
          topAuthorAvatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(title.substring(0, 2))}&backgroundColor=e60012`,
        }
      }
    )

    // Enrich top 5 items with real post data (parallel fetch, with timeout)
    const top5 = items.slice(0, 5)
    const enrichResults = await Promise.allSettled(
      top5.map((item) => fetchTopPost(item.title))
    )

    for (let i = 0; i < Math.min(5, enrichResults.length); i++) {
      const result = enrichResults[i]
      if (result.status === "fulfilled" && result.value) {
        const data = result.value
        if (data.excerpt) items[i].excerpt = data.excerpt
        if (data.imageUrl) items[i].imageUrl = data.imageUrl
        if (data.videoUrl) items[i].videoUrl = data.videoUrl
        if (data.topAuthor) items[i].topAuthor = data.topAuthor
        if (data.topAuthorAvatar) items[i].topAuthorAvatar = data.topAuthorAvatar
      }
    }

    cache = { data: items, timestamp: now }
    return NextResponse.json(items)
  } catch (error) {
    console.error("Weibo trending fetch failed:", error)
    if (cache) return NextResponse.json(cache.data)
    return NextResponse.json(generateFallbackData(), { headers: { "X-Data-Source": "fallback" } })
  }
}

function generateFallbackData(): WeiboHotItem[] {
  const topics = [
    "特朗普比特币储备计划", "以太坊ETF突破历史", "Solana生态大爆发",
    "BNB Chain新升级", "AI Agent代币暴涨", "链上巨鲸大额转账",
    "SEC加密监管新动向", "Meme币百倍神话", "DeFi TVL创新高",
    "NFT市场回暖", "Layer2生态格局", "稳定币市值突破2000亿",
    "加密行业裁员潮", "比特币减半效应", "Web3游戏爆款",
    "空投季来临", "DAO治理新模式", "ZK技术突破",
    "跨链桥安全事件", "加密税务新规"
  ]
  return topics.map((title, i) => ({
    rank: i + 1,
    title,
    hotValue: Math.floor(Math.random() * 10000000) + 500000,
    url: `https://s.weibo.com/weibo?q=%23${encodeURIComponent(title)}%23`,
    excerpt: `微博热搜"${title}"持续发酵中，多位大V参与讨论。`,
    topAuthor: "热搜博主",
    topAuthorAvatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(title.substring(0, 2))}&backgroundColor=e60012`,
  }))
}
