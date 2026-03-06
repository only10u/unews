import { NextResponse } from "next/server"

// GET /api/posts/weibo?keyword=xxx
// 转发请求到 http://1.12.248.87:3003/weibo/top?keyword=xxx
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const keyword = searchParams.get("keyword")
    
    if (!keyword) {
      return NextResponse.json({ success: false, error: "keyword is required" }, { status: 400 })
    }
    
    const res = await fetch(`http://1.12.248.87:3003/weibo/top?keyword=${encodeURIComponent(keyword)}`, {
      next: { revalidate: 300 }, // 5分钟缓存
      signal: AbortSignal.timeout(15000),
    })
    
    if (!res.ok) {
      throw new Error(`upstream ${res.status}`)
    }
    
    const data = await res.json()
    
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    })
  } catch (e) {
    console.log("[POSTS-WEIBO] error:", String(e))
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 })
  }
}
