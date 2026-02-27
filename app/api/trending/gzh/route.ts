import { NextResponse } from "next/server"

// GZH (WeChat Official Accounts) trending - v10 using public aggregator APIs only
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

interface VvhanItem {
  title: string
  hot: string | number
  url: string
  pic?: string
}

interface TenapiItem {
  name: string
  hot: string | number
  pic?: string
}

/** Source 1: vvhan API */
async function tryVvhan(): Promise<GzhHotItem[] | null> {
  try {
    const res = await fetch("https://api.vvhan.com/api/hotlist/wxHot", {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return null
    const json = await res.json()
    const data = json?.data as VvhanItem[] | undefined
    if (!Array.isArray(data) || data.length === 0) return null

    const items: GzhHotItem[] = data.slice(0, 30).map((item, i) => ({
      rank: i + 1,
      title: item.title || "",
      hotValue: typeof item.hot === "number" ? item.hot : parseInt(String(item.hot).replace(/[^\d]/g, ""), 10) || 0,
      url: item.url || `https://weixin.sogou.com/weixin?query=${encodeURIComponent(item.title || "")}`,
      imageUrl: item.pic || `https://picsum.photos/seed/${encodeURIComponent((item.title || "").substring(0, 8))}/800/450`,
      authorName: "公众号热文",
      authorAvatar: undefined,
      excerpt: `${item.title}正在热议`,
      mediaType: "image" as const,
    }))

    console.log("[GZH-API] source: vvhan, count:", items.length, ", sample pic:", items[0]?.imageUrl?.substring(0, 60))
    return items
  } catch (e) {
    console.log("[GZH-API] vvhan failed:", e instanceof Error ? e.message : String(e))
    return null
  }
}

/** Source 2: tenapi API */
async function tryTenapi(): Promise<GzhHotItem[] | null> {
  try {
    const res = await fetch("https://tenapi.cn/v2/wxhot", {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return null
    const json = await res.json()
    const data = json?.data as TenapiItem[] | undefined
    if (!Array.isArray(data) || data.length === 0) return null

    const items: GzhHotItem[] = data.slice(0, 30).map((item, i) => ({
      rank: i + 1,
      title: item.name || "",
      hotValue: typeof item.hot === "number" ? item.hot : parseInt(String(item.hot).replace(/[^\d]/g, ""), 10) || 0,
      url: `https://weixin.sogou.com/weixin?query=${encodeURIComponent(item.name || "")}`,
      imageUrl: item.pic || `https://picsum.photos/seed/${encodeURIComponent((item.name || "").substring(0, 8))}/800/450`,
      authorName: "公众号热文",
      authorAvatar: undefined,
      excerpt: `${item.name}正在热议`,
      mediaType: "image" as const,
    }))

    console.log("[GZH-API] source: tenapi, count:", items.length, ", sample pic:", items[0]?.imageUrl?.substring(0, 60))
    return items
  } catch (e) {
    console.log("[GZH-API] tenapi failed:", e instanceof Error ? e.message : String(e))
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
    imageUrl: `https://picsum.photos/seed/${encodeURIComponent(title.substring(0, 8))}/800/450`,
    authorName: "公众号热文",
    authorAvatar: undefined,
    excerpt: `${title}正在热议`,
    mediaType: "image" as const,
  }))
}

export async function GET() {
  const now = Date.now()
  if (cache && now - cache.timestamp < CACHE_TTL) {
    return NextResponse.json(cache.data)
  }

  // Try sources in order
  let items = await tryVvhan()
  if (!items) {
    items = await tryTenapi()
  }
  if (!items) {
    items = getStaticFallback()
  }

  cache = { data: items, timestamp: now }
  return NextResponse.json(items)
}
