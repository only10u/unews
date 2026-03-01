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
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  ChevronDown,
  ChevronUp,
  Lock,
  RefreshCw,
  ArrowUp,
  Pin,
} from "lucide-react"
import Image from "next/image"
import useSWR from "swr"

interface NewsFeedProps {
  activeChannel: Platform
  aiSummaryEnabled?: boolean
  isAuthed?: boolean
  onOpenAuthDialog?: () => void
  scoreThreshold?: number
  keywords?: string[]
}

const PREVIEW_COUNT = 20
const FREE_PREVIEW = 999 // Temporarily disabled: allow all content for free users
const W1 = 0.5  // initial weight factor
const W2 = 0.35 // freshness factor
const W3 = 0.15 // burst bonus factor

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

/** Convert trending items from API into NewsItem format */
function trendingToNewsItems(
  items: TrendingItem[],
  platform: "weibo" | "gongzhonghao" | "douyin"
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
    if (item.isBurst) tags.push("热度爆发")
    if (score >= 9.0) tags.push("突发爆点")
    const delta = item.rankDelta ?? 0

    // Minutes ago: simulate based on rank position
    const minutesAgo = Math.max(1, index * 2 + Math.floor(Math.random() * 3))
    const timestamp = minutesAgo <= 60 ? `${minutesAgo}分钟前` : `${Math.floor(minutesAgo / 60)}小时前`

    // Use real enriched author data from API (prefer API author over generic platform default)
    const authorName = item.topAuthor ? item.topAuthor : auth.name
    const authorAvatar = item.topAuthorAvatar ? item.topAuthorAvatar : auth.avatar
    // Use real excerpt only - no fake fallback text
    const summary = item.excerpt || ""

    return {
      id: `${platform}-trending-${item.id}`,
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
      firstSeenAt: Date.now() - minutesAgo * 60 * 1000,
      isOfficial: auth.isOfficial && item.rank <= 5,
    } as NewsItem
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
            detailContent?: string; summary?: string;
          }, i: number) => ({
            id: `${platform[0]}${i + 1}`,
            rank: item.rank || i + 1,
            title: item.title || "",
            hotValue: item.hotValue || 0,
            url: item.url || "",
            // Compatible with both old and new field names
            excerpt: item.excerpt || item.summary || "",
            imageUrl: item.imageUrl || item.imageurl || "",
            videoUrl: item.videoUrl || "",
            mediaType: item.mediaType,
            topAuthor: item.authorName || item.topAuthor || "热搜博主",
            topAuthorAvatar: item.authorAvatar || item.topAuthorAvatar || "",
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
  aiSummaryEnabled,
  isAuthed,
  onOpenAuthDialog,
  scoreThreshold = 0,
  keywords = [],
}: NewsFeedProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [newItemIds, setNewItemIds] = useState<Set<string>>(new Set())
  const [pendingCount, setPendingCount] = useState(0)
  const [isUserScrolling, setIsUserScrolling] = useState(false)
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set())
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set())
  const prevItemsRef = useRef<string[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)

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
    { refreshInterval: 15000, revalidateOnFocus: false, dedupingInterval: 5000 }
  )
  const { data: douyinTrending, isLoading: douyinLoading, mutate: mutateDouyin } = useSWR(
    "douyin",
    trendingFetcher,
    { refreshInterval: 15000, revalidateOnFocus: false, dedupingInterval: 5000 }
  )
  const { data: gzhTrending, isLoading: gzhLoading, mutate: mutateGzh } = useSWR(
    "gzh",
    trendingFetcher,
    { refreshInterval: 15000, revalidateOnFocus: false, dedupingInterval: 5000 }
  )
  
  // Compute loading state based on active channel
  const isLoading = activeChannel === "aggregate" 
    ? (weiboLoading || douyinLoading || gzhLoading)
    : activeChannel === "weibo" ? weiboLoading 
    : activeChannel === "douyin" ? douyinLoading 
    : gzhLoading

  // Convert trending to news items - use only real API data, no mock data
  const allItems = useMemo(() => {
    const weiboNews = trendingToNewsItems(weiboTrending || [], "weibo")
    const douyinNews = trendingToNewsItems(douyinTrending || [], "douyin")
    const gzhNews = trendingToNewsItems(gzhTrending || [], "gongzhonghao")

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

  // Detect user scrolling to enable queue mode
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
    }
    el.addEventListener("scroll", onScroll, { passive: true })
    return () => { el.removeEventListener("scroll", onScroll); clearTimeout(timer) }
  }, [])

  // Detect new items for animation + queue mode
  useEffect(() => {
    const currentIds = allItems.map((i) => i.id)
    const prevIds = prevItemsRef.current
    const brandNew = currentIds.filter((id) => !prevIds.includes(id))
    if (brandNew.length > 0 && prevIds.length > 0) {
      if (isUserScrolling) {
        setPendingCount((c) => c + brandNew.length)
      } else {
        setNewItemIds(new Set(brandNew))
        const timer = setTimeout(() => setNewItemIds(new Set()), 5000)
        return () => clearTimeout(timer)
      }
    }
    prevItemsRef.current = currentIds
  }, [allItems, isUserScrolling])

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
  const { displayItems: flatDisplayItems, totalCount } = useMemo(() => {
    // Filter hidden items
    let all = deduplicateNews(allItems).filter((item) => !hiddenIds.has(item.id))

    // Apply score threshold
    if (scoreThreshold > 0) {
      all = all.filter((item) => item.score >= scoreThreshold || item.score >= 9.0)
    }

    // User-pinned items go to the top
    const userPinned = all.filter((item) => pinnedIds.has(item.id))
    const unpinned = all.filter((item) => !pinnedIds.has(item.id))

    // Sort unpinned by composite score
    unpinned
      .filter((item) => item.score > 1.0)
      .sort((a, b) => computeCompositeScore(b) - computeCompositeScore(a))
    userPinned.sort((a, b) => computeCompositeScore(b) - computeCompositeScore(a))

    // Build display list: pinned first, then the rest
    const items: { item: NewsItem; isPinned: boolean; compositeScore: number }[] = []
    for (const p of userPinned) {
      items.push({ item: p, isPinned: true, compositeScore: computeCompositeScore(p) })
    }
    for (const s of unpinned) {
      items.push({ item: s, isPinned: false, compositeScore: computeCompositeScore(s) })
    }

    return { displayItems: items, totalCount: all.length }
  }, [allItems, scoreThreshold, pinnedIds, hiddenIds])

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
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" title="��时刷新中" />
          </div>

          <div className="flex items-center gap-2">
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

      {/* Queue mode banner */}
      {pendingCount > 0 && (
        <div className="sticky top-[105px] z-20 flex justify-center py-2">
          <button
            onClick={handleViewPending}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-primary-foreground text-xs font-bold shadow-lg hover:bg-primary/90 transition-all animate-slide-in"
          >
            <ArrowUp size={14} />
            {"有 " + pendingCount + " 条新热点，点击查看"}
          </button>
        </div>
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
                      isPinned={false}
                      aiSummaryEnabled={false}
                    />
                  </div>
                </div>
              ) : (
                <NewsCard
                  item={entry.item}
                  isNew={newItemIds.has(entry.item.id)}
                  isPinned={entry.isPinned}
                  aiSummaryEnabled={aiSummaryEnabled}
                  onTogglePin={handleTogglePin}
                  onHide={handleHide}
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
    </div>
  )
}
