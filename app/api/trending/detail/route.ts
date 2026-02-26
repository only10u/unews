import { NextRequest, NextResponse } from "next/server"

/**
 * Two-step scraping: Given a platform + keyword, fetch the top/pinned post content.
 * Returns: { detailContent, mediaUrl, mediaType, authorName }
 *
 * GET /api/trending/detail?platform=weibo&keyword=XXX
 */

// Simple in-memory cache to avoid repeated fetches
const detailCache = new Map<string, { data: DetailResult; ts: number }>()
const DETAIL_CACHE_TTL = 120_000 // 2 minutes

interface DetailResult {
  detailContent: string
  mediaUrl: string | null
  mediaType: "image" | "video" | null
  authorName: string | null
  authorAvatar: string | null
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim()
}

/** Strip Weibo hashtag markers: #话题# -> 话题 */
function stripWeiboTags(text: string): string {
  return text.replace(/#([^#]+)#/g, "$1").trim()
}

// ──── Weibo Detail Scraper ─────────────────────────────────────────
async function fetchWeiboDetail(keyword: string): Promise<DetailResult> {
  try {
    const encodedQ = encodeURIComponent(keyword)
    const res = await fetch(
      `https://m.weibo.cn/api/container/getIndex?containerid=100103type%3D1%26q%3D${encodedQ}&page_type=searchall`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
          "Accept": "application/json",
          "Referer": "https://m.weibo.cn/",
          "X-Requested-With": "XMLHttpRequest",
        },
        signal: AbortSignal.timeout(6000),
      }
    )
    if (!res.ok) throw new Error(`Weibo search: ${res.status}`)
    const json = await res.json()

    const cards = json?.data?.cards || []
    for (const card of cards) {
      const mblog = card.card_type === 9 ? card.mblog : null
      const subMblog = card.card_type === 11 ? card.card_group?.find((s: { card_type: number; mblog?: unknown }) => s.card_type === 9)?.mblog : null
      const blog = mblog || subMblog
      if (!blog) continue

      const rawText = stripHtml(blog.text || "")
      const cleanText = stripWeiboTags(rawText).substring(0, 300)

      // Extract media: prioritize video, then images
      const pics = blog.pics || []
      const firstPic = pics.length > 0 ? (pics[0].large?.url || pics[0].url) : null
      const videoUrl = blog.page_info?.urls?.mp4_720p_mp4
        || blog.page_info?.urls?.mp4_hd_mp4
        || blog.page_info?.media_info?.stream_url
        || null
      const videoThumb = blog.page_info?.page_pic?.url || null

      let mediaUrl: string | null = null
      let mediaType: "image" | "video" | null = null

      if (videoUrl) {
        mediaUrl = videoUrl
        mediaType = "video"
      } else if (firstPic) {
        mediaUrl = firstPic
        mediaType = "image"
      } else if (videoThumb) {
        mediaUrl = videoThumb
        mediaType = "image"
      }

      return {
        detailContent: cleanText || `${keyword} 正在微博引发广泛讨论`,
        mediaUrl,
        mediaType,
        authorName: blog.user?.screen_name || null,
        authorAvatar: blog.user?.profile_image_url || null,
      }
    }
  } catch (e) {
    console.error("[Detail] Weibo fetch failed:", e)
  }

  return {
    detailContent: `微博热搜"${keyword}"正在引发广泛讨论`,
    mediaUrl: null,
    mediaType: null,
    authorName: null,
    authorAvatar: null,
  }
}

// ──── Douyin Detail Scraper ────────────────────────────────────────
async function fetchDouyinDetail(keyword: string): Promise<DetailResult> {
  try {
    const encodedQ = encodeURIComponent(keyword)
    const res = await fetch(
      `https://www.douyin.com/aweme/v1/web/search/item/?keyword=${encodedQ}&count=1&offset=0`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          "Accept": "application/json",
          "Referer": "https://www.douyin.com/",
        },
        signal: AbortSignal.timeout(4000),
      }
    )
    if (res.ok) {
      const json = await res.json()
      const items = json?.data || json?.aweme_list || []
      if (items.length > 0) {
        const first = items[0]
        const desc = first.desc || first.title || ""
        const coverUrl = first.video?.cover?.url_list?.[0]
          || first.video?.origin_cover?.url_list?.[0]
          || null
        const playUrl = first.video?.play_addr?.url_list?.[0] || null

        return {
          detailContent: desc.substring(0, 300) || `抖音热搜"${keyword}"正在走红`,
          mediaUrl: playUrl || coverUrl,
          mediaType: playUrl ? "video" : coverUrl ? "image" : null,
          authorName: first.author?.nickname || null,
          authorAvatar: null,
        }
      }
    }
  } catch (e) {
    console.error("[Detail] Douyin fetch failed:", e)
  }

  // Fallback: return a search link as video
  return {
    detailContent: `抖音热搜"${keyword}"相关视频正在走红，多位创作者参与互动`,
    mediaUrl: null,
    mediaType: null,
    authorName: null,
    authorAvatar: null,
  }
}

// ──── GZH (WeChat) Detail - use sogou or return placeholder ────────
async function fetchGzhDetail(keyword: string): Promise<DetailResult> {
  // WeChat articles are behind heavy anti-scraping; use search link
  return {
    detailContent: `公众号热文"${keyword}"正在获得大量阅读和转发`,
    mediaUrl: null,
    mediaType: null,
    authorName: null,
    authorAvatar: null,
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const platform = searchParams.get("platform") || "weibo"
  const keyword = searchParams.get("keyword") || ""

  if (!keyword) {
    return NextResponse.json({ error: "Missing keyword" }, { status: 400 })
  }

  // Check cache
  const cacheKey = `${platform}:${keyword}`
  const cached = detailCache.get(cacheKey)
  if (cached && Date.now() - cached.ts < DETAIL_CACHE_TTL) {
    return NextResponse.json(cached.data, {
      headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300" },
    })
  }

  let result: DetailResult

  switch (platform) {
    case "weibo":
      result = await fetchWeiboDetail(keyword)
      break
    case "douyin":
      result = await fetchDouyinDetail(keyword)
      break
    case "gzh":
    case "gongzhonghao":
      result = await fetchGzhDetail(keyword)
      break
    default:
      result = {
        detailContent: `"${keyword}"相关内容`,
        mediaUrl: null,
        mediaType: null,
        authorName: null,
        authorAvatar: null,
      }
  }

  // Store in cache
  detailCache.set(cacheKey, { data: result, ts: Date.now() })

  // Evict old entries
  if (detailCache.size > 200) {
    const now = Date.now()
    for (const [key, val] of detailCache) {
      if (now - val.ts > DETAIL_CACHE_TTL * 2) detailCache.delete(key)
    }
  }

  return NextResponse.json(result, {
    headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300" },
  })
}
