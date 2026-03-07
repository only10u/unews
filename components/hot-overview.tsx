"use client"

import { useState, useMemo, useCallback } from "react"
import { cn } from "@/lib/utils"
import { useTrendingDiff, type TrendingDiffItem } from "@/hooks/use-trending-diff"
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  RefreshCw,
  TrendingUp,
  Clock,
  Flame,
  ExternalLink,
} from "lucide-react"

interface HotOverviewProps {
  items: { id: string; title: string; platform: string }[]
  className?: string
}

function getPlatformColor(p: string): string {
  switch (p) {
    case "weibo": return "bg-orange-500/15 text-orange-500 border-orange-500/20"
    case "douyin": return "bg-gray-900/15 text-gray-900 dark:bg-white/15 dark:text-white border-gray-900/20 dark:border-white/20"
    case "gzh":
    case "gongzhonghao": return "bg-green-500/15 text-green-500 border-green-500/20"
    default: return "bg-gray-500/15 text-gray-500 border-gray-500/20"
  }
}

function getPlatformLabel(p: string): string {
  switch (p) {
    case "weibo": return "微博"
    case "douyin": return "抖音"
    case "gzh":
    case "gongzhonghao": return "公众号"
    default: return p
  }
}

function getStatusLabel(status: TrendingDiffItem["status"]): { text: string; className: string } {
  switch (status) {
    case "new": return { text: "新上榜", className: "bg-red-500/15 text-red-500" }
    case "top10": return { text: "冲进前十", className: "bg-orange-500/15 text-orange-500" }
    case "rising": return { text: "上升中", className: "bg-emerald-500/15 text-emerald-500" }
    default: return { text: "", className: "" }
  }
}

function formatLastUpdate(dateStr: string): string {
  try {
    const date = new Date(dateStr)
    return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })
  } catch {
    return ""
  }
}

export function HotOverview({ items, className }: HotOverviewProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [copied, setCopied] = useState(false)

  // 使用共享的趋势变化数据
  const { all: trendItems, lastUpdate, isLoading: isTrendLoading, refresh: refreshTrend } = useTrendingDiff()

  // 取前10条趋势变化
  const displayTrendItems = useMemo(() => {
    return trendItems.slice(0, 10)
  }, [trendItems])

  // 一键复制
  const handleCopy = useCallback(() => {
    const trendText = displayTrendItems.map(t => {
      const statusLabel = t.status ? getStatusLabel(t.status).text : ""
      const rankChange = t.prevRank !== null
        ? `#${t.prevRank}→#${t.rank} ${t.rankChange > 0 ? "上升" : "下降"}${Math.abs(t.rankChange)}名`
        : "—"
      return `[${getPlatformLabel(t.platform)}] ${t.title}   ${statusLabel}   ${rankChange}`
    }).join("\n")
    
    const fullText = `【趋势变化】\n${trendText}`
    
    navigator.clipboard.writeText(fullText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [displayTrendItems])

  const handleRefresh = useCallback(() => {
    refreshTrend()
  }, [refreshTrend])

  return (
    <div className={cn("border-t border-border/30 bg-card/50", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/20">
        <div className="flex items-center gap-2">
          <Flame size={16} className="text-orange-500" />
          <h3 className="font-bold text-foreground">热点速览</h3>
        </div>
        
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock size={12} />
            <span>上次更新: {lastUpdate ? formatLastUpdate(lastUpdate) : "--:--"}</span>
          </div>
          <span className="text-muted-foreground/50">|</span>
          <span>每10分钟更新</span>
          
          <div className="flex items-center gap-1 ml-2">
            <button
              onClick={handleRefresh}
              className="p-1.5 rounded-md hover:bg-accent transition-colors"
              title="刷新"
            >
              <RefreshCw size={12} className={cn(isTrendLoading && "animate-spin")} />
            </button>
            <button
              onClick={handleCopy}
              className="p-1.5 rounded-md hover:bg-accent transition-colors"
              title="一键复制"
            >
              {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
            </button>
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-1.5 rounded-md hover:bg-accent transition-colors"
              title={isCollapsed ? "展开" : "收起"}
            >
              {isCollapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {!isCollapsed && (
        <div className="p-4 space-y-6">
          {/* 趋势变化 */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={14} className="text-emerald-500" />
              <h4 className="text-sm font-semibold text-foreground">趋势变化</h4>
              <span className="text-[10px] text-muted-foreground">({displayTrendItems.length}条)</span>
            </div>
            
            {isTrendLoading && displayTrendItems.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <RefreshCw size={12} className="animate-spin" />
                <span>加载中...</span>
              </div>
            ) : displayTrendItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">暂无明显趋势变化</p>
            ) : (
              <div className="space-y-2">
                {displayTrendItems.map((item, idx) => {
                  const statusInfo = item.status ? getStatusLabel(item.status) : null
                  return (
                    <a
                      key={`${item.platform}-${item.title}-${idx}`}
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors group"
                    >
                      <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium border shrink-0", getPlatformColor(item.platform))}>
                        {getPlatformLabel(item.platform)}
                      </span>
                      <span className="flex-1 text-sm text-foreground truncate group-hover:text-primary">{item.title}</span>
                      {statusInfo && statusInfo.text && (
                        <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0", statusInfo.className)}>
                          {statusInfo.text}
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                        {item.prevRank !== null ? (
                          <>
                            #{item.prevRank}→#{item.rank}
                            {item.rankChange > 0 && (
                              <span className="text-emerald-500 ml-1">
                                <TrendingUp size={10} className="inline" />{item.rankChange}
                              </span>
                            )}
                          </>
                        ) : (
                          "—"
                        )}
                      </span>
                      <ExternalLink size={10} className="text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0" />
                    </a>
                  )
                })}
              </div>
            )}
          </div>


        </div>
      )}
    </div>
  )
}
