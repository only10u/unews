import { NextResponse } from "next/server"
import { generateText } from "ai"

interface NewsItem {
  id: string
  title: string
  platform: string
}

export async function POST(request: Request) {
  try {
    const { items } = await request.json() as { items: NewsItem[] }
    
    if (!items || items.length === 0) {
      return NextResponse.json({ cryptoNews: [] })
    }

    // 构建列表供AI判断
    const itemList = items.map((item, idx) => `${idx + 1}. [${item.platform}] ${item.title}`).join("\n")

    const prompt = `你是一个加密货币市场分析专家。请分析以下热搜新闻列表，筛选出可能在24小时内影响加密货币价格的新闻。

影响币价的新闻特征包括：
- 监管政策变化（SEC、央行、各国加密法规）
- 大型机构动态（贝莱德、特斯拉等公司的加密相关消息）
- 宏观经济数据（利率、通胀、就业数据）
- 地缘政治事件（战争、制裁、国际关系）
- 科技巨头动态（马斯克、扎克伯格等人物言论）
- 加密行业新闻（交易所、DeFi、NFT重大事件）
- 美股大盘走势相关消息

请从以下热搜中选出最多5条可能影响币价的新闻，并为每条给出：
1. 一句话说明可能的影响
2. 影响方向（利好/利空/中性）

热搜列表：
${itemList}

请按以下JSON格式返回（只返回JSON，不要有其他文字）：
{
  "cryptoNews": [
    {"index": 1, "impact": "影响说明", "direction": "利好"},
    {"index": 5, "impact": "影响说明", "direction": "利空"}
  ]
}

如果没有可能影响币价的新闻，返回：{"cryptoNews": []}`

    const { text } = await generateText({
      model: "anthropic/claude-sonnet-4-20250514" as any,
      prompt,
      maxTokens: 800,
    })

    // 解析JSON
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        const cryptoNews = (parsed.cryptoNews || []).map((m: { index: number; impact: string; direction: string }) => ({
          id: items[m.index - 1]?.id || "",
          title: items[m.index - 1]?.title || "",
          platform: items[m.index - 1]?.platform || "",
          impact: m.impact || "",
          direction: m.direction || "中性",
        })).filter((m: { id: string }) => m.id)
        return NextResponse.json({ cryptoNews })
      }
    } catch {
      console.error("Failed to parse crypto impact response")
    }

    return NextResponse.json({ cryptoNews: [] })
  } catch (error) {
    console.error("Crypto impact API error:", error)
    return NextResponse.json({ cryptoNews: [], error: String(error) })
  }
}
