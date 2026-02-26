import { NextResponse } from "next/server"

// Weibo trending - v5 rebuilt from scratch
interface WeiboHotItem {
  rank: number
  title: string
  hotValue: number
  url: string
  category?: string
  excerpt?: string
  imageUrl?: string
  videoUrl?: string
  mediaType?: "image" | "video"
  authorName?: string
  authorAvatar?: string
  detailContent?: string
}

let cache: { data: WeiboHotItem[]; timestamp: number } | null = null
const CACHE_TTL = 30_000

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
    .trim()
}

function stripWeiboTags(text: string): string {
  return text.replace(/#([^#]+)#/g, "$1").trim()
}

type EnrichResult = {
  excerpt?: string
  detailContent?: string
  imageUrl?: string
  videoUrl?: string
  mediaType?: "image" | "video"
  authorName?: string
  authorAvatar?: string
}

/** Method 1: Fetch topic page HTML and extract og:image meta tags */
async function tryTopicPage(keyword: string, topicUrl: string): Promise<EnrichResult | null> {
  console.log('[FETCH-V3] trying method1 (topic page) for:', keyword.substring(0, 12))
  try {
    const res = await fetch(topicUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        "Referer": "https://weibo.com",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      },
      signal: AbortSignal.timeout(6000),
    })
    console.log('[FETCH-V3] method1 status:', res.status, 'for:', keyword.substring(0, 8))
    if (!res.ok) return null

    const html = await res.text()
    console.log('[FETCH-V3] method1 html length:', html.length, 'has-render-data:', html.includes('$render_data'))

    // Try to extract $render_data JSON first (contains full weibo data)
    const renderMatch = html.match(/\$render_data\s*=\s*(\[[\s\S]*?\])\s*\[0\]/)
    if (renderMatch) {
      try {
        const data = JSON.parse(renderMatch[1])
        const status = data?.[0]?.status || data?.[0]?.data?.statuses?.[0]
        if (status) {
          const pics = status.pics || []
          const firstPic = pics.length > 0 ? (pics[0].large?.url || pics[0].url) : undefined
          console.log('[FETCH-V3] method1 render_data found user:', status.user?.screen_name, 'pics:', pics.length)
          return {
            excerpt: stripHtml(status.text || "").substring(0, 120),
            detailContent: stripHtml(status.text || "").substring(0, 300),
            imageUrl: firstPic,
            authorName: status.user?.screen_name,
            authorAvatar: status.user?.profile_image_url,
            mediaType: firstPic ? "image" : undefined,
          }
        }
      } catch (e) {
        console.log('[FETCH-V3] method1 render_data parse failed:', e instanceof Error ? e.message : String(e))
      }
    }

    // Fallback: extract og:image and og:description meta tags
    const ogImage = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i)
      || html.match(/<meta\s+content="([^"]+)"\s+property="og:image"/i)
    const ogDesc = html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/i)
      || html.match(/<meta\s+content="([^"]+)"\s+property="og:description"/i)
    const ogTitle = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i)
      || html.match(/<meta\s+content="([^"]+)"\s+property="og:title"/i)

    console.log('[FETCH-V3] method1 og:image:', ogImage?.[1]?.substring(0, 60) || 'none')
    console.log('[FETCH-V3] method1 og:desc:', ogDesc?.[1]?.substring(0, 40) || 'none')

    if (ogImage?.[1] || ogDesc?.[1]) {
      return {
        imageUrl: ogImage?.[1]?.replace(/^\/\//, 'https://'),
        excerpt: ogDesc?.[1] || ogTitle?.[1] || keyword,
        detailContent: ogDesc?.[1] || `#${keyword}# 正在微博热议`,
        authorName: "微博热搜",
        mediaType: ogImage?.[1] ? "image" : undefined,
      }
    }

    console.log('[FETCH-V3] method1 no og tags found')
    return null
  } catch (e) {
    console.log('[FETCH-V3] method1 exception:', e instanceof Error ? e.message : String(e))
    return null
  }
}

/** Method 2: Try TopHub API for Weibo hot topics */
async function tryTopHub(keyword: string): Promise<EnrichResult | null> {
  console.log('[FETCH-V3] trying method2 (tophub) for:', keyword.substring(0, 12))
  try {
    // TopHub aggregates trending content and is usually accessible
    const res = await fetch(
      `https://api.vvhan.com/api/hotlist?type=weibo`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0",
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(4000),
      }
    )
    console.log('[FETCH-V3] method2 status:', res.status)
    if (!res.ok) return null

    const json = await res.json()
    const items = json?.data || []
    // Find matching item by keyword
    const match = items.find((item: { title?: string }) => 
      item.title?.includes(keyword.substring(0, 6)) || keyword.includes(item.title?.substring(0, 6) || '')
    )
    
    if (match) {
      console.log('[FETCH-V3] method2 found match:', match.title?.substring(0, 20))
      return {
        excerpt: match.desc || match.title || keyword,
        detailContent: match.desc || `#${keyword}# 正在热议`,
        imageUrl: match.pic || match.cover,
        authorName: match.author || "微博热搜",
        mediaType: match.pic ? "image" : undefined,
      }
    }
    
    console.log('[FETCH-V3] method2 no match found')
    return null
  } catch (e) {
    console.log('[FETCH-V3] method2 exception:', e instanceof Error ? e.message : String(e))
    return null
  }
}

/** Method 3: Generate placeholder content (always succeeds) */
function generatePlaceholder(keyword: string): EnrichResult {
  console.log('[FETCH-V3] using method3 (placeholder) for:', keyword.substring(0, 12))
  return {
    excerpt: `#${keyword}# 正在微博热议中，点击查看详情`,
    detailContent: `话题 #${keyword}# 登上微博热搜，引发网友广泛讨论。`,
    authorName: "微博热搜",
    // Keep imageUrl and authorAvatar undefined to use defaults
  }
}

/** Fetch top post for a keyword - tries 3 methods in sequence */
async function fetchTopPost(keyword: string, topicUrl: string): Promise<EnrichResult | null> {
  console.log('[FETCH-V3] START enriching:', keyword.substring(0, 15))
  
  // Method 1: Topic page HTML (og:image etc)
  const r1 = await tryTopicPage(keyword, topicUrl)
  if (r1 && (r1.imageUrl || r1.authorName !== "微博热搜")) {
    console.log('[FETCH-V3] method1 returned valid data')
    return r1
  }
  
  // Method 2: TopHub aggregator API
  const r2 = await tryTopHub(keyword)
  if (r2 && (r2.imageUrl || r2.excerpt)) {
    console.log('[FETCH-V3] method2 returned valid data')
    return r2
  }
  
  // Method 3: Placeholder (always returns something)
  console.log('[FETCH-V3] all methods failed, using placeholder')
  return generatePlaceholder(keyword)
}

export async function GET() {
  const now = Date.now()
  if (cache && now - cache.timestamp < CACHE_TTL) {
    return NextResponse.json(cache.data)
  }

  try {
    const res = await fetch("https://weibo.com/ajax/side/hotSearch", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        Accept: "application/json",
        Referer: "https://weibo.com/",
      },
      next: { revalidate: 30 },
    })

    if (!res.ok) throw new Error(`Weibo API: ${res.status}`)
    const json = await res.json()
    const realtime = json?.data?.realtime
    if (!Array.isArray(realtime)) throw new Error("Invalid data format")

    const items: WeiboHotItem[] = realtime.slice(0, 25).map(
      (item: { note?: string; word?: string; num?: number; category?: string; label_name?: string }, index: number) => {
        const title = item.note || item.word || ""
        return {
          rank: index + 1,
          title,
          hotValue: item.num || 0,
          url: `https://s.weibo.com/weibo?q=%23${encodeURIComponent(title)}%23`,
          category: item.category || item.label_name || undefined,
          excerpt: `微博热搜 "${title}" 引发广泛讨论`,
          imageUrl: `https://picsum.photos/seed/${encodeURIComponent(title.substring(0, 8))}/800/450`,
          authorName: "微博热搜",
          authorAvatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(title.substring(0, 2))}&backgroundColor=e60012`,
        }
      }
    )

    // Enrich ALL items in parallel batches of 5
    const BATCH = 5
    for (let i = 0; i < items.length; i += BATCH) {
      const batch = items.slice(i, i + BATCH)
      const results = await Promise.allSettled(batch.map((it) => fetchTopPost(it.title, it.url)))
      for (let j = 0; j < results.length; j++) {
        const r = results[j]
        if (r.status === "fulfilled" && r.value) {
          const d = r.value
          const idx = i + j
          if (d.excerpt) items[idx].excerpt = d.excerpt
          if (d.detailContent) items[idx].detailContent = d.detailContent
          if (d.imageUrl) items[idx].imageUrl = d.imageUrl
          if (d.videoUrl) items[idx].videoUrl = d.videoUrl
          if (d.mediaType) items[idx].mediaType = d.mediaType
          if (d.authorName) items[idx].authorName = d.authorName
          if (d.authorAvatar) items[idx].authorAvatar = d.authorAvatar
        }
      }
    }

    // Debug
    console.log("[v0] Weibo items:", items.length, "sample:", JSON.stringify({
      title: items[0]?.title, authorName: items[0]?.authorName,
      img: items[0]?.imageUrl?.substring(0, 50), media: items[0]?.mediaType,
    }))

    cache = { data: items, timestamp: now }
    return NextResponse.json(items)
  } catch (error) {
    console.error("[v0] Weibo error:", error)
    if (cache) return NextResponse.json(cache.data)
    return NextResponse.json(generateFallback())
  }
}

function generateFallback(): WeiboHotItem[] {
  const topics = [
    "特朗普比特币储备计划", "以太坊ETF突破历史", "Solana生态大爆发",
    "BNB Chain新升级", "AI Agent代币暴涨", "链上巨��大额转账",
    "SEC加密监管新动向", "Meme币百倍神话", "DeFi TVL创新高",
    "NFT市场回暖", "Layer2生态格局", "稳定币市值突破2000亿",
    "加密行业裁员潮", "比特币减半效应", "Web3游戏爆款",
  ]
  return topics.map((title, i) => ({
    rank: i + 1,
    title,
    hotValue: Math.floor(Math.random() * 10000000) + 500000,
    url: `https://s.weibo.com/weibo?q=%23${encodeURIComponent(title)}%23`,
    excerpt: `微博热搜 "${title}" 持续发酵`,
    imageUrl: `https://picsum.photos/seed/${encodeURIComponent(title.substring(0, 8))}/800/450`,
    authorName: "微博热搜",
    authorAvatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(title.substring(0, 2))}&backgroundColor=e60012`,
  }))
}
