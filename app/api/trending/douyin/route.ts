import { NextResponse } from "next/server"

// Douyin trending - v10 using public aggregator APIs only
interface DouyinHotItem {
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

let cache: { data: DouyinHotItem[]; timestamp: number } | null = null
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
async function tryVvhan(): Promise<DouyinHotItem[] | null> {
  try {
    const res = await fetch("https://api.vvhan.com/api/hotlist/douyinHot", {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return null
    const json = await res.json()
    const data = json?.data as VvhanItem[] | undefined
    if (!Array.isArray(data) || data.length === 0) return null

    const items: DouyinHotItem[] = data.slice(0, 30).map((item, i) => ({
      rank: i + 1,
      title: item.title || "",
      hotValue: typeof item.hot === "number" ? item.hot : parseInt(String(item.hot).replace(/[^\d]/g, ""), 10) || 0,
      url: item.url || `https://www.douyin.com/search/${encodeURIComponent(item.title || "")}`,
      imageUrl: item.pic || `https://picsum.photos/seed/${encodeURIComponent((item.title || "").substring(0, 8))}/800/450`,
      authorName: "抖音热榜",
      authorAvatar: undefined,
      excerpt: `${item.title}正在热议`,
      mediaType: "image" as const,
    }))

    console.log("[DOUYIN-API] source: vvhan, count:", items.length, ", sample pic:", items[0]?.imageUrl?.substring(0, 60))
    return items
  } catch (e) {
    console.log("[DOUYIN-API] vvhan failed:", e instanceof Error ? e.message : String(e))
    return null
  }
}

/** Source 2: tenapi API */
async function tryTenapi(): Promise<DouyinHotItem[] | null> {
  try {
    const res = await fetch("https://tenapi.cn/v2/douyinhot", {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return null
    const json = await res.json()
    const data = json?.data as TenapiItem[] | undefined
    if (!Array.isArray(data) || data.length === 0) return null

    const items: DouyinHotItem[] = data.slice(0, 30).map((item, i) => ({
      rank: i + 1,
      title: item.name || "",
      hotValue: typeof item.hot === "number" ? item.hot : parseInt(String(item.hot).replace(/[^\d]/g, ""), 10) || 0,
      url: `https://www.douyin.com/search/${encodeURIComponent(item.name || "")}`,
      imageUrl: item.pic || `https://picsum.photos/seed/${encodeURIComponent((item.name || "").substring(0, 8))}/800/450`,
      authorName: "抖音热榜",
      authorAvatar: undefined,
      excerpt: `${item.name}正在热议`,
      mediaType: "image" as const,
    }))

    console.log("[DOUYIN-API] source: tenapi, count:", items.length, ", sample pic:", items[0]?.imageUrl?.substring(0, 60))
    return items
  } catch (e) {
    console.log("[DOUYIN-API] tenapi failed:", e instanceof Error ? e.message : String(e))
    return null
  }
}

/** Static fallback data */
function getStaticFallback(): DouyinHotItem[] {
  const topics = [
    "马斯克柴犬视频", "外卖小哥弹吉他走红", "00后整顿职场名场面",
    "AI换脸翻车现场", "减肥博主一周挑战", "街头美食探店合集",
    "猫咪搞笑合集", "健身教练翻车日常", "旅行vlog泰国篇",
    "手工达人微缩世界", "变装视频合集", "宠物成精瞬间",
    "美妆教程新手必看", "搞笑情侣日常", "城市夜景延时摄影",
  ]
  console.log("[DOUYIN-API] source: static fallback, count:", topics.length)
  return topics.map((title, i) => ({
    rank: i + 1,
    title,
    hotValue: Math.floor(Math.random() * 10000000) + 500000,
    url: `https://www.douyin.com/search/${encodeURIComponent(title)}`,
    imageUrl: `https://picsum.photos/seed/${encodeURIComponent(title.substring(0, 8))}/800/450`,
    authorName: "抖音热榜",
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
