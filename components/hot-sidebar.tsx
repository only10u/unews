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
  hotListFontSize?: number
}

const DEFAULT_WIDTH = 350
const MIN_WIDTH = 300
const MAX_WIDTH = 1100
const WIDE_THRESHOLD = 700

// Snap宽度定义：三个状态对应的宽度
const SNAP_WIDTH_1COL = 350   // 1列：默认宽度
const SNAP_WIDTH_2COL = 700   // 2列：两倍宽度
const SNAP_WIDTH_3COL = 1050  // 3列：三倍宽度
const SNAP_THRESHOLD = 80     // 拖动超过此阈值触发snap

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
  forceExpand = false,
  fontSize = 14,
}: {
  title: string
  icon: string
  items: TrendingItem[]
  defaultMaxItems?: number
  showViewAll?: boolean
  viewAllUrl?: string
  loading?: boolean
  collapsible?: boolean
  forceExpand?: boolean
  fontSize?: number
}) {
  const [changedIds, setChangedIds] = useState<Set<string>>(new Set())
  const [isExpanded, setIsExpanded] = useState(false)
  const prevItemsRef = useRef<Map<string, number>>(new Map())
  // When forceExpand is true, show all items
  const actualExpanded = forceExpand || isExpanded
  const displayItems = actualExpanded ? items : items.slice(0, defaultMaxItems)

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
  // 根据排名变化计算呼吸动画：上升显示淡红呼吸，下降显示淡绿呼吸
  const rankChangeAnim = delta > 0 ? "animate-rank-up-breath" : delta < 0 ? "animate-rank-down-breath" : ""
  return (
  <a
  key={item.id}
  href={item.url}
  target="_blank"
  rel="noopener noreferrer"
  className={cn(
  "flex items-center gap-2 px-3 py-1.5 hover:bg-accent/40 transition-all group/item",
  getRankBg(item.rank),
  rankChangeAnim,
  changedIds.has(item.id) && "animate-flash-rank"
  )}
  >
              <span className="w-5 text-center text-xs font-bold shrink-0" style={{ color: getRankColor(item.rank) }}>
                {item.rank}
              </span>
              <span 
                className={cn(
                  "flex-1 truncate group-hover/item:text-primary transition-colors",
                  delta > 0 ? "text-red-500" : delta < 0 ? "text-emerald-500" : "text-foreground/90"
                )}
                style={{ fontSize: `${fontSize}px` }}
              >
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

      {/* Expand / Collapse button at the BOTTOM of the list - hide when forceExpand is true */}
      {collapsible && hasMore && !forceExpand && (
        <button
          onClick={() => setIsExpanded((p) => !p)}
          className="flex items-center justify-center gap-1 py-2 mx-3 my-2 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors border border-border/30"
        >
          {actualExpanded ? (
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

export function HotSidebar({ activeChannel, onToggle, onWidthChange, isAuthed = false, hotListFontSize = 14 }: HotSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_WIDTH)
  const [columnCount, setColumnCount] = useState(1) // 1, 2, or 3 columns
  const [isAnimating, setIsAnimating] = useState(false) // 控制snap动画
  const isDragging = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(DEFAULT_WIDTH)
  
  // 辅助函数：根据列数获取目标宽度
  const getSnapWidth = useCallback((cols: number) => {
    if (cols === 3) return SNAP_WIDTH_3COL
    if (cols === 2) return SNAP_WIDTH_2COL
    return SNAP_WIDTH_1COL
  }, [])
  
  // 辅助函数：根据宽度计算最近的列数
  const getClosestColumnCount = useCallback((width: number) => {
    const dist1 = Math.abs(width - SNAP_WIDTH_1COL)
    const dist2 = Math.abs(width - SNAP_WIDTH_2COL)
    const dist3 = Math.abs(width - SNAP_WIDTH_3COL)
    if (dist1 <= dist2 && dist1 <= dist3) return 1
    if (dist2 <= dist3) return 2
    return 3
  }, [])

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

  // Carousel touch/mouse handlers for horizontal swipe
  const handleTouchStart = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    touchStartX.current = clientX
    touchDeltaX.current = 0
    setIsDraggingCarousel(true)
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (!isDraggingCarousel) return
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    touchDeltaX.current = clientX - touchStartX.current
  }, [isDraggingCarousel])

  const handleTouchEnd = useCallback(() => {
    if (!isDraggingCarousel) return
    setIsDraggingCarousel(false)
    
    // Threshold for swipe detection
    const threshold = 50
    if (touchDeltaX.current < -threshold && carouselIndex < 2) {
      // Swipe left - show next platform
      setCarouselIndex(prev => Math.min(2, prev + 1))
    } else if (touchDeltaX.current > threshold && carouselIndex > 0) {
      // Swipe right - show previous platform
      setCarouselIndex(prev => Math.max(0, prev - 1))
    }
    touchDeltaX.current = 0
  }, [isDraggingCarousel, carouselIndex])

  // Reset carousel index when channel changes
  useEffect(() => {
    setCarouselIndex(0)
  }, [activeChannel])

  // Get ordered platforms based on active channel
  const getOrderedPlatforms = useCallback(() => {
    if (activeChannel === "weibo") {
      return [
        { key: "weibo", title: "微博热搜 Top 50", icon: PLATFORM_ICONS.weibo, items: weibo, loading: weiboLoading, url: PLATFORM_OFFICIAL_URLS.weibo },
        { key: "douyin", title: "抖音热搜 Top 50", icon: PLATFORM_ICONS.douyin, items: douyin, loading: douyinLoading, url: PLATFORM_OFFICIAL_URLS.douyin },
        { key: "gzh", title: "公众号热文 Top 50", icon: PLATFORM_ICONS.gongzhonghao, items: gzh, loading: gzhLoading, url: PLATFORM_OFFICIAL_URLS.gongzhonghao },
      ]
    } else if (activeChannel === "douyin") {
      return [
        { key: "douyin", title: "抖音热搜 Top 50", icon: PLATFORM_ICONS.douyin, items: douyin, loading: douyinLoading, url: PLATFORM_OFFICIAL_URLS.douyin },
        { key: "weibo", title: "微博热搜 Top 50", icon: PLATFORM_ICONS.weibo, items: weibo, loading: weiboLoading, url: PLATFORM_OFFICIAL_URLS.weibo },
        { key: "gzh", title: "公众号热文 Top 50", icon: PLATFORM_ICONS.gongzhonghao, items: gzh, loading: gzhLoading, url: PLATFORM_OFFICIAL_URLS.gongzhonghao },
      ]
    } else {
      return [
        { key: "gzh", title: "公众号热文 Top 50", icon: PLATFORM_ICONS.gongzhonghao, items: gzh, loading: gzhLoading, url: PLATFORM_OFFICIAL_URLS.gongzhonghao },
        { key: "weibo", title: "微博热搜 Top 50", icon: PLATFORM_ICONS.weibo, items: weibo, loading: weiboLoading, url: PLATFORM_OFFICIAL_URLS.weibo },
        { key: "douyin", title: "抖音热搜 Top 50", icon: PLATFORM_ICONS.douyin, items: douyin, loading: douyinLoading, url: PLATFORM_OFFICIAL_URLS.douyin },
      ]
    }
  }, [activeChannel, weibo, douyin, gzh, weiboLoading, douyinLoading, gzhLoading])

  // 处理触摸事件开始（移动端支持）
  const handleTouchStartResize = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    isDragging.current = true
    startX.current = e.touches[0].clientX
    startWidth.current = sidebarWidth
  }, [sidebarWidth])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDragging.current = true
    startX.current = e.clientX
    startWidth.current = sidebarWidth
    document.body.style.cursor = "col-resize"
    document.body.style.userSelect = "none"
  }, [sidebarWidth])

  // Snap到目标列数的函数
  const snapToColumn = useCallback((targetCols: number) => {
    const targetWidth = getSnapWidth(targetCols)
    setIsAnimating(true)
    setColumnCount(targetCols)
    setSidebarWidth(targetWidth)
    onWidthChange?.(targetWidth)
    // 动画完成后关闭animating状态
    setTimeout(() => setIsAnimating(false), 300)
  }, [getSnapWidth, onWidthChange])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || isAnimating) return
      const delta = startX.current - e.clientX
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth.current + delta))
      setSidebarWidth(newWidth)
      // 实时更新但不触发onWidthChange（等snap完成再触发）
    }
    
    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging.current || isAnimating) return
      const delta = startX.current - e.touches[0].clientX
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth.current + delta))
      setSidebarWidth(newWidth)
    }
    
    const handleDragEnd = () => {
      if (isDragging.current) {
        isDragging.current = false
        document.body.style.cursor = ""
        document.body.style.userSelect = ""
        
        // 非聚合板块才使用snap逻辑
        if (activeChannel !== "aggregate") {
          const dragDelta = Math.abs(sidebarWidth - startWidth.current)
          
          // 只有拖动超过阈值才snap
          if (dragDelta >= SNAP_THRESHOLD) {
            const targetCols = getClosestColumnCount(sidebarWidth)
            snapToColumn(targetCols)
          } else {
            // 拖动距离不够，回弹到原来的列数
            snapToColumn(columnCount)
          }
        } else {
          // 聚合板块：自由拖动，直接通知宽度变化
          onWidthChange?.(sidebarWidth)
        }
      }
    }
    
    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mouseup", handleDragEnd)
    window.addEventListener("touchmove", handleTouchMove, { passive: true })
    window.addEventListener("touchend", handleDragEnd)
    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleDragEnd)
      window.removeEventListener("touchmove", handleTouchMove)
      window.removeEventListener("touchend", handleDragEnd)
    }
  }, [onWidthChange, activeChannel, sidebarWidth, columnCount, getClosestColumnCount, snapToColumn, isAnimating])
  
  // 当切换到非聚合板块时，重置为单列
  useEffect(() => {
    if (activeChannel !== "aggregate" && columnCount !== 1) {
      // 保持当前列数，不自动重置
    }
  }, [activeChannel, columnCount])

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
          "z-30 bg-background",
          isCollapsed ? "translate-x-full" : "translate-x-0",
          // Snap动画时使用transition，拖动时不使用
          isAnimating ? "transition-all duration-300 ease-out" : "transition-transform duration-300 ease-in-out"
        )}
        style={{ width: `${sidebarWidth}px` }}
      >
        {/* Drag handle - left edge (支持touch和mouse) */}
        <div
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStartResize}
          className="absolute left-0 top-0 bottom-0 w-3 cursor-col-resize z-40 group flex items-center justify-center hover:bg-primary/10 transition-colors"
          title="向左拖动扩展，可并排显示三个板块"
        >
          <div className="w-0.5 h-12 rounded-full bg-border group-hover:bg-primary/50 transition-colors" />
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
                      title="微博热搜 TOP 50"
                      icon={PLATFORM_ICONS.weibo}
                      items={weibo.slice(0, 50)}
                      defaultMaxItems={50}
                      showViewAll
                      viewAllUrl={PLATFORM_OFFICIAL_URLS.weibo}
                      loading={weiboLoading}
                      collapsible={false}
                      forceExpand
                      fontSize={hotListFontSize}
                    />
                  </div>
                  <div className="border-r border-border/30">
                    <TrendingList
                      title="抖音热搜 TOP 50"
                      icon={PLATFORM_ICONS.douyin}
                      items={douyin.slice(0, 50)}
                      defaultMaxItems={50}
                      showViewAll
                      viewAllUrl={PLATFORM_OFFICIAL_URLS.douyin}
                      loading={douyinLoading}
                      collapsible={false}
                      forceExpand
                      fontSize={hotListFontSize}
                    />
                  </div>
                  <div>
                    <TrendingList
                      title="公众号热文 TOP 50"
                      icon={PLATFORM_ICONS.gongzhonghao}
                      items={gzh.slice(0, 50)}
                      defaultMaxItems={50}
                      showViewAll
                      viewAllUrl={PLATFORM_OFFICIAL_URLS.gongzhonghao}
                      loading={gzhLoading}
                      collapsible={false}
                      forceExpand
                      fontSize={hotListFontSize}
                    />
                  </div>
                </div>
              ) : (
                <>
                  <TrendingList
                    title="微博热搜 TOP 50"
                    icon={PLATFORM_ICONS.weibo}
                    items={weibo.slice(0, 50)}
                    defaultMaxItems={10}
                    showViewAll
                    viewAllUrl={PLATFORM_OFFICIAL_URLS.weibo}
                    loading={weiboLoading}
                    collapsible
                    fontSize={hotListFontSize}
                  />
                  <div className="mx-3 border-t border-border/30" />
                  <TrendingList
                    title="抖音热搜 TOP 50"
                    icon={PLATFORM_ICONS.douyin}
                    items={douyin.slice(0, 50)}
                    defaultMaxItems={10}
                    showViewAll
                    viewAllUrl={PLATFORM_OFFICIAL_URLS.douyin}
                    loading={douyinLoading}
                    collapsible
                    fontSize={hotListFontSize}
                  />
                  <div className="mx-3 border-t border-border/30" />
                  <TrendingList
                    title="公众号热文 TOP 50"
                    icon={PLATFORM_ICONS.gongzhonghao}
                    items={gzh.slice(0, 50)}
                    defaultMaxItems={10}
                    showViewAll
                    viewAllUrl={PLATFORM_OFFICIAL_URLS.gongzhonghao}
                    loading={gzhLoading}
                    collapsible
                    fontSize={hotListFontSize}
                  />
                </>
              )
            ) : (
              /* 单平台板块：根据columnCount显示1/2/3列 */
              <div className="relative">
                {/* 列数指示器 */}
                <div className="flex items-center justify-center gap-1.5 py-2">
                  {[1, 2, 3].map((cols) => (
                    <button
                      key={cols}
                      onClick={() => snapToColumn(cols)}
                      className={cn(
                        "px-2 py-0.5 rounded text-[10px] transition-all",
                        columnCount === cols 
                          ? "bg-primary text-primary-foreground font-bold" 
                          : "bg-muted text-muted-foreground hover:bg-accent"
                      )}
                      title={`显示${cols}列`}
                    >
                      {cols}列
                    </button>
                  ))}
                </div>
                
                {/* 拖动提示 */}
                {columnCount === 1 && (
                  <div className="text-center text-[10px] text-muted-foreground/50 pb-1">
                    向左拖动侧边栏可展开更多列
                  </div>
                )}
                
                {/* 根据columnCount渲染网格 */}
                <div 
                  className={cn(
                    "grid gap-0 h-full transition-all duration-300",
                    columnCount === 1 && "grid-cols-1",
                    columnCount === 2 && "grid-cols-2",
                    columnCount === 3 && "grid-cols-3"
                  )}
                >
                  {getOrderedPlatforms().slice(0, columnCount).map((platform, idx) => (
                    <div 
                      key={platform.key} 
                      className={cn(
                        "overflow-y-auto",
                        idx < columnCount - 1 && "border-r border-border/30"
                      )}
                    >
                      <TrendingList
                        title={platform.title}
                        icon={platform.icon}
                        items={platform.items.slice(0, 50)}
                        defaultMaxItems={50}
                        showViewAll
                        viewAllUrl={platform.url}
                        loading={platform.loading}
                        collapsible={false}
                        forceExpand
                        fontSize={hotListFontSize}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </aside>
    </>
  )
}
