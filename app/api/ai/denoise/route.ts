import { NextResponse } from "next/server"

const CLAUDE_MODEL = "claude-sonnet-4-20250514"

interface NewsItem {
  id: string
  title: string
  platform: string
}

export async function POST(request: Request) {
  try {
    const { items } = await request.json() as { items: NewsItem[] }
    
    if (!items || items.length === 0) {
      return NextResponse.json({ filteredIds: [] })
    }

    // 构建列表供Claude判断
    const itemList = items.map((item, idx) => `${idx + 1}. [${item.platform}] ${item.title}`).join("\n")

    const prompt = `你是一个新闻内容分类专家。请分析以下热搜标题列表，识别出属于"娱乐性内容"的条目。

娱乐性内容包括但不限于：
- 明星八卦、艺人动态、偶像新闻
- 饭圈追星、粉丝应援、控评相关
- 电视剧、电影、综艺节目相关热搜
- 娱乐圈绯闻、恋情、分手、官宣等
- 选秀节目、练习生、成团出道
- 影视剧票房、收视率、番位争议

需要保留的有价值内容：
- 财经、科技、互联网行业新闻
- 政策法规、社会民生
- 国际时事、地缘政治
- 科学发现、学术研究
- 体育赛事（非娱乐八卦性质）
- 社会事件、民生热点

热搜列表：
${itemList}

请直接返回需要过滤掉的娱乐性内容的序号，用逗号分隔。如果没有需要过滤的内容，返回"无"。
只返回序号或"无"，不要有其他解释文字。`

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY || "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 500,
        messages: [{ role: "user", content: prompt }],
      }),
    })

    if (!response.ok) {
      console.error("Claude API error:", response.status)
      return NextResponse.json({ filteredIds: [], error: "API error" })
    }

    const data = await response.json()
    const text = data.content?.[0]?.text || ""

    // 解析返回的序号
    if (text.trim() === "无" || text.trim() === "") {
      return NextResponse.json({ filteredIds: [] })
    }

    const numbers = text.match(/\d+/g) || []
    const filteredIds = numbers
      .map(n => parseInt(n, 10) - 1) // 转为0索引
      .filter(idx => idx >= 0 && idx < items.length)
      .map(idx => items[idx].id)

    return NextResponse.json({ filteredIds })
  } catch (error) {
    console.error("Denoise API error:", error)
    return NextResponse.json({ filteredIds: [], error: String(error) })
  }
}
