"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { cn } from "@/lib/utils"
import {
  type Platform,
  type TrendingItem,
  mockWeiboTrending,
  mockDouyinTrending,
  mockGzhTrending,
  formatHotValue,
  PLATFORM_ICONS,
  PLATFORM_OFFICIAL_URLS,
} from "@/lib/mock-data"
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Flame,
} from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import Image from "next/image"
import useSWR from "swr"

interface HotSidebarProps {
  activeChannel: Platform
  onToggle?: (collapsed: boolean) => void
}

function getRankColor(rank: number): string {
  if (rank === 1) return "var(--gold)"
  if (rank === 2) return "var(--silver)"
  if (rank === 3) return "var(--bronze)"
  if (rank <= 10) return "var(--foreground)"
  return "var(--muted-foreground)"
}

function getRankBg(rank: number): string {
  if (rank === 1) return "bg-[var(--gold)]/8"
  if (rank === 2) return "bg-[var(--silver)]/5"
  if (rank === 3) return "bg-[var(--bronze)]/5"
  return ""
}

/** Fetch trending from API, returns array of TrendingItem */
async function trendingFetcher(platform: string): Promise<TrendingItem[]> {
  try {
    const res = await fetch(`/api/trending/${platform}`)
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data) && data.length > 0) {
        return data.map(
          (item: { rank?: number; title?: string; hotValue?: number; url?: string }, i: number) => ({
            id: `${platform[0]}${i + 1}`,
            rank: item.rank || i + 1,
            title: item.title || "",
            hotValue: item.hotValue || 0,
            url: item.url || "",
          })
        )
      }
    }
  } catch { /* fallback */ }
  return []
}

/**
 * Hook that tracks rank history and calculates 15-minute delta for trending items.
 * Stores snapshots every 3 minutes, compares current vs 15-min-ago snapshot.
 */
function useRankTracking(items: TrendingItem[], platformKey: string): TrendingItem[] {
  const historyRef = useRef<{ time: number; ranks: Map<string, number> }[]>([])

  // Record snapshot every 3 minutes
  useEffect(() => {
    if (items.length === 0) return
    const now = Date.now()
    const history = historyRef.current

    // Only add snapshot if >3 min since last
    const last = history[history.length - 1]
    if (!last || now - last.time >= 3 * 60 * 1000) {
      const rankMap = new Map<string, number>()
      items.forEach((item) => rankMap.set(item.title, item.rank))
      history.push({ time: now, ranks: rankMap })
      // Keep only last 10 snapshots (~30 min)
      if (history.length > 10) history.shift()
    }
  }, [items, platformKey])

  // Calculate delta vs 15-min-ago snapshot
  const history = historyRef.current
  const now = Date.now()
  // Find snapshot closest to 15 min ago
  let refSnapshot: Map<string, number> | null = null
  for (let i = history.length - 1; i >= 0; i--) {
    if (now - history[i].time >= 15 * 60 * 1000) {
      refSnapshot = history[i].ranks
      break
    }
  }
  // If no 15-min snapshot, use the oldest available
  if (!refSnapshot && history.length > 1) {
    refSnapshot = history[0].ranks
  }

  return items.map((item) => {
    if (!refSnapshot) return item
    const prevRank = refSnapshot.get(item.title)
    if (prevRank === undefined) {
      // New entry - not seen 15 min ago, mark as burst if in top 10
      return {
        ...item,
        prevRank: undefined,
        rankDelta: undefined,
        isBurst: item.rank <= 10,
      }
    }
    const delta = prevRank - item.rank // positive = rose
    const isBurst = delta >= 40 && item.rank <= 10 // from 50+ to top 10
    return {
      ...item,
      prevRank,
      rankDelta: delta,
      isBurst,
    }
  })
}

function TrendingList({
  title,
  icon,
  items,
  maxItems,
  showViewAll,
  viewAllUrl,
  loading,
  collapsible,
}: {
  title: string
  icon: string
  items: TrendingItem[]
  maxItems?: number
  showViewAll?: boolean
  viewAllUrl?: string
  loading?: boolean
  collapsible?: boolean
}) {
  const [changedIds, setChangedIds] = useState<Set<string>>(new Set())
  const [isExpanded, setIsExpanded] = useState(true)
  const prevItemsRef = useRef<Map<string, number>>(new Map())
  const displayItems = maxItems ? items.slice(0, maxItems) : items

  // Detect rank changes and trigger flash animation
  useEffect(() => {
    const prev = prevItemsRef.current
    const changed = new Set<string>()
    for (const item of displayItems) {
      const oldRank = prev.get(item.id)
      if (oldRank !== undefined && oldRank !== item.rank) {
        changed.add(item.id)
      }
    }
    if (changed.size > 0) {
      setChangedIds(changed)
      const timer = setTimeout(() => setChangedIds(new Set()), 800)
      return () => clearTimeout(timer)
    }
    // Update ref
    const newMap = new Map<string, number>()
    displayItems.forEach((item) => newMap.set(item.id, item.rank))
    prevItemsRef.current = newMap
  }, [displayItems])

  return (
    <div className="mb-3">
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <Image src={icon} alt={title} width={18} height={18} className="rounded-sm object-cover" unoptimized />
          <span className="text-sm font-bold text-foreground">{title}</span>
          {loading && <RefreshCw size={10} className="text-muted-foreground animate-spin" />}
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" title="实时同步中" />
        </div>
        <div className="flex items-center gap-2">
          {showViewAll && viewAllUrl && (
            <a
              href={viewAllUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[11px] text-primary hover:text-primary/80 transition-colors"
            >
              查看全部
              <ExternalLink size={10} />
            </a>
          )}
          {collapsible && (
            <button
              onClick={() => setIsExpanded((p) => !p)}
              className="flex items-center justify-center w-5 h-5 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
              aria-label={isExpanded ? "收起" : "展开"}
            >
              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          )}
        </div>
      </div>
      <div className={cn(
        "transition-all duration-200 overflow-hidden",
        collapsible && !isExpanded ? "max-h-0 opacity-0" : "max-h-[2000px] opacity-100"
      )}>
        {displayItems.map((item) => {
          const delta = item.rankDelta ?? 0
          return (
            <a
              key={item.id}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 hover:bg-accent/40 transition-all group/item",
                getRankBg(item.rank),
                changedIds.has(item.id) && "animate-flash-rank"
              )}
            >
              <span
                className="w-5 text-center text-xs font-bold shrink-0"
                style={{ color: getRankColor(item.rank) }}
              >
                {item.rank}
              </span>
              <span className="flex-1 text-sm text-foreground/90 truncate group-hover/item:text-primary transition-colors">
                {item.title}
              </span>

              {/* Burst tag */}
              {item.isBurst && (
                <span className="shrink-0 flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] bg-orange-500/15 text-orange-400 font-bold">
                  <Flame size={9} />
                  飙升
                </span>
              )}

              {/* Rank delta arrows */}
              {delta > 0 && (
                <span className="shrink-0 flex items-center gap-0.5 text-[10px] text-red-500 font-bold font-mono">
                  <TrendingUp size={10} />
                  {delta}
                </span>
              )}
              {delta < 0 && (
                <span className="shrink-0 flex items-center gap-0.5 text-[10px] text-emerald-500 font-bold font-mono">
                  <TrendingDown size={10} />
                  {Math.abs(delta)}
                </span>
              )}

              <span className="text-[10px] text-muted-foreground shrink-0">
                {formatHotValue(item.hotValue)}
              </span>
              <ExternalLink
                size={10}
                className="shrink-0 opacity-0 group-hover/item:opacity-100 text-muted-foreground transition-opacity"
              />
            </a>
          )
        })}
      </div>
    </div>
  )
}

export function HotSidebar({ activeChannel, onToggle }: HotSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)

  // SWR with 1-second refresh for real-time hot rankings
  const { data: weiboRaw, isValidating: weiboLoading } = useSWR(
    "weibo",
    trendingFetcher,
    { refreshInterval: 1000, revalidateOnFocus: false, fallbackData: mockWeiboTrending }
  )
  const { data: douyinRaw, isValidating: douyinLoading } = useSWR(
    "douyin",
    trendingFetcher,
    { refreshInterval: 1000, revalidateOnFocus: false, fallbackData: mockDouyinTrending }
  )
  const { data: gzhRaw, isValidating: gzhLoading } = useSWR(
    "gzh",
    trendingFetcher,
    { refreshInterval: 1000, revalidateOnFocus: false, fallbackData: mockGzhTrending }
  )

  const weiboBase = weiboRaw && weiboRaw.length > 0 ? weiboRaw : mockWeiboTrending
  const douyinBase = douyinRaw && douyinRaw.length > 0 ? douyinRaw : mockDouyinTrending
  const gzhBase = gzhRaw && gzhRaw.length > 0 ? gzhRaw : mockGzhTrending

  // Apply rank tracking with 15-minute delta
  const weibo = useRankTracking(weiboBase, "weibo")
  const douyin = useRankTracking(douyinBase, "douyin")
  const gzh = useRankTracking(gzhBase, "gzh")

  const toggleCollapse = useCallback(() => {
    setIsCollapsed((prev) => {
      const next = !prev
      onToggle?.(next)
      return next
    })
  }, [onToggle])

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={toggleCollapse}
        className={cn(
          "fixed z-40 top-1/2 -translate-y-1/2 flex items-center justify-center transition-all duration-300",
          "bg-background hover:bg-accent border border-border/50 shadow-lg",
          isCollapsed
            ? "right-0 w-8 h-16 rounded-l-lg"
            : "right-[350px] w-6 h-14 rounded-l-md"
        )}
        aria-label={isCollapsed ? "展开侧边栏" : "收起侧边栏"}
      >
        {isCollapsed ? (
          <ChevronLeft size={16} className="text-foreground" />
        ) : (
          <ChevronRight size={14} className="text-muted-foreground" />
        )}
      </button>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-14 right-0 bottom-12 w-[350px] border-l border-border/30",
          "transition-transform duration-300 ease-in-out z-30",
          "bg-background",
          isCollapsed ? "translate-x-full" : "translate-x-0"
        )}
      >
        <ScrollArea className="h-full">
          <div className="py-2">
            {activeChannel === "aggregate" ? (
              <>
                <TrendingList
                  title="微博热搜"
                  icon={PLATFORM_ICONS.weibo}
                  items={weibo}
                  maxItems={5}
                  showViewAll
                  viewAllUrl={PLATFORM_OFFICIAL_URLS.weibo}
                  loading={weiboLoading}
                />
                <div className="mx-3 border-t border-border/30" />
                <TrendingList
                  title="抖音热搜"
                  icon={PLATFORM_ICONS.douyin}
                  items={douyin}
                  maxItems={5}
                  showViewAll
                  viewAllUrl={PLATFORM_OFFICIAL_URLS.douyin}
                  loading={douyinLoading}
                />
                <div className="mx-3 border-t border-border/30" />
                <TrendingList
                  title="公众号热文"
                  icon={PLATFORM_ICONS.gongzhonghao}
                  items={gzh}
                  maxItems={5}
                  showViewAll
                  viewAllUrl={PLATFORM_OFFICIAL_URLS.gongzhonghao}
                  loading={gzhLoading}
                />
              </>
            ) : activeChannel === "weibo" ? (
              <TrendingList
                title="微博热搜 Top 20"
                icon={PLATFORM_ICONS.weibo}
                items={weibo}
                showViewAll
                viewAllUrl={PLATFORM_OFFICIAL_URLS.weibo}
                loading={weiboLoading}
              />
            ) : activeChannel === "douyin" ? (
              <TrendingList
                title="抖音热搜 Top 20"
                icon={PLATFORM_ICONS.douyin}
                items={douyin}
                showViewAll
                viewAllUrl={PLATFORM_OFFICIAL_URLS.douyin}
                loading={douyinLoading}
              />
            ) : (
              <TrendingList
                title="公众号热文 Top 20"
                icon={PLATFORM_ICONS.gongzhonghao}
                items={gzh}
                showViewAll
                viewAllUrl={PLATFORM_OFFICIAL_URLS.gongzhonghao}
                loading={gzhLoading}
              />
            )}
          </div>
        </ScrollArea>
      </aside>
    </>
  )
}
