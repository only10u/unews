import { NextResponse } from "next/server"
import { UPSTREAM_TRENDING_3001 } from "@/lib/upstream"

export const dynamic = "force-dynamic"

// Returns NewsItem[] format for frontend
export async function GET() {
  try {
    const url = `${UPSTREAM_TRENDING_3001}/api/trending/gzh`
    const res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(25000),
    })
    if (!res.ok) throw new Error(`upstream ${res.status}`)
    const raw = await res.json()
    const list = Array.isArray(raw) ? raw : (raw as { data?: unknown })?.data
    if (!Array.isArray(list)) {
      console.error("[GZH-API] upstream not array:", url, typeof raw)
      return NextResponse.json([], { status: 200 })
    }

    // Map to NewsItem format expected by frontend
    // 扩展字段映射，覆盖公众号API可能的各种字段名
    const data = list.map((item: any, i: number) => ({
      id: `g${i + 1}`,
      title: item.title || item.name || "",
      hotValue: item.hotValue || item.reading_count || item.read_num || 0,
      url: item.url || item.link || item.content_url || "",
      // 图片：覆盖多种可能的字段名
      imageUrl: item.imageUrl || item.cover || item.pic_url || item.thumb_url || item.head_img_url || "",
      videoUrl: item.videoUrl || "",
      mediaType: item.mediaType || "image",
      isBurst: item.isBurst || false,
      rankDelta: item.rankDelta || 0,
      prevRank: item.prevRank,
      // 作者：覆盖多种可能的字段名
      author: item.author || item.nickname || item.account_name || item.authorName || item.topAuthor || item.source || "公众号精选",
      // 头像：覆盖多种可能的字段名
      authorAvatar: item.round_head_img || item.author_icon || item.authorAvatar || item.topAuthorAvatar || item.logo || item.head_img || "",
      // 正文：覆盖更多可能的字段名
      summary: item.digest || item.abstract || item.desc || item.description || item.content_intro || item.content || item.summary || item.excerpt || item.intro || item.text || "",
      platformRank: item.rank || i + 1,
    }))
    
    console.log("[GZH-API] returning", data.length, "items, sample:", JSON.stringify({
      title: data[0]?.title?.substring(0, 20),
      imageUrl: data[0]?.imageUrl?.substring(0, 50),
      author: data[0]?.author,
      platformRank: data[0]?.platformRank,
    }))
    
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    })
  } catch (e) {
    console.log("[GZH-API] error:", String(e))
    return NextResponse.json([], { 
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    })
  }
}
