import { NextResponse } from "next/server"

// TopHub 微信24h热文榜 - triple fallback: API → HTML scrape → static
const TOPHUB_NODE = "WnBe01o371"
const TOPHUB_API_URL = `https://api.tophubdata.com/v2/GetAllInfoGzip?id=${TOPHUB_NODE}&page=0`
const TOPHUB_HTML_URL = `https://tophub.today/n/${TOPHUB_NODE}`
const TOPHUB_API_KEY = "53c76260b011e6384dbb7b9ebd8d3318"

let cache: { data: unknown[]; ts: number } | null = null
const CACHE_TTL = 30_000

function parseHotValue(raw: string): number {
  if (!raw) return 0
  const t = raw.trim()
  if (t.includes("万")) return Math.round(parseFloat(t.replace("万", "")) * 10000)
  return parseInt(t.replace(/,/g, ""), 10) || 0
}

// ─── Method 1: TopHub Official API ───────────────────────────────────
async function fetchFromAPI() {
  const res = await fetch(TOPHUB_API_URL, {
    headers: {
      "Authorization": TOPHUB_API_KEY,
      "Accept": "application/json, text/plain, */*",
      "Accept-Encoding": "gzip, deflate",
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      "Referer": "https://tophub.today/",
    },
    next: { revalidate: 30 },
  })
  if (!res.ok) throw new Error(`TopHub API: ${res.status}`)
  const json = await res.json()

  // The API returns { Code: 0, Data: { ... } } structure
  const dataObj = json?.Data || json?.data
  const list = dataObj?.data || dataObj?.list || dataObj?.Ede01e || []

  if (!Array.isArray(list) || list.length === 0) {
    throw new Error("Empty API response")
  }

  return list.slice(0, 25).map((item: Record<string, string | number>, i: number) => {
    const rank = i + 1
    const title = String(item.Title || item.title || item.t || "").trim()
    const url = String(item.Url || item.url || item.u || "")
    const hotStr = String(item.extra?.hot || item.Hot || item.hot || item.e || "")
    const hotValue = parseHotValue(hotStr) || Math.max(100000 - rank * 3000, 5000)

    return {
      id: `gzh-${rank}`,
      rank,
      title,
      hotValue,
      url: url.startsWith("http") ? url : `https://tophub.today${url}`,
      excerpt: `微信公众号24小时热文 #${rank}，阅读量 ${hotStr || "10万"}+`,
      topAuthor: "公众号热文",
      topAuthorAvatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(title.substring(0, 2))}&backgroundColor=1aad19`,
    }
  }).filter((item: { title: string }) => item.title.length >= 2)
}

// ─── Method 2: HTML Scraping (original approach) ─────────────────────
async function fetchFromHTML() {
  const res = await fetch(TOPHUB_HTML_URL, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      "Referer": "https://tophub.today/",
      "Cookie": `token=${TOPHUB_API_KEY}`,
    },
    next: { revalidate: 30 },
  })

  if (!res.ok) throw new Error(`TopHub HTML: ${res.status}`)

  const html = await res.text()
  const items: {
    id: string; rank: number; title: string; hotValue: number; url: string
    excerpt?: string; topAuthor?: string; topAuthorAvatar?: string
  }[] = []

  const trRegex = /<td[^>]*>\s*(\d+)\.\s*<\/td>\s*<td>\s*<a\s+href="([^"]*)"[^>]*>([^<]+)<\/a>\s*<\/td>\s*<td[^>]*>([^<]*)<\/td>/gs

  let match
  while ((match = trRegex.exec(html)) !== null) {
    const rank = parseInt(match[1], 10)
    const rawUrl = match[2]
    const title = match[3].trim()
    const hotStr = match[4].trim()
    const hotValue = parseHotValue(hotStr)

    if (!title || title.length < 2) continue

    const url = rawUrl.startsWith("http") ? rawUrl : `https://tophub.today${rawUrl}`

    items.push({
      id: `gzh-${rank}`,
      rank,
      title,
      hotValue: hotValue || Math.max(100000 - rank * 3000, 5000),
      url,
      excerpt: `微信公众号24小时热文 #${rank}，阅读量 ${hotStr || "10万"}+`,
      topAuthor: "公众号热文",
      topAuthorAvatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(title.substring(0, 2))}&backgroundColor=1aad19`,
    })
  }

  if (items.length === 0) throw new Error("HTML parse returned 0 items")
  return items
}

// ─── Method 3: Static fallback ───────────────────────────────────────
function getStaticFallback() {
  const titles = [
    "马筱梅生子，汪小菲张兰大喜！",
    "2026年起，所有行政村都会增加一个新机构？",
    "返程高峰现罕见一幕！1100公里顺风车，乘客竟反向议价",
    "万万没想到！大年初八第一个迎来失业潮的不是幼师不是医生",
    "2026大阪马拉松：吉田響自杀式领跑27公里跑崩",
    "突发！多地银行宣布：暂停办理",
    "央视曝光！这种常见水果，竟是1级致癌物？",
    "刚刚宣布！油价又要变",
    "重磅！教育部最新通知",
    "紧急提醒！手机上这个功能赶紧关掉",
    "定了！下月起，这些新规将影响你的生活",
    "刷屏了！ChatGPT最新功能震撼发布",
    "重大信号！房价即将迎来新变化",
    "科学家重大发现：这种食物能延长寿命",
    "官方紧急通报！这款App被下架了",
    "震惊！A股最新消息来了",
    "重磅政策！这类人群将获得补贴",
    "今日国际局势突变：多国紧急表态",
    "春节后第一波裁员潮来了",
    "最新研究：每天坚持这个习惯，远离癌症",
  ]

  return titles.map((title, i) => ({
    id: `gzh-${i + 1}`,
    rank: i + 1,
    title,
    hotValue: Math.max(100000 - i * 4000, 5000),
    url: `https://weixin.sogou.com/weixin?query=${encodeURIComponent(title)}`,
    excerpt: `微信公众号24小时热文 #${i + 1}`,
    topAuthor: "公众号热文",
    topAuthorAvatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(title.substring(0, 2))}&backgroundColor=1aad19`,
  }))
}

export async function GET() {
  if (cache && Date.now() - cache.ts < CACHE_TTL) {
    return NextResponse.json(cache.data, {
      headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" },
    })
  }

  // Triple fallback: API → HTML → Static
  let items: unknown[] | null = null
  let source = "static"

  // Try 1: Official API
  try {
    items = await fetchFromAPI()
    if (items && items.length > 0) source = "api"
  } catch (e) {
    console.error("[GZH] API method failed:", e)
  }

  // Try 2: HTML Scraping
  if (!items || items.length === 0) {
    try {
      items = await fetchFromHTML()
      if (items && items.length > 0) source = "html"
    } catch (e) {
      console.error("[GZH] HTML method failed:", e)
    }
  }

  // Try 3: Static fallback
  if (!items || items.length === 0) {
    items = getStaticFallback()
    source = "static"
  }

  cache = { data: items, ts: Date.now() }
  return NextResponse.json(items, {
    headers: {
      "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
      "X-Data-Source": source,
    },
  })
}
