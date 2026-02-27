import { NextResponse } from "next/server"
import { transferImage, detectPlatform } from "@/lib/r2"

// Douyin trending - v14 with R2 image transfer
interface DouyinHotItem {
  rank: number
  title: string
  hotValue: number
  url: string
  imageUrl: string
  authorName: string
  authorAvatar: undefined
  excerpt: string
  mediaType: "video"
}

let cache: { data: DouyinHotItem[]; timestamp: number } | null = null
const CACHE_TTL = 30_000

/** Source 1: TopHub API for Douyin */
async function tryTopHub(): Promise<DouyinHotItem[] | null> {
  try {
    const res = await fetch("https://api.tophubdata.com/v2/nodes/DpQvNABoNE", {
      headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json" },
      signal: AbortSignal.timeout(6000),
    })
    console.log("[DOUYIN-API] tophub status:", res.status)
    if (!res.ok) return null
    const json = await res.json()
    const data = json?.data?.items
    if (!Array.isArray(data) || data.length === 0) return null

    const items: DouyinHotItem[] = data.slice(0, 30).map((item: { title?: string; extra?: { hot?: number }; url?: string }, i: number) => ({
      rank: i + 1,
      title: item.title || "",
      hotValue: item.extra?.hot || Math.floor(Math.random() * 5000000) + 100000,
      url: item.url || `https://www.douyin.com/search/${encodeURIComponent(item.title || "")}`,
      imageUrl: `https://picsum.photos/seed/dy${encodeURIComponent((item.title || "").substring(0, 6))}/800/450`,
      authorName: "抖音热榜",
      authorAvatar: undefined,
      excerpt: `${item.title}正在抖音热播`,
      mediaType: "video" as const,
    }))

    console.log("[DOUYIN-API] source: tophub, count:", items.length)
    return items
  } catch (e) {
    console.log("[DOUYIN-API] tophub failed:", e instanceof Error ? e.message : String(e))
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

    const items: DouyinHotItem[] = data.slice(0, 30).map((item: { title?: string; url?: string; hot?: number }, i: number) => ({
      rank: i + 1,
      title: item.title || "",
      hotValue: item.hot || Math.floor(Math.random() * 5000000) + 100000,
      url: item.url || `https://www.douyin.com/search/${encodeURIComponent(item.title || "")}`,
      imageUrl: `https://picsum.photos/seed/dy${encodeURIComponent((item.title || "").substring(0, 6))}/800/450`,
      authorName: "抖音热榜",
      authorAvatar: undefined,
      excerpt: `${item.title}正在抖音热播`,
      mediaType: "video" as const,
    }))

    console.log("[DOUYIN-API] source: 60s, count:", items.length)
    return items
  } catch (e) {
    console.log("[DOUYIN-API] 60s failed:", e instanceof Error ? e.message : String(e))
    return null
  }
}

/** Source 3: oioweb API */
async function tryOioweb(): Promise<DouyinHotItem[] | null> {
  try {
    const res = await fetch("https://api.oioweb.cn/api/common/HotList?type=douyin", {
      headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json" },
      signal: AbortSignal.timeout(5000),
    })
    console.log("[DOUYIN-API] oioweb status:", res.status)
    if (!res.ok) return null
    const json = await res.json()
    const data = json?.result
    if (!Array.isArray(data) || data.length === 0) return null

    const items: DouyinHotItem[] = data.slice(0, 30).map((item: { title?: string; hot?: string | number; url?: string }, i: number) => ({
      rank: i + 1,
      title: item.title || "",
      hotValue: typeof item.hot === "number" ? item.hot : parseInt(String(item.hot || "0").replace(/[^\d]/g, ""), 10) || 0,
      url: item.url || `https://www.douyin.com/search/${encodeURIComponent(item.title || "")}`,
      imageUrl: `https://picsum.photos/seed/dy${encodeURIComponent((item.title || "").substring(0, 6))}/800/450`,
      authorName: "抖音热榜",
      authorAvatar: undefined,
      excerpt: `${item.title}正在抖音热播`,
      mediaType: "video" as const,
    }))

    console.log("[DOUYIN-API] source: oioweb, count:", items.length)
    return items
  } catch (e) {
    console.log("[DOUYIN-API] oioweb failed:", e instanceof Error ? e.message : String(e))
    return null
  }
}

/** Static fallback */
function getStaticFallback(): DouyinHotItem[] {
  const topics = [
    "AI换脸神器爆火", "千万粉丝主播翻车", "国风变装挑战",
    "萌宠搞笑日常", "美食探店实录", "健身打卡挑战",
    "穿搭灵感分享", "旅行Vlog合集", "搞笑段子精选",
    "音乐翻唱挑战", "舞蹈教学热门", "剧情反转神作",
    "科技数码测评", "家居改造灵感", "情感故事分享",
  ]
  console.log("[DOUYIN-API] source: static fallback, count:", topics.length)
  return topics.map((title, i) => ({
    rank: i + 1,
    title,
    hotValue: Math.floor(Math.random() * 10000000) + 500000,
    url: `https://www.douyin.com/search/${encodeURIComponent(title)}`,
    imageUrl: `https://picsum.photos/seed/dy${encodeURIComponent(title.substring(0, 6))}/800/450`,
    authorName: "抖音热榜",
    authorAvatar: undefined,
    excerpt: `${title}正在抖音热播`,
    mediaType: "video" as const,
  }))
}

/**
 * Transfer images to R2 if they are from protected domains
 */
async function transferImagesToR2(items: DouyinHotItem[]): Promise<DouyinHotItem[]> {
  const results = await Promise.allSettled(
    items.map(async (item) => {
      const platform = detectPlatform(item.imageUrl)
      if (platform === "unknown") return item
      
      try {
        const result = await transferImage(item.imageUrl)
        if (result.proxied) {
          console.log("[DOUYIN-R2] transferred:", item.imageUrl.substring(0, 50), "->", result.proxied.substring(0, 50))
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
  if (!items) items = await tryOioweb()
  if (!items) items = getStaticFallback()

  // Transfer protected images to R2
  items = await transferImagesToR2(items)

  cache = { data: items, timestamp: now }
  return NextResponse.json(items)
}
