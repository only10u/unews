"use client"

import { useMemo, useState, useEffect, useCallback, useRef } from "react"
import { cn } from "@/lib/utils"
import {
  type Platform,
  type NewsItem,
  type TrendingItem,
  PLATFORM_ICONS,
} from "@/lib/mock-data"
import { NewsCard } from "./news-card"
import { HotOverview } from "./hot-overview"
import { VoiceSettingsDialog, speakText, type VoiceSettings, type SoundType } from "./voice-settings"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  ChevronDown,
  ChevronUp,
  Lock,
  RefreshCw,
  ArrowUp,
  Pin,
  Volume2,
  VolumeX,
  Settings,
} from "lucide-react"
import Image from "next/image"
import useSWR from "swr"

interface NewsFeedProps {
  activeChannel: Platform
  aiDenoiseEnabled?: boolean  // AI降噪开关
  isAuthed?: boolean
  onOpenAuthDialog?: () => void
  scoreThreshold?: number
  keywords?: string[]
  tweetFontSize?: number
  // 音频播报相关
  isMuted?: boolean
  onToggleMute?: () => void
  // 滚动联动相关
  scrollRef?: React.RefObject<HTMLDivElement>
  onScroll?: (scrollTop: number, scrollHeight: number, clientHeight: number) => void
}

const PREVIEW_COUNT = 20
const FREE_PREVIEW = 999 // Temporarily disabled: allow all content for free users
const W1 = 0.5  // initial weight factor
const W2 = 0.35 // freshness factor
const W3 = 0.15 // burst bonus factor

// 娱乐八卦/明星/饭圈关键词 - 用于客户端去噪过滤
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
]

// 强特征词：单独出现即过滤
const STRONG_ENTERTAINMENT_KEYWORDS = ["饭圈", "追星", "爱豆", "应援", "控评", "超话", "塌房", "刷榜"]

/** 检测内容是否为娱乐八卦/明星饭圈相关 */
function isEntertainmentContent(title: string, content: string = ""): boolean {
  const text = (title + " " + content).toLowerCase()
  
  // 检查是否包含娱乐关键词
  const matchedKeywords = ENTERTAINMENT_KEYWORDS.filter(kw => text.includes(kw.toLowerCase()))
  
  // 如果匹配了2个或以上关键词，认定为娱乐内容
  if (matchedKeywords.length >= 2) {
    return true
  }
  
  // 单个强特征关键词也过滤
  if (STRONG_ENTERTAINMENT_KEYWORDS.some(kw => text.includes(kw))) {
    return true
  }
  
  return false
}

function getPlatformLabel(p: Platform): string {
  switch (p) {
    case "aggregate": return "聚合"
    case "weibo": return "微博"
    case "gongzhonghao": return "公众号"
    case "douyin": return "抖音"
  }
}

function getPlatformIcon(p: Platform): string | null {
  switch (p) {
    case "weibo": return PLATFORM_ICONS.weibo
    case "gongzhonghao": return PLATFORM_ICONS.gongzhonghao
    case "douyin": return PLATFORM_ICONS.douyin
    default: return null
  }
}

/** Jaccard similarity on character bigrams for dedup */
function textSimilarity(a: string, b: string): number {
  if (a === b) return 1
  if (a.length < 2 || b.length < 2) return 0
  const bigramsA = new Set<string>()
  const bigramsB = new Set<string>()
  for (let i = 0; i < a.length - 1; i++) bigramsA.add(a.substring(i, i + 2))
  for (let i = 0; i < b.length - 1; i++) bigramsB.add(b.substring(i, i + 2))
  let intersection = 0
  for (const bg of bigramsA) if (bigramsB.has(bg)) intersection++
  const union = bigramsA.size + bigramsB.size - intersection
  return union === 0 ? 0 : intersection / union
}

function deduplicateNews(items: NewsItem[]): NewsItem[] {
  const seen: NewsItem[] = []
  for (const item of items) {
    const isDupe = seen.some(
      (s) => textSimilarity(s.title, item.title) > 0.9
    )
    if (!isDupe) seen.push(item)
  }
  return seen
}

/** Parse "X分钟前" / "X小时前" to minutes */
function parseMinutesAgo(ts: string): number {
  const m = ts.match(/(\d+)\s*分钟前/)
  if (m) return parseInt(m[1], 10)
  const h = ts.match(/(\d+)\s*小时前/)
  if (h) return parseInt(h[1], 10) * 60
  return 999
}

/**
 * Dynamic Priority Ranking:
 * compositeScore = (initialWeight * W1) + (freshnessDecay * W2) + (burstBonus * W3)
 *
 * Official accounts: forced top-5 for 30 minutes
 * Burst: 15-min rank rise >= 5 positions
 */
function computeCompositeScore(item: NewsItem): number {
  const initialWeight = item.score
  const minutesAgo = parseMinutesAgo(item.timestamp)

  // Freshness: items within 10 minutes get extreme boost
  let freshness = 0
  if (minutesAgo <= 3) freshness = 10
  else if (minutesAgo <= 10) freshness = 8
  else if (minutesAgo <= 30) freshness = 5
  else if (minutesAgo <= 60) freshness = 3
  else freshness = 1

  // Burst: rank surged 5+ in 15 minutes
  let burstBonus = 0
  if (item.isBursting) burstBonus = 10
  else if (item.rankDelta && item.rankDelta >= 5) burstBonus = Math.min(item.rankDelta * 1.5, 10)

  // Official account boost: 30 minutes
  let officialBoost = 0
  if (item.isOfficial && minutesAgo <= 30) officialBoost = 5

  // High AI score boost (金狗 >= 9.0)
  let goldBoost = 0
  if (item.score >= 9.0) goldBoost = 3

  return (initialWeight * W1) + (freshness * W2) + (burstBonus * W3) + officialBoost + goldBoost
}

/** 
 * 检查字符串是否有效（非空、非undefined、trim后有内容）
 * 用于防止空字符串覆盖已有数据
 */
function isValidString(val: string | undefined | null): val is string {
  return typeof val === "string" && val.trim() !== ""
}

/**
 * 字段级合并：新数据的空值不会覆盖旧数据
 * 优先使用新数据，但如果新数据为空则保留旧数据
 */
function mergeNewsItem(existing: NewsItem | undefined, newItem: NewsItem): NewsItem {
  if (!existing) return newItem
  
  return {
    ...existing,
    ...newItem,
    // 以下字段：新值为空时保留旧值
    author: isValidString(newItem.author) ? newItem.author : existing.author,
    authorAvatar: isValidString(newItem.authorAvatar) ? newItem.authorAvatar : existing.authorAvatar,
    summary: isValidString(newItem.summary) ? newItem.summary : existing.summary,
    imageUrl: isValidString(newItem.imageUrl) ? newItem.imageUrl : existing.imageUrl,
    videoUrl: isValidString(newItem.videoUrl) ? newItem.videoUrl : existing.videoUrl,
    detailContent: isValidString(newItem.detailContent) ? newItem.detailContent : existing.detailContent,
    // 数组字段：新数组有内容时才替换
    tags: (newItem.tags && newItem.tags.length > 0) ? newItem.tags : existing.tags,
  }
}

/** 解析原始时间戳字段（支持多种格式） */
function parseOriginalTimestamp(item: TrendingItem): number | null {
  // 尝试多种可能的时间戳字段名
  const timeFields = [
    (item as any).pubDate,
    (item as any).created_at,
    (item as any).createdAt,
    (item as any).publish_time,
    (item as any).publishTime,
    (item as any).time,
    (item as any).timestamp,
    (item as any).update_time,
    (item as any).updateTime,
  ]
  
  for (const field of timeFields) {
    if (!field) continue
    
    // 如果是数字（Unix时间戳，秒或毫秒）
    if (typeof field === "number") {
      // 判断是秒还是毫秒
      return field > 1e12 ? field : field * 1000
    }
    
    // 如果是字符串，尝试解析
    if (typeof field === "string") {
      const parsed = Date.parse(field)
      if (!isNaN(parsed)) return parsed
      
      // 尝试解析 "x分钟前" 格式
      const minMatch = field.match(/(\d+)\s*分钟前/)
      if (minMatch) {
        return Date.now() - parseInt(minMatch[1], 10) * 60 * 1000
      }
      
      const hourMatch = field.match(/(\d+)\s*小时前/)
      if (hourMatch) {
        return Date.now() - parseInt(hourMatch[1], 10) * 60 * 60 * 1000
      }
    }
  }
  
  return null
}

/** 格式化时间戳为相对时间 */
function formatRelativeTime(firstSeenAt: number): string {
  const now = Date.now()
  const diffMs = now - firstSeenAt
  const diffMinutes = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMinutes / 60)
  
  if (diffMinutes < 1) return "刚刚"
  if (diffMinutes < 60) return `${diffMinutes}分钟前`
  if (diffHours < 24) return `${diffHours}小时前`
  
  // 超过24小时显示 MM-DD HH:mm
  const date = new Date(firstSeenAt)
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  const hour = String(date.getHours()).padStart(2, "0")
  const minute = String(date.getMinutes()).padStart(2, "0")
  return `${month}-${day} ${hour}:${minute}`
}

/** Convert trending items from API into NewsItem format */
function trendingToNewsItems(
  items: TrendingItem[],
  platform: "weibo" | "gongzhonghao" | "douyin",
  cache?: Map<string, NewsItem>,
  firstSeenMap?: Map<string, number>
): NewsItem[] {
  const authors: Record<string, { name: string; avatar: string; verified: boolean; followers: string; isOfficial: boolean }> = {
    weibo: { name: "微博热搜", avatar: "https://api.dicebear.com/7.x/initials/svg?seed=WB&backgroundColor=e60012", verified: true, followers: "5000万", isOfficial: true },
    douyin: { name: "抖音热榜", avatar: "https://api.dicebear.com/7.x/initials/svg?seed=DY&backgroundColor=000000", verified: true, followers: "3000万", isOfficial: true },
    gongzhonghao: { name: "公众号精选", avatar: "https://api.dicebear.com/7.x/initials/svg?seed=GZ&backgroundColor=1aad19", verified: true, followers: "1000万", isOfficial: false },
  }
  const auth = authors[platform]

  return items.map((item, index) => {
    // Score based on rank: top items get higher score
    const baseScore = Math.max(1, 10 - (item.rank - 1) * 0.4)
    // Boost burst items
    const burstBonus = item.isBurst ? 1.5 : 0
    const score = Math.min(10, Math.round((baseScore + burstBonus) * 10) / 10)

    // Determine tags
    const tags: string[] = []
    if (item.rank <= 3) tags.push("热搜前三")
    if (item.rank <= 10) tags.push("Top 10")
    if (item.isBurst) tags.push("热门爆发")
    if (score >= 9.0) tags.push("突发爆点")
    const delta = item.rankDelta ?? 0

    const id = `${platform}-trending-${item.id}`
    
    // 修复3: 优先使用接口返回的原始时间戳
    // 1. 首先尝试从接口数据中解析原始时间戳（pubDate, created_at等）
    // 2. 如果没有原始时间戳，则使用首次发现时间
    // 3. 已有记录不覆盖，避免轮询刷新时间覆盖真实上榜时间
    let firstSeenAt = firstSeenMap?.get(id)
    const originalTimestamp = parseOriginalTimestamp(item)
    
    if (!firstSeenAt) {
      // 先尝试从 localStorage 读取，有则沿用，无则记录当前时间
      try {
        const stored = typeof window !== "undefined" ? localStorage.getItem(`fs_${id}`) : null
        firstSeenAt = stored ? parseInt(stored, 10) : (originalTimestamp || Date.now())
        // 如果localStorage没有存储，则写入
        if (!stored && typeof window !== "undefined") {
          localStorage.setItem(`fs_${id}`, String(firstSeenAt))
        }
      } catch {
        firstSeenAt = originalTimestamp || Date.now()
      }
      // 更新内存缓存
      if (firstSeenMap) {
        firstSeenMap.set(id, firstSeenAt)
      }
    }
    const timestamp = formatRelativeTime(firstSeenAt)

    // Use real enriched author data from API (prefer API author over generic platform default)
    const authorName = item.authorName || item.topAuthor || auth.name
    const authorAvatar = item.authorAvatar || item.topAuthorAvatar || auth.avatar
    // Use real excerpt only - no fake fallback text
    const summary = item.excerpt || item.summary || ""
    
    const newItem: NewsItem = {
      id,
      platform,
      author: authorName,
      authorAvatar: authorAvatar,
      authorVerified: auth.verified,
      authorFollowers: auth.followers,
      title: item.title,
      summary,
      score,
      scoreReason: "",
      tags,
      likes: Math.floor(item.hotValue / 100),
      reposts: Math.floor(item.hotValue / 200),
      comments: Math.floor(item.hotValue / 300),
      timestamp,
      url: item.url,
      imageUrl: item.imageUrl,
      videoUrl: item.videoUrl,
      mediaType: item.mediaType,
      detailContent: item.detailContent,
      platformRank: item.rank,
      prevPlatformRank: item.prevRank,
      rankDelta: delta,
      isBursting: item.isBurst || delta >= 5,
      firstSeenAt,
      isOfficial: auth.isOfficial && item.rank <= 5,
    }
    
    // 修复1: 与缓存进行字段级merge，防止空值覆盖
    const existing = cache?.get(id)
    const merged = mergeNewsItem(existing, newItem)
    
    // 更新缓存
    if (cache) {
      cache.set(id, merged)
    }
    
    return merged
  })
}

function formatHotValue(n: number): string {
  if (n >= 100000000) return (n / 100000000).toFixed(1) + "亿"
  if (n >= 10000) return (n / 10000).toFixed(1) + "万"
  return n.toLocaleString()
}

/** SWR fetcher for trending data - includes deep content fields */
async function trendingFetcher(platform: string): Promise<TrendingItem[]> {
  try {
    const res = await fetch(`/api/trending/${platform}`)
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data) && data.length > 0) {
        return data.map(
          (item: {
            rank?: number; title?: string; hotValue?: number; url?: string;
            excerpt?: string; imageUrl?: string; imageurl?: string; videoUrl?: string;
            mediaType?: "image" | "video";
            topAuthor?: string; topAuthorAvatar?: string;
            authorName?: string; authorAvatar?: string;
            author?: string;  // API直接返回的author字段
            summary?: string;
            detailContent?: string;
            platformRank?: number;
            // 扩展：兼容更多可能的字段名
            nickname?: string;
            avatar?: string;
            user?: { screen_name?: string; profile_image_url?: string; avatar?: string };
          }, i: number) => ({
            id: `${platform[0]}${i + 1}`,
            rank: item.platformRank || item.rank || i + 1,
            title: item.title || "",
            hotValue: item.hotValue || 0,
            url: item.url || "",
            // 正文：覆盖更多可能的字段名
            excerpt: item.summary || item.excerpt || (item as any).digest || (item as any).description || (item as any).content || (item as any).text || (item as any).desc || "",
            imageUrl: item.imageUrl || item.imageurl || (item as any).cover || (item as any).pic || "",
            videoUrl: item.videoUrl || "",
            mediaType: item.mediaType,
            // 作���：覆盖更多可能的字段名，包括user对象
            topAuthor: item.author || item.authorName || item.topAuthor || item.nickname || item.user?.screen_name || "",
            // 头像：覆盖更多可能的字段名，包括user对象
            topAuthorAvatar: item.authorAvatar || item.topAuthorAvatar || item.avatar || item.user?.profile_image_url || item.user?.avatar || "",
            detailContent: item.detailContent || "",
          })
        )
      }
    }
  } catch { /* fallback */ }
  return []
}

export function NewsFeed({
  activeChannel,
  aiDenoiseEnabled = false,  // 默认关闭，点击按钮启用
  isAuthed,
  onOpenAuthDialog,
  scoreThreshold = 0,
  keywords = [],
  tweetFontSize = 14,
  isMuted = true,
  onToggleMute,
  scrollRef: externalScrollRef,
  onScroll: onScrollSync,
}: NewsFeedProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [newItemIds, setNewItemIds] = useState<Set<string>>(new Set())
  const [pendingCount, setPendingCount] = useState(0)
  const [isUserScrolling, setIsUserScrolling] = useState(false)
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set())
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set())
  const [voiceSettingsOpen, setVoiceSettingsOpen] = useState(false)
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>({
    volume: 80,
    voiceGender: "female",
    soundType: "voice",
  })
  // 临时置顶的新消息ID集合（3秒后移除）
  const [tempTopIds, setTempTopIds] = useState<Set<string>>(new Set())
  const prevItemsRef = useRef<string[]>([])
  const internalScrollRef = useRef<HTMLDivElement>(null)
  const scrollRef = externalScrollRef || internalScrollRef
  
  // 修复1&3: 持久化数据缓存，用于字段级merge，防止空值覆盖
  const stableCache = useRef<Map<string, NewsItem>>(new Map())
  
  // 修复8: 首次发现时间Map - 用于准确显示上榜时间
  // 使用 localStorage 持久化，避免组件卸载重挂时丢失
  const firstSeenMap = useRef<Map<string, number>>(new Map())
  
  // 从 localStorage 加载 firstSeenMap 数据并清理旧记录
  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const map = firstSeenMap.current
      const now = Date.now()
      const MAX_AGE = 72 * 60 * 60 * 1000 // 72小时
      
      // 清理超过72小时的旧记录，同时加载有效记录
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i)
        if (key?.startsWith("fs_")) {
          const val = parseInt(localStorage.getItem(key) || "0", 10)
          if (now - val > MAX_AGE) {
            localStorage.removeItem(key)
          } else {
            const id = key.replace("fs_", "")
            map.set(id, val)
          }
        }
      }
    } catch { /* ignore localStorage errors */ }
  }, [])

  const handleTogglePin = useCallback((id: string) => {
    setPinnedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleHide = useCallback((id: string) => {
    setHiddenIds((prev) => new Set(prev).add(id))
    // Also remove from pinned if pinned
    setPinnedIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }, [])

  const handleClearAllPins = useCallback(() => {
    setPinnedIds(new Set())
  }, [])

  // SWR for trending data - 15 second refresh (detail fetching is triggered per-card on expand)
  const { data: weiboTrending, isLoading: weiboLoading, mutate: mutateWeibo } = useSWR(
    "weibo",
    trendingFetcher,
    { refreshInterval: 10_000, revalidateOnFocus: true, dedupingInterval: 4000 }
  )
  const { data: douyinTrending, isLoading: douyinLoading, mutate: mutateDouyin } = useSWR(
    "douyin",
    trendingFetcher,
    { refreshInterval: 10_000, revalidateOnFocus: true, dedupingInterval: 4000 }
  )
  const { data: gzhTrending, isLoading: gzhLoading, mutate: mutateGzh } = useSWR(
    "gzh",
    trendingFetcher,
    { refreshInterval: 10_000, revalidateOnFocus: true, dedupingInterval: 4000 }
  )
  
  // Compute loading state based on active channel
  const isLoading = activeChannel === "aggregate" 
    ? (weiboLoading || douyinLoading || gzhLoading)
    : activeChannel === "weibo" ? weiboLoading 
    : activeChannel === "douyin" ? douyinLoading 
    : gzhLoading

  // Convert trending to news items - use only real API data, no mock data
  // 修复1&3: 使用 stableCache 进行字段级merge
  // 修复8: 使用 firstSeenMap 记录首次发现时间
  const allItems = useMemo(() => {
    const cache = stableCache.current
    const seenMap = firstSeenMap.current
    const weiboNews = trendingToNewsItems(weiboTrending || [], "weibo", cache, seenMap)
    const douyinNews = trendingToNewsItems(douyinTrending || [], "douyin", cache, seenMap)
    const gzhNews = trendingToNewsItems(gzhTrending || [], "gongzhonghao", cache, seenMap)

    let combined: NewsItem[]
    if (activeChannel === "aggregate") {
      combined = [...weiboNews, ...douyinNews, ...gzhNews]
    } else if (activeChannel === "weibo") {
      combined = weiboNews
    } else if (activeChannel === "douyin") {
      combined = douyinNews
    } else {
      combined = gzhNews
    }

    return combined
  }, [weiboTrending, douyinTrending, gzhTrending, activeChannel])

  // Detect user scrolling to enable queue mode + sync scroll
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    let timer: ReturnType<typeof setTimeout>
    const onScroll = () => {
      if (el.scrollTop > 100) {
        setIsUserScrolling(true)
        clearTimeout(timer)
        timer = setTimeout(() => setIsUserScrolling(false), 5000)
      } else {
        setIsUserScrolling(false)
      }
      // 滚动联动回调
      if (onScrollSync) {
        onScrollSync(el.scrollTop, el.scrollHeight, el.clientHeight)
      }
    }
    el.addEventListener("scroll", onScroll, { passive: true })
    return () => { el.removeEventListener("scroll", onScroll); clearTimeout(timer) }
  }, [onScrollSync])

  // 语音播报函数 - 使用设置中的配置
  const speakNewItem = useCallback((platform: string, _title: string) => {
    const platformLabel = platform === "weibo" ? "微博" : platform === "douyin" ? "抖音" : "公众号"
    // 只播报平台名称，不播报标题内容
    const text = `${platformLabel}新消息`
    speakText(text, voiceSettings)
  }, [voiceSettings])

  // 测试播报 - 播报当前板块
  const handleTestVoice = useCallback(() => {
    const platformLabel = 
      activeChannel === "weibo" ? "微博" :
      activeChannel === "douyin" ? "抖音" :
      activeChannel === "gongzhonghao" ? "公众号" : "热搜"
    speakText(`${platformLabel}新消息`, voiceSettings)
  }, [activeChannel, voiceSettings])

  // Detect new items for animation + queue mode + voice broadcast
  useEffect(() => {
    const currentIds = allItems.map((i) => i.id)
    const prevIds = prevItemsRef.current
    // 必须在最顶部无条件执行，确保状态同步
    prevItemsRef.current = currentIds
    
    const brandNew = currentIds.filter((id) => !prevIds.includes(id))
    
    if (brandNew.length > 0 && prevIds.length > 0) {
      // 设置新消息高亮和临时置顶
      setTempTopIds(new Set(brandNew))
      setNewItemIds(new Set(brandNew))
      
      // 10秒后清除高亮和置顶
      const t1 = setTimeout(() => setTempTopIds(new Set()), 10000)
      const t2 = setTimeout(() => setNewItemIds(new Set()), 10000)
      
      // 语音播报新上榜热搜（仅在非静音状态下）
      if (!isMuted) {
        const first = allItems.find(i => brandNew.includes(i.id))
        if (first) speakNewItem(first.platform, first.title)
      }
      
      return () => { clearTimeout(t1); clearTimeout(t2) }
    }
  }, [allItems, isMuted, speakNewItem])

  const handleViewPending = useCallback(() => {
    setPendingCount(0)
    setIsUserScrolling(false)
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })
  }, [])

  const handleManualRefresh = useCallback(() => {
    setIsRefreshing(true)
    mutateWeibo()
    mutateDouyin()
    mutateGzh()
    setTimeout(() => setIsRefreshing(false), 800)
  }, [mutateWeibo, mutateDouyin, mutateGzh])

  // Process with dynamic priority ranking (user-controlled pinning only)
  const { displayItems: flatDisplayItems, totalCount, filteredCount } = useMemo(() => {
    // Filter hidden items
    let all = deduplicateNews(allItems).filter((item) => !hiddenIds.has(item.id))

    // AI去噪过滤：过滤娱乐八卦、明星动态、饭圈追星、影视剧综相关内容
    let filtered = 0
    if (aiDenoiseEnabled) {
      const beforeCount = all.length
      all = all.filter((item) => !isEntertainmentContent(item.title, item.summary))
      filtered = beforeCount - all.length
    }

    // Apply score threshold
    if (scoreThreshold > 0) {
      all = all.filter((item) => item.score >= scoreThreshold || item.score >= 9.0)
    }

    // User-pinned items go to the top
    const userPinned = all.filter((item) => pinnedIds.has(item.id))
    const unpinned = all.filter((item) => !pinnedIds.has(item.id))

    // Sort unpinned by composite score
    unpinned.sort((a, b) => computeCompositeScore(b) - computeCompositeScore(a))
    userPinned.sort((a, b) => computeCompositeScore(b) - computeCompositeScore(a))

    // Build display list: pinned first, then the rest
    const items: { item: NewsItem; isPinned: boolean; compositeScore: number }[] = []
    for (const p of userPinned) {
      items.push({ item: p, isPinned: true, compositeScore: computeCompositeScore(p) })
    }

    // 聚合板块特殊排序：公众号/抖音优先前5-10位，微博前3穿插到3/6/9位
    if (activeChannel === "aggregate" && unpinned.length > 0) {
      // 分离三个平台
      const weiboItems = unpinned.filter(i => i.platform === "weibo")
      const douyinItems = unpinned.filter(i => i.platform === "douyin")
      const gzhItems = unpinned.filter(i => i.platform === "gongzhonghao")
      
      // 取各平台前N条
      const topWeibo = weiboItems.slice(0, 3)  // 微博前3
      const topDouyin = douyinItems.slice(0, 5)  // 抖音前5
      const topGzh = gzhItems.slice(0, 5)  // 公众号前5
      
      // 剩余内容按热度混排
      const usedIds = new Set([...topWeibo, ...topDouyin, ...topGzh].map(i => i.id))
      const remaining = unpinned.filter(i => !usedIds.has(i.id))
      
      // 构建前10位：公众号/抖音交替填充，微博穿插到3/6/9位
      const front10: NewsItem[] = []
      let dyIdx = 0, gzhIdx = 0, wbIdx = 0
      
      for (let pos = 1; pos <= 10; pos++) {
        // 微博穿插到第3、6、9位
        if ((pos === 3 || pos === 6 || pos === 9) && wbIdx < topWeibo.length) {
          front10.push(topWeibo[wbIdx++])
        } else {
          // 其他位置：公众号和抖音交替
          if (pos % 2 === 1 && gzhIdx < topGzh.length) {
            front10.push(topGzh[gzhIdx++])
          } else if (dyIdx < topDouyin.length) {
            front10.push(topDouyin[dyIdx++])
          } else if (gzhIdx < topGzh.length) {
            front10.push(topGzh[gzhIdx++])
          } else if (wbIdx < topWeibo.length) {
            front10.push(topWeibo[wbIdx++])
          }
        }
      }
      
      // 添加未使用的top条目
      const front10Ids = new Set(front10.map(i => i.id))
      const unusedTop = [...topWeibo, ...topDouyin, ...topGzh].filter(i => !front10Ids.has(i.id))
      
      // 最终列表：前10 + 未使用的top + 剩余混排
      const finalList = [...front10, ...unusedTop, ...remaining]
      for (const s of finalList) {
        items.push({ item: s, isPinned: false, compositeScore: computeCompositeScore(s) })
      }
    } else {
      for (const s of unpinned) {
        items.push({ item: s, isPinned: false, compositeScore: computeCompositeScore(s) })
      }
    }

    // 临时置顶：将tempTopIds中的项目移到顶部（置顶项之后）
    if (tempTopIds.size > 0) {
      const tempTopItems = items.filter(i => tempTopIds.has(i.item.id) && !i.isPinned)
      const otherItems = items.filter(i => !tempTopIds.has(i.item.id) || i.isPinned)
      const pinnedItems = otherItems.filter(i => i.isPinned)
      const normalItems = otherItems.filter(i => !i.isPinned)
      return { displayItems: [...pinnedItems, ...tempTopItems, ...normalItems], totalCount: all.length, filteredCount: filtered }
    }

    return { displayItems: items, totalCount: all.length, filteredCount: filtered }
  }, [allItems, scoreThreshold, pinnedIds, hiddenIds, aiDenoiseEnabled, activeChannel, tempTopIds])

  const displayedItems = isExpanded ? flatDisplayItems : flatDisplayItems.slice(0, PREVIEW_COUNT)
  const hasMore = flatDisplayItems.length > PREVIEW_COUNT
  const platformIcon = getPlatformIcon(activeChannel)
  const showPaywall = false // Temporarily disabled: no paywall

  return (
    <div className="flex-1 min-w-0">
      {/* Feed Header */}
      <div className="sticky top-14 z-30 bg-background border-b border-border/30 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {platformIcon && (
              <Image
                src={platformIcon}
                alt={getPlatformLabel(activeChannel)}
                width={22}
                height={22}
                className="rounded-sm object-cover"
                unoptimized
              />
            )}
            <h2 className="text-foreground font-bold text-base">
              {getPlatformLabel(activeChannel)}
              {activeChannel === "aggregate" ? " - 全平台实时推送" : " - 实时推送"}
            </h2>
            <span className="text-[11px] text-muted-foreground ml-1">
              {"共 " + totalCount + " 条"}
            </span>
            {aiDenoiseEnabled && filteredCount > 0 && (
              <span className="text-[10px] text-orange-500/80 ml-1" title="AI智能去噪已过滤娱乐八卦内容">
                {"(已去噪 " + filteredCount + " 条)"}
              </span>
            )}
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" title="实时刷新中" />
          </div>

          <div className="flex items-center gap-2">
            {/* 音频播报按钮组 */}
            <div className="flex items-center gap-0.5 bg-secondary/50 rounded-lg p-0.5 shrink-0">
              <button
                onClick={onToggleMute}
                className={cn(
                  "relative flex items-center justify-center w-8 h-8 rounded-md transition-all",
                  isMuted
                    ? "text-muted-foreground hover:text-foreground hover:bg-accent"
                    : "bg-primary/20 text-primary"
                )}
                title={isMuted ? "开启语音播报" : "关闭语音播报"}
              >
                {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                {!isMuted && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                )}
              </button>
              <button
                onClick={handleTestVoice}
                className="px-2 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-all"
                title="测试播报"
              >
                测试
              </button>
              <button
                onClick={() => setVoiceSettingsOpen(true)}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-all"
                title="语音设置"
              >
                <Settings size={12} />
              </button>
            </div>

            <button
              onClick={handleManualRefresh}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all",
                "bg-secondary text-muted-foreground hover:text-foreground hover:bg-accent",
                isRefreshing && "pointer-events-none"
              )}
              title="手动刷新"
            >
              <RefreshCw size={12} className={cn(isRefreshing && "animate-spin")} />
              刷新
            </button>

            {pinnedIds.size > 0 && (
              <button
                onClick={handleClearAllPins}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-all"
                title="取消所有置顶"
              >
                <Pin size={12} />
                {"取消置顶 (" + pinnedIds.size + ")"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 热点速览区域 - 仅聚合板块显示 */}
      {activeChannel === "aggregate" && (
        <HotOverview items={allItems} />
      )}

      {/* News List */}
      <div ref={scrollRef} className="h-[calc(100vh-56px-48px-49px)] overflow-y-auto">
        <div>
          {/* Skeleton loading state */}
          {isLoading && displayedItems.length === 0 && (
            <div className="space-y-2 p-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-4 rounded-xl border border-border/40 animate-pulse">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-9 h-9 rounded-full bg-secondary" />
                    <div className="space-y-1">
                      <div className="h-3 w-24 bg-secondary rounded" />
                      <div className="h-2 w-16 bg-secondary rounded" />
                    </div>
                  </div>
                  <div className="h-3 w-3/4 bg-secondary rounded mb-2" />
                  <div className="h-3 w-full bg-secondary rounded mb-2" />
                  <div className="h-40 w-full bg-secondary rounded-xl" />
                </div>
              ))}
            </div>
          )}
          
          {displayedItems.map((entry, index) => (
            <div key={entry.item.id}>
              {/* Paywall after free preview */}
              {showPaywall && index === FREE_PREVIEW && (
                <div className="relative py-8 px-4">
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/80 to-background pointer-events-none" />
                  <div className="relative flex flex-col items-center gap-3 py-6 px-4 rounded-xl border border-primary/20 bg-card">
                    <Lock size={24} className="text-primary" />
                    <h3 className="text-foreground font-bold text-sm">付费内容</h3>
                    <p className="text-xs text-muted-foreground text-center max-w-sm">
                      以下为付费新闻热点，输入密钥即可解锁全部推送、AI总结和声音播报功能。
                    </p>
                    <button
                      onClick={onOpenAuthDialog}
                      className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
                    >
                      输入密钥解锁
                    </button>
                    <p className="text-[10px] text-muted-foreground">
                      演示密钥: DOUU-TRIAL-2026
                    </p>
                  </div>
                </div>
              )}

              {showPaywall && index >= FREE_PREVIEW ? (
                <div className="relative">
                  <div className="blur-sm pointer-events-none select-none">
                    <NewsCard
                      item={entry.item}
                      isNew={false}
                      isTempTop={false}
                      isPinned={false}
                      fontSize={tweetFontSize}
                    />
                  </div>
                </div>
              ) : (
                <NewsCard
                  item={entry.item}
                  isNew={newItemIds.has(entry.item.id)}
                  isTempTop={tempTopIds.has(entry.item.id)}
                  isPinned={entry.isPinned}
                  onTogglePin={handleTogglePin}
                  onHide={handleHide}
                  fontSize={tweetFontSize}
                />
              )}
            </div>
          ))}

          {displayedItems.length === 0 && (
            <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
              暂无数据
            </div>
          )}

          {hasMore && !isExpanded && (
            <div className="flex items-center justify-center py-6">
              <button
                onClick={() => setIsExpanded(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-secondary hover:bg-accent text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronDown size={14} />
                {"查看更多 (还有 " + (flatDisplayItems.length - PREVIEW_COUNT) + " 条)"}
              </button>
            </div>
          )}

          {isExpanded && hasMore && (
            <div className="flex items-center justify-center py-6">
              <button
                onClick={() => {
                  setIsExpanded(false)
                  scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-secondary hover:bg-accent text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronUp size={14} />
                收起列表
              </button>
            </div>
          )}

        </div>
      </div>

      {/* 语音设置弹窗 */}
      <VoiceSettingsDialog
        isOpen={voiceSettingsOpen}
        onClose={() => setVoiceSettingsOpen(false)}
        settings={voiceSettings}
        onSettingsChange={setVoiceSettings}
        activeChannel={activeChannel}
        onTest={handleTestVoice}
      />
    </div>
  )
}
