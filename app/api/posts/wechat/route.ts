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

    // 匹配第一条文章的链接（article_title_0）
    const urlMatch = html.match(/uigs="article_title_0"[^>]*href="([^"]+)"/)
      || html.match(/href="([^"]+)"[^>]*uigs="article_title_0"/)

    // 匹配第一条文章标题文本（去掉注释和 em 标签）
    const titleBlockMatch = html.match(/uigs="article_title_0"[^>]*>([\s\S]*?)<\/a>/)
    const title = titleBlockMatch?.[1]
      ?.replace(/<!--[\s\S]*?-->/g, "")
      ?.replace(/<[^>]+>/g, "")
      ?.trim() || ""

    // 匹配第一条摘要
    const summaryMatch = html.match(/id="sogou_vr_11002601_summary_0"[^>]*>([\s\S]*?)<\/p>/)
    const summary = summaryMatch?.[1]
      ?.replace(/<!--[\s\S]*?-->/g, "")
      ?.replace(/<[^>]+>/g, "")
      ?.replace(/&ldquo;/g, "「")
      ?.replace(/&rdquo;/g, "」")
      ?.replace(/&amp;/g, "&")
      ?.trim()
      ?.slice(0, 100) || ""

    // 匹配图片：取 sogou 缩略图里的原始 url 参数值并 decode
    const imgMatch = html.match(/id="sogou_vr_11002601_img_0"[\s\S]*?url=([^&"]+)/)
    let imageUrl = ""
    if (imgMatch?.[1]) {
      try { imageUrl = decodeURIComponent(imgMatch[1]) } catch { imageUrl = "" }
    }

    // 还原 url
    const rawUrl = urlMatch?.[1]?.replace(/&amp;/g, "&") || ""
    const url = rawUrl.startsWith("http") ? rawUrl : `https://weixin.sogou.com${rawUrl}`

    if (!url || url === "https://weixin.sogou.com") {
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
        url,
      },
    })
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) })
  }
}
