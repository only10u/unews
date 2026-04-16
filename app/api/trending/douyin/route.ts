import { NextResponse } from "next/server"
import { fetchTrendingPath } from "@/lib/upstream"
import { mergeWithEnrichLayer, parsePublishedMsFromRaw } from "@/lib/trending-enrich"

// Returns NewsItem[] format for frontend
export async function GET() {
  try {
    const res = await fetchTrendingPath("/api/trending/douyin", {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(25000),
    })
    if (!res.ok) throw new Error(`upstream ${res.status}`)
    const rawData = await res.json()
    const rawList = Array.isArray(rawData)
      ? rawData
      : (rawData as { data?: unknown })?.data
    if (!Array.isArray(rawList)) {
      console.error("[DOUYIN-API] upstream not array:", typeof rawData)
      return NextResponse.json([], { status: 200 })
    }

    // Map to NewsItem format expected by frontend
    // 扩展字段映射，覆盖抖音API可能的各种字段名
    const data = rawList.map((item: any, i: number) => ({
      id: `d${i + 1}`,
      title: item.title || item.word || item.hot_sentence || "",
      hotValue: item.hotValue || item.hot_value || item.view_count || 0,
      url: item.url || item.link || item.video_url || "",
      // 封面图：优先从video对象取，然后是各种可能的字段名
      imageUrl: item.video?.cover?.url_list?.[0] || item.video?.dynamic_cover?.url_list?.[0] || 
                item.cover || item.imageUrl || item.pic || item.poster || "",
      videoUrl: item.videoUrl || item.video?.play_addr?.url_list?.[0] || item.play_url || "",
      mediaType: item.mediaType || "video",
      isBurst: item.isBurst || item.is_hot || false,
      rankDelta: item.rankDelta || item.rank_diff || 0,
      prevRank: item.prevRank || item.prev_rank,
      // 作者：优先从author对象取
      author: item.author?.nickname || item.author?.unique_id || item.authorName || item.topAuthor || item.author || item.nick || "抖音热榜",
      // 头像：优先从author对象取
      authorAvatar: item.author?.avatar?.url_list?.[0] || item.author?.avatar_thumb?.url_list?.[0] || 
                    item.authorAvatar || item.topAuthorAvatar || item.avatar || "",
      // 正文：覆盖多种可能的字段名
      summary: item.desc || item.description || item.excerpt || item.summary || item.content || item.sentence_tag || "",
      platformRank: item.rank || item.position || i + 1,
      detailContent: item.detailContent || item.share_info?.share_title || "",
      publishedAt: parsePublishedMsFromRaw(item),
    }))

    const merged = (await mergeWithEnrichLayer(
      "douyin",
      data as Record<string, unknown>[]
    )) as typeof data

    console.log("[DOUYIN-API] returning", merged.length, "items, sample:", JSON.stringify({
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
    console.log("[DOUYIN-API] error:", String(e))
    return NextResponse.json([], { 
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    })
  }
}
