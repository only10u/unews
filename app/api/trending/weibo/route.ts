import { NextResponse } from "next/server"
import { transferImage, detectPlatform } from "@/lib/r2"

// Weibo trending - v18 with Bing image search for cover images
interface WeiboHotItem {
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

let cache: { data: WeiboHotItem[]; timestamp: number } | null = null
const CACHE_TTL = 120_000 // 2 minutes

/**
 * Fetch cover image from Bing Image Search (accessible from overseas)
 */
async function fetchBingImage(keyword: string): Promise<string | null> {
  try {
    const query = encodeURIComponent(keyword + " 新闻")
    const url = `https://cn.bing.com/images/search?q=${query}&first=1&count=1&safeSearch=Moderate`
    
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "zh-CN,zh;q=0.9",
      },
      signal: AbortSignal.timeout(5000),
    })
    
    if (!res.ok) {
      console.log("[WEIBO-BING] status:", res.status, "kw:", keyword.substring(0, 10))
      return null
    }
    
    const html = await res.text()
    
    // Extract murl (media URL) from Bing image results
    // Pattern: "murl":"https://..."
    const murlMatch = html.match(/"murl":"(https?:[^"]+)"/i)
    if (murlMatch && murlMatch[1]) {
      const imageUrl = murlMatch[1].replace(/\\u002f/g, "/")
      console.log("[WEIBO-BING] found image:", imageUrl.substring(0, 60), "kw:", keyword.substring(0, 10))
      return imageUrl
    }
    
    // Fallback: try to find any image URL
    const imgMatch = html.match(/src2="(https?:[^"]+(?:\.jpg|\.png|\.webp)[^"]*)"/i)
    if (imgMatch && imgMatch[1]) {
      console.log("[WEIBO-BING] found src2 image:", imgMatch[1].substring(0, 60))
      return imgMatch[1]
    }
    
    console.log("[WEIBO-BING] no image found for:", keyword.substring(0, 10))
    return null
  } catch (e) {
    console.log("[WEIBO-BING] exception:", e instanceof Error ? e.message : String(e))
    return null
  }
}

/**
 * Enrich items with Bing images (batch processing)
 */
async function enrichWithBingImages(items: WeiboHotItem[]): Promise<WeiboHotItem[]> {
  console.log("[WEIBO-BING] starting enrichment for", items.length, "items")
  
  // Process first 10 items only to stay within time limits
  const toEnrich = items.slice(0, 10)
  const results = await Promise.allSettled(
    toEnrich.map(async (item, idx) => {
      // Stagger requests
      await new Promise(r => setTimeout(r, idx * 200))
      return fetchBingImage(item.title)
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
  
  const enrichedCount = enriched.filter((item, i) => item.imageUrl !== items[i].imageUrl).length
  console.log("[WEIBO-BING] enriched:", enrichedCount, "of", Math.min(10, items.length))
  
  return enriched
}

/** Source 1: Weibo official API */
async function tryWeiboOfficial(): Promise<WeiboHotItem[] | null> {
  try {
    const res = await fetch("https://weibo.com/ajax/side/hotSearch", {
      headers: {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
        "Accept": "application/json",
        "Referer": "https://weibo.com/",
      },
      signal: AbortSignal.timeout(5000),
    })
    console.log("[WEIBO-API] official status:", res.status)
    if (!res.ok) return null
    
    const text = await res.text()
    if (!text.startsWith("{")) return null
    
    const json = JSON.parse(text)
    const realtime = json?.data?.realtime
    if (!Array.isArray(realtime) || realtime.length === 0) return null

    const items: WeiboHotItem[] = realtime.slice(0, 20).map((item: { word?: string; num?: number; raw_hot?: number }, i: number) => ({
      rank: i + 1,
      title: item.word || "",
      hotValue: item.num || item.raw_hot || 0,
      url: `https://s.weibo.com/weibo?q=${encodeURIComponent(item.word || "")}`,
      imageUrl: `https://picsum.photos/seed/${encodeURIComponent((item.word || "").substring(0, 8))}/800/450`,
      authorName: "微博热搜",
      authorAvatar: undefined,
      excerpt: `#${item.word}# 正在热议中`,
      mediaType: "image" as const,
    }))

    console.log("[WEIBO-API] source: official, count:", items.length)
    return items
  } catch (e) {
    console.log("[WEIBO-API] official failed:", e instanceof Error ? e.message : String(e))
    return null
  }
}

/** Source 2: 60s API */
async function try60sApi(): Promise<WeiboHotItem[] | null> {
  try {
    const res = await fetch("https://60s.viki.moe/weibo", {
      headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json" },
      signal: AbortSignal.timeout(5000),
    })
    console.log("[WEIBO-API] 60s status:", res.status)
    if (!res.ok) return null
    const json = await res.json()
    const data = json?.data
    if (!Array.isArray(data) || data.length === 0) return null

    const items: WeiboHotItem[] = data.slice(0, 20).map((item: { title?: string; url?: string; hot?: number }, i: number) => ({
      rank: i + 1,
      title: item.title || "",
      hotValue: item.hot || 0,
      url: item.url || `https://s.weibo.com/weibo?q=${encodeURIComponent(item.title || "")}`,
      imageUrl: `https://picsum.photos/seed/${encodeURIComponent((item.title || "").substring(0, 8))}/800/450`,
      authorName: "微博热搜",
      authorAvatar: undefined,
      excerpt: `#${item.title}# 正在热议中`,
      mediaType: "image" as const,
    }))

    console.log("[WEIBO-API] source: 60s, count:", items.length)
    return items
  } catch (e) {
    console.log("[WEIBO-API] 60s failed:", e instanceof Error ? e.message : String(e))
    return null
  }
}

/** Static fallback */
function getStaticFallback(): WeiboHotItem[] {
  console.log("[WEIBO-API] source: static fallback")
  return []
}

/**
 * Transfer images to R2 if they are from protected domains
 */
async function transferImagesToR2(items: WeiboHotItem[]): Promise<WeiboHotItem[]> {
  const protectedItems = items.filter(it => detectPlatform(it.imageUrl) !== "unknown")
  console.log("[WEIBO-R2] protected items:", protectedItems.length, "of", items.length)
  
  if (protectedItems.length === 0) return items
  
  const results = await Promise.allSettled(
    items.map(async (item) => {
      if (detectPlatform(item.imageUrl) === "unknown") return item
      try {
        const result = await transferImage(item.imageUrl)
        if (result.proxied) {
          console.log("[WEIBO-R2] transferred:", item.title.substring(0, 10))
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

/**
 * Try to get data from domestic crawler push first
 */
async function tryCrawlerCache(): Promise<WeiboHotItem[] | null> {
  try {
    // Import dynamically to avoid circular dependency
    const res = await fetch(`${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : ''}/api/crawler/push?platform=weibo`, {
      signal: AbortSignal.timeout(2000),
    })
    if (res.ok) {
      const data = await res.json()
      if (data.source === "crawler" && Array.isArray(data.data) && data.data.length > 0) {
        console.log("[WEIBO-API] source: crawler cache, count:", data.data.length)
        return data.data as WeiboHotItem[]
      }
    }
  } catch (e) {
    console.log("[WEIBO-API] crawler cache failed:", e instanceof Error ? e.message : String(e))
  }
  return null
}

export async function GET() {
  const now = Date.now()
  if (cache && now - cache.timestamp < CACHE_TTL) {
    return NextResponse.json(cache.data)
  }

  // Priority 1: Domestic crawler pushed data (with real images already transferred to R2)
  let items = await tryCrawlerCache()
  
  // Priority 2: Weibo official API + Bing enrichment
  if (!items || items.length === 0) {
    items = await tryWeiboOfficial()
    if (items && items.length > 0) {
      items = await enrichWithBingImages(items)
      items = await transferImagesToR2(items)
    }
  }
  
  // Priority 3: 60s API
  if (!items || items.length === 0) {
    items = await try60sApi()
    if (items && items.length > 0) {
      items = await enrichWithBingImages(items)
    }
  }
  
  // Priority 4: Static fallback
  if (!items || items.length === 0) {
    items = getStaticFallback()
  }

  cache = { data: items, timestamp: now }
  return NextResponse.json(items)
}
