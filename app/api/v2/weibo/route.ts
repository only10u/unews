import { NextResponse } from "next/server"

// Weibo trending - v6 NEW PATH to bypass Turbopack cache
interface WeiboHotItem {
  rank: number
  title: string
  hotValue: number
  url: string
  category?: string
  excerpt?: string
  imageUrl?: string
  videoUrl?: string
  mediaType?: "image" | "video"
  authorName?: string
  authorAvatar?: string
  detailContent?: string
}

let cache: { data: WeiboHotItem[]; timestamp: number } | null = null
const CACHE_TTL = 30_000

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
    .trim()
}

function stripWeiboTags(text: string): string {
  return text.replace(/#([^#]+)#/g, "$1").trim()
}

/** Fetch top post for a keyword via Weibo mobile search API */
async function fetchTopPost(keyword: string): Promise<{
  excerpt?: string
  detailContent?: string
  imageUrl?: string
  videoUrl?: string
  mediaType?: "image" | "video"
  authorName?: string
  authorAvatar?: string
} | null> {
  try {
    const encodedQ = encodeURIComponent(keyword)
    const res = await fetch(
      `https://m.weibo.cn/api/container/getIndex?containerid=100103type%3D1%26q%3D${encodedQ}&page_type=searchall`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
          Accept: "application/json",
          Referer: "https://m.weibo.cn/",
        },
        signal: AbortSignal.timeout(5000),
      }
    )
    if (!res.ok) return null
    const json = await res.json()

    const cards = json?.data?.cards || []
    for (const card of cards) {
      const mblog = card.card_type === 9 ? card.mblog
        : card.card_type === 11 ? card.card_group?.find((s: { card_type: number }) => s.card_type === 9)?.mblog
        : null
      if (!mblog) continue

      const rawText = stripHtml(mblog.text || "")
      const cleanText = stripWeiboTags(rawText).substring(0, 300)
      const pics = mblog.pics || []
      const firstPic = pics.length > 0 ? (pics[0].large?.url || pics[0].url) : undefined
      const videoUrl = mblog.page_info?.urls?.mp4_720p_mp4
        || mblog.page_info?.urls?.mp4_hd_mp4
        || mblog.page_info?.media_info?.stream_url
        || undefined
      const videoThumb = mblog.page_info?.page_pic?.url || undefined

      const result = {
        excerpt: cleanText?.substring(0, 120) || undefined,
        detailContent: cleanText || undefined,
        imageUrl: firstPic || videoThumb || undefined,
        videoUrl: videoUrl || undefined,
        mediaType: videoUrl ? "video" : firstPic ? "image" : undefined,
        authorName: mblog.user?.screen_name || undefined,
        authorAvatar: mblog.user?.profile_image_url || undefined,
      }
      // TEST LOG - 获取真实 sinaimg URL
      console.log('[TEST-V2] authorAvatar:', result.authorAvatar)
      console.log('[TEST-V2] imageUrl:', result.imageUrl)
      return result
    }
    return null
  } catch {
    return null
  }
}

export async function GET() {
  console.log('[TEST-V2] /api/v2/weibo called - this confirms new route is loaded!')
  
  const now = Date.now()
  if (cache && now - cache.timestamp < CACHE_TTL) {
    return NextResponse.json(cache.data)
  }

  try {
    const res = await fetch("https://weibo.com/ajax/side/hotSearch", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
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
        return {
          rank: index + 1,
          title,
          hotValue: item.num || 0,
          url: `https://s.weibo.com/weibo?q=%23${encodeURIComponent(title)}%23`,
          category: item.category || item.label_name || undefined,
          excerpt: `微博热搜 "${title}" 引发广泛讨论`,
          imageUrl: `https://picsum.photos/seed/${encodeURIComponent(title.substring(0, 8))}/800/450`,
          authorName: "微博热搜",
          authorAvatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(title.substring(0, 2))}&backgroundColor=e60012`,
        }
      }
    )

    // Enrich ALL items in parallel batches of 5
    const BATCH = 5
    for (let i = 0; i < items.length; i += BATCH) {
      const batch = items.slice(i, i + BATCH)
      const results = await Promise.allSettled(batch.map((it) => fetchTopPost(it.title)))
      for (let j = 0; j < results.length; j++) {
        const r = results[j]
        if (r.status === "fulfilled" && r.value) {
          const d = r.value
          const idx = i + j
          if (d.excerpt) items[idx].excerpt = d.excerpt
          if (d.detailContent) items[idx].detailContent = d.detailContent
          if (d.imageUrl) items[idx].imageUrl = d.imageUrl
          if (d.videoUrl) items[idx].videoUrl = d.videoUrl
          if (d.mediaType) items[idx].mediaType = d.mediaType
          if (d.authorName) items[idx].authorName = d.authorName
          if (d.authorAvatar) items[idx].authorAvatar = d.authorAvatar
        }
      }
    }

    console.log("[TEST-V2] Weibo enrichment done, sample:", JSON.stringify({
      title: items[0]?.title,
      authorName: items[0]?.authorName,
      authorAvatar: items[0]?.authorAvatar?.substring(0, 60),
      imageUrl: items[0]?.imageUrl?.substring(0, 60),
      mediaType: items[0]?.mediaType,
    }))

    cache = { data: items, timestamp: now }
    return NextResponse.json(items)
  } catch (error) {
    console.error("[TEST-V2] Weibo error:", error)
    if (cache) return NextResponse.json(cache.data)
    return NextResponse.json(generateFallback())
  }
}

function generateFallback(): WeiboHotItem[] {
  const topics = [
    "特朗普比特币储备计划", "以太坊ETF突破历史", "Solana生态大爆发",
    "BNB Chain新升级", "AI Agent代币暴涨", "链上巨鲸大额转账",
    "SEC加密监管新动向", "Meme币百倍神话", "DeFi TVL创新高",
    "NFT市场回暖", "Layer2生态格局", "稳定币市值突破2000亿",
  ]
  return topics.map((title, i) => ({
    rank: i + 1,
    title,
    hotValue: Math.floor(Math.random() * 10000000) + 500000,
    url: `https://s.weibo.com/weibo?q=%23${encodeURIComponent(title)}%23`,
    excerpt: `微博热搜 "${title}" 持续发酵`,
    imageUrl: `https://picsum.photos/seed/${encodeURIComponent(title.substring(0, 8))}/800/450`,
    authorName: "微博热搜",
    authorAvatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(title.substring(0, 2))}&backgroundColor=e60012`,
  }))
}
