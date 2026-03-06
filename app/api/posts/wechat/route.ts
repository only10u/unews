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

    // 解析公众号名称
    const accountMatch = html.match(/class="tit"[^>]*>([^<]+)</)
    // 解析最新文章标题
    const titleMatch = html.match(/class="wx-rb[^"]*"[^>]*title="([^"]+)"/)
    // 解析文章链接
    const urlMatch = html.match(/class="wx-rb[^"]*"[^>]*href="([^"]+)"/)
    // 解析封面图
    const imgMatch = html.match(/class="wx-rb[^"]*"[\s\S]*?<img[^>]*src="([^"]+)"/)
    // 解析摘要
    const summaryMatch = html.match(/class="txt-info"[^>]*>([\s\S]*?)<\/p>/)

    const title = titleMatch?.[1] || ""
    const url = urlMatch?.[1] || ""
    const imageUrl = imgMatch?.[1] || ""
    const summary = summaryMatch?.[1]?.replace(/<[^>]+>/g, "").trim().slice(0, 100) || ""

    if (!title && !url) {
      return NextResponse.json({ success: false, error: "no article found" })
    }

    return NextResponse.json({
      success: true,
      data: {
        author: account,
        title,
        summary,
        imageUrl,
        pubDate: "",
        url: url.startsWith("http") ? url : `https://weixin.sogou.com${url}`,
      },
    })
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) })
  }
}
