import { NextResponse } from "next/server"

// TopHub 微信24h热文榜 - dual fallback: HTML scrape → static
const TOPHUB_NODE = "WnBe01o371"
const TOPHUB_HTML_URL = `https://tophub.today/n/${TOPHUB_NODE}`
const TOPHUB_API_KEY = "53c76260b011e6384dbb7b9ebd8d3318"

let cache: { data: unknown[]; ts: number } | null = null
const CACHE_TTL = 60_000 // 60s

function parseHotValue(raw: string): number {
  if (!raw) return 0
  const t = raw.trim()
  if (t.includes("万")) return Math.round(parseFloat(t.replace("万", "")) * 10000)
  return parseInt(t.replace(/[,\s]/g, ""), 10) || 0
}

// ─── Method 1: HTML Scraping from tophub.today ───────────────────────
async function fetchFromHTML() {
  const res = await fetch(TOPHUB_HTML_URL, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      "Referer": "https://tophub.today/",
      "Cookie": `token=${TOPHUB_API_KEY}`,
    },
    next: { revalidate: 60 },
  })

  if (!res.ok) throw new Error(`TopHub HTML: ${res.status}`)
  const html = await res.text()

  const items: {
    id: string; rank: number; title: string; hotValue: number; url: string
    excerpt?: string; topAuthor?: string; topAuthorAvatar?: string
  }[] = []

  // Match the table structure: rank | linked title | hot value
  // Pattern 1: Standard table row format
  const rowRegex = /(\d+)\.\s*\|?\s*\[([^\]]+)\]\s*\(([^)]+)\)|(\d+)\.\s*\|.*?<a\s+href="([^"]*)"[^>]*>([^<]+)<\/a>.*?\|([^|<\n]*)\|/g

  // Try a simpler approach: find all anchor tags in table cells with rank numbers
  // The HTML has: <td>1.</td><td><a href="...">title</a></td><td>10.0万</td>
  const simpleRegex = /<td[^>]*>\s*(\d+)\.\s*<\/td>\s*<td[^>]*>\s*<a\s+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>\s*<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/gi

  let match
  while ((match = simpleRegex.exec(html)) !== null) {
    const rank = parseInt(match[1], 10)
    const rawUrl = match[2]
    const title = match[3].replace(/<[^>]*>/g, "").trim()
    const hotStr = match[4].replace(/<[^>]*>/g, "").trim()
    const hotValue = parseHotValue(hotStr)

    if (!title || title.length < 2) continue
    const url = rawUrl.startsWith("http") ? rawUrl : `https://tophub.today${rawUrl}`

    items.push({
      id: `gzh-${rank}`,
      rank,
      title,
      hotValue: hotValue || Math.max(100000 - rank * 3000, 5000),
      url,
      excerpt: `微信公众号24小时热文 #${rank}，阅读量 ${hotStr || "10万+"}`,
      imageUrl: `https://picsum.photos/seed/${encodeURIComponent(title.substring(0, 8))}/800/450`,
      topAuthor: "公众号热文",
      topAuthorAvatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(title.substring(0, 2))}&backgroundColor=1aad19`,
    })
  }

  // Fallback: try matching the pipe-separated format from the fetched content
  if (items.length === 0) {
    const pipeRegex = /(\d+)\.\|?\[([^\]]+)\][^|]*\|([^|]*)\|/g
    while ((match = pipeRegex.exec(html)) !== null) {
      const rank = parseInt(match[1], 10)
      const title = match[2].trim()
      const hotStr = match[3].trim()
      const hotValue = parseHotValue(hotStr)

      if (!title || title.length < 2) continue

      items.push({
        id: `gzh-${rank}`,
        rank,
        title,
        hotValue: hotValue || Math.max(100000 - rank * 3000, 5000),
        url: `https://weixin.sogou.com/weixin?query=${encodeURIComponent(title)}`,
        excerpt: `微信公众号24小时热文 #${rank}，阅读量 ${hotStr || "10万+"}`,
        imageUrl: `https://picsum.photos/seed/${encodeURIComponent(title.substring(0, 8))}/800/450`,
        topAuthor: "公众号热文",
        topAuthorAvatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(title.substring(0, 2))}&backgroundColor=1aad19`,
      })
    }
  }

  // Fallback: try matching any <a> tags with titles that look like article titles
  if (items.length === 0) {
    const linkRegex = /<a[^>]+href="(\/l\/[^"]*)"[^>]*>([^<]{4,})<\/a>/gi
    let rank = 0
    while ((match = linkRegex.exec(html)) !== null && rank < 30) {
      rank++
      const rawUrl = match[1]
      const title = match[2].trim()
      if (!title || title.length < 4) { rank--; continue }

      items.push({
        id: `gzh-${rank}`,
        rank,
        title,
        hotValue: Math.max(100000 - rank * 3000, 5000),
        url: `https://tophub.today${rawUrl}`,
        excerpt: `微信公众号24小时热文 #${rank}`,
        imageUrl: `https://picsum.photos/seed/${encodeURIComponent(title.substring(0, 8))}/800/450`,
        topAuthor: "公众号热文",
        topAuthorAvatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(title.substring(0, 2))}&backgroundColor=1aad19`,
      })
    }
  }

  if (items.length === 0) throw new Error("HTML parse returned 0 items")
  return items
}

// ─── Method 2: Static fallback ───────────────────────────────────────
function getStaticFallback() {
  const titles = [
    "北大教授发现1426亿棵树！",
    "降息50个基点",
    "香港科技大学已录取两位哈佛转校生",
    "突发，暴跌！特朗普：马斯克疯了",
    "突发！全境拉响警报！",
    "随时可能发生大规模地震！我使馆，紧急提醒",
    "马斯克表示愿意和特朗普和解",
    "全面决裂！刚刚特朗普整了个大活！",
    "海棠作者被异地传唤：耽美作品涉罪的边界与争议",
    "张雪峰，走好",
    "聊聊哈佛女被围攻这事折射出来的社会现实",
    "刘文超不幸离世，终年54岁",
    "西子电梯发讣告：董事长不幸离世",
    "稳定币第一股，被疯抢",
    "吵完架反悔了？马斯克改口",
    "马斯克曝猛料：特朗普的名字在爱泼斯坦档案中",
    "特朗普政府发动史无前例报复",
    "重磅！中芯国际卖厂瘦身",
    "凌晨重磅！果然爆了，熔断！",
    "彻底撕破脸，马斯克：特朗普应该被弹劾",
  ]

  return titles.map((title, i) => ({
    id: `gzh-${i + 1}`,
    rank: i + 1,
    title,
    hotValue: Math.max(100000 - i * 4000, 5000),
    url: `https://weixin.sogou.com/weixin?query=${encodeURIComponent(title)}`,
    excerpt: `微信公众号24小时热文 #${i + 1}`,
    imageUrl: `https://picsum.photos/seed/${encodeURIComponent(title.substring(0, 8))}/800/450`,
    topAuthor: "公众号热文",
    topAuthorAvatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(title.substring(0, 2))}&backgroundColor=1aad19`,
  }))
}

export async function GET() {
  if (cache && Date.now() - cache.ts < CACHE_TTL) {
    return NextResponse.json(cache.data, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
    })
  }

  let items: unknown[] | null = null
  let source = "static"

  // Try 1: HTML Scraping
  try {
    items = await fetchFromHTML()
    if (items && items.length > 0) source = "html"
  } catch (e) {
    console.error("[GZH] HTML method failed:", e)
  }

  // Try 2: Static fallback (always works)
  if (!items || items.length === 0) {
    items = getStaticFallback()
    source = "static"
  }

  cache = { data: items, ts: Date.now() }
  return NextResponse.json(items, {
    headers: {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
      "X-Data-Source": source,
    },
  })
}
