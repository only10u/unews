import { NextResponse } from "next/server"

// Returns NewsItem[] format for frontend
export async function GET() {
  try {
    const res = await fetch("http://1.12.248.87:3001/api/trending/douyin", {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(25000),
    })
    if (!res.ok) throw new Error(`upstream ${res.status}`)
    const raw = await res.json()
    
    // Map to NewsItem format expected by frontend
    const data = raw.map((item: any, i: number) => ({
      id: `d${i + 1}`,
      title: item.title || "",
      hotValue: item.hotValue || 0,
      url: item.url || "",
      imageUrl: item.imageUrl || "",
      videoUrl: item.videoUrl || "",
      mediaType: item.mediaType || "video",
      isBurst: item.isBurst || false,
      rankDelta: item.rankDelta || 0,
      prevRank: item.prevRank,
      // NewsItem format fields
      author: item.authorName || item.topAuthor || "抖音热榜",
      authorAvatar: item.authorAvatar || item.topAuthorAvatar || "",
      summary: item.excerpt || "",
      platformRank: item.rank || i + 1,
    }))
    
    console.log("[DOUYIN-API] returning", data.length, "items, sample:", JSON.stringify({
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
    console.log("[DOUYIN-API] error:", String(e))
    return NextResponse.json([], { 
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    })
  }
}
