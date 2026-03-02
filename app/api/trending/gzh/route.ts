import { NextResponse } from "next/server"

// Returns NewsItem[] format for frontend
export async function GET() {
  try {
    const res = await fetch("http://1.12.248.87:3001/api/trending/gzh", {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(25000),
    })
    if (!res.ok) throw new Error(`upstream ${res.status}`)
    const raw = await res.json()
    
    // Map to NewsItem format expected by frontend
    const data = raw.map((item: any, i: number) => ({
      id: `g${i + 1}`,
      title: item.title || "",
      hotValue: item.hotValue || 0,
      url: item.url || "",
      imageUrl: item.imageUrl || "",
      videoUrl: item.videoUrl || "",
      mediaType: item.mediaType || "image",
      isBurst: item.isBurst || false,
      rankDelta: item.rankDelta || 0,
      prevRank: item.prevRank,
      // NewsItem format fields - 多字段fallback确保正文显示
      author: item.authorName || item.topAuthor || item.author || "公众号精选",
      authorAvatar: item.authorAvatar || item.topAuthorAvatar || "",
      // 公众号正文：优先excerpt，其次summary/digest/description/content
      summary: item.excerpt || item.summary || item.digest || item.description || item.content || "",
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
