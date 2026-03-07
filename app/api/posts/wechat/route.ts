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
      `https://weixin.sogou.com/weixin?type=2&query=${encodeURIComponent(query)}&ie=utf8`,
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

    // 文章搜索结果，匹配第一条
    const titleMatch = html.match(/class="txt-box"[^>]*>[\s\S]*?<h3[^>]*>[\s\S]*?<a[^>]*title="([^"]+)"/)
    const urlMatch = html.match(/class="txt-box"[^>]*>[\s\S]*?<h3[^>]*>[\s\S]*?<a[^>]*href="([^"]+)"/)
    const summaryMatch = html.match(/class="txt-info"[^>]*>([\s\S]*?)<\/p>/)
    const imgMatch = html.match(/<div class="img-box"[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"/)
    const authorMatch = html.match(/class="account"[^>]*>([\s\S]*?)<\/span>/)

    const title = titleMatch?.[1]?.trim() || ""
    const url = urlMatch?.[1]?.trim() || ""
    const summary = summaryMatch?.[1]?.replace(/<[^>]+>/g, "").trim().slice(0, 100) || ""
    const imageUrl = imgMatch?.[1]?.trim() || ""
    const author = authorMatch?.[1]?.replace(/<[^>]+>/g, "").trim() || account

    if (!title && !url) {
      // debug: 返回 html 片段帮助定位
      return NextResponse.json({ 
        success: false, 
        error: "no article found",
        htmlSample: html.slice(2000, 5000)
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        author,
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
