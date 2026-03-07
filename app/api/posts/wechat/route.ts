import { NextResponse } from "next/server"

const ACCOUNTS: Record<string, string> = {
  "央视新闻": "央视新闻",
  "人民日报": "人民日报",
  "光明日报": "光明日报",
  "新华社": "新华社",
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const account = searchParams.get("account") || "央视新闻"
  const query = ACCOUNTS[account] || account

  try {
    const res = await fetch(
      `https://weixin.sogou.com/weixin?type=1&query=${encodeURIComponent(query)}&ie=utf8`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Referer": "https://weixin.sogou.com/",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "zh-CN,zh;q=0.9",
        },
        signal: AbortSignal.timeout(10000),
        next: { revalidate: 600 },
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
