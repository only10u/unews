import { NextResponse } from "next/server"
import { transferImage, detectPlatform } from "@/lib/r2"

// Douyin trending - v16 with real video cover enrichment
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
const CACHE_TTL = 60_000

const MAX_CONCURRENT = 3
const DELAY_MS = 500

/**
 * Enrichment: Fetch video cover from Douyin API
 */
async function enrichDouyinImage(keyword: string): Promise<{ imageUrl?: string; authorName?: string } | null> {
  try {
    // Try Douyin search API
    const url = `https://www.douyin.com/aweme/v1/web/hot/search/list/`
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1",
        "Accept": "application/json",
        "Referer": "https://www.douyin.com/",
      },
      signal: AbortSignal.timeout(6000),
    })
    
    if (!res.ok) {
      console.log("[DOUYIN-ENRICH] API failed:", res.status)
      return null
    }
    
    const json = await res.json()
    const list = json?.data?.word_list || json?.word_list || []
    
    // Find matching item
    const match = list.find((item: { word?: string }) => 
      item.word?.includes(keyword.substring(0, 4)) || keyword.includes(item.word?.substring(0, 4) || "")
    )
    
    if (match?.cover) {
      let coverUrl = match.cover
      if (coverUrl.startsWith("//")) coverUrl = "https:" + coverUrl
      console.log("[DOUYIN-ENRICH] found cover:", coverUrl.substring(0, 50))
      return { imageUrl: coverUrl }
    }
    
    return null
  } catch (e) {
    console.log("[DOUYIN-ENRICH] exception:", e instanceof Error ? e.message : String(e))
    return null
  }
}

/**
 * Batch enrichment with concurrency control
 */
async function enrichItemsWithImages(items: DouyinHotItem[]): Promise<DouyinHotItem[]> {
  console.log("[DOUYIN-ENRICH] starting enrichment for", items.length, "items")
  
  const results: DouyinHotItem[] = [...items]
  
  for (let i = 0; i < Math.min(items.length, 10); i += MAX_CONCURRENT) {
    const batch = items.slice(i, i + MAX_CONCURRENT)
    const batchResults = await Promise.allSettled(
      batch.map(async (item, idx) => {
        if (idx > 0) await new Promise(resolve => setTimeout(resolve, DELAY_MS))
        return enrichDouyinImage(item.title)
      })
    )
    
    for (let j = 0; j < batchResults.length; j++) {
      const result = batchResults[j]
      if (result.status === "fulfilled" && result.value?.imageUrl) {
        results[i + j] = { ...results[i + j], imageUrl: result.value.imageUrl }
      }
    }
    
    if (i + MAX_CONCURRENT < items.length) {
      await new Promise(resolve => setTimeout(resolve, DELAY_MS))
    }
  }
  
  return results
}

/** Source 1: Douyin official hot list API */
async function tryDouyinOfficial(): Promise<DouyinHotItem[] | null> {
  try {
    const res = await fetch("https://www.douyin.com/aweme/v1/web/hot/search/list/", {
      headers: {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15",
        "Accept": "application/json",
        "Referer": "https://www.douyin.com/",
      },
      signal: AbortSignal.timeout(6000),
    })
    console.log("[DOUYIN-API] official status:", res.status)
    if (!res.ok) return null
    
    const json = await res.json()
    const list = json?.data?.word_list || json?.word_list || []
    if (!Array.isArray(list) || list.length === 0) return null

    const items: DouyinHotItem[] = list.slice(0, 20).map((item: { word?: string; hot_value?: number; cover?: string }, i: number) => {
      let coverUrl = item.cover || ""
      if (coverUrl.startsWith("//")) coverUrl = "https:" + coverUrl
      
      return {
        rank: i + 1,
        title: item.word || "",
        hotValue: item.hot_value || 0,
        url: `https://www.douyin.com/search/${encodeURIComponent(item.word || "")}`,
        imageUrl: coverUrl || `https://picsum.photos/seed/dy${i}/800/450`,
        authorName: "抖音热榜",
        authorAvatar: undefined,
        excerpt: `#${item.word}# 正在抖音热播`,
        mediaType: "video" as const,
      }
    })

    console.log("[DOUYIN-API] source: douyin official, count:", items.length, "with covers:", items.filter(i => i.imageUrl.includes("douyinpic")).length)
    return items
  } catch (e) {
    console.log("[DOUYIN-API] official failed:", e instanceof Error ? e.message : String(e))
    return null
  }
}

/** Source 2: 60s API */
async function try60sApi(): Promise<DouyinHotItem[] | null> {
  try {
    const res = await fetch("https://60s.viki.moe/douyin", {
      headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json" },
      signal: AbortSignal.timeout(6000),
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

/** Static fallback */
function getStaticFallback(): DouyinHotItem[] {
  const topics = ["抖音热门话题1", "抖音热门话题2", "抖音热门话题3"]
  console.log("[DOUYIN-API] source: static fallback")
  return topics.map((title, i) => ({
    rank: i + 1,
    title,
    hotValue: 1000000,
    url: `https://www.douyin.com/search/${encodeURIComponent(title)}`,
    imageUrl: `https://picsum.photos/seed/dy${i}/800/450`,
    authorName: "抖音热榜",
    authorAvatar: undefined,
    excerpt: `${title}正在热播`,
    mediaType: "video" as const,
  }))
}

/**
 * Transfer images to R2 if they are from protected domains
 */
async function transferImagesToR2(items: DouyinHotItem[]): Promise<DouyinHotItem[]> {
  const protectedItems = items.filter(it => /douyinpic\.com|bytedance/i.test(it.imageUrl || ""))
  console.log("[DOUYIN-R2] items to transfer:", protectedItems.length, "of", items.length)
  
  if (protectedItems.length === 0) return items
  
  const results = await Promise.allSettled(
    items.map(async (item) => {
      const platform = detectPlatform(item.imageUrl)
      if (platform === "unknown") return item
      
      try {
        const result = await transferImage(item.imageUrl)
        if (result.proxied) {
          console.log("[DOUYIN-R2] transferred:", item.imageUrl.substring(0, 40))
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

  let items = await tryDouyinOfficial()
  if (!items) items = await try60sApi()
  if (!items) items = getStaticFallback()

  // Enrich items without covers
  const needsEnrichment = items.filter(i => !i.imageUrl.includes("douyinpic")).length > items.length / 2
  if (needsEnrichment) {
    items = await enrichItemsWithImages(items)
  }
  
  // Transfer protected images to R2
  items = await transferImagesToR2(items)

  cache = { data: items, timestamp: now }
  return NextResponse.json(items)
}
