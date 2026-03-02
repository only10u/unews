import { NextResponse } from "next/server"

// AI智能去噪 + 摘要端点
// 功能：过滤娱乐八卦、明星动态、饭圈追星、影视剧综等内容
// 同时提供摘要生成功能

interface SummaryRequest {
  title: string
  content: string
  platform: string
}

// 娱乐八卦/明星/饭圈关键词 - 用于去噪过滤
const ENTERTAINMENT_KEYWORDS = [
  // 明星艺人通用词
  "明星", "艺人", "偶像", "爱豆", "idol", "演员", "歌手", "练习生", "出道",
  // 饭圈追星词汇
  "饭圈", "粉丝", "应援", "打call", "控评", "反黑", "超话", "pick", "出圈",
  "安利", "入坑", "脱粉", "回踩", "黑粉", "私生", "站姐", "代拍", "接机",
  "刷榜", "做数据", "营业", "塌房", "糊了", "翻红", "c位", "资源咖",
  // 娱乐八卦词汇  
  "恋情", "分手", "官宣", "领证", "离婚", "出轨", "劈腿", "小三", "绯闻",
  "热恋", "约会", "同框", "合体", "cp", "嗑cp", "锁死", "be了", "he",
  // 影视剧综相关
  "电视剧", "电影", "综艺", "上映", "杀青", "开机", "定档", "收视率",
  "票房", "路演", "首映", "点映", "番位", "主演", "客串", "搭档",
  "真人秀", "选秀", "淘汰", "晋级", "导师", "学员", "成团", "出道夜",
  // 娱乐圈事件
  "红毯", "颁奖", "典礼", "封后", "影帝", "影后", "视帝", "视后",
  "提名", "获奖", "内娱", "外娱", "韩娱", "日娱", "港圈",
  // 具体平台/节目特征词
  "创造营", "青你", "偶练", "乘风破浪", "披荆斩棘", "跑男", "向往的生活",
  "浪姐", "哥哥", "中餐厅", "极限挑战", "快本", "天天向上",
]

// 特定排除的明星/艺人名称模式 (可以根据需要扩展)
const CELEBRITY_PATTERNS = [
  /[某某].*?[恋情|分手|官宣]/,
  /追星.*?[女孩|男孩|少女]/,
]

/**
 * 检测内容是否为娱乐八卦/明星饭圈相关
 * @returns true 如果是需要过滤的内容
 */
export function isEntertainmentContent(title: string, content: string = ""): boolean {
  const text = (title + " " + content).toLowerCase()
  
  // 检查是否包含娱乐关键词
  const matchedKeywords = ENTERTAINMENT_KEYWORDS.filter(kw => text.includes(kw.toLowerCase()))
  
  // 如果匹配了2个或以上关键词，认定为娱乐内容
  if (matchedKeywords.length >= 2) {
    return true
  }
  
  // 检查明星相关模式
  for (const pattern of CELEBRITY_PATTERNS) {
    if (pattern.test(text)) {
      return true
    }
  }
  
  // 单个强特征关键词也过滤
  const strongKeywords = ["饭圈", "追星", "爱豆", "应援", "控评", "超话", "塌房", "刷榜"]
  if (strongKeywords.some(kw => text.includes(kw))) {
    return true
  }
  
  return false
}

/**
 * 获取去噪过滤原因（用于调试/日志）
 */
export function getFilterReason(title: string, content: string = ""): string | null {
  const text = (title + " " + content).toLowerCase()
  
  const matchedKeywords = ENTERTAINMENT_KEYWORDS.filter(kw => text.includes(kw.toLowerCase()))
  
  if (matchedKeywords.length >= 2) {
    return `匹配娱乐关键词: ${matchedKeywords.slice(0, 3).join(", ")}`
  }
  
  const strongKeywords = ["饭圈", "追星", "爱豆", "应援", "控评", "超话", "塌房", "刷榜"]
  const matchedStrong = strongKeywords.filter(kw => text.includes(kw))
  if (matchedStrong.length > 0) {
    return `匹配强特征词: ${matchedStrong.join(", ")}`
  }
  
  return null
}

export async function POST(request: Request) {
  try {
    const body: SummaryRequest = await request.json()
    const { title, content, platform } = body

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 })
    }

    // 首先进行去噪检测
    const shouldFilter = isEntertainmentContent(title, content)
    const filterReason = shouldFilter ? getFilterReason(title, content) : null

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
        return NextResponse.json({ 
          summary: result.text,
          filtered: shouldFilter,
          filterReason 
        })
      } catch (aiError) {
        console.error("AI generation failed, falling back:", aiError)
      }
    }

    // Fallback: rule-based summary generation
    const summary = generateRuleSummary(title, content, platform)
    return NextResponse.json({ 
      summary, 
      source: "rule-based",
      filtered: shouldFilter,
      filterReason 
    })
  } catch (error) {
    console.error("AI summary error:", error)
    return NextResponse.json(
      { error: "Failed to generate summary" },
      { status: 500 }
    )
  }
}

// 新增：批量去噪检测接口
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { items } = body as { items: Array<{ id: string; title: string; content?: string }> }

    if (!Array.isArray(items)) {
      return NextResponse.json({ error: "Items array is required" }, { status: 400 })
    }

    const results = items.map(item => ({
      id: item.id,
      filtered: isEntertainmentContent(item.title, item.content),
      filterReason: getFilterReason(item.title, item.content)
    }))

    return NextResponse.json({ results })
  } catch (error) {
    console.error("AI denoise error:", error)
    return NextResponse.json(
      { error: "Failed to process denoise request" },
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
