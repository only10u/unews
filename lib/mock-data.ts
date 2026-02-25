// Platform icon URLs
export const PLATFORM_ICONS = {
  weibo: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/unnamed-2DMyfQQZxc6qB1B4iYNhonXsTxqesO.png",
  douyin: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/%E5%BE%AE%E4%BF%A1%E5%9B%BE%E7%89%87_2026-02-25_133001_132-3L6OfkycCzJtNGF6rfuPTja7PKCzNh.png",
  gongzhonghao: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/images-JwZUfhv1P3SehfPgf2INlNrXcSUhLu.png",
  okx: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/vEj4j3o9_400x400-I5YzmLqLCZ5X9YsFekvjLqWCI3jmUH.jpg",
  binance: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/025iaK2q_400x400-DDPDb76JZ5zuFvPYOIq65sHcsMClCs.jpg",
} as const

export type Platform = "aggregate" | "weibo" | "gongzhonghao" | "douyin"

export type ScoreLevel = "golden" | "silver" | "bronze" | "earth"

export function getScoreLevel(score: number): ScoreLevel {
  if (score >= 9.1) return "golden"
  if (score >= 7.1) return "silver"
  if (score >= 4.1) return "bronze"
  return "earth"
}

export function getScoreColor(score: number): string {
  const level = getScoreLevel(score)
  switch (level) {
    case "golden": return "var(--gold)"
    case "silver": return "var(--silver)"
    case "bronze": return "var(--bronze)"
    case "earth": return "#666666"
  }
}

export function getScoreLabel(score: number): string {
  const level = getScoreLevel(score)
  switch (level) {
    case "golden": return "金狗"
    case "silver": return "银狗"
    case "bronze": return "铜狗"
    case "earth": return "土狗"
  }
}

export interface NewsItem {
  id: string
  platform: "weibo" | "gongzhonghao" | "douyin"
  author: string
  authorAvatar: string
  authorVerified: boolean
  authorFollowers: string
  title: string
  summary: string
  aiSummary?: string
  score: number
  scoreReason: string
  tags: string[]
  likes: number
  reposts: number
  comments: number
  timestamp: string
  url: string
  imageUrl?: string
  videoUrl?: string
  // Rank tracking fields
  platformRank?: number         // current rank on platform (e.g. Weibo #5)
  prevPlatformRank?: number     // previous rank (for delta calculation)
  rankDelta?: number            // +N means rose N spots, -N means fell
  isBursting?: boolean          // true if rank surged dramatically
  firstSeenAt?: number          // epoch ms when first scraped
  isOfficial?: boolean          // true if from official/央媒 account
}

export interface TrendingItem {
  id: string
  rank: number
  title: string
  hotValue: number
  url: string
  isNew?: boolean
  prevRank?: number     // rank 15 minutes ago
  rankDelta?: number    // positive = rose, negative = fell
  isBurst?: boolean     // surged from 50+ to top 10
  // Deep content fields (from second-level scraping)
  excerpt?: string           // first post summary text
  imageUrl?: string          // first image from top post
  videoUrl?: string          // video link if applicable
  topAuthor?: string         // top post author name
  topAuthorAvatar?: string   // top post author avatar
}

export interface CryptoPrice {
  symbol: string
  name: string
  price: number
  change24h: number
}

// Mock news feed data - 25 items for preview/expand feature
export const mockNewsData: NewsItem[] = [
  {
    id: "1",
    platform: "weibo",
    author: "财经头条",
    authorAvatar: "https://api.dicebear.com/7.x/initials/svg?seed=CJ&backgroundColor=f0b90b",
    authorVerified: true,
    authorFollowers: "1200万",
    title: "美联储突发声明：加密货币监管框架即将出台",
    summary: "据华尔街日报报道，美联储主席鲍威尔今日在国会听证会上表示，将在下月推出全新的加密货币监管框架。此举被市场解读为重大利好，比特币短时突破 10 万美元关口。",
    aiSummary: "美联储将推出加密货币监管框架，市场解读为利好信号。比特币突破10万美元，监管明确化有望推动机构资金入场。建议关注后续政策细节和市场反应。",
    score: 9.3,
    scoreReason: "多平台热搜共振 + 政策叙事 + 高传播速率",
    tags: ["政策叙事", "突发爆点", "热度加速"],
    likes: 45200,
    reposts: 12800,
    comments: 8900,
    timestamp: "3分钟前",
    url: "https://weibo.com",
    imageUrl: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=600&h=300&fit=crop",
    platformRank: 1,
    prevPlatformRank: 3,
    rankDelta: 2,
    isBursting: true,
    firstSeenAt: Date.now() - 3 * 60 * 1000,
    isOfficial: true,
  },
  {
    id: "2",
    platform: "douyin",
    author: "区块链日报",
    authorAvatar: "https://api.dicebear.com/7.x/initials/svg?seed=QK&backgroundColor=3b82f6",
    authorVerified: true,
    authorFollowers: "890万",
    title: "马斯克直播中展示新宠物柴犬，取名$MARS",
    summary: "马斯克在今晚直播中展示了他的新宠物柴犬，并表示要在 Solana 链上发行 Meme 币 $MARS。直播观看人数突破 500 万。",
    aiSummary: "马斯克再次利用社交影响力推动Meme币热潮，$MARS代币在Solana链上部署。历史经验表明此类名人效应短期爆发力强但持续性存疑，需警惕追高风险。",
    score: 9.5,
    scoreReason: "名人效应 + 包含代币名称$MARS + Solana链提及",
    tags: ["动物IP", "名人翻车", "荒谬新闻"],
    likes: 89000,
    reposts: 34000,
    comments: 22000,
    timestamp: "5分钟前",
    url: "https://douyin.com",
    videoUrl: "https://example.com/video1.mp4",
    platformRank: 2,
    prevPlatformRank: 8,
    rankDelta: 6,
    isBursting: true,
    firstSeenAt: Date.now() - 5 * 60 * 1000,
  },
  {
    id: "3",
    platform: "gongzhonghao",
    author: "吴说区块链",
    authorAvatar: "https://api.dicebear.com/7.x/initials/svg?seed=WS&backgroundColor=10b981",
    authorVerified: true,
    authorFollowers: "50万",
    title: "独家：某顶级交易所即将上线新代币，合约地址曝光",
    summary: "据知情人士透露，某头部交易所将在本周上线一个 AI 概念代币。合约地址：0x1234...abcd。目前该代币在 DEX 上交易量已暴涨 300%。",
    aiSummary: "头部交易所即将上线AI概念代币，合约地址已被社区发现。DEX交易量暴涨300%显示市场关注度极高，但需注意交易所上币前后可能出现的剧烈波动。",
    score: 8.7,
    scoreReason: "包含CA地址 + 交易所上币叙事 + AI概念",
    tags: ["AI革命", "热度加速", "突发爆点"],
    likes: 12000,
    reposts: 5600,
    comments: 3200,
    timestamp: "8分钟前",
    url: "https://mp.weixin.qq.com",
    imageUrl: "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=600&h=300&fit=crop",
    platformRank: 5,
    prevPlatformRank: 5,
    rankDelta: 0,
    firstSeenAt: Date.now() - 8 * 60 * 1000,
  },
  {
    id: "4",
    platform: "weibo",
    author: "每日经济新闻",
    authorAvatar: "https://api.dicebear.com/7.x/initials/svg?seed=MR&backgroundColor=ef4444",
    authorVerified: true,
    authorFollowers: "3500万",
    title: "SEC 主席发推暗示以太坊 ETF 审批进展",
    summary: "美国 SEC 主席 Gary Gensler 在社交媒体上发布了一条意味深长的推文，被社区解读为以太坊 ETF 审批即将迎来重大进展。ETH 价格短时上涨 8%。",
    aiSummary: "SEC主席社交媒体发文被解读为ETH ETF利好信号，ETH短时上涨8%。若ETF获批将为以太坊带来大量机构资金，建议关注审批时间线和市场情绪变化。",
    score: 8.2,
    scoreReason: "监管叙事 + 多平台传播 + 价格联动",
    tags: ["监管冲突", "政策叙事", "热度加速"],
    likes: 28000,
    reposts: 9800,
    comments: 6700,
    timestamp: "12分钟前",
    url: "https://weibo.com",
    platformRank: 3,
    prevPlatformRank: 2,
    rankDelta: -1,
    firstSeenAt: Date.now() - 12 * 60 * 1000,
    isOfficial: true,
  },
  {
    id: "5",
    platform: "douyin",
    author: "Crypto小明",
    authorAvatar: "https://api.dicebear.com/7.x/initials/svg?seed=XM&backgroundColor=8b5cf6",
    authorVerified: false,
    authorFollowers: "23万",
    title: "震惊！这只土狗币一天翻了100倍",
    summary: "一位匿名开发者在 Base 链上部署的 Meme 币 $DOGE2 在 24 小时内实现 100 倍涨幅，目前市值已达 5000 万美元。社区怀疑有大户操盘。",
    aiSummary: "Base链Meme币$DOGE2实现100倍涨幅，但匿名开发者和大户操盘嫌疑需高度警惕。此类项目通常缺乏基本面支撑，投资者应谨防rug pull风险。",
    score: 7.5,
    scoreReason: "包含代币名称 + Base链提及 + 高波动数据",
    tags: ["荒谬新闻", "资本 vs 散户", "热度加速"],
    likes: 56000,
    reposts: 18000,
    comments: 14000,
    timestamp: "15分钟前",
    url: "https://douyin.com",
    imageUrl: "https://images.unsplash.com/photo-1622630998477-20aa696ecb05?w=600&h=300&fit=crop",
    platformRank: 7,
    prevPlatformRank: 15,
    rankDelta: 8,
    isBursting: true,
    firstSeenAt: Date.now() - 15 * 60 * 1000,
  },
  {
    id: "6",
    platform: "gongzhonghao",
    author: "链闻速递",
    authorAvatar: "https://api.dicebear.com/7.x/initials/svg?seed=LW&backgroundColor=06b6d4",
    authorVerified: true,
    authorFollowers: "80万",
    title: "空投预警：某 L2 项目即将开放领取",
    summary: "据官方公告，某知名 L2 项目将于下周一开放代币空投领取，快照时间为上月 15 日��预计参与人数超过 50 万。",
    aiSummary: "知名L2项目空投即将开放，快照已于上月完成。预计50万人参与领取，建议关注Gas费波动和代币上线后的抛压情况。",
    score: 7.8,
    scoreReason: "包含空投关键词 + L2叙事 + 高初始分",
    tags: ["热度加速", "群体狂欢"],
    likes: 8900,
    reposts: 4200,
    comments: 2100,
    timestamp: "20分钟前",
    url: "https://mp.weixin.qq.com",
    platformRank: 12,
    prevPlatformRank: 12,
    rankDelta: 0,
    firstSeenAt: Date.now() - 20 * 60 * 1000,
  },
  {
    id: "7",
    platform: "weibo",
    author: "搞笑日常",
    authorAvatar: "https://api.dicebear.com/7.x/initials/svg?seed=GX&backgroundColor=f97316",
    authorVerified: false,
    authorFollowers: "500万",
    title: "网友晒出AI生成的搞笑猫咪图被疯转",
    summary: "一位网友使用AI生成了一组猫咪穿西装上班的图片，被微博疯转超过10万次。有网友已经开始在链上部署相关Meme币。",
    aiSummary: "AI生成猫咪图成为新一轮meme素材，链上已出现相关代币。萌宠+AI的组合有一定传播力，但meme币投机性极强，建议娱乐为主。",
    score: 5.2,
    scoreReason: "萌宠二创 + 中等传播 + Meme潜力",
    tags: ["萌宠二创", "迷因模板", "AI生成荒诞"],
    likes: 102000,
    reposts: 45000,
    comments: 18000,
    timestamp: "25分钟前",
    url: "https://weibo.com",
    imageUrl: "https://images.unsplash.com/photo-1574158622682-e40e69881006?w=600&h=300&fit=crop",
  },
  {
    id: "8",
    platform: "douyin",
    author: "生活百态",
    authorAvatar: "https://api.dicebear.com/7.x/initials/svg?seed=SH&backgroundColor=ec4899",
    authorVerified: false,
    authorFollowers: "150万",
    title: "外卖小哥街头即兴表演走红",
    summary: "一位外卖小哥在等餐时即兴弹奏吉他的视频在抖音走红，获得超过200万点赞。暂无直接链上关联性。",
    aiSummary: "外卖小哥才艺视频走红属于典型社会热点，暂无直接区块链或加密货币关联。链上投机可能性低，建议仅作社会话题观察。",
    score: 3.2,
    scoreReason: "社交热度中等 + 无链上相关性",
    tags: ["群体狂欢", "热度稳定"],
    likes: 210000,
    reposts: 35000,
    comments: 28000,
    timestamp: "30分钟前",
    url: "https://douyin.com",
    videoUrl: "https://example.com/video2.mp4",
  },
  {
    id: "9",
    platform: "weibo",
    author: "币圈老王",
    authorAvatar: "https://api.dicebear.com/7.x/initials/svg?seed=LW2&backgroundColor=6366f1",
    authorVerified: false,
    authorFollowers: "45万",
    title: "BTC矿工持仓创三年新低，抛压警告",
    summary: "链上数据显示，比特币矿工持仓量降至三年最低水平，大量BTC被转移至交易所地址。分析师警告可能面临短期抛压。",
    aiSummary: "矿工持仓降至三年低位，链上数据显示大量BTC流入交易所。短期抛压风险上升，但长期来看矿工出清也可能是底部信号，需结合其他指标综合判断。",
    score: 7.2,
    scoreReason: "链上数据 + 矿工行为 + 价格影响",
    tags: ["链上数据", "矿工行为", "风险预警"],
    likes: 15600,
    reposts: 6800,
    comments: 4500,
    timestamp: "35分钟前",
    url: "https://weibo.com",
  },
  {
    id: "10",
    platform: "gongzhonghao",
    author: "DeFi之道",
    authorAvatar: "https://api.dicebear.com/7.x/initials/svg?seed=DF&backgroundColor=14b8a6",
    authorVerified: true,
    authorFollowers: "35万",
    title: "Uniswap V4 正式上线，手续费降低50%",
    summary: "Uniswap官方宣布V4版本正式上线以太坊主网，新版本引入Hook机制，交易手续费平均降低50%。TVL在上线首日突破100亿美元。",
    aiSummary: "Uniswap V4上线带来Hook机制创新和50%手续费降低，TVL首日突破百亿。这对DeFi生态是重大利好，可能带动DEX赛道整体回暖。UNI代币短期有上涨动力。",
    score: 8.5,
    scoreReason: "头部协议升级 + TVL数据 + DeFi叙事",
    tags: ["DeFi", "协议升级", "TVL突破"],
    likes: 9800,
    reposts: 4100,
    comments: 2800,
    timestamp: "38分钟前",
    url: "https://mp.weixin.qq.com",
    imageUrl: "https://images.unsplash.com/photo-1642790106117-e829e14a795f?w=600&h=300&fit=crop",
  },
  {
    id: "11",
    platform: "douyin",
    author: "Web3导航",
    authorAvatar: "https://api.dicebear.com/7.x/initials/svg?seed=W3&backgroundColor=a855f7",
    authorVerified: true,
    authorFollowers: "120万",
    title: "Solana手机Saga2开售秒罄，二手价翻三倍",
    summary: "Solana第二代区块链手机Saga2正式开售，10万台库存在3分钟内售罄。二手市场价格已从599美元飙升至1800美元，引发社区热议。",
    aiSummary: "Solana手机Saga2秒罄反映出Web3硬件市场需求旺盛。二手溢价显示市场投机情绪，但同时也证明了Solana生态的用户基础正在扩大。",
    score: 7.9,
    scoreReason: "Solana生态 + 硬件叙事 + 稀缺性",
    tags: ["Solana生态", "硬件", "稀缺性溢价"],
    likes: 67000,
    reposts: 23000,
    comments: 15000,
    timestamp: "42分钟前",
    url: "https://douyin.com",
  },
  {
    id: "12",
    platform: "weibo",
    author: "财联社",
    authorAvatar: "https://api.dicebear.com/7.x/initials/svg?seed=CL&backgroundColor=0ea5e9",
    authorVerified: true,
    authorFollowers: "2800万",
    title: "香港虚拟资产交易所牌照再添两家",
    summary: "香港证监会今日宣布，再向两家加密货币交易平台发放虚拟资产交易所牌照。至此，香港持牌交易所已达8家，监管框架持续完善。",
    aiSummary: "香港持牌交易所增至8家，监管环境持续改善。亚太地区加密合规化进程加速，利好合规交易平台和亚洲市场流动性。",
    score: 7.1,
    scoreReason: "监管利好 + 香港政策 + 合规化趋势",
    tags: ["政策叙事", "亚太市场", "监管合规"],
    likes: 18000,
    reposts: 7200,
    comments: 3900,
    timestamp: "45分钟前",
    url: "https://weibo.com",
  },
  {
    id: "13",
    platform: "gongzhonghao",
    author: "Bankless中文",
    authorAvatar: "https://api.dicebear.com/7.x/initials/svg?seed=BL&backgroundColor=ef4444",
    authorVerified: true,
    authorFollowers: "28万",
    title: "以太坊Dencun升级后L2成本下降90%",
    summary: "据最新数据，以太坊Dencun升级后各L2网��的交易成本平均下降90%以上。Arbitrum单笔交易费用已降至0.01美元以下，推动L2日活用户数创新高。",
    score: 7.6,
    scoreReason: "技术升级 + 数据支撑 + L2叙事",
    tags: ["技术升级", "L2生态", "成本降低"],
    likes: 6800,
    reposts: 3100,
    comments: 1900,
    timestamp: "50分钟前",
    url: "https://mp.weixin.qq.com",
  },
  {
    id: "14",
    platform: "douyin",
    author: "加密日记",
    authorAvatar: "https://api.dicebear.com/7.x/initials/svg?seed=JM&backgroundColor=d946ef",
    authorVerified: false,
    authorFollowers: "56万",
    title: "传某国将比特币列为法定货币",
    summary: "据多方消息源透露，某东南亚国家正在考虑将比特币列为法定支付手段。如果消息属实，这将是继萨尔瓦多之后第二个采取此举的国家。",
    score: 8.0,
    scoreReason: "法定货币叙事 + 政策利好 + 国际影响",
    tags: ["政策叙事", "国际局势", "BTC利好"],
    likes: 43000,
    reposts: 19000,
    comments: 11000,
    timestamp: "55分钟前",
    url: "https://douyin.com",
  },
  {
    id: "15",
    platform: "weibo",
    author: "区块律动",
    authorAvatar: "https://api.dicebear.com/7.x/initials/svg?seed=QD&backgroundColor=22c55e",
    authorVerified: true,
    authorFollowers: "150万",
    title: "AI Agent 赛道单日融资超5亿美元",
    summary: "据统计，AI Agent赛道在过去24小时内完成超过5亿美元融资，a16z和Paradigm领投多个项目。市场对AI+Crypto的叙事热度持续升温。",
    score: 8.8,
    scoreReason: "AI赛道 + 大额融资 + 顶级VC参与",
    tags: ["AI革命", "VC动态", "融资热潮"],
    likes: 21000,
    reposts: 8900,
    comments: 5600,
    timestamp: "1小时前",
    url: "https://weibo.com",
    imageUrl: "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=600&h=300&fit=crop",
  },
  {
    id: "16",
    platform: "gongzhonghao",
    author: "星球日报",
    authorAvatar: "https://api.dicebear.com/7.x/initials/svg?seed=XQ&backgroundColor=f59e0b",
    authorVerified: true,
    authorFollowers: "65万",
    title: "比特币ETF单周净流入创历史新高",
    summary: "美国比特币现货ETF在本周录得创纪录的38亿美元净流入，其中BlackRock的IBIT贡献了超过一半的份额。",
    score: 8.3,
    scoreReason: "ETF数据 + 机构资金 + 创纪录",
    tags: ["机构入场", "ETF数据", "资金流向"],
    likes: 11000,
    reposts: 4800,
    comments: 2900,
    timestamp: "1小时前",
    url: "https://mp.weixin.qq.com",
  },
  {
    id: "17",
    platform: "douyin",
    author: "链上侦探",
    authorAvatar: "https://api.dicebear.com/7.x/initials/svg?seed=LZ&backgroundColor=64748b",
    authorVerified: false,
    authorFollowers: "78万",
    title: "巨鲸钱包异动：5000枚BTC转入交易所",
    summary: "链上监控显示，某知名巨鲸地址在过去1小时内向Coinbase转入5000枚BTC，价值约5亿美元。社区担忧可能引发抛售。",
    score: 7.4,
    scoreReason: "巨鲸动向 + 大额转账 + 抛售风险",
    tags: ["链上数据", "巨鲸动向", "风险预警"],
    likes: 38000,
    reposts: 14000,
    comments: 9200,
    timestamp: "1小时前",
    url: "https://douyin.com",
  },
  {
    id: "18",
    platform: "weibo",
    author: "科技金融圈",
    authorAvatar: "https://api.dicebear.com/7.x/initials/svg?seed=KJ&backgroundColor=0891b2",
    authorVerified: true,
    authorFollowers: "890万",
    title: "苹果Vision Pro支持加密钱包应用",
    summary: "苹果在最新的visionOS更新中开放了加密钱包应用接入。MetaMask和Phantom已率先适配，用户可通过手势操作管理数字资产。",
    score: 6.8,
    scoreReason: "科技巨头 + 加密集成 + 新场景",
    tags: ["科技巨头", "新场景", "硬件生态"],
    likes: 34000,
    reposts: 12000,
    comments: 7800,
    timestamp: "1.5小时前",
    url: "https://weibo.com",
  },
  {
    id: "19",
    platform: "gongzhonghao",
    author: "PANews",
    authorAvatar: "https://api.dicebear.com/7.x/initials/svg?seed=PA&backgroundColor=7c3aed",
    authorVerified: true,
    authorFollowers: "42万",
    title: "Starknet生态TVL突破50亿美元",
    summary: "据DeFiLlama数据，Starknet生态总锁仓量(TVL)首次突破50亿美元大关，较年初增长超过400%。ZK Rollup技术路线获得市场认可。",
    score: 7.3,
    scoreReason: "TVL数据 + ZK叙事 + 生态增长",
    tags: ["ZK技术", "TVL突破", "生态增长"],
    likes: 7200,
    reposts: 3400,
    comments: 1800,
    timestamp: "2小时前",
    url: "https://mp.weixin.qq.com",
  },
  {
    id: "20",
    platform: "douyin",
    author: "币圈老李",
    authorAvatar: "https://api.dicebear.com/7.x/initials/svg?seed=LL&backgroundColor=be185d",
    authorVerified: false,
    authorFollowers: "200万",
    title: "实盘：我用1000U如何在一周赚到10万U",
    summary: "抖音博主分享了自己通过杠杆交易在一周内将1000USDT变为10万USDT的过程。视频引发争议，有人质疑真实性，也有人模仿操作爆仓。",
    score: 4.5,
    scoreReason: "高风险交易 + 争议性内容 + 高互动",
    tags: ["交易实录", "高风险", "争议内容"],
    likes: 156000,
    reposts: 42000,
    comments: 35000,
    timestamp: "2小时前",
    url: "https://douyin.com",
    videoUrl: "https://example.com/video3.mp4",
  },
  {
    id: "21",
    platform: "weibo",
    author: "加密观察",
    authorAvatar: "https://api.dicebear.com/7.x/initials/svg?seed=JG&backgroundColor=059669",
    authorVerified: true,
    authorFollowers: "320万",
    title: "Coinbase宣布进军日本市场",
    summary: "Coinbase正式宣布获得日本金融厅(FSA)牌照，将在三个月内向日本用户开放服务。这标志着Coinbase亚太扩张战略的重要一步。",
    score: 6.5,
    scoreReason: "交易所扩张 + 日本市场 + 牌照获批",
    tags: ["交易所", "亚太市场", "牌照"],
    likes: 14000,
    reposts: 5200,
    comments: 3100,
    timestamp: "2.5小时前",
    url: "https://weibo.com",
  },
  {
    id: "22",
    platform: "gongzhonghao",
    author: "Web3研习社",
    authorAvatar: "https://api.dicebear.com/7.x/initials/svg?seed=W3Y&backgroundColor=db2777",
    authorVerified: true,
    authorFollowers: "18万",
    title: "深度：RWA赛道为何被称为下一个万亿美元市场",
    summary: "本文深入分析了RWA(现实世界资产)赛道的发展前景，包括国债代币化、房地产上链等方向。报告预测到2030年RWA市场规模将超过16万亿美元。",
    score: 6.2,
    scoreReason: "深度分析 + RWA叙事 + 市场预测",
    tags: ["RWA", "深度分析", "市场预测"],
    likes: 4500,
    reposts: 2100,
    comments: 980,
    timestamp: "3小时前",
    url: "https://mp.weixin.qq.com",
  },
  {
    id: "23",
    platform: "douyin",
    author: "NFT艺术家",
    authorAvatar: "https://api.dicebear.com/7.x/initials/svg?seed=NF&backgroundColor=e11d48",
    authorVerified: false,
    authorFollowers: "88万",
    title: "用AI生成NFT作品月入10万的方法论",
    summary: "一位NFT创作者分享了自己利用AI工具批量生成NFT艺术品并在OpenSea上获得持续收入的完整流程和技巧。",
    score: 4.8,
    scoreReason: "AI+NFT + 中等热度 + 创作者经济",
    tags: ["NFT", "AI创作", "创作者经济"],
    likes: 89000,
    reposts: 28000,
    comments: 16000,
    timestamp: "3小时前",
    url: "https://douyin.com",
  },
  {
    id: "24",
    platform: "weibo",
    author: "金色财经",
    authorAvatar: "https://api.dicebear.com/7.x/initials/svg?seed=JS&backgroundColor=ca8a04",
    authorVerified: true,
    authorFollowers: "560万",
    title: "以太坊Gas费降至历史新低",
    summary: "得益于Dencun升级和L2分流效应，以太坊主网Gas费降至历史最低水平，普通转账仅需约0.1美元。这对DeFi和NFT生态复苏形成利好。",
    score: 6.9,
    scoreReason: "Gas费数据 + 生态利好 + 技术进步",
    tags: ["以太坊", "Gas费", "生态利好"],
    likes: 23000,
    reposts: 8100,
    comments: 4700,
    timestamp: "3.5小时前",
    url: "https://weibo.com",
  },
  {
    id: "25",
    platform: "gongzhonghao",
    author: "Foresight News",
    authorAvatar: "https://api.dicebear.com/7.x/initials/svg?seed=FN&backgroundColor=2563eb",
    authorVerified: true,
    authorFollowers: "55万",
    title: "一文读懂EigenLayer再质押生态图谱",
    summary: "全面梳理EigenLayer再质押生态的最新发展，涵盖AVS服务、LRT协议、积分经济等核心概念，并分析了即将到来的代币空投预期。",
    score: 7.0,
    scoreReason: "热门叙事 + 空投预期 + 生态梳理",
    tags: ["再质押", "EigenLayer", "空投预期"],
    likes: 5600,
    reposts: 2700,
    comments: 1500,
    timestamp: "4小时前",
    url: "https://mp.weixin.qq.com",
  },
]

// Mock trending data
export const mockWeiboTrending: TrendingItem[] = [
  { id: "w1", rank: 1, title: "美联储加密货币监管框架", hotValue: 9876543, url: "https://s.weibo.com/weibo?q=%23美联储加密货币监管框架%23" },
  { id: "w2", rank: 2, title: "马斯克新宠物柴犬MARS", hotValue: 8765432, url: "https://s.weibo.com/weibo?q=%23马斯克新宠物柴犬%23" },
  { id: "w3", rank: 3, title: "以太坊ETF审批进展", hotValue: 7654321, url: "https://s.weibo.com/weibo?q=%23以太坊ETF%23" },
  { id: "w4", rank: 4, title: "比特币突破10万美元", hotValue: 6543210, url: "https://s.weibo.com/weibo?q=%23比特币突破10万%23" },
  { id: "w5", rank: 5, title: "AI生成猫咪图疯转", hotValue: 5432109, url: "https://s.weibo.com/weibo?q=%23AI猫咪图%23" },
  { id: "w6", rank: 6, title: "某交易所上线新币", hotValue: 4321098, url: "https://s.weibo.com/weibo?q=%23新币上线%23" },
  { id: "w7", rank: 7, title: "L2空投即将开放", hotValue: 3210987, url: "https://s.weibo.com/weibo?q=%23L2空投%23" },
  { id: "w8", rank: 8, title: "Base链Meme币暴涨", hotValue: 2109876, url: "https://s.weibo.com/weibo?q=%23Base链%23" },
  { id: "w9", rank: 9, title: "Solana生态重大更新", hotValue: 1098765, url: "https://s.weibo.com/weibo?q=%23Solana%23" },
  { id: "w10", rank: 10, title: "SEC监管新动态", hotValue: 987654, url: "https://s.weibo.com/weibo?q=%23SEC监管%23" },
  { id: "w11", rank: 11, title: "DeFi协议被攻击", hotValue: 876543, url: "https://s.weibo.com/weibo?q=%23DeFi攻击%23" },
  { id: "w12", rank: 12, title: "NFT市场回暖", hotValue: 765432, url: "https://s.weibo.com/weibo?q=%23NFT回暖%23" },
  { id: "w13", rank: 13, title: "韩国加密监管", hotValue: 654321, url: "https://s.weibo.com/weibo?q=%23韩国加密%23" },
  { id: "w14", rank: 14, title: "稳定币新规", hotValue: 543210, url: "https://s.weibo.com/weibo?q=%23稳定币%23" },
  { id: "w15", rank: 15, title: "DAO治理争议", hotValue: 432109, url: "https://s.weibo.com/weibo?q=%23DAO治理%23" },
  { id: "w16", rank: 16, title: "矿工收益变化", hotValue: 321098, url: "https://s.weibo.com/weibo?q=%23矿工收益%23" },
  { id: "w17", rank: 17, title: "元宇宙项目进展", hotValue: 210987, url: "https://s.weibo.com/weibo?q=%23元宇宙%23" },
  { id: "w18", rank: 18, title: "链游新品发布", hotValue: 109876, url: "https://s.weibo.com/weibo?q=%23链游%23" },
  { id: "w19", rank: 19, title: "跨链桥安全事件", hotValue: 98765, url: "https://s.weibo.com/weibo?q=%23跨链桥%23" },
  { id: "w20", rank: 20, title: "RWA概念爆发", hotValue: 87654, url: "https://s.weibo.com/weibo?q=%23RWA%23" },
]

export const mockDouyinTrending: TrendingItem[] = [
  { id: "d1", rank: 1, title: "马斯克直播柴犬MARS", hotValue: 12345678, url: "https://www.douyin.com/search/马斯克柴犬" },
  { id: "d2", rank: 2, title: "土狗币100倍暴涨实录", hotValue: 10234567, url: "https://www.douyin.com/search/土狗币100倍" },
  { id: "d3", rank: 3, title: "比特币10万美元庆祝", hotValue: 9123456, url: "https://www.douyin.com/search/比特币10万" },
  { id: "d4", rank: 4, title: "外卖小哥吉他表演", hotValue: 8012345, url: "https://www.douyin.com/search/外卖小哥吉他" },
  { id: "d5", rank: 5, title: "AI画猫挑战赛", hotValue: 7901234, url: "https://www.douyin.com/search/AI画猫" },
  { id: "d6", rank: 6, title: "区块链科普系列", hotValue: 6890123, url: "https://www.douyin.com/search/区块链科普" },
  { id: "d7", rank: 7, title: "加密钱包安全教程", hotValue: 5789012, url: "https://www.douyin.com/search/钱包安全" },
  { id: "d8", rank: 8, title: "新手炒币入门", hotValue: 4678901, url: "https://www.douyin.com/search/炒币入门" },
  { id: "d9", rank: 9, title: "DeFi挖矿教程", hotValue: 3567890, url: "https://www.douyin.com/search/DeFi挖矿" },
  { id: "d10", rank: 10, title: "NFT艺术创作", hotValue: 2456789, url: "https://www.douyin.com/search/NFT艺术" },
  { id: "d11", rank: 11, title: "Web3求职攻略", hotValue: 1345678, url: "https://www.douyin.com/search/Web3求职" },
  { id: "d12", rank: 12, title: "元宇宙体验分享", hotValue: 1234567, url: "https://www.douyin.com/search/元宇宙体验" },
  { id: "d13", rank: 13, title: "空投撸毛教程", hotValue: 1123456, url: "https://www.douyin.com/search/空投撸毛" },
  { id: "d14", rank: 14, title: "链上数据分析", hotValue: 1012345, url: "https://www.douyin.com/search/链上数据" },
  { id: "d15", rank: 15, title: "Meme币文化解读", hotValue: 901234, url: "https://www.douyin.com/search/Meme币" },
  { id: "d16", rank: 16, title: "加密行业裁员潮", hotValue: 890123, url: "https://www.douyin.com/search/加密裁员" },
  { id: "d17", rank: 17, title: "稳定币收益策略", hotValue: 789012, url: "https://www.douyin.com/search/稳定币收益" },
  { id: "d18", rank: 18, title: "跨链体验对比", hotValue: 678901, url: "https://www.douyin.com/search/跨链对比" },
  { id: "d19", rank: 19, title: "DAO组织运营", hotValue: 567890, url: "https://www.douyin.com/search/DAO运营" },
  { id: "d20", rank: 20, title: "Layer2使用指南", hotValue: 456789, url: "https://www.douyin.com/search/Layer2指南" },
]

export const mockGzhTrending: TrendingItem[] = [
  { id: "g1", rank: 1, title: "独家：头部交易所上币内幕", hotValue: 98000, url: "https://mp.weixin.qq.com" },
  { id: "g2", rank: 2, title: "空投预警：L2项目即将开放领取", hotValue: 87000, url: "https://mp.weixin.qq.com" },
  { id: "g3", rank: 3, title: "深度解析美联储加密监管框架", hotValue: 76000, url: "https://mp.weixin.qq.com" },
  { id: "g4", rank: 4, title: "Solana生态年度报告", hotValue: 65000, url: "https://mp.weixin.qq.com" },
  { id: "g5", rank: 5, title: "AI���理赛道全景分析", hotValue: 54000, url: "https://mp.weixin.qq.com" },
  { id: "g6", rank: 6, title: "2026年加密行业十大预测", hotValue: 43000, url: "https://mp.weixin.qq.com" },
  { id: "g7", rank: 7, title: "DeFi安全漏洞年度复盘", hotValue: 32000, url: "https://mp.weixin.qq.com" },
  { id: "g8", rank: 8, title: "RWA赛道机构入场报告", hotValue: 21000, url: "https://mp.weixin.qq.com" },
  { id: "g9", rank: 9, title: "NFT市场回暖信号分析", hotValue: 18000, url: "https://mp.weixin.qq.com" },
  { id: "g10", rank: 10, title: "Web3社交产品对比测评", hotValue: 15000, url: "https://mp.weixin.qq.com" },
  { id: "g11", rank: 11, title: "稳定币监管全球动态", hotValue: 12000, url: "https://mp.weixin.qq.com" },
  { id: "g12", rank: 12, title: "链上数据周报", hotValue: 10000, url: "https://mp.weixin.qq.com" },
  { id: "g13", rank: 13, title: "加密VC投资趋势", hotValue: 9000, url: "https://mp.weixin.qq.com" },
  { id: "g14", rank: 14, title: "矿工生态变革", hotValue: 8000, url: "https://mp.weixin.qq.com" },
  { id: "g15", rank: 15, title: "跨链桥技术对比", hotValue: 7000, url: "https://mp.weixin.qq.com" },
  { id: "g16", rank: 16, title: "DAO治理最佳实践", hotValue: 6000, url: "https://mp.weixin.qq.com" },
  { id: "g17", rank: 17, title: "ZK技术进展月报", hotValue: 5000, url: "https://mp.weixin.qq.com" },
  { id: "g18", rank: 18, title: "模块化区块链解读", hotValue: 4000, url: "https://mp.weixin.qq.com" },
  { id: "g19", rank: 19, title: "加密税务指南", hotValue: 3000, url: "https://mp.weixin.qq.com" },
  { id: "g20", rank: 20, title: "比特币减半效应复盘", hotValue: 2000, url: "https://mp.weixin.qq.com" },
]

export const mockCryptoPrices: CryptoPrice[] = [
  { symbol: "BTC", name: "Bitcoin", price: 102345.67, change24h: 5.23 },
  { symbol: "ETH", name: "Ethereum", price: 3890.12, change24h: 3.45 },
  { symbol: "SOL", name: "Solana", price: 187.89, change24h: 8.12 },
  { symbol: "BNB", name: "BNB", price: 645.32, change24h: -1.23 },
]

export function formatHotValue(value: number): string {
  if (value >= 10000000) return (value / 10000000).toFixed(1) + "千万"
  if (value >= 10000) return (value / 10000).toFixed(1) + "万"
  return value.toString()
}

export function formatNumber(value: number): string {
  if (value >= 10000) return (value / 10000).toFixed(1) + "万"
  return value.toLocaleString()
}

// Official URLs for "查看全部"
export const PLATFORM_OFFICIAL_URLS = {
  weibo: "https://s.weibo.com/top/summary",
  douyin: "https://www.douyin.com/hot",
  gongzhonghao: "https://mp.weixin.qq.com",
} as const
