import { NextResponse } from "next/server"

// AI Summary endpoint
// Uses a simple rule-based summarizer as fallback when no AI provider is configured
// In production, connect to OpenAI / Anthropic / DeepSeek etc.

interface SummaryRequest {
  title: string
  content: string
  platform: string
}

export async function POST(request: Request) {
  try {
    const body: SummaryRequest = await request.json()
    const { title, content, platform } = body

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 })
    }

    // Try to use AI provider if AI_GATEWAY_API_KEY is set
    const aiKey = process.env.AI_GATEWAY_API_KEY
    if (aiKey) {
      try {
        const { generateText } = await import("ai")
        const result = await generateText({
          model: "openai/gpt-4o-mini" as any,
          prompt: `你是一位加密货币和Web3领域的资深分析师。请用简洁的中文对以下${getPlatformName(platform)}内容进行总结分析，重点关注与加密货币市场的关联性、潜在影响和交易机会。控制在100字以内。

标题：${title}
内容：${content || "无详细内容"}

请直接给出总结，不要加任何前缀。`,
          maxTokens: 200,
        })
        return NextResponse.json({ summary: result.text })
      } catch (aiError) {
        console.error("AI generation failed, falling back:", aiError)
      }
    }

    // Fallback: rule-based summary generation
    const summary = generateRuleSummary(title, content, platform)
    return NextResponse.json({ summary, source: "rule-based" })
  } catch (error) {
    console.error("AI summary error:", error)
    return NextResponse.json(
      { error: "Failed to generate summary" },
      { status: 500 }
    )
  }
}

function getPlatformName(platform: string): string {
  switch (platform) {
    case "weibo": return "微博"
    case "douyin": return "抖音"
    case "gongzhonghao": return "公众号"
    default: return "社交媒体"
  }
}

function generateRuleSummary(title: string, content: string, platform: string): string {
  const text = (title + " " + (content || "")).toLowerCase()

  // Crypto keywords detection
  const cryptoKeywords = ["btc", "eth", "sol", "bnb", "比特币", "以太坊", "加密", "区块链", "defi", "nft", "空投", "挖矿", "代币", "交易所", "链上", "web3", "meme"]
  const hasCrypto = cryptoKeywords.some(k => text.includes(k))

  const bullKeywords = ["暴涨", "突破", "新高", "利好", "上涨", "飙升", "爆发", "bull", "moon"]
  const bearKeywords = ["暴跌", "下跌", "崩盘", "利空", "恐慌", "清算", "crash", "bear"]
  const regulatoryKeywords = ["监管", "政策", "sec", "合规", "审查", "禁止"]
  const techKeywords = ["升级", "技术", "开发", "测试网", "主网", "协议"]

  const isBullish = bullKeywords.some(k => text.includes(k))
  const isBearish = bearKeywords.some(k => text.includes(k))
  const isRegulatory = regulatoryKeywords.some(k => text.includes(k))
  const isTech = techKeywords.some(k => text.includes(k))

  let summary = ""

  if (hasCrypto) {
    if (isBullish) {
      summary = `该消息显示市场情绪偏向积极。"${title}" 可能带动相关板块短期上涨。建议关注链上资金流向，把握潜在交易机会，但需注意追高风险。`
    } else if (isBearish) {
      summary = `该消息释放负面信号。"${title}" 可能引发市场恐慌情绪扩散。建议密切关注支撑位，做好风险管理，等待企稳信号后再行操作。`
    } else if (isRegulatory) {
      summary = `该消息涉及政策监管层面。"${title}" 对市场影响需要综合评估。监管明确化长期利好行业发展，但短期可能带来不确定性波动。`
    } else if (isTech) {
      summary = `该消息属于技术发展类。"${title}" 反映了项目技术进展或升级动态。基本面改善有利于长期价值，但短期价格影响有限。`
    } else {
      summary = `来自${getPlatformName(platform)}的热点："${title}"。该话题在加密社区引发关注，建议持续跟踪后续发展及市场反应，评估潜在的交易信号。`
    }
  } else {
    summary = `来自${getPlatformName(platform)}的社会热点："${title}"。该话题当前热度较高，虽非直接加密相关，但可能影响市场情绪面。建议观察是否会形成跨圈传播效应。`
  }

  return summary
}
