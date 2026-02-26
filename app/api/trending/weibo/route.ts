import { NextResponse } from "next/server"

// Weibo trending - v5 rebuilt from scratch
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

type EnrichResult = {
  excerpt?: string
  detailContent?: string
  imageUrl?: string
  videoUrl?: string
  mediaType?: "image" | "video"
  authorName?: string
  authorAvatar?: string
}

/** Method 1: Weibo PC Ajax API (no login required for basic search) */
async function tryWeiboAjax(keyword: string): Promise<EnrichResult | null> {
  console.log('[FETCH-V2] trying method1 (weibo ajax) for:', keyword.substring(0, 12))
  try {
    const q = encodeURIComponent(keyword)
    const res = await fetch(
      `https://weibo.com/ajax/statuses/searchTopWeibo?q=${q}&page=1`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
          Accept: "application/json",
          Referer: "https://weibo.com/",
        },
        signal: AbortSignal.timeout(4000),
      }
    )
    console.log('[FETCH-V2] method1 status:', res.status)
    if (!res.ok) return null
    
    const text = await res.text()
    // Check if response is JSON
    if (!text.startsWith('{') && !text.startsWith('[')) {
      console.log('[FETCH-V2] method1 not JSON, first 50 chars:', text.substring(0, 50))
      return null
    }
    
    const json = JSON.parse(text)
    const statuses = json?.statuses || json?.data?.statuses || []
    console.log('[FETCH-V2] method1 statuses count:', statuses.length)
    
    if (statuses.length === 0) return null
    
    const first = statuses[0]
    const rawText = stripHtml(first.text || first.text_raw || "")
    const cleanText = stripWeiboTags(rawText).substring(0, 300)
    const pics = first.pic_infos ? Object.values(first.pic_infos) : (first.pics || [])
    const firstPic = pics.length > 0 ? ((pics[0] as {large?: {url: string}, url?: string}).large?.url || (pics[0] as {url?: string}).url) : undefined
    
    const result: EnrichResult = {
      excerpt: cleanText.substring(0, 120) || undefined,
      detailContent: cleanText || undefined,
      imageUrl: firstPic || undefined,
      authorName: first.user?.screen_name || undefined,
      authorAvatar: first.user?.profile_image_url || first.user?.avatar_hd || undefined,
      mediaType: firstPic ? "image" : undefined,
    }
    
    console.log('[FETCH-V2] method1 SUCCESS:', JSON.stringify({
      authorName: result.authorName,
      imageUrl: result.imageUrl?.substring(0, 50),
    }))
    return result
  } catch (e) {
    console.log('[FETCH-V2] method1 error:', e instanceof Error ? e.message : String(e))
    return null
  }
}

/** Method 2: Sogou Weibo search (parse HTML) */
async function trySogouWeibo(keyword: string): Promise<EnrichResult | null> {
  console.log('[FETCH-V2] trying method2 (sogou weibo) for:', keyword.substring(0, 12))
  try {
    const q = encodeURIComponent(keyword)
    const res = await fetch(
      `https://weibo.sogou.com/weibo?type=2&query=${q}&ie=utf8`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          Accept: "text/html",
          Referer: "https://weibo.sogou.com/",
        },
        signal: AbortSignal.timeout(4000),
      }
    )
    console.log('[FETCH-V2] method2 status:', res.status)
    if (!res.ok) return null
    
    const html = await res.text()
    
    // Extract content from first result using regex
    const contentMatch = html.match(/<div[^>]*class="[^"]*txt-box[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
    const imgMatch = html.match(/<div[^>]*class="[^"]*pic-box[^"]*"[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"/i)
    const authorMatch = html.match(/<a[^>]*class="[^"]*name[^"]*"[^>]*>([^<]+)<\/a>/i)
      || html.match(/<div[^>]*class="[^"]*s-p[^"]*"[^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>/i)
    
    if (!contentMatch && !imgMatch) {
      console.log('[FETCH-V2] method2 no content found in HTML')
      return null
    }
    
    const excerpt = contentMatch ? stripHtml(contentMatch[1]).substring(0, 120) : undefined
    const imageUrl = imgMatch ? imgMatch[1].replace(/^\/\//, 'https://') : undefined
    const authorName = authorMatch ? stripHtml(authorMatch[1]) : undefined
    
    const result: EnrichResult = {
      excerpt,
      detailContent: excerpt,
      imageUrl,
      authorName,
      mediaType: imageUrl ? "image" : undefined,
    }
    
    console.log('[FETCH-V2] method2 SUCCESS:', JSON.stringify({
      authorName: result.authorName,
      hasImage: !!result.imageUrl,
      excerptLen: result.excerpt?.length,
    }))
    return result
  } catch (e) {
    console.log('[FETCH-V2] method2 error:', e instanceof Error ? e.message : String(e))
    return null
  }
}

/** Method 3: Generate placeholder content (always succeeds) */
function generatePlaceholder(keyword: string): EnrichResult {
  console.log('[FETCH-V2] using method3 (placeholder) for:', keyword.substring(0, 12))
  return {
    excerpt: `#${keyword}# 正在微博热议中，点击查看详情`,
    detailContent: `话题 #${keyword}# 登上微博热搜，引发网友广泛讨论。`,
    authorName: "微博热搜",
    // Keep imageUrl and authorAvatar undefined to use defaults
  }
}

/** Fetch top post for a keyword - tries 3 methods in sequence */
async function fetchTopPost(keyword: string): Promise<EnrichResult | null> {
  console.log('[FETCH-V2] START enriching:', keyword.substring(0, 15))
  
  // Method 1: Weibo Ajax API
  const r1 = await tryWeiboAjax(keyword)
  if (r1 && (r1.imageUrl || r1.authorName)) {
    console.log('[FETCH-V2] method1 returned valid data')
    return r1
  }
  
  // Method 2: Sogou Weibo Search
  const r2 = await trySogouWeibo(keyword)
  if (r2 && (r2.imageUrl || r2.excerpt)) {
    console.log('[FETCH-V2] method2 returned valid data')
    return r2
  }
  
  // Method 3: Placeholder (always returns something)
  console.log('[FETCH-V2] all methods failed, using placeholder')
  return generatePlaceholder(keyword)
}

export async function GET() {
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

    // Debug
    console.log("[v0] Weibo items:", items.length, "sample:", JSON.stringify({
      title: items[0]?.title, authorName: items[0]?.authorName,
      img: items[0]?.imageUrl?.substring(0, 50), media: items[0]?.mediaType,
    }))

    cache = { data: items, timestamp: now }
    return NextResponse.json(items)
  } catch (error) {
    console.error("[v0] Weibo error:", error)
    if (cache) return NextResponse.json(cache.data)
    return NextResponse.json(generateFallback())
  }
}

function generateFallback(): WeiboHotItem[] {
  const topics = [
    "特朗普比特币储备计划", "以太坊ETF突破历史", "Solana生态大爆发",
    "BNB Chain新升级", "AI Agent代币暴涨", "链上巨��大额转账",
    "SEC加密监管新动向", "Meme币百倍神话", "DeFi TVL创新高",
    "NFT市场回暖", "Layer2生态格局", "稳定币市值突破2000亿",
    "加密行业裁员潮", "比特币减半效应", "Web3游戏爆款",
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
