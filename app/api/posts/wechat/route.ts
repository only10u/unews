import { NextResponse } from "next/server"

// GET /api/posts/wechat?account=xxx
// account 参数映射到对应的公众号RSS
const ACCOUNT_MAP: Record<string, string> = {
  "央视新闻": "CCTVnewsclient",
  "人民日报": "rmrb1948",
  "光明日报": "gmrb1949",
  "新华社": "xinhuashefabu",
}

// 去除HTML标签
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim()
}

// 解析RSS XML
function parseRssItem(xml: string): {
  title: string
  summary: string
  imageUrl: string
  pubDate: string
  url: string
  author: string
} | null {
  try {
    // 提取第一个 <item>
    const itemMatch = xml.match(/<item>([\s\S]*?)<\/item>/)
    if (!itemMatch) return null
    
    const itemXml = itemMatch[1]
    
    // 提取各字段
    const titleMatch = itemXml.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/)
    const descMatch = itemXml.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/)
    const linkMatch = itemXml.match(/<link>([\s\S]*?)<\/link>/)
    const pubDateMatch = itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/)
    const enclosureMatch = itemXml.match(/<enclosure[^>]*url="([^"]*)"/)
    const authorMatch = itemXml.match(/<author>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/author>/)
    
    const title = titleMatch ? stripHtml(titleMatch[1]) : ""
    const description = descMatch ? stripHtml(descMatch[1]) : ""
    const summary = description.substring(0, 80) + (description.length > 80 ? "..." : "")
    const url = linkMatch ? linkMatch[1].trim() : ""
    const pubDate = pubDateMatch ? pubDateMatch[1].trim() : ""
    const imageUrl = enclosureMatch ? enclosureMatch[1] : ""
    const author = authorMatch ? stripHtml(authorMatch[1]) : ""
    
    return { title, summary, imageUrl, pubDate, url, author }
  } catch {
    return null
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const account = searchParams.get("account")
    
    if (!account) {
      return NextResponse.json({ success: false, error: "account is required" }, { status: 400 })
    }
    
    const accountId = ACCOUNT_MAP[account]
    if (!accountId) {
      return NextResponse.json({ success: false, error: `unknown account: ${account}` }, { status: 400 })
    }
    
    const res = await fetch(`http://1.12.248.87:3002/wechat/mp/article/${accountId}`, {
      next: { revalidate: 600 }, // 10分钟缓存
      signal: AbortSignal.timeout(15000),
    })
    
    if (!res.ok) {
      throw new Error(`upstream ${res.status}`)
    }
    
    const xml = await res.text()
    const item = parseRssItem(xml)
    
    if (!item) {
      return NextResponse.json({ success: false, error: "failed to parse RSS" }, { status: 500 })
    }
    
    return NextResponse.json({
      success: true,
      data: {
        ...item,
        author: item.author || account, // fallback到账号名
      }
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200',
      },
    })
  } catch (e) {
    console.log("[POSTS-WECHAT] error:", String(e))
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 })
  }
}
