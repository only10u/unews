import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const keyword = searchParams.get("keyword")
  if (!keyword) return NextResponse.json({ success: false, error: "keyword required" })

  try {
    const res = await fetch(
      `https://www.douyin.com/search/${encodeURIComponent(keyword)}?type=video`,
      {
        headers: {
          Cookie: "sessionid=4a7dc6651151b6c86706b4fd6b6c29ed; sid_tt=4a7dc6651151b6c86706b4fd6b6c29ed; uid_tt=603a4278db3b39c8491cb60985edaed4; passport_csrf_token=672dcc675ea6bf7580ab7421c983fa50; ttwid=1%7CdGsscToCsLKl_pM4wu3wIf0oV7Yu5kh611MaqGuJOkQ%7C1772822251%7C57574fd13d1c29bad09906e5ad04b816fd322080f96c602d8087bbc1eb4970d3; odin_tt=86ea9b4765935d25098abdc3ec7d059352644b9d5776eebeed182ce3f9e88c1846cd24c8ce748956a919eeb71c9f9df41532e14c13432e22e1071d70dfaa0bf5",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Referer: "https://www.douyin.com/",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "zh-CN,zh;q=0.9",
        },
        signal: AbortSignal.timeout(10000),
        next: { revalidate: 300 },
      }
    )
    const html = await res.text()
    return NextResponse.json({
      status: res.status,
      preview: html.slice(0, 3000)
    })
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) })
  }
}
