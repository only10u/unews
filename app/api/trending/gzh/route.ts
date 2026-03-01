import { NextResponse } from "next/server"

// Returns TrendingItem[] format for frontend trendingFetcher
export async function GET() {
  try {
    const res = await fetch("http://1.12.248.87:3001/api/trending/gzh", {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) throw new Error(`upstream ${res.status}`)
    const raw = await res.json()
    
    // Map to TrendingItem format expected by frontend
    const data = raw.map((item: any, i: number) => ({
      id: `g${i + 1}`,
      rank: item.rank || i + 1,
      title: item.title || "",
      hotValue: item.hotValue || 0,
      url: item.url || "",
      excerpt: item.excerpt || item.summary || "",
      imageUrl: item.imageUrl || "",
      videoUrl: item.videoUrl || "",
      mediaType: item.mediaType || "image",
      topAuthor: item.authorName || item.author || "公众号精选",
      topAuthorAvatar: item.authorAvatar || "",
      detailContent: item.detailContent || item.excerpt || "",
      isBurst: item.isBurst || false,
      rankDelta: item.rankDelta || 0,
      prevRank: item.prevRank,
    }))
    
    console.log("[GZH-API] returning", data.length, "items, sample:", JSON.stringify({
      title: data[0]?.title?.substring(0, 20),
      imageUrl: data[0]?.imageUrl?.substring(0, 50),
      topAuthor: data[0]?.topAuthor,
    }))
    
    return NextResponse.json(data)
  } catch (e) {
    console.log("[GZH-API] error:", String(e))
    return NextResponse.json([], { status: 200 })
  }
}
