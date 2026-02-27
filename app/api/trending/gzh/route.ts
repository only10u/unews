import { NextResponse } from "next/server"
import { transferImage, detectPlatform } from "@/lib/r2"

// GZH (WeChat Official Accounts) trending - v14 with R2 image transfer
interface GzhHotItem {
  rank: number
  title: string
  hotValue: number
  url: string
  imageUrl: string
  authorName: string
  authorAvatar: undefined
  excerpt: string
  mediaType: "image"
}

let cache: { data: GzhHotItem[]; timestamp: number } | null = null
const CACHE_TTL = 30_000

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

    const items: GzhHotItem[] = data.slice(0, 30).map((item: { title?: string; extra?: { hot?: number; info?: string }; url?: string }, i: number) => ({
      rank: i + 1,
      title: item.title || "",
      hotValue: item.extra?.hot || Math.floor(Math.random() * 5000000) + 100000,
      url: item.url || `https://weixin.sogou.com/weixin?query=${encodeURIComponent(item.title || "")}`,
      imageUrl: `https://picsum.photos/seed/wx${encodeURIComponent((item.title || "").substring(0, 6))}/800/450`,
      authorName: item.extra?.info || "公众号热文",
      authorAvatar: undefined,
      excerpt: `${item.title}`,
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

    const items: GzhHotItem[] = data.slice(0, 30).map((item: { title?: string; url?: string; hot?: number }, i: number) => ({
      rank: i + 1,
      title: item.title || "",
      hotValue: item.hot || Math.floor(Math.random() * 5000000) + 100000,
      url: item.url || `https://weixin.sogou.com/weixin?query=${encodeURIComponent(item.title || "")}`,
      imageUrl: `https://picsum.photos/seed/wx${encodeURIComponent((item.title || "").substring(0, 6))}/800/450`,
      authorName: "公众号热文",
      authorAvatar: undefined,
      excerpt: `${item.title}`,
      mediaType: "image" as const,
    }))

    console.log("[GZH-API] source: 60s, count:", items.length)
    return items
  } catch (e) {
    console.log("[GZH-API] 60s failed:", e instanceof Error ? e.message : String(e))
    return null
  }
}

/** Source 3: oioweb API */
async function tryOioweb(): Promise<GzhHotItem[] | null> {
  try {
    const res = await fetch("https://api.oioweb.cn/api/common/HotList?type=wx", {
      headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json" },
      signal: AbortSignal.timeout(5000),
    })
    console.log("[GZH-API] oioweb status:", res.status)
    if (!res.ok) return null
    const json = await res.json()
    const data = json?.result
    if (!Array.isArray(data) || data.length === 0) return null

    const items: GzhHotItem[] = data.slice(0, 30).map((item: { title?: string; hot?: string | number; url?: string; author?: string }, i: number) => ({
      rank: i + 1,
      title: item.title || "",
      hotValue: typeof item.hot === "number" ? item.hot : parseInt(String(item.hot || "0").replace(/[^\d]/g, ""), 10) || 0,
      url: item.url || `https://weixin.sogou.com/weixin?query=${encodeURIComponent(item.title || "")}`,
      imageUrl: `https://picsum.photos/seed/wx${encodeURIComponent((item.title || "").substring(0, 6))}/800/450`,
      authorName: item.author || "公众号热文",
      authorAvatar: undefined,
      excerpt: `${item.title}`,
      mediaType: "image" as const,
    }))

    console.log("[GZH-API] source: oioweb, count:", items.length)
    return items
  } catch (e) {
    console.log("[GZH-API] oioweb failed:", e instanceof Error ? e.message : String(e))
    return null
  }
}

/** Static fallback data */
function getStaticFallback(): GzhHotItem[] {
  const topics = [
    "三大运营商集体宣布AI战略", "教育部新规引发家长热议",
    "央行数字货币最新进展", "新能源车企年度销量排行",
    "医保改革最新政策解读", "房地产市场回暖信号明显",
    "互联网大厂组织架构调整", "高考改革方案全面解析",
    "5G-A商用进程加速", "芯片产业链国产替代突破",
    "碳中和政策落地实施细则", "乡村振兴典型案例分析",
    "食品安全新标准出台", "养老金制度改革方向",
    "青年就业创业新政策",
  ]
  console.log("[GZH-API] source: static fallback, count:", topics.length)
  return topics.map((title, i) => ({
    rank: i + 1,
    title,
    hotValue: Math.floor(Math.random() * 10000000) + 500000,
    url: `https://weixin.sogou.com/weixin?query=${encodeURIComponent(title)}`,
    imageUrl: `https://picsum.photos/seed/wx${encodeURIComponent(title.substring(0, 6))}/800/450`,
    authorName: "公众号热文",
    authorAvatar: undefined,
    excerpt: `${title}`,
    mediaType: "image" as const,
  }))
}

/**
 * Transfer images to R2 if they are from protected domains
 */
async function transferImagesToR2(items: GzhHotItem[]): Promise<GzhHotItem[]> {
  const protectedCount = items.filter(it => /sinaimg\.cn|mmbiz\.qpic\.cn|douyinpic\.com/i.test(it.imageUrl || "")).length
  console.log("[GZH-R2] transferImagesToR2 called, total:", items.length, "protected:", protectedCount, "sample URL:", items[0]?.imageUrl?.substring(0, 60))
  
  const results = await Promise.allSettled(
    items.map(async (item) => {
      const platform = detectPlatform(item.imageUrl)
      if (platform === "unknown") return item
      
      try {
        const result = await transferImage(item.imageUrl)
        if (result.proxied) {
          console.log("[GZH-R2] transferred:", item.imageUrl.substring(0, 50), "->", result.proxied.substring(0, 50))
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
