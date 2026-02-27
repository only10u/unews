import { NextResponse } from "next/server"
import { transferImage, detectPlatform } from "@/lib/r2"

// Weibo trending - v16 with real image enrichment
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
const CACHE_TTL = 60_000 // 1 minute cache to reduce enrichment load

// Concurrency control
const MAX_CONCURRENT = 3
const DELAY_MS = 500

/**
 * Enrichment: Fetch real image from s.weibo.com search page
 */
async function enrichWeiboImage(keyword: string): Promise<string | null> {
  const kw = keyword.substring(0, 12)
  try {
    const url = `https://s.weibo.com/weibo?q=${encodeURIComponent(keyword)}&Refer=top`
    console.log("[WEIBO-ENRICH] requesting:", url.substring(0, 80))
    
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        "Referer": "https://weibo.com/",
        "Cookie": "", // No cookie needed for search
      },
      signal: AbortSignal.timeout(8000),
      redirect: "follow",
    })
    
    console.log("[WEIBO-ENRICH] response:", res.status, res.statusText, "url:", res.url?.substring(0, 50), "kw:", kw)
    
    if (!res.ok) {
      return null
    }
    
    const html = await res.text()
    const htmlLen = html.length
    const hasLogin = html.includes("passport.weibo.com") || html.includes("登录")
    const hasCaptcha = html.includes("验证码") || html.includes("captcha")
    
    console.log("[WEIBO-ENRICH] html len:", htmlLen, "hasLogin:", hasLogin, "hasCaptcha:", hasCaptcha, "kw:", kw)
    
    // Check if redirected to login page
    if (hasLogin || hasCaptcha || htmlLen < 5000) {
      console.log("[WEIBO-ENRICH] blocked - login/captcha required, kw:", kw)
      return null
    }
    
    // Extract sinaimg.cn image URLs from the HTML
    const imgMatches = html.match(/(?:src=["'])((?:https?:)?\/\/[^"']*sinaimg\.cn[^"']*(?:\.jpg|\.png|\.gif|\.webp)[^"']*)/gi)
    
    console.log("[WEIBO-ENRICH] sinaimg matches:", imgMatches?.length || 0, "kw:", kw)
    
    if (imgMatches && imgMatches.length > 0) {
      const match = imgMatches[0].match(/(?:src=["'])((?:https?:)?\/\/[^"']+)/i)
      if (match && match[1]) {
        let imageUrl = match[1]
        if (imageUrl.startsWith("//")) {
          imageUrl = "https:" + imageUrl
        }
        imageUrl = imageUrl.replace(/\/thumb\d+\//, "/mw690/").replace(/\/orj\d+\//, "/mw690/")
        console.log("[WEIBO-ENRICH] SUCCESS image:", imageUrl.substring(0, 70), "kw:", kw)
        return imageUrl
      }
    }
    
    console.log("[WEIBO-ENRICH] no sinaimg found, kw:", kw)
    return null
  } catch (e) {
    console.log("[WEIBO-ENRICH] EXCEPTION:", e instanceof Error ? e.message : String(e), "kw:", kw)
    return null
  }
}

/**
 * Batch enrichment with concurrency control
 */
async function enrichItemsWithImages(items: WeiboHotItem[]): Promise<WeiboHotItem[]> {
  console.log("[WEIBO-ENRICH] starting enrichment for", items.length, "items")
  
  const results: WeiboHotItem[] = [...items]
  
  // Process in batches of MAX_CONCURRENT
  for (let i = 0; i < items.length; i += MAX_CONCURRENT) {
    const batch = items.slice(i, i + MAX_CONCURRENT)
    const batchResults = await Promise.allSettled(
      batch.map(async (item, idx) => {
        // Add delay to avoid rate limiting
        if (idx > 0) {
          await new Promise(resolve => setTimeout(resolve, DELAY_MS))
        }
        return enrichWeiboImage(item.title)
      })
    )
    
    // Update results with enriched images
    for (let j = 0; j < batchResults.length; j++) {
      const result = batchResults[j]
      if (result.status === "fulfilled" && result.value) {
        results[i + j] = { ...results[i + j], imageUrl: result.value }
      }
    }
    
    // Add delay between batches
    if (i + MAX_CONCURRENT < items.length) {
      await new Promise(resolve => setTimeout(resolve, DELAY_MS))
    }
  }
  
  const enrichedCount = results.filter((item, idx) => item.imageUrl !== items[idx].imageUrl).length
  console.log("[WEIBO-ENRICH] enrichment complete, enriched:", enrichedCount, "of", items.length)
  
  return results
}

/** Source 1: Weibo official API (most reliable) */
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
    console.log("[WEIBO-API] weibo official status:", res.status)
    if (!res.ok) return null
    
    const text = await res.text()
    if (!text.startsWith("{")) return null
    
    const json = JSON.parse(text)
    const realtime = json?.data?.realtime
    if (!Array.isArray(realtime) || realtime.length === 0) return null

    // Log first item's fields to check for image data
    const firstItem = realtime[0]
    console.log("[WEIBO-API] first item fields:", JSON.stringify({
      word: firstItem?.word?.substring(0, 15),
      pic_url: firstItem?.pic_url,
      icon: firstItem?.icon,
      icon_desc: firstItem?.icon_desc,
      icon_desc_color: firstItem?.icon_desc_color,
      allKeys: Object.keys(firstItem || {}),
    }))

    const items: WeiboHotItem[] = realtime.slice(0, 20).map((item: { word?: string; num?: number; raw_hot?: number; icon?: string }, i: number) => ({
      rank: i + 1,
      title: item.word || "",
      hotValue: item.num || item.raw_hot || 0,
      url: `https://s.weibo.com/weibo?q=${encodeURIComponent(item.word || "")}`,
      imageUrl: `https://picsum.photos/seed/${encodeURIComponent((item.word || "").substring(0, 8))}/800/450`, // placeholder
      authorName: "微博热搜",
      authorAvatar: undefined,
      excerpt: `#${item.word}# 正在热议中`,
      mediaType: "image" as const,
    }))

    console.log("[WEIBO-API] source: weibo official, count:", items.length)
    return items
  } catch (e) {
    console.log("[WEIBO-API] weibo official failed:", e instanceof Error ? e.message : String(e))
    return null
  }
}

/** Source 2: 60s API */
async function try60sApi(): Promise<WeiboHotItem[] | null> {
  try {
    const res = await fetch("https://60s.viki.moe/weibo", {
      headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json" },
      signal: AbortSignal.timeout(6000),
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
  const topics = ["热搜话题1", "热搜话题2", "热搜话题3", "热搜话题4", "热搜话题5"]
  console.log("[WEIBO-API] source: static fallback")
  return topics.map((title, i) => ({
    rank: i + 1,
    title,
    hotValue: 1000000 - i * 100000,
    url: `https://s.weibo.com/weibo?q=${encodeURIComponent(title)}`,
    imageUrl: `https://picsum.photos/seed/${i}/800/450`,
    authorName: "微博热搜",
    authorAvatar: undefined,
    excerpt: `${title}正在热议`,
    mediaType: "image" as const,
  }))
}

/**
 * Transfer images to R2 if they are from protected domains
 */
async function transferImagesToR2(items: WeiboHotItem[]): Promise<WeiboHotItem[]> {
  const protectedItems = items.filter(it => /sinaimg\.cn/i.test(it.imageUrl || ""))
  console.log("[WEIBO-R2] items to transfer:", protectedItems.length, "of", items.length)
  
  if (protectedItems.length === 0) {
    return items
  }
  
  const results = await Promise.allSettled(
    items.map(async (item) => {
      const platform = detectPlatform(item.imageUrl)
      if (platform === "unknown") return item
      
      try {
        const result = await transferImage(item.imageUrl)
        if (result.proxied) {
          console.log("[WEIBO-R2] transferred:", item.imageUrl.substring(0, 40), "->", result.proxied.substring(0, 40))
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

  // Try sources in order
  let items = await tryWeiboOfficial()
  if (!items) items = await try60sApi()
  if (!items) items = getStaticFallback()

  // Enrich with real images from s.weibo.com
  items = await enrichItemsWithImages(items)
  
  // Transfer protected images to R2
  items = await transferImagesToR2(items)

  cache = { data: items, timestamp: now }
  return NextResponse.json(items)
}
