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
      return NextResponse.json({ memes: [] })
    }

    // 构建列表供Claude判断
    const itemList = items.map((item, idx) => `${idx + 1}. [${item.platform}] ${item.title}`).join("\n")

    const prompt = `你是一个加密货币和Meme币分析专家。请分析以下热搜标题列表，筛选出具有加密货币/链上meme炒作潜力的新闻。

Meme币潜力特征包括：
- 涉及动物形象（狗、猫、青蛙、熊猫等）
- 名人效应（马斯克、特朗普等有社交影响力的人物）
- 政策反差（意外的政策变化、监管动态）
- 网络梗/病毒传播潜力的事件
- 科技突破（AI、航天等可能产生概念币的领域）
- 社会热点中有符号化、IP化潜力的元素

请从以下热搜中选出最多5条具有meme潜力的新闻，并为每条给出一句话理由。

热搜列表：
${itemList}

请按以下JSON格式返回（只返回JSON，不要有其他文字）：
{
  "memes": [
    {"index": 1, "reason": "理由说明"},
    {"index": 5, "reason": "理由说明"}
  ]
}

如果没有合适的meme潜力新闻，返回：{"memes": []}`

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY || "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 800,
        messages: [{ role: "user", content: prompt }],
      }),
    })

    if (!response.ok) {
      console.error("Claude API error:", response.status)
      return NextResponse.json({ memes: [] })
    }

    const data = await response.json()
    const text = data.content?.[0]?.text || ""

    // 解析JSON
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        const memes = (parsed.memes || []).map((m: { index: number; reason: string }) => ({
          id: items[m.index - 1]?.id || "",
          title: items[m.index - 1]?.title || "",
          platform: items[m.index - 1]?.platform || "",
          reason: m.reason || "",
        })).filter((m: { id: string }) => m.id)
        return NextResponse.json({ memes })
      }
    } catch {
      console.error("Failed to parse meme response")
    }

    return NextResponse.json({ memes: [] })
  } catch (error) {
    console.error("Meme potential API error:", error)
    return NextResponse.json({ memes: [], error: String(error) })
  }
}
