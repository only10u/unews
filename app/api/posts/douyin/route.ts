import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const keyword = searchParams.get("keyword")
  if (!keyword) return NextResponse.json({ success: false, error: "keyword required" })

  try {
    const res = await fetch(
      `https://www.douyin.com/aweme/v1/web/search/item/?keyword=${encodeURIComponent(keyword)}&count=5&search_channel=aweme_general&search_source=normal_search`,
      {
        headers: {
          Cookie: "sessionid=4a7dc6651151b6c86706b4fd6b6c29ed; sid_tt=4a7dc6651151b6c86706b4fd6b6c29ed; uid_tt=603a4278db3b39c8491cb60985edaed4; passport_csrf_token=672dcc675ea6bf7580ab7421c983fa50; ttwid=1%7CdGsscToCsLKl_pM4wu3wIf0oV7Yu5kh611MaqGuJOkQ%7C1772822251%7C57574fd13d1c29bad09906e5ad04b816fd322080f96c602d8087bbc1eb4970d3; odin_tt=86ea9b4765935d25098abdc3ec7d059352644b9d5776eebeed182ce3f9e88c1846cd24c8ce748956a919eeb71c9f9df41532e14c13432e22e1071d70dfaa0bf5",
          "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1",
          Referer: "https://www.douyin.com/",
          Accept: "application/json, text/plain, */*",
          "Accept-Language": "zh-CN,zh;q=0.9",
        },
        signal: AbortSignal.timeout(10000),
        next: { revalidate: 300 },
      }
    )

    const text = await res.text()

    // 如果返回非JSON（被拦截或返回HTML），返回debug信息
    let json: any
    try {
      json = JSON.parse(text)
    } catch {
      return NextResponse.json({
        success: false,
        error: "non-json response",
        status: res.status,
        preview: text.slice(0, 500),
      })
    }

    const items = json?.data || []
    const first = items[0]?.aweme_info || items[0]

    if (!first) {
      return NextResponse.json({ success: false, error: "no video found" })
    }

    return NextResponse.json({
      success: true,
      data: {
        avatar: first?.author?.avatar_thumb?.url_list?.[0] || "",
        author: first?.author?.nickname || "抖音用户",
        content: (first?.desc || keyword).slice(0, 120),
        imageUrl: first?.video?.cover?.url_list?.[0] || "",
        url: `https://www.douyin.com/video/${first?.aweme_id || ""}`,
      },
    })
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) })
  }
}
