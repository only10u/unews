import { NextResponse } from "next/server"
import { fetchTrendingPath } from "@/lib/upstream"
import { mergeWithEnrichLayer, parsePublishedMsFromRaw } from "@/lib/trending-enrich"

export const dynamic = "force-dynamic"

// Returns NewsItem[] format for frontend
export async function GET() {
  try {
    const res = await fetchTrendingPath("/api/trending/weibo", {
      cache: "no-store",
      signal: AbortSignal.timeout(25000),
    })
    if (!res.ok) throw new Error(`upstream ${res.status}`)
    const rawData = await res.json()
    const list = Array.isArray(rawData) ? rawData : (rawData as { data?: unknown })?.data
    if (!Array.isArray(list)) {
      console.error("[WEIBO-API] upstream not array:", typeof rawData)
      return NextResponse.json([], { status: 200 })
    }

    // 过滤广告条目
    const filtered = list.filter((item: any) => {
      // 过滤 is_ad 字段
      if (item.is_ad) return false
      // 过滤 ad_type 字段
      if (item.ad_type && item.ad_type !== 0) return false
      // 过滤 note 或 icon_desc 中包含广告相关关键词
      const note = item.note || item.icon_desc || ""
      if (note.includes("广告") || note.includes("荐") || note.includes("商业")) return false
      return true
    })
    
    // Map to NewsItem format expected by frontend
    // 扩展字段映射，覆盖微博API可能的各种字段名
    // 过滤后重新编号，确保排名连续；最多 25 条，真实名次优先 realpos
    const WEIBO_CAP = 25
    const trimmed = filtered.slice(0, WEIBO_CAP)
    const data = trimmed.map((item: any, i: number) => ({
      id: `w${i + 1}`,
      title: item.title || item.word || item.note || "",
      hotValue: item.hotValue || item.hot_num || item.num || 0,
      url: item.url || item.link || item.scheme || "",
      detailContent: item.detailContent || item.full_text || item.long_text || "",
      // 图片：覆盖多种可能的字段名
      imageUrl: item.pic || item.pic_url || item.image || item.imageUrl || item.cover || item.icon || "",
      videoUrl: item.videoUrl || item.video_url || "",
      mediaType: item.mediaType || "image",
      isBurst: item.isBurst || item.is_hot || item.is_new || false,
      rankDelta: item.rankDelta || item.rank_diff || 0,
      prevRank: item.prevRank || item.prev_rank,
      // 作者：优先从user对象取，然后是各种可能的字段名
      author: item.user?.screen_name || item.user?.name || item.authorName || item.topAuthor || item.author || item.nick || "微博热搜",
      // 头像：优先从user对象取
      authorAvatar: item.user?.profile_image_url || item.user?.avatar_large || item.user?.avatar || item.authorAvatar || item.topAuthorAvatar || item.icon_url || "",
      // 正文：覆盖多种可能的字段名
      summary: item.text || item.content || item.desc || item.summary || item.excerpt || item.label_name || "",
      platformRank: Number(item.realpos ?? item.rank ?? item.position ?? i + 1) || i + 1,
      publishedAt: parsePublishedMsFromRaw(item),
    }))

    const merged = (await mergeWithEnrichLayer(
      "weibo",
      data as Record<string, unknown>[]
    )) as typeof data

    console.log("[WEIBO-API] returning", merged.length, "items, sample:", JSON.stringify({
      title: merged[0]?.title?.substring(0, 20),
      imageUrl: merged[0]?.imageUrl?.substring(0, 50),
      author: merged[0]?.author,
      platformRank: merged[0]?.platformRank,
    }))
    
    return NextResponse.json(merged, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    })
  } catch (e) {
    console.log("[WEIBO-API] error:", String(e))
    return NextResponse.json([], { 
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    })
  }
}
