"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { cn } from "@/lib/utils"
import { type NewsItem, PLATFORM_ICONS } from "@/lib/mock-data"
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  RefreshCw,
  TrendingUp,
  Sparkles,
  Clock,
  Flame,
} from "lucide-react"

interface HotOverviewProps {
  items: NewsItem[]
  className?: string
}

interface TrendItem {
  id: string
  title: string
  platform: "weibo" | "douyin" | "gongzhonghao"
  status: "new" | "top10" | "rising"
  prevRank?: number
  currentRank?: number
  delta?: number
}

interface MemeItem {
  id: string
  title: string
  platform: string
  reason: string
}

function getPlatformColor(p: string): string {
  switch (p) {
    case "weibo": return "bg-orange-500/15 text-orange-500 border-orange-500/20"
    case "douyin": return "bg-gray-900/15 text-gray-900 dark:bg-white/15 dark:text-white border-gray-900/20 dark:border-white/20"
    case "gongzhonghao": return "bg-green-500/15 text-green-500 border-green-500/20"
    default: return "bg-gray-500/15 text-gray-500 border-gray-500/20"
  }
}

function getPlatformLabel(p: string): string {
  switch (p) {
    case "weibo": return "微博"
    case "douyin": return "抖音"
    case "gongzhonghao": return "公众号"
    default: return p
  }
}

function getStatusLabel(status: TrendItem["status"]): { text: string; className: string } {
  switch (status) {
    case "new": return { text: "新上榜", className: "bg-red-500/15 text-red-500" }
    case "top10": return { text: "冲进前十", className: "bg-blue-500/15 text-blue-500" }
    case "rising": return { text: "持续上升", className: "bg-emerald-500/15 text-emerald-500" }
  }
}

export function HotOverview({ items, className }: HotOverviewProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [copied, setCopied] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [memeItems, setMemeItems] = useState<MemeItem[]>([])
  const [isLoadingMeme, setIsLoadingMeme] = useState(false)

  console.log("[v0] HotOverview rendered, items count:", items.length)

  // 计算趋势变化数据
  const trendItems = useMemo<TrendItem[]>(() => {
    const trends: TrendItem[] = []
    
    for (const item of items) {
      const delta = item.rankDelta ?? 0
      const rank = item.platformRank ?? 99
      const prevRank = item.prevPlatformRank ?? rank
      
      let status: TrendItem["status"] | null = null
      
      // 新上榜：之前不在榜单（prevRank很大或不存在）
      if (prevRank > 50 && rank <= 50) {
        status = "new"
      }
      // 冲进前十
      else if (prevRank > 10 && rank <= 10) {
        status = "top10"
      }
      // 持续上升（上升5位以上）
      else if (delta >= 5) {
        status = "rising"
      }
      
      if (status) {
        trends.push({
          id: item.id,
          title: item.title,
          platform: item.platform,
          status,
          prevRank,
          currentRank: rank,
          delta: Math.abs(delta),
        })
      }
    }
    
    // 按状态优先级排序：新上榜 > 冲进前十 > 持续上升
    const priority = { new: 0, top10: 1, rising: 2 }
    return trends.sort((a, b) => priority[a.status] - priority[b.status]).slice(0, 10)
  }, [items])

  // 获取Meme潜力榜
  const fetchMemePotential = useCallback(async () => {
    if (items.length === 0) return
    console.log("[v0] Fetching meme potential, items:", items.length)
    setIsLoadingMeme(true)
    try {
      const res = await fetch("/api/ai/meme-potential", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.slice(0, 30).map(i => ({
            id: i.id,
            title: i.title,
            platform: i.platform,
          })),
        }),
      })
      console.log("[v0] Meme API response status:", res.status)
      if (res.ok) {
        const data = await res.json()
        console.log("[v0] Meme data received:", data)
        setMemeItems(data.memes || [])
      }
    } catch (e) {
      console.error("[v0] Failed to fetch meme potential:", e)
    } finally {
      setIsLoadingMeme(false)
    }
  }, [items])

  // 每10分钟刷新一次
  useEffect(() => {
    fetchMemePotential()
    const interval = setInterval(() => {
      setLastUpdate(new Date())
      fetchMemePotential()
    }, 10 * 60 * 1000) // 10分钟
    return () => clearInterval(interval)
  }, [fetchMemePotential])

  // 一键复制
  const handleCopy = useCallback(() => {
    const trendText = trendItems.map(t => {
      const statusLabel = getStatusLabel(t.status).text
      const rankChange = t.prevRank && t.currentRank 
        ? `#${t.prevRank}→#${t.currentRank} 上升${t.delta}名`
        : ""
      return `[${getPlatformLabel(t.platform)}] ${t.title}   ${statusLabel}   ${rankChange}`
    }).join("\n")
    
    const memeText = memeItems.map(m => `${m.title}\n理由：${m.reason}`).join("\n\n")
    
    const fullText = `【趋势变化】\n${trendText}\n\n【Meme潜力榜】\n${memeText}`
    
    navigator.clipboard.writeText(fullText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [trendItems, memeItems])

  const handleRefresh = useCallback(() => {
    setLastUpdate(new Date())
    fetchMemePotential()
  }, [fetchMemePotential])

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
            <span>上次更新: {lastUpdate.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</span>
          </div>
          <span className="text-muted-foreground/50">|</span>
          <span>每10分钟更新</span>
          
          <div className="flex items-center gap-1 ml-2">
            <button
              onClick={handleRefresh}
              className="p-1.5 rounded-md hover:bg-accent transition-colors"
              title="刷新"
            >
              <RefreshCw size={12} className={cn(isLoadingMeme && "animate-spin")} />
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
              <span className="text-[10px] text-muted-foreground">({trendItems.length}条)</span>
            </div>
            
            {trendItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">暂无明显趋势变化</p>
            ) : (
              <div className="space-y-2">
                {trendItems.map((item) => {
                  const status = getStatusLabel(item.status)
                  return (
                    <div
                      key={item.id}
                      className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium border", getPlatformColor(item.platform))}>
                        {getPlatformLabel(item.platform)}
                      </span>
                      <span className="flex-1 text-sm text-foreground truncate">{item.title}</span>
                      <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium", status.className)}>
                        {status.text}
                      </span>
                      {item.prevRank && item.currentRank && (
                        <span className="text-[10px] text-emerald-500 font-mono">
                          #{item.prevRank}→#{item.currentRank} <TrendingUp size={10} className="inline" />{item.delta}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Meme潜力榜 */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={14} className="text-primary" />
              <h4 className="text-sm font-semibold text-foreground">Meme 潜力榜</h4>
              <span className="text-[10px] text-muted-foreground">({memeItems.length}条)</span>
            </div>
            
            {isLoadingMeme ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <RefreshCw size={12} className="animate-spin" />
                <span>AI正在分析...</span>
              </div>
            ) : memeItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">暂无Meme潜力新闻</p>
            ) : (
              <div className="space-y-3">
                {memeItems.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    className="p-3 rounded-lg bg-primary/5 border border-primary/10"
                  >
                    <p className="text-sm font-medium text-foreground mb-1">{item.title}</p>
                    <p className="text-[12px] text-muted-foreground">
                      <span className="text-primary font-medium">理由：</span>
                      {item.reason}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
