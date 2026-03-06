import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const keyword = searchParams.get("keyword")
  if (!keyword) return NextResponse.json({ success: false, error: "keyword required" })

  try {
    const res = await fetch(
      `https://www.douyin.com/aweme/v1/web/search/item/?keyword=${encodeURIComponent(keyword)}&search_channel=aweme_video_web&count=5&offset=0`,
      {
        headers: {
          Cookie: "enter_pc_once=1; uid_tt=603a4278db3b39c8491cb60985edaed4; sid_tt=4a7dc6651151b6c86706b4fd6b6c29ed; sessionid=4a7dc6651151b6c86706b4fd6b6c29ed; sessionid_ss=4a7dc6651151b6c86706b4fd6b6c29ed; passport_csrf_token=672dcc675ea6bf7580ab7421c983fa50; ttwid=1%7CdGsscToCsLKl_pM4wu3wIf0oV7Yu5kh611MaqGuJOkQ%7C1772822251%7C57574fd13d1c29bad09906e5ad04b816fd322080f96c602d8087bbc1eb4970d3; odin_tt=86ea9b4765935d25098abdc3ec7d059352644b9d5776eebeed182ce3f9e88c1846cd24c8ce748956a919eeb71c9f9df41532e14c13432e22e1071d70dfaa0bf5; sid_guard=4a7dc6651151b6c86706b4fd6b6c29ed%7C1770891490%7C5184000%7CMon%2C+13-Apr-2026+10%3A18%3A10+GMT",
          "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15",
          Referer: "https://www.douyin.com",
        },
        signal: AbortSignal.timeout(10000),
        next: { revalidate: 300 },
      }
    )
    const data = await res.json()
    console.log('douyin raw:', JSON.stringify(data).slice(0, 500))
    const items = data?.data || data?.aweme_list || []
    const first = items[0]?.aweme_info || items[0]
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
