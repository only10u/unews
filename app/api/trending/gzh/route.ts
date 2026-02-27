import { NextResponse } from "next/server"
import { transferImage, detectPlatform } from "@/lib/r2"

// GZH (WeChat Official Accounts) trending - v16 with real image enrichment
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
const CACHE_TTL = 60_000

const MAX_CONCURRENT = 3
const DELAY_MS = 500

/**
 * Enrichment: Fetch cover image from Sogou WeChat search
 */
async function enrichGzhImage(keyword: string): Promise<{ imageUrl?: string; authorName?: string } | null> {
  try {
    const url = `https://weixin.sogou.com/weixin?type=2&query=${encodeURIComponent(keyword)}`
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "zh-CN,zh;q=0.9",
        "Referer": "https://weixin.sogou.com/",
      },
      signal: AbortSignal.timeout(8000),
    })
    
    if (!res.ok) {
      console.log("[GZH-ENRICH] fetch failed:", res.status, "for:", keyword.substring(0, 10))
      return null
    }
    
    const html = await res.text()
    
    // Extract mmbiz.qpic.cn image URLs
    // Pattern: src="http://mmbiz.qpic.cn/..." or img class="img-news" src="..."
    const imgMatches = html.match(/(?:src=["'])((?:https?:)?\/\/mmbiz\.qpic\.cn[^"']+)/gi)
    
    if (imgMatches && imgMatches.length > 0) {
      const match = imgMatches[0].match(/(?:src=["'])((?:https?:)?\/\/[^"']+)/i)
      if (match && match[1]) {
        let imageUrl = match[1]
        if (imageUrl.startsWith("//")) imageUrl = "https:" + imageUrl
        console.log("[GZH-ENRICH] found image:", imageUrl.substring(0, 50), "for:", keyword.substring(0, 10))
        return { imageUrl }
      }
    }
    
    // Try to extract account name
    const authorMatch = html.match(/<a[^>]*account_name[^>]*>([^<]+)<\/a>/i) 
      || html.match(/<span[^>]*class="account"[^>]*>([^<]+)<\/span>/i)
    
    if (authorMatch) {
      return { authorName: authorMatch[1].trim() }
    }
    
    console.log("[GZH-ENRICH] no mmbiz image found for:", keyword.substring(0, 10))
    return null
  } catch (e) {
    console.log("[GZH-ENRICH] exception:", e instanceof Error ? e.message : String(e))
    return null
  }
}

/**
 * Batch enrichment with concurrency control
 */
async function enrichItemsWithImages(items: GzhHotItem[]): Promise<GzhHotItem[]> {
  console.log("[GZH-ENRICH] starting enrichment for", items.length, "items")
  
  const results: GzhHotItem[] = [...items]
  
  for (let i = 0; i < Math.min(items.length, 10); i += MAX_CONCURRENT) {
    const batch = items.slice(i, i + MAX_CONCURRENT)
    const batchResults = await Promise.allSettled(
      batch.map(async (item, idx) => {
        if (idx > 0) await new Promise(resolve => setTimeout(resolve, DELAY_MS))
        return enrichGzhImage(item.title)
      })
    )
    
    for (let j = 0; j < batchResults.length; j++) {
      const result = batchResults[j]
      if (result.status === "fulfilled" && result.value) {
        if (result.value.imageUrl) {
          results[i + j] = { ...results[i + j], imageUrl: result.value.imageUrl }
        }
        if (result.value.authorName) {
          results[i + j] = { ...results[i + j], authorName: result.value.authorName }
        }
      }
    }
    
    if (i + MAX_CONCURRENT < items.length) {
      await new Promise(resolve => setTimeout(resolve, DELAY_MS))
    }
  }
  
  const enrichedCount = results.filter((item, idx) => item.imageUrl !== items[idx].imageUrl).length
  console.log("[GZH-ENRICH] enrichment complete, enriched:", enrichedCount)
  
  return results
}

/** Source 1: TopHub API for WeChat */
async function tryTopHub(): Promise<GzhHotItem[] | null> {
  try {
    const res = await fetch("https://api.tophubdata.com/v2/nodes/WnBe01o371", {
      headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json" },
      signal: AbortSignal.timeout(6000),
    })
    console.log("[GZH-API] tophub status:", res.status)
    if (!res.ok) return null
    const json = await res.json()
    const data = json?.data?.items
    if (!Array.isArray(data) || data.length === 0) return null

    const items: GzhHotItem[] = data.slice(0, 20).map((item: { title?: string; extra?: { hot?: number; info?: string }; url?: string }, i: number) => ({
      rank: i + 1,
      title: item.title || "",
      hotValue: item.extra?.hot || 0,
      url: item.url || `https://weixin.sogou.com/weixin?query=${encodeURIComponent(item.title || "")}`,
      imageUrl: `https://picsum.photos/seed/wx${i}/800/450`,
      authorName: item.extra?.info || "公众号热文",
      authorAvatar: undefined,
      excerpt: item.title || "",
      mediaType: "image" as const,
    }))

    console.log("[GZH-API] source: tophub, count:", items.length)
    return items
  } catch (e) {
    console.log("[GZH-API] tophub failed:", e instanceof Error ? e.message : String(e))
    return null
  }
}

/** Source 2: 60s API */
async function try60sApi(): Promise<GzhHotItem[] | null> {
  try {
    const res = await fetch("https://60s.viki.moe/wechat", {
      headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json" },
      signal: AbortSignal.timeout(6000),
    })
    console.log("[GZH-API] 60s status:", res.status)
    if (!res.ok) return null
    const json = await res.json()
    const data = json?.data
    if (!Array.isArray(data) || data.length === 0) return null

    const items: GzhHotItem[] = data.slice(0, 20).map((item: { title?: string; url?: string; hot?: number }, i: number) => ({
      rank: i + 1,
      title: item.title || "",
      hotValue: item.hot || 0,
      url: item.url || `https://weixin.sogou.com/weixin?query=${encodeURIComponent(item.title || "")}`,
      imageUrl: `https://picsum.photos/seed/wx${i}/800/450`,
      authorName: "公众号热文",
      authorAvatar: undefined,
      excerpt: item.title || "",
      mediaType: "image" as const,
    }))

    console.log("[GZH-API] source: 60s, count:", items.length)
    return items
  } catch (e) {
    console.log("[GZH-API] 60s failed:", e instanceof Error ? e.message : String(e))
    return null
  }
}

/** Static fallback */
function getStaticFallback(): GzhHotItem[] {
  const topics = ["公众号热文1", "公众号热文2", "公众号热文3"]
  console.log("[GZH-API] source: static fallback")
  return topics.map((title, i) => ({
    rank: i + 1,
    title,
    hotValue: 1000000,
    url: `https://weixin.sogou.com/weixin?query=${encodeURIComponent(title)}`,
    imageUrl: `https://picsum.photos/seed/wx${i}/800/450`,
    authorName: "公众号热文",
    authorAvatar: undefined,
    excerpt: title,
    mediaType: "image" as const,
  }))
}

/**
 * Transfer images to R2 if they are from protected domains
 */
async function transferImagesToR2(items: GzhHotItem[]): Promise<GzhHotItem[]> {
  const protectedItems = items.filter(it => /mmbiz\.qpic\.cn/i.test(it.imageUrl || ""))
  console.log("[GZH-R2] items to transfer:", protectedItems.length, "of", items.length)
  
  if (protectedItems.length === 0) return items
  
  const results = await Promise.allSettled(
    items.map(async (item) => {
      const platform = detectPlatform(item.imageUrl)
      if (platform === "unknown") return item
      
      try {
        const result = await transferImage(item.imageUrl)
        if (result.proxied) {
          console.log("[GZH-R2] transferred:", item.imageUrl.substring(0, 40))
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

  let items = await tryTopHub()
  if (!items) items = await try60sApi()
  if (!items) items = getStaticFallback()

  // Enrich with real images from sogou weixin search
  items = await enrichItemsWithImages(items)
  
  // Transfer protected images to R2
  items = await transferImagesToR2(items)

  cache = { data: items, timestamp: now }
  return NextResponse.json(items)
}
