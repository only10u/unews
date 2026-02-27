import { NextResponse } from "next/server"

// Weibo trending - v10 using public aggregator APIs only
interface WeiboHotItem {
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

let cache: { data: WeiboHotItem[]; timestamp: number } | null = null
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
async function tryVvhan(): Promise<WeiboHotItem[] | null> {
  try {
    const res = await fetch("https://api.vvhan.com/api/hotlist/wbHot", {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return null
    const json = await res.json()
    const data = json?.data as VvhanItem[] | undefined
    if (!Array.isArray(data) || data.length === 0) return null

    const items: WeiboHotItem[] = data.slice(0, 30).map((item, i) => ({
      rank: i + 1,
      title: item.title || "",
      hotValue: typeof item.hot === "number" ? item.hot : parseInt(String(item.hot).replace(/[^\d]/g, ""), 10) || 0,
      url: item.url || `https://s.weibo.com/weibo?q=${encodeURIComponent(item.title || "")}`,
      imageUrl: item.pic || `https://picsum.photos/seed/${encodeURIComponent((item.title || "").substring(0, 8))}/800/450`,
      authorName: "微博热搜",
      authorAvatar: undefined,
      excerpt: `${item.title}正在热议`,
      mediaType: "image" as const,
    }))

    console.log("[WEIBO-API] source: vvhan, count:", items.length, ", sample pic:", items[0]?.imageUrl?.substring(0, 60))
    return items
  } catch (e) {
    console.log("[WEIBO-API] vvhan failed:", e instanceof Error ? e.message : String(e))
    return null
  }
}

/** Source 2: tenapi API */
async function tryTenapi(): Promise<WeiboHotItem[] | null> {
  try {
    const res = await fetch("https://tenapi.cn/v2/weibohot", {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return null
    const json = await res.json()
    const data = json?.data as TenapiItem[] | undefined
    if (!Array.isArray(data) || data.length === 0) return null

    const items: WeiboHotItem[] = data.slice(0, 30).map((item, i) => ({
      rank: i + 1,
      title: item.name || "",
      hotValue: typeof item.hot === "number" ? item.hot : parseInt(String(item.hot).replace(/[^\d]/g, ""), 10) || 0,
      url: `https://s.weibo.com/weibo?q=${encodeURIComponent(item.name || "")}`,
      imageUrl: item.pic || `https://picsum.photos/seed/${encodeURIComponent((item.name || "").substring(0, 8))}/800/450`,
      authorName: "微博热搜",
      authorAvatar: undefined,
      excerpt: `${item.name}正在热议`,
      mediaType: "image" as const,
    }))

    console.log("[WEIBO-API] source: tenapi, count:", items.length, ", sample pic:", items[0]?.imageUrl?.substring(0, 60))
    return items
  } catch (e) {
    console.log("[WEIBO-API] tenapi failed:", e instanceof Error ? e.message : String(e))
    return null
  }
}

/** Static fallback data */
function getStaticFallback(): WeiboHotItem[] {
  const topics = [
    "特朗普比特币储备计划", "以太坊ETF突破历史", "Solana生态大爆发",
    "BNB Chain新升级", "AI Agent代币暴涨", "链上巨鲸大额转账",
    "SEC加密监管新动向", "Meme币百倍神话", "DeFi TVL创新高",
    "NFT市场回暖", "Layer2生态格局", "稳定币市值突破2000亿",
    "加密行业裁员潮", "比特币减半效应", "Web3游戏爆款",
  ]
  console.log("[WEIBO-API] source: static fallback, count:", topics.length)
  return topics.map((title, i) => ({
    rank: i + 1,
    title,
    hotValue: Math.floor(Math.random() * 10000000) + 500000,
    url: `https://s.weibo.com/weibo?q=${encodeURIComponent(title)}`,
    imageUrl: `https://picsum.photos/seed/${encodeURIComponent(title.substring(0, 8))}/800/450`,
    authorName: "微博热搜",
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
