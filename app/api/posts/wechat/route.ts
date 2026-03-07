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

    // 匹配标题：从 <a> 标签的 title 属性或文本内容取
    const titleMatch = html.match(/<a[^>]+uigs="article_title_1"[^>]*title="([^"]+)"/)
      || html.match(/<a[^>]+uigs="article_title_1"[^>]*>([^<]+)</)
    // 匹配文章链接
    const urlMatch = html.match(/<a[^>]+uigs="article_title_1"[^>]*href="([^"]+)"/)
    // 匹配摘要
    const summaryMatch = html.match(/class="txt-info"[^>]*>([\s\S]*?)<\/p>/)
    // 匹配图片：sogou 缩略图里的原始 url 参数
    const imgMatch = html.match(/sogoucdn\.com\/v2\/thumb[^"']*url=([^&"']+)/)
    // 匹配作者
    const authorMatch = html.match(/class="account"[^>]*>([\s\S]*?)<\/span>/)

    const title = titleMatch?.[1]?.trim() || ""
    const rawUrl = urlMatch?.[1]?.replace(/&amp;/g, "&").trim() || ""
    const summary = summaryMatch?.[1]?.replace(/<[^>]+>/g, "").replace(/&[a-z]+;/g, "").trim().slice(0, 100) || ""
    const author = authorMatch?.[1]?.replace(/<[^>]+>/g, "").trim() || account

    // 还原图片真实地址
    let imageUrl = ""
    if (imgMatch?.[1]) {
      try {
        imageUrl = decodeURIComponent(imgMatch[1])
        if (imageUrl.startsWith("http") === false) {
          imageUrl = "https:" + imageUrl
        }
      } catch {
        imageUrl = ""
      }
    }

    const url = rawUrl.startsWith("http") ? rawUrl : `https://weixin.sogou.com${rawUrl}`

    if (!url) {
      return NextResponse.json({ success: false, error: "no article found" })
    }

    return NextResponse.json({
      success: true,
      data: {
        author,
        title,
        summary,
        imageUrl,
        pubDate: "",
        url,
      },
    })
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) })
  }
}
