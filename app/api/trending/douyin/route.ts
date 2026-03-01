import { NextResponse } from "next/server"
import { transferImage, detectPlatform } from "@/lib/r2"

// Douyin trending - v18 with IES API + Bing image fallback
interface DouyinHotItem {
  rank: number
  title: string
  hotValue: number
  url: string
  imageUrl: string
  authorName: string
  authorAvatar: string | undefined
  excerpt: string
  mediaType: "video"
}

let cache: { data: DouyinHotItem[]; timestamp: number } | null = null
const CACHE_TTL = 120_000

/**
 * Fetch cover image from Bing Image Search
 */
async function fetchBingImage(keyword: string): Promise<string | null> {
  try {
    const query = encodeURIComponent(keyword + " 抖音")
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
async function enrichWithBingImages(items: DouyinHotItem[]): Promise<DouyinHotItem[]> {
  console.log("[DOUYIN-BING] enriching", items.length, "items")
  
  const toEnrich = items.slice(0, 10)
  const results = await Promise.allSettled(
    toEnrich.map(async (item, idx) => {
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
  
  const count = enriched.filter((item, i) => item.imageUrl !== items[i].imageUrl).length
  console.log("[DOUYIN-BING] enriched:", count)
  
  return enriched
}

/** Source 1: IES Douyin API (no login required) */
async function tryIesDouyin(): Promise<DouyinHotItem[] | null> {
  try {
    const res = await fetch("https://www.iesdouyin.com/web/api/v2/hotsearch/billboard/word/", {
      headers: {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15",
        "Accept": "application/json",
      },
      signal: AbortSignal.timeout(6000),
    })
    console.log("[DOUYIN-API] IES status:", res.status)
    if (!res.ok) return null
    
    const json = await res.json()
    const list = json?.word_list || []
    if (!Array.isArray(list) || list.length === 0) {
      console.log("[DOUYIN-API] IES empty list")
      return null
    }

    const items: DouyinHotItem[] = list.slice(0, 20).map((item: { word?: string; hot_value?: number }, i: number) => ({
      rank: i + 1,
      title: item.word || "",
      hotValue: item.hot_value || 0,
      url: `https://www.douyin.com/search/${encodeURIComponent(item.word || "")}`,
      imageUrl: `https://picsum.photos/seed/dy${encodeURIComponent((item.word || "").substring(0, 6))}/800/450`,
      authorName: "抖音热榜",
      authorAvatar: undefined,
      excerpt: `#${item.word}# 正在抖音热播`,
      mediaType: "video" as const,
    }))

    console.log("[DOUYIN-API] source: IES, count:", items.length)
    return items
  } catch (e) {
    console.log("[DOUYIN-API] IES failed:", e instanceof Error ? e.message : String(e))
    return null
  }
}

/** Source 2: 60s API */
async function try60sApi(): Promise<DouyinHotItem[] | null> {
  try {
    const res = await fetch("https://60s.viki.moe/douyin", {
      headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json" },
      signal: AbortSignal.timeout(5000),
    })
    console.log("[DOUYIN-API] 60s status:", res.status)
    if (!res.ok) return null
    const json = await res.json()
    const data = json?.data
    if (!Array.isArray(data) || data.length === 0) return null

    const items: DouyinHotItem[] = data.slice(0, 20).map((item: { title?: string; url?: string; hot?: number }, i: number) => ({
      rank: i + 1,
      title: item.title || "",
      hotValue: item.hot || 0,
      url: item.url || `https://www.douyin.com/search/${encodeURIComponent(item.title || "")}`,
      imageUrl: `https://picsum.photos/seed/dy${i}/800/450`,
      authorName: "抖音热榜",
      authorAvatar: undefined,
      excerpt: `#${item.title}# 正在抖音热播`,
      mediaType: "video" as const,
    }))

    console.log("[DOUYIN-API] source: 60s, count:", items.length)
    return items
  } catch (e) {
    console.log("[DOUYIN-API] 60s failed:", e instanceof Error ? e.message : String(e))
    return null
  }
}

/** Empty fallback - show "no data" instead of fake data */
function getEmptyFallback(): DouyinHotItem[] {
  console.log("[DOUYIN-API] source: empty fallback")
  return []
}

/**
 * Transfer protected images to R2
 */
async function transferImagesToR2(items: DouyinHotItem[]): Promise<DouyinHotItem[]> {
  const protectedItems = items.filter(it => detectPlatform(it.imageUrl) !== "unknown")
  console.log("[DOUYIN-R2] protected items:", protectedItems.length)
  
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

/**
 * Try to get data from domestic crawler push first
 */
async function tryCrawlerCache(): Promise<DouyinHotItem[] | null> {
  try {
    const res = await fetch(`${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : ''}/api/crawler/push?platform=douyin`, {
      signal: AbortSignal.timeout(2000),
    })
    if (res.ok) {
      const data = await res.json()
      if (data.source === "crawler" && Array.isArray(data.data) && data.data.length > 0) {
        console.log("[DOUYIN-API] source: crawler cache, count:", data.data.length)
        return data.data as DouyinHotItem[]
      }
    }
  } catch (e) {
    console.log("[DOUYIN-API] crawler cache failed:", e instanceof Error ? e.message : String(e))
  }
  return null
}

export async function GET() {
  const now = Date.now()
  if (cache && now - cache.timestamp < CACHE_TTL) {
    return NextResponse.json(cache.data)
  }

  // Priority 1: Domestic crawler pushed data
  let items = await tryCrawlerCache()
  
  // Priority 2: IES API + Bing enrichment  
  if (!items || items.length === 0) {
    items = await tryIesDouyin()
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
  
  // Priority 4: Empty fallback
  if (!items || items.length === 0) {
    items = getEmptyFallback()
  }

  cache = { data: items, timestamp: now }
  return NextResponse.json(items)
}
