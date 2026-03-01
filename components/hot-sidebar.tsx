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
  Lock,
} from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import Image from "next/image"
import useSWR from "swr"

interface HotSidebarProps {
  activeChannel: Platform
  onToggle?: (collapsed: boolean) => void
  onWidthChange?: (width: number) => void
  isAuthed?: boolean
}

const DEFAULT_WIDTH = 350
const MIN_WIDTH = 300
const MAX_WIDTH = 1100
const WIDE_THRESHOLD = 700

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

function useRankTracking(items: TrendingItem[], platformKey: string): TrendingItem[] {
  const historyRef = useRef<{ time: number; ranks: Map<string, number> }[]>([])

  useEffect(() => {
    if (items.length === 0) return
    const now = Date.now()
    const history = historyRef.current
    const last = history[history.length - 1]
    if (!last || now - last.time >= 3 * 60 * 1000) {
      const rankMap = new Map<string, number>()
      items.forEach((item) => rankMap.set(item.title, item.rank))
      history.push({ time: now, ranks: rankMap })
      if (history.length > 10) history.shift()
    }
  }, [items, platformKey])

  const history = historyRef.current
  const now = Date.now()
  let refSnapshot: Map<string, number> | null = null
  for (let i = history.length - 1; i >= 0; i--) {
    if (now - history[i].time >= 15 * 60 * 1000) {
      refSnapshot = history[i].ranks
      break
    }
  }
  if (!refSnapshot && history.length > 1) {
    refSnapshot = history[0].ranks
  }

  return items.map((item) => {
    if (!refSnapshot) return item
    const prevRank = refSnapshot.get(item.title)
    if (prevRank === undefined) {
      return { ...item, prevRank: undefined, rankDelta: undefined, isBurst: item.rank <= 10 }
    }
    const delta = prevRank - item.rank
    const isBurst = delta >= 40 && item.rank <= 10
    return { ...item, prevRank, rankDelta: delta, isBurst }
  })
}

function TrendingList({
  title,
  icon,
  items,
  defaultMaxItems = 5,
  showViewAll,
  viewAllUrl,
  loading,
  collapsible = true,
}: {
  title: string
  icon: string
  items: TrendingItem[]
  defaultMaxItems?: number
  showViewAll?: boolean
  viewAllUrl?: string
  loading?: boolean
  collapsible?: boolean
}) {
  const [changedIds, setChangedIds] = useState<Set<string>>(new Set())
  const [isExpanded, setIsExpanded] = useState(false)
  const prevItemsRef = useRef<Map<string, number>>(new Map())
  const displayItems = isExpanded ? items : items.slice(0, defaultMaxItems)

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
    const newMap = new Map<string, number>()
    displayItems.forEach((item) => newMap.set(item.id, item.rank))
    prevItemsRef.current = newMap
  }, [displayItems])

  const hasMore = items.length > defaultMaxItems

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <Image src={icon} alt={title} width={18} height={18} className="rounded-sm object-cover" unoptimized />
          <span className="text-sm font-bold text-foreground">{title}</span>
          {loading && <RefreshCw size={10} className="text-muted-foreground animate-spin" />}
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" title="实时同步中" />
        </div>
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
      </div>

      {/* Items */}
      <div>
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
              <span className="w-5 text-center text-xs font-bold shrink-0" style={{ color: getRankColor(item.rank) }}>
                {item.rank}
              </span>
              <span className="flex-1 text-sm text-foreground/90 truncate group-hover/item:text-primary transition-colors">
                {item.title}
              </span>
              {item.isBurst && (
                <span className="shrink-0 flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] bg-orange-500/15 text-orange-400 font-bold">
                  <Flame size={9} />
                </span>
              )}
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
            </a>
          )
        })}
      </div>

      {/* Expand / Collapse button at the BOTTOM of the list */}
      {collapsible && hasMore && (
        <button
          onClick={() => setIsExpanded((p) => !p)}
          className="flex items-center justify-center gap-1 py-2 mx-3 my-2 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors border border-border/30"
        >
          {isExpanded ? (
            <>
              <ChevronUp size={14} />
              {"收起 (前 " + defaultMaxItems + " 条)"}
            </>
          ) : (
            <>
              <ChevronDown size={14} />
              {"展开全部 (" + items.length + " 条)"}
            </>
          )}
        </button>
      )}
    </div>
  )
}

export function HotSidebar({ activeChannel, onToggle, onWidthChange, isAuthed = false }: HotSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_WIDTH)
  const isDragging = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(DEFAULT_WIDTH)

  const isWide = sidebarWidth >= WIDE_THRESHOLD

  const { data: weiboRaw, isValidating: weiboLoading } = useSWR("weibo", trendingFetcher, {
    refreshInterval: 1000, revalidateOnFocus: false, fallbackData: mockWeiboTrending,
  })
  const { data: douyinRaw, isValidating: douyinLoading } = useSWR("douyin", trendingFetcher, {
    refreshInterval: 1000, revalidateOnFocus: false, fallbackData: mockDouyinTrending,
  })
  const { data: gzhRaw, isValidating: gzhLoading } = useSWR("gzh", trendingFetcher, {
    refreshInterval: 1000, revalidateOnFocus: false, fallbackData: mockGzhTrending,
  })

  const weiboBase = weiboRaw && weiboRaw.length > 0 ? weiboRaw : mockWeiboTrending
  const douyinBase = douyinRaw && douyinRaw.length > 0 ? douyinRaw : mockDouyinTrending
  const gzhBase = gzhRaw && gzhRaw.length > 0 ? gzhRaw : mockGzhTrending

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

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDragging.current = true
    startX.current = e.clientX
    startWidth.current = sidebarWidth
    document.body.style.cursor = "col-resize"
    document.body.style.userSelect = "none"
  }, [sidebarWidth])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return
      const delta = startX.current - e.clientX
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth.current + delta))
      setSidebarWidth(newWidth)
      onWidthChange?.(newWidth)
    }
    const handleMouseUp = () => {
      if (isDragging.current) {
        isDragging.current = false
        document.body.style.cursor = ""
        document.body.style.userSelect = ""
      }
    }
    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mouseup", handleMouseUp)
    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
    }
  }, [onWidthChange])

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
            : "w-6 h-14 rounded-l-md"
        )}
        style={isCollapsed ? undefined : { right: `${sidebarWidth}px` }}
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
          "fixed top-14 right-0 bottom-12 border-l border-border/30",
          "transition-transform duration-300 ease-in-out z-30",
          "bg-background",
          isCollapsed ? "translate-x-full" : "translate-x-0"
        )}
        style={{ width: `${sidebarWidth}px` }}
      >
        {/* Drag handle - left edge */}
        <div
          onMouseDown={handleMouseDown}
          className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize z-40 group flex items-center justify-center hover:bg-primary/10 transition-colors"
          title="向左拖动扩展，可并排显示三个板块"
        >
          <div className="w-0.5 h-8 rounded-full bg-border group-hover:bg-primary/50 transition-colors" />
        </div>

        <ScrollArea className="h-full">
          {/* Paywall temporarily disabled - show all content */}
          <div className="py-2 pl-2">
            {/* Width indicator hint */}
            {sidebarWidth > MIN_WIDTH && sidebarWidth < WIDE_THRESHOLD && (
              <div className="text-center text-[10px] text-muted-foreground/50 pb-1">
                {"继续向左拖动可并排显示 (" + Math.round((sidebarWidth / WIDE_THRESHOLD) * 100) + "%)"}
              </div>
            )}

            {activeChannel === "aggregate" ? (
              isWide ? (
                <div className="grid grid-cols-3 gap-0 h-full">
                  <div className="border-r border-border/30">
                    <TrendingList
                      title="微博热搜"
                      icon={PLATFORM_ICONS.weibo}
                      items={weibo}
                      defaultMaxItems={10}
                      showViewAll
                      viewAllUrl={PLATFORM_OFFICIAL_URLS.weibo}
                      loading={weiboLoading}
                      collapsible
                    />
                  </div>
                  <div className="border-r border-border/30">
                    <TrendingList
                      title="抖音热搜"
                      icon={PLATFORM_ICONS.douyin}
                      items={douyin}
                      defaultMaxItems={10}
                      showViewAll
                      viewAllUrl={PLATFORM_OFFICIAL_URLS.douyin}
                      loading={douyinLoading}
                      collapsible
                    />
                  </div>
                  <div>
                    <TrendingList
                      title="公众号热文"
                      icon={PLATFORM_ICONS.gongzhonghao}
                      items={gzh}
                      defaultMaxItems={10}
                      showViewAll
                      viewAllUrl={PLATFORM_OFFICIAL_URLS.gongzhonghao}
                      loading={gzhLoading}
                      collapsible
                    />
                  </div>
                </div>
              ) : (
                <>
                  <TrendingList
                    title="微博热搜"
                    icon={PLATFORM_ICONS.weibo}
                    items={weibo}
                    defaultMaxItems={5}
                    showViewAll
                    viewAllUrl={PLATFORM_OFFICIAL_URLS.weibo}
                    loading={weiboLoading}
                    collapsible
                  />
                  <div className="mx-3 border-t border-border/30" />
                  <TrendingList
                    title="抖音热搜"
                    icon={PLATFORM_ICONS.douyin}
                    items={douyin}
                    defaultMaxItems={5}
                    showViewAll
                    viewAllUrl={PLATFORM_OFFICIAL_URLS.douyin}
                    loading={douyinLoading}
                    collapsible
                  />
                  <div className="mx-3 border-t border-border/30" />
                  <TrendingList
                    title="公众号热文"
                    icon={PLATFORM_ICONS.gongzhonghao}
                    items={gzh}
                    defaultMaxItems={5}
                    showViewAll
                    viewAllUrl={PLATFORM_OFFICIAL_URLS.gongzhonghao}
                    loading={gzhLoading}
                    collapsible
                  />
                </>
              )
            ) : activeChannel === "weibo" ? (
              <TrendingList
                title="微博热搜 Top 50"
                icon={PLATFORM_ICONS.weibo}
                items={weibo}
                defaultMaxItems={20}
                showViewAll
                viewAllUrl={PLATFORM_OFFICIAL_URLS.weibo}
                loading={weiboLoading}
                collapsible
              />
            ) : activeChannel === "douyin" ? (
              <TrendingList
                title="抖音热搜 Top 50"
                icon={PLATFORM_ICONS.douyin}
                items={douyin}
                defaultMaxItems={20}
                showViewAll
                viewAllUrl={PLATFORM_OFFICIAL_URLS.douyin}
                loading={douyinLoading}
                collapsible
              />
            ) : (
              <TrendingList
                title="公众号热文 Top 50"
                icon={PLATFORM_ICONS.gongzhonghao}
                items={gzh}
                defaultMaxItems={20}
                showViewAll
                viewAllUrl={PLATFORM_OFFICIAL_URLS.gongzhonghao}
                loading={gzhLoading}
                collapsible
              />
            )}
          </div>
        </ScrollArea>
      </aside>
    </>
  )
}
