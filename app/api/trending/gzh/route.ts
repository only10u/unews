import { NextResponse } from "next/server"

// GZH (WeChat Official Accounts) trending - v5 rebuilt from scratch
interface GzhHotItem {
  id: string
  rank: number
  title: string
  hotValue: number
  url: string
  excerpt?: string
  imageUrl?: string
  videoUrl?: string
  mediaType?: "image" | "video"
  authorName?: string
  authorAvatar?: string
  detailContent?: string
}

let cache: { data: GzhHotItem[]; ts: number } | null = null
const CACHE_TTL = 60_000

function parseHotValue(raw: string): number {
  if (!raw) return 0
  const t = raw.trim()
  if (t.includes("万")) return Math.round(parseFloat(t.replace("万", "")) * 10000)
  return parseInt(t.replace(/[,\s]/g, ""), 10) || 0
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
    .trim()
}

/** Fetch article detail via Sogou WeChat search */
async function fetchGzhDetail(keyword: string): Promise<{
  excerpt?: string
  detailContent?: string
  imageUrl?: string
  authorName?: string
  authorAvatar?: string
} | null> {
  try {
    const q = encodeURIComponent(keyword)
    const res = await fetch(`https://weixin.sogou.com/weixin?type=2&query=${q}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html",
        Referer: "https://weixin.sogou.com/",
      },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return null
    const html = await res.text()

    // Extract first article result
    const titleMatch = html.match(/<a[^>]*uigs="article_title_0"[^>]*>([^<]+)/i)
    const imgMatch = html.match(/<img[^>]*src="(https?:\/\/[^"]*mmbiz[^"]*)"/i)
    const accountMatch = html.match(/<a[^>]*uigs="account_name_0"[^>]*>([^<]+)/i)
    const contentMatch = html.match(/<p[^>]*class="txt-info"[^>]*>([^<]+)/i)

    if (!titleMatch && !contentMatch) return null

    const authorName = accountMatch ? stripHtml(accountMatch[1]) : undefined
    const excerpt = contentMatch ? stripHtml(contentMatch[1]).substring(0, 150) : undefined
    const imageUrl = imgMatch ? imgMatch[1].replace(/&amp;/g, "&") : undefined

    return {
      excerpt,
      detailContent: excerpt,
      imageUrl,
      authorName,
      authorAvatar: authorName
        ? `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(authorName)}&backgroundColor=1aad19`
        : undefined,
    }
  } catch {
    return null
  }
}

/** Scrape TopHub GZH trending page */
async function fetchFromHTML(): Promise<GzhHotItem[]> {
  const res = await fetch("https://tophub.today/n/WnBe01o371", {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html",
    },
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`TopHub HTML: ${res.status}`)
  const html = await res.text()

  const items: GzhHotItem[] = []
  let match: RegExpExecArray | null

  // Pattern: <td>rank</td> ... <a href="url">title</a> ... <td>hotValue</td>
  const rowRegex = /<tr[^>]*>[\s\S]*?<td[^>]*>\s*(\d+)\s*<\/td>[\s\S]*?<a[^>]*href="([^"]*)"[^>]*>([^<]+)<\/a>[\s\S]*?<td[^>]*>([^<]*)<\/td>[\s\S]*?<\/tr>/gi
  while ((match = rowRegex.exec(html)) !== null && items.length < 30) {
    const rank = parseInt(match[1], 10)
    const rawUrl = match[2]
    const title = stripHtml(match[3])
    const hotStr = match[4].trim()
    if (!title || title.length < 2) continue
    const url = rawUrl.startsWith("http") ? rawUrl : `https://tophub.today${rawUrl}`
    items.push({
      id: `gzh-${rank}`,
      rank,
      title,
      hotValue: parseHotValue(hotStr) || Math.max(100000 - rank * 3000, 5000),
      url,
      excerpt: `公众号24h热文 #${rank}`,
      imageUrl: `https://picsum.photos/seed/${encodeURIComponent(title.substring(0, 8))}/800/450`,
      authorName: "公众号热文",
      authorAvatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(title.substring(0, 2))}&backgroundColor=1aad19`,
    })
  }

  // Fallback: simpler link-based pattern
  if (items.length === 0) {
    const linkRegex = /<a[^>]+href="(\/l\/[^"]*)"[^>]*>([^<]{4,})<\/a>/gi
    let rank = 0
    while ((match = linkRegex.exec(html)) !== null && rank < 30) {
      rank++
      const title = stripHtml(match[2])
      if (!title || title.length < 4) { rank--; continue }
      items.push({
        id: `gzh-${rank}`,
        rank,
        title,
        hotValue: Math.max(100000 - rank * 3000, 5000),
        url: `https://tophub.today${match[1]}`,
        excerpt: `公众号24h热文 #${rank}`,
        imageUrl: `https://picsum.photos/seed/${encodeURIComponent(title.substring(0, 8))}/800/450`,
        authorName: "公众号热文",
        authorAvatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(title.substring(0, 2))}&backgroundColor=1aad19`,
      })
    }
  }
  return items
}

function getStaticFallback(): GzhHotItem[] {
  const titles = [
    "三大运营商集体宣布AI战略", "教育部新规引发家长热议",
    "央行数字货币最新进展", "新能源车企年度销量排行",
    "医保改革最新政策解读", "房地产市场回暖信号明显",
    "互联网大厂组织架构调整", "高考改革方案全面解析",
    "5G-A商用进程加速", "芯片产业链国产替代突破",
    "碳中和政策落地实施细则", "乡村振兴典型案例分析",
    "食品安全新标准出台", "养老金制度改革方向",
    "青年就业创业新政策", "文旅融合发展新模式",
    "中医药现代化创新路径", "智慧城市建设新进展",
    "双减政策执行效果评估", "绿色金融发展新机遇",
  ]
  return titles.map((title, i) => ({
    id: `gzh-${i + 1}`,
    rank: i + 1,
    title,
    hotValue: Math.max(100000 - i * 4000, 5000),
    url: `https://weixin.sogou.com/weixin?query=${encodeURIComponent(title)}`,
    excerpt: `公众号24h热文 #${i + 1}`,
    imageUrl: `https://picsum.photos/seed/${encodeURIComponent(title.substring(0, 8))}/800/450`,
    authorName: "公众号热文",
    authorAvatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(title.substring(0, 2))}&backgroundColor=1aad19`,
  }))
}

export async function GET() {
  const now = Date.now()
  if (cache && now - cache.ts < CACHE_TTL) {
    return NextResponse.json(cache.data)
  }

  let items: GzhHotItem[] = []

  try {
    items = await fetchFromHTML()
    console.log("[v0] GZH scraped items:", items.length)
  } catch (e) {
    console.error("[v0] GZH scrape failed:", e)
  }

  if (items.length === 0) {
    items = getStaticFallback()
    console.log("[v0] GZH using static fallback")
  }

  // Enrich with real author data in batches of 5
  const BATCH_SIZE = 5
  for (let start = 0; start < items.length; start += BATCH_SIZE) {
    const batch = items.slice(start, start + BATCH_SIZE)
    const results = await Promise.allSettled(
      batch.map((item) => fetchGzhDetail(item.title))
    )
    for (let j = 0; j < results.length; j++) {
      const idx = start + j
      const result = results[j]
      if (result.status === "fulfilled" && result.value) {
        const d = result.value
        if (d.excerpt) items[idx].excerpt = d.excerpt
        if (d.detailContent) items[idx].detailContent = d.detailContent
        if (d.imageUrl) { items[idx].imageUrl = d.imageUrl; items[idx].mediaType = "image" }
        if (d.authorName) items[idx].authorName = d.authorName
        if (d.authorAvatar) items[idx].authorAvatar = d.authorAvatar
      }
    }
  }

  // Debug
  if (items.length > 0) {
    const s = items[0]
    console.log("[v0] GZH sample:", JSON.stringify({
      title: s.title, authorName: s.authorName,
      imageUrl: s.imageUrl?.substring(0, 50),
      mediaType: s.mediaType, hasDetail: !!s.detailContent,
    }))
  }

  cache = { data: items, ts: now }
  return NextResponse.json(items, {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
  })
}
