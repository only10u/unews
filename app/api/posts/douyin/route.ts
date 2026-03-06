import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const keyword = searchParams.get("keyword")
  if (!keyword) return NextResponse.json({ success: false, error: "keyword required" })

  try {
    const res = await fetch(
      `https://www.douyin.com/aweme/v1/web/search/item/?keyword=${encodeURIComponent(keyword)}&search_channel=aweme_video_web&count=1`,
      {
        headers: {
          Cookie: "sessionid=4a7dc6651151b6c86706b4fd6b6c29ed; sid_tt=4a7dc6651151b6c86706b4fd6b6c29ed; uid_tt=603a4278db3b39c8491cb60985edaed4; odin_tt=8201715a6befaf49046ce8c512bd1c74953ceee85219e9af9e48d809482e9e7d8fc8eb623fe558d49c904133ec8b48bd292c2763f1d474676a274983619320e7a00aa81d37482a628d9bc75689c08e54; passport_csrf_token=672dcc675ea6bf7580ab7421c983fa50; ttwid=1%7CdGsscToCsLKl_pM4wu3wIf0oV7Yu5kh611MaqGuJOkQ%7C1772822251%7C57574fd13d1c29bad09906e5ad04b816fd322080f96c602d8087bbc1eb4970d3",
          "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15",
          Referer: "https://www.douyin.com",
        },
        signal: AbortSignal.timeout(10000),
        next: { revalidate: 300 },
      }
    )
    const data = await res.json()
    const items = data?.data || []
    const first = items[0]?.aweme_info
    if (!first) return NextResponse.json({ success: false, error: "no video found" })
    return NextResponse.json({
      success: true,
      avatar: first.author?.avatar_thumb?.url_list?.[0] || "",
      author: first.author?.nickname || "",
      content: first.desc || "",
      imageUrl: first.video?.cover?.url_list?.[0] || "",
      url: `https://www.douyin.com/video/${first.aweme_id}`,
    })
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) })
  }
}
