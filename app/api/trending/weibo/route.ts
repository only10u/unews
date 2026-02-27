import { NextResponse } from "next/server"

// Weibo trending - v11 with more API sources
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

/** Source 1: TopHub official API */
async function tryTopHub(): Promise<WeiboHotItem[] | null> {
  try {
    const res = await fetch("https://api.tophubdata.com/v2/nodes/KqndgxeLl9", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "application/json",
      },
      signal: AbortSignal.timeout(6000),
    })
    console.log("[WEIBO-API] tophub status:", res.status)
    if (!res.ok) return null
    const json = await res.json()
    const data = json?.data?.items
    if (!Array.isArray(data) || data.length === 0) return null

    const items: WeiboHotItem[] = data.slice(0, 30).map((item: { title?: string; extra?: { icon?: string; hot?: number }; url?: string }, i: number) => ({
      rank: i + 1,
      title: item.title || "",
      hotValue: item.extra?.hot || Math.floor(Math.random() * 5000000) + 100000,
      url: item.url || `https://s.weibo.com/weibo?q=${encodeURIComponent(item.title || "")}`,
      imageUrl: item.extra?.icon || `https://picsum.photos/seed/${encodeURIComponent((item.title || "").substring(0, 8))}/800/450`,
      authorName: "微博热搜",
      authorAvatar: undefined,
      excerpt: `${item.title}正在热议`,
      mediaType: "image" as const,
    }))

    console.log("[WEIBO-API] source: tophub, count:", items.length)
    return items
  } catch (e) {
    console.log("[WEIBO-API] tophub failed:", e instanceof Error ? e.message : String(e))
    return null
  }
}

/** Source 2: 60s API (reliable, based in China) */
async function try60sApi(): Promise<WeiboHotItem[] | null> {
  try {
    const res = await fetch("https://60s.viki.moe/weibo", {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/json",
      },
      signal: AbortSignal.timeout(6000),
    })
    console.log("[WEIBO-API] 60s status:", res.status)
    if (!res.ok) return null
    const json = await res.json()
    const data = json?.data
    if (!Array.isArray(data) || data.length === 0) return null

    const items: WeiboHotItem[] = data.slice(0, 30).map((item: { title?: string; url?: string; hot?: number }, i: number) => ({
      rank: i + 1,
      title: item.title || "",
      hotValue: item.hot || Math.floor(Math.random() * 5000000) + 100000,
      url: item.url || `https://s.weibo.com/weibo?q=${encodeURIComponent(item.title || "")}`,
      imageUrl: `https://picsum.photos/seed/${encodeURIComponent((item.title || "").substring(0, 8))}/800/450`,
      authorName: "微博热搜",
      authorAvatar: undefined,
      excerpt: `${item.title}正在热议`,
      mediaType: "image" as const,
    }))

    console.log("[WEIBO-API] source: 60s, count:", items.length)
    return items
  } catch (e) {
    console.log("[WEIBO-API] 60s failed:", e instanceof Error ? e.message : String(e))
    return null
  }
}

/** Source 3: Weibo official realtimehot (may return HTML but worth trying) */
async function tryWeiboOfficial(): Promise<WeiboHotItem[] | null> {
  try {
    const res = await fetch("https://weibo.com/ajax/side/hotSearch", {
      headers: {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        "Accept": "application/json, text/plain, */*",
        "Referer": "https://weibo.com/",
      },
      signal: AbortSignal.timeout(5000),
    })
    console.log("[WEIBO-API] weibo official status:", res.status)
    if (!res.ok) return null
    
    const text = await res.text()
    if (!text.startsWith("{")) {
      console.log("[WEIBO-API] weibo official not JSON:", text.substring(0, 50))
      return null
    }
    
    const json = JSON.parse(text)
    const realtime = json?.data?.realtime
    if (!Array.isArray(realtime) || realtime.length === 0) return null

    const items: WeiboHotItem[] = realtime.slice(0, 30).map((item: { word?: string; num?: number; raw_hot?: number }, i: number) => ({
      rank: i + 1,
      title: item.word || "",
      hotValue: item.num || item.raw_hot || Math.floor(Math.random() * 5000000) + 100000,
      url: `https://s.weibo.com/weibo?q=${encodeURIComponent(item.word || "")}`,
      imageUrl: `https://picsum.photos/seed/${encodeURIComponent((item.word || "").substring(0, 8))}/800/450`,
      authorName: "微博热搜",
      authorAvatar: undefined,
      excerpt: `${item.word}正在热议`,
      mediaType: "image" as const,
    }))

    console.log("[WEIBO-API] source: weibo official, count:", items.length, 
      "sample:", JSON.stringify({
        title: items[0]?.title,
        imageUrl: items[0]?.imageUrl,
        authorName: items[0]?.authorName,
        authorAvatar: items[0]?.authorAvatar,
      }))
    return items
  } catch (e) {
    console.log("[WEIBO-API] weibo official failed:", e instanceof Error ? e.message : String(e))
    return null
  }
}

/** Source 4: oioweb API */
async function tryOioweb(): Promise<WeiboHotItem[] | null> {
  try {
    const res = await fetch("https://api.oioweb.cn/api/common/HotList?type=weibo", {
      headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json" },
      signal: AbortSignal.timeout(5000),
    })
    console.log("[WEIBO-API] oioweb status:", res.status)
    if (!res.ok) return null
    const json = await res.json()
    const data = json?.result
    if (!Array.isArray(data) || data.length === 0) return null

    const items: WeiboHotItem[] = data.slice(0, 30).map((item: { title?: string; hot?: string | number; url?: string }, i: number) => ({
      rank: i + 1,
      title: item.title || "",
      hotValue: typeof item.hot === "number" ? item.hot : parseInt(String(item.hot || "0").replace(/[^\d]/g, ""), 10) || 0,
      url: item.url || `https://s.weibo.com/weibo?q=${encodeURIComponent(item.title || "")}`,
      imageUrl: `https://picsum.photos/seed/${encodeURIComponent((item.title || "").substring(0, 8))}/800/450`,
      authorName: "微博热搜",
      authorAvatar: undefined,
      excerpt: `${item.title}正在热议`,
      mediaType: "image" as const,
    }))

    console.log("[WEIBO-API] source: oioweb, count:", items.length)
    return items
  } catch (e) {
    console.log("[WEIBO-API] oioweb failed:", e instanceof Error ? e.message : String(e))
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
  let items = await tryTopHub()
  if (!items) items = await try60sApi()
  if (!items) items = await tryWeiboOfficial()
  if (!items) items = await tryOioweb()
  if (!items) items = getStaticFallback()

  cache = { data: items, timestamp: now }
  return NextResponse.json(items)
}
