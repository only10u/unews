import { NextResponse } from "next/server"
import { transferImage, detectPlatform } from "@/lib/r2"

// GZH (WeChat Official Accounts) trending - v18 with Bing news search
interface GzhHotItem {
  rank: number
  title: string
  hotValue: number
  url: string
  imageUrl: string
  authorName: string
  authorAvatar: string | undefined
  excerpt: string
  mediaType: "image"
}

let cache: { data: GzhHotItem[]; timestamp: number } | null = null
const CACHE_TTL = 120_000

/**
 * Fetch news image from Bing News Search
 */
async function fetchBingNewsImage(keyword: string): Promise<string | null> {
  try {
    const query = encodeURIComponent(keyword + " 公众号")
    const url = `https://cn.bing.com/news/search?q=${query}&format=rss`
    
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "application/rss+xml,text/xml,*/*",
      },
      signal: AbortSignal.timeout(5000),
    })
    
    if (!res.ok) return null
    
    const xml = await res.text()
    // Extract image from RSS <enclosure> or <media:thumbnail>
    const imgMatch = xml.match(/<enclosure[^>]*url="([^"]+)"/i)
      || xml.match(/<media:thumbnail[^>]*url="([^"]+)"/i)
      || xml.match(/<img[^>]*src="([^"]+)"/i)
    
    if (imgMatch && imgMatch[1]) {
      return imgMatch[1]
    }
    return null
  } catch {
    return null
  }
}

/**
 * Fetch image from Bing Image Search
 */
async function fetchBingImage(keyword: string): Promise<string | null> {
  try {
    const query = encodeURIComponent(keyword)
    const url = `https://cn.bing.com/images/search?q=${query}&first=1&count=1`
    
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "text/html",
        "Accept-Language": "zh-CN,zh;q=0.9",
      },
      signal: AbortSignal.timeout(5000),
    })
    
    if (!res.ok) return null
    
    const html = await res.text()
    const murlMatch = html.match(/"murl":"(https?:[^"]+)"/i)
    if (murlMatch && murlMatch[1]) {
      return murlMatch[1].replace(/\\u002f/g, "/")
    }
    return null
  } catch {
    return null
  }
}

/**
 * Enrich items with Bing images
 */
async function enrichWithBingImages(items: GzhHotItem[]): Promise<GzhHotItem[]> {
  console.log("[GZH-BING] enriching", items.length, "items")
  
  const toEnrich = items.slice(0, 10)
  const results = await Promise.allSettled(
    toEnrich.map(async (item, idx) => {
      await new Promise(r => setTimeout(r, idx * 200))
      // Try news first, then image search
      let img = await fetchBingNewsImage(item.title)
      if (!img) img = await fetchBingImage(item.title)
      return img
    })
  )
  
  const enriched = items.map((item, i) => {
    if (i < results.length) {
      const result = results[i]
      if (result.status === "fulfilled" && result.value) {
        return { ...item, imageUrl: result.value }
      }
    }
    return item
  })
  
  const count = enriched.filter((item, i) => item.imageUrl !== items[i].imageUrl).length
  console.log("[GZH-BING] enriched:", count)
  
  return enriched
}

/** Source 1: 60s API for WeChat hot articles */
async function try60sApi(): Promise<GzhHotItem[] | null> {
  try {
    const res = await fetch("https://60s.viki.moe/wechat", {
      headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json" },
      signal: AbortSignal.timeout(5000),
    })
    console.log("[GZH-API] 60s status:", res.status)
    if (!res.ok) return null
    const json = await res.json()
    const data = json?.data
    if (!Array.isArray(data) || data.length === 0) return null

    const items: GzhHotItem[] = data.slice(0, 20).map((item: { title?: string; url?: string; digest?: string }, i: number) => ({
      rank: i + 1,
      title: item.title || "",
      hotValue: 0,
      url: item.url || `https://weixin.sogou.com/weixin?query=${encodeURIComponent(item.title || "")}`,
      imageUrl: `https://picsum.photos/seed/wx${encodeURIComponent((item.title || "").substring(0, 6))}/800/450`,
      authorName: "公众号热文",
      authorAvatar: undefined,
      excerpt: item.digest || item.title || "",
      mediaType: "image" as const,
    }))

    console.log("[GZH-API] source: 60s, count:", items.length)
    return items
  } catch (e) {
    console.log("[GZH-API] 60s failed:", e instanceof Error ? e.message : String(e))
    return null
  }
}

/** Source 2: Bing News RSS as content source */
async function tryBingNews(): Promise<GzhHotItem[] | null> {
  try {
    const res = await fetch("https://cn.bing.com/news/search?q=热门公众号&format=rss", {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/rss+xml,text/xml",
      },
      signal: AbortSignal.timeout(5000),
    })
    console.log("[GZH-API] bing news status:", res.status)
    if (!res.ok) return null
    
    const xml = await res.text()
    // Parse RSS items
    const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)
    const items: GzhHotItem[] = []
    
    let rank = 1
    for (const match of itemMatches) {
      if (rank > 20) break
      const content = match[1]
      const title = content.match(/<title>(?:<!\[CDATA\[)?([^\]<]+)/)?.[1] || ""
      const link = content.match(/<link>([^<]+)/)?.[1] || ""
      const desc = content.match(/<description>(?:<!\[CDATA\[)?([^\]<]+)/)?.[1] || ""
      const img = content.match(/<enclosure[^>]*url="([^"]+)"/)?.[1]
        || content.match(/<media:thumbnail[^>]*url="([^"]+)"/)?.[1]
      
      if (title) {
        items.push({
          rank: rank++,
          title: title.trim(),
          hotValue: 0,
          url: link || `https://weixin.sogou.com/weixin?query=${encodeURIComponent(title)}`,
          imageUrl: img || `https://picsum.photos/seed/wx${rank}/800/450`,
          authorName: "公众号热文",
          authorAvatar: undefined,
          excerpt: desc?.substring(0, 100) || title,
          mediaType: "image" as const,
        })
      }
    }
    
    if (items.length === 0) return null
    console.log("[GZH-API] source: bing news, count:", items.length)
    return items
  } catch (e) {
    console.log("[GZH-API] bing news failed:", e instanceof Error ? e.message : String(e))
    return null
  }
}

/** Empty fallback - show "暂无数据" instead of fake data */
function getEmptyFallback(): GzhHotItem[] {
  console.log("[GZH-API] source: empty fallback (no real data available)")
  return []
}

/**
 * Transfer protected images to R2
 */
async function transferImagesToR2(items: GzhHotItem[]): Promise<GzhHotItem[]> {
  const protectedItems = items.filter(it => detectPlatform(it.imageUrl) !== "unknown")
  console.log("[GZH-R2] protected items:", protectedItems.length)
  
  if (protectedItems.length === 0) return items
  
  const results = await Promise.allSettled(
    items.map(async (item) => {
      if (detectPlatform(item.imageUrl) === "unknown") return item
      try {
        const result = await transferImage(item.imageUrl)
        if (result.proxied) {
          return { ...item, imageUrl: result.proxied }
        }
        return item
      } catch {
        return item
      }
    })
  )
  
  return results.map((r, i) => r.status === "fulfilled" ? r.value : items[i])
}

export async function GET() {
  const now = Date.now()
  if (cache && now - cache.timestamp < CACHE_TTL) {
    return NextResponse.json(cache.data)
  }

  let items = await try60sApi()
  if (!items || items.length === 0) items = await tryBingNews()
  if (!items || items.length === 0) items = getEmptyFallback()

  if (items.length > 0) {
    items = await enrichWithBingImages(items)
    items = await transferImagesToR2(items)
  }

  cache = { data: items, timestamp: now }
  return NextResponse.json(items)
}
