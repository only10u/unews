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
    const { title, content } = body

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 })
    }

    // 首先使用规则进行快速去噪检测
    const ruleBasedFilter = isEntertainmentContent(title, content)
    const filterReason = ruleBasedFilter ? getFilterReason(title, content) : null

    // 如果规则已经判断为娱乐内容，直接返回
    if (ruleBasedFilter) {
      return NextResponse.json({ 
        filtered: true,
        filterReason,
        source: "rule-based"
      })
    }

    // 规则未命中时，尝试使用AI进行更智能的检测
    const aiKey = process.env.AI_GATEWAY_API_KEY
    if (aiKey) {
      try {
        const { generateText } = await import("ai")
        const result = await generateText({
          model: "openai/gpt-4o-mini" as any,
          prompt: `你是一个内容分类器。请判断以下内容是否属于"娱乐八卦/明星动态/饭圈追星/影视剧综艺"类别。

需要过滤的内容包括：
- 明星艺人的私生活、恋情、绯闻
- 饭圈追星、应援、超话、控评相关
- 影视剧、综艺节目、选秀节目相关
- 娱乐圈八卦、颁奖典礼、红毯等

不应过滤的内容包括：
- 加密货币、区块链、Web3相关
- 科技、财经、时政新闻
- 社会民生、教育、健康等

标题：${title}
内容：${content || "无"}

请只回答 true 或 false：
- true = 这是娱乐八卦/明星饭圈内容，应该过滤
- false = 这不是娱乐内容，不应过滤`,
          maxTokens: 10,
        })
        
        const aiResult = result.text.trim().toLowerCase()
        const aiFiltered = aiResult === "true" || aiResult.includes("true")
        
        return NextResponse.json({ 
          filtered: aiFiltered,
          filterReason: aiFiltered ? "AI判断为娱乐内容" : null,
          source: "ai"
        })
      } catch (aiError) {
        console.error("AI denoise failed, falling back to rule-based:", aiError)
      }
    }

    // Fallback: 规则检测结果
    return NextResponse.json({ 
      filtered: ruleBasedFilter,
      filterReason,
      source: "rule-based"
    })
  } catch (error) {
    console.error("AI denoise error:", error)
    return NextResponse.json(
      { error: "Failed to process denoise request" },
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

// 注意：原摘要生成函数已移除，AI去噪现在专注于内容分类过滤
