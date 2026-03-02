"use client"

import { useState, useEffect, useRef } from "react"
import { cn } from "@/lib/utils"
import {
  type NewsItem,
  getScoreLevel,
  getScoreColor,
  formatNumber,
  PLATFORM_ICONS,
} from "@/lib/mock-data"
import {
  MessageCircle,
  Repeat2,
  Heart,
  ExternalLink,
  Sparkles,
  X,
  Play,
  Loader2,
  Pin,
  TrendingUp,
  TrendingDown,
  Flame,
} from "lucide-react"


interface NewsCardProps {
  item: NewsItem
  isNew?: boolean
  isPinned?: boolean
  aiSummaryEnabled?: boolean
  onTogglePin?: (id: string) => void
  onHide?: (id: string) => void
  fontSize?: number
}

function getPlatformIcon(p: NewsItem["platform"]): string {
  switch (p) {
    case "weibo": return PLATFORM_ICONS.weibo
    case "douyin": return PLATFORM_ICONS.douyin
    case "gongzhonghao": return PLATFORM_ICONS.gongzhonghao
  }
}
function getPlatformLabel(p: NewsItem["platform"]): string {
  switch (p) {
    case "weibo": return "微博"
    case "douyin": return "抖音"
    case "gongzhonghao": return "公众号"
  }
}
function getPlatformSearchUrl(p: NewsItem["platform"], t: string): string {
  const q = encodeURIComponent(t)
  switch (p) {
    case "weibo": return `https://s.weibo.com/weibo?q=${q}`
    case "douyin": return `https://www.douyin.com/search/${q}`
    case "gongzhonghao": return `https://weixin.sogou.com/weixin?query=${q}`
  }
}
function getPlatformShort(p: NewsItem["platform"]): string {
  switch (p) {
    case "weibo": return "微博热搜"
    case "douyin": return "抖音热榜"
    case "gongzhonghao": return "公众号"
  }
}

/** 
 * 修复2: 检查字符串是否有效（非空、非undefined、trim后有内容）
 * 用于防止空字符串导致fallback失效
 */
function isValidString(val: string | undefined | null): val is string {
  return typeof val === "string" && val.trim() !== ""
}

/**
 * 修复4: 全局持久化的失败URL缓存
 * 组件重新渲染时不会重置，避免闪烁
 */
const failedImageUrls = new Set<string>()
const failedAvatarUrls = new Set<string>()

/** Proxy anti-hotlink images via our backend */
function proxyImage(url: string | undefined): string | undefined {
  if (!url || !isValidString(url)) return undefined
  if (/sinaimg\.cn|mmbiz\.qpic\.cn|douyinpic\.com|wimg\.cn/i.test(url)) {
    return `/api/proxy/image?url=${encodeURIComponent(url)}`
  }
  return url
}

// ─────────────────────────────────────────────────
// Main NewsCard - social card layout
// Images, content text, and avatar are ALWAYS visible
// Expand reveals: detail/video + AI summary + interactions
// ─────────────────────────────────────────────────
export function NewsCard({ item, isNew, isPinned, aiSummaryEnabled, onTogglePin, onHide, fontSize = 14 }: NewsCardProps) {
  const [showAiSummary, setShowAiSummary] = useState(false)
  const [aiSummary, setAiSummary] = useState<string | null>(item.aiSummary || null)
  const [isLoadingSummary, setIsLoadingSummary] = useState(false)
  // 修复4: 使用全局缓存判断图片是否失败，配合useState触发重渲染
  const [imgError, setImgError] = useState(() => failedImageUrls.has(item.imageUrl || ""))
  const [avatarError, setAvatarError] = useState(() => failedAvatarUrls.has(item.authorAvatar || ""))
  const [isExpanded, setIsExpanded] = useState(false)
  const [detailData, setDetailData] = useState<{
    detailContent: string
    mediaUrl: string | null
    mediaType: "image" | "video" | null
    authorName: string | null
  } | null>(null)
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)
  const [detailError, setDetailError] = useState(false)
  const prevEnabledRef = useRef(aiSummaryEnabled)
  const scoreLevel = getScoreLevel(item.score)
  const scoreColor = getScoreColor(item.score)

  // ─── Media URLs ───
  const imageUrl = proxyImage(item.imageUrl)
  const avatarUrl = proxyImage(item.authorAvatar)
  const videoUrl = item.videoUrl
  const isVideo = item.mediaType === "video" || (videoUrl && /\.(mp4|webm|ogg|m3u8)(\?|$)/i.test(videoUrl))

  // ─── Content text - priority: summary > excerpt > detailContent > title ───
  const contentText = item.summary || (item as any).excerpt || item.detailContent || ""

  // ─── Deep fetch on expand ───
  useEffect(() => {
    if (!isExpanded || detailData || isLoadingDetail || item.detailLoaded) return
    setIsLoadingDetail(true)
    setDetailError(false)
    const pMap: Record<string, string> = { weibo: "weibo", douyin: "douyin", gongzhonghao: "gzh" }
    const pKey = pMap[item.platform] || item.platform
    fetch(`/api/trending/detail?platform=${pKey}&keyword=${encodeURIComponent(item.title)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("fail")
        const data = await res.json()
        setDetailData(data)
      })
      .catch(() => setDetailError(true))
      .finally(() => setIsLoadingDetail(false))
  }, [isExpanded, detailData, isLoadingDetail, item.detailLoaded, item.platform, item.title])

  // AI summary
  useEffect(() => {
    if (aiSummaryEnabled && !prevEnabledRef.current) {
      setShowAiSummary(true)
      if (!aiSummary && !isLoadingSummary) doFetchSummary()
    } else if (!aiSummaryEnabled && prevEnabledRef.current) {
      setShowAiSummary(false)
    }
    prevEnabledRef.current = aiSummaryEnabled
  }, [aiSummaryEnabled]) // eslint-disable-line react-hooks/exhaustive-deps

  const doFetchSummary = async () => {
    if (isLoadingSummary) return
    setIsLoadingSummary(true)
    try {
      const res = await fetch("/api/ai/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: item.title, content: contentText, platform: item.platform }),
      })
      if (res.ok) { const d = await res.json(); setAiSummary(d.summary) }
      else setAiSummary("AI 总结生成失败，请稍后重试。")
    } catch { setAiSummary("AI 总结生成失败，请稍后重试。") }
    finally { setIsLoadingSummary(false) }
  }

  // Rank badge and background color based on rank change
  const delta = item.rankDelta ?? 0
  
  // 根据排名变化计算呼吸动画：上升显示淡红呼吸，下降显示淡绿呼吸
  const getRankChangeAnimation = (): string => {
    if (delta > 0) {
      // 排名上升 - 淡红色呼吸动画
      return "animate-rank-up-breath"
    } else if (delta < 0) {
      // 排名下降 - 淡绿色呼吸动画
      return "animate-rank-down-breath"
    }
    return ""
  }
  const rankChangeAnimation = getRankChangeAnimation()
  
  const rankBadge = item.platformRank ? (
    <span className="inline-flex items-center gap-1 text-[11px] font-mono">
      <span className="text-muted-foreground">{getPlatformShort(item.platform)}</span>
      <span className="font-bold text-foreground">{"#" + item.platformRank}</span>
      {delta > 0 && <span className="inline-flex items-center text-red-500 font-bold"><TrendingUp size={11} />{delta}</span>}
      {delta < 0 && <span className="inline-flex items-center text-emerald-500 font-bold"><TrendingDown size={11} />{Math.abs(delta)}</span>}
    </span>
  ) : null

  return (
    <article
      className={cn(
        "group relative transition-all border-b border-border/30 hover:bg-accent/30",
        isNew && "animate-new-item animate-slide-in",
        isPinned && "pinned-glow bg-primary/[0.03]",
        scoreLevel === "golden" && !isPinned && "animate-golden-sweep",
        item.isBursting && "animate-burst",
        // 排名变化呼吸动画：上升淡红呼吸，下降淡绿呼吸
        rankChangeAnimation
      )}
    >
      {/* ─── Hover actions ─── */}
      <div className="absolute top-2 left-2 z-10 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => { e.stopPropagation(); onTogglePin?.(item.id) }}
          className={cn(
            "flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-all",
            isPinned
              ? "bg-primary/20 text-primary border border-primary/30"
              : "bg-secondary/80 text-muted-foreground hover:text-primary hover:bg-primary/10 border border-border/50"
          )}
        >
          <Pin size={10} className={cn(isPinned && "fill-primary")} />
          {isPinned ? "取消置顶" : "置顶"}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onHide?.(item.id) }}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-secondary/80 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 border border-border/50 transition-all"
        >
          <X size={10} />
          隐藏
        </button>
      </div>

      {isPinned && (
        <div className="flex items-center gap-1.5 px-4 pt-3">
          <Pin size={12} className="text-primary fill-primary" />
          <span className="text-[12px] font-bold text-primary">置顶</span>
        </div>
      )}

      <div className="px-4 pt-3 pb-3">
        {/* ═══════ Row 1: Avatar + Author + Meta (ALWAYS VISIBLE) ═══════ */}
        <div className="flex items-center gap-2.5 mb-2">
          {/* Avatar - 修复2: 加强空字符串检查 */}
          <div className="shrink-0 w-9 h-9 rounded-full overflow-hidden bg-secondary border border-border/30">
            {isValidString(avatarUrl) && !avatarError ? (
              <img
                src={avatarUrl}
                alt={isValidString(item.author) ? item.author : getPlatformLabel(item.platform)}
                className="w-full h-full object-cover"
                onError={(e) => {
                  // 调试日志：打印实际字段值方便排查
                  console.log('[v0] avatar load failed:', {
                    authorAvatar: item.authorAvatar,
                    avatarUrl,
                    platform: item.platform,
                    author: item.author
                  })
                  // 记录到全局缓存，防止重渲染时重置
                  if (item.authorAvatar) failedAvatarUrls.add(item.authorAvatar)
                  // 隐藏失败的图片元素
                  const target = e.target as HTMLImageElement
                  target.style.display = 'none'
                  setAvatarError(true)
                }}
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center text-xs font-bold text-muted-foreground">
                {(isValidString(item.author) ? item.author : getPlatformLabel(item.platform))[0]}
              </div>
            )}
          </div>

          {/* Author info - 修复2: 加强空字符串检查 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-foreground text-[13px] truncate">
                {isValidString(item.author) ? item.author : getPlatformLabel(item.platform)}
              </span>
              {item.authorVerified && (
                <span className="shrink-0 px-1.5 py-0.5 rounded text-[11px] bg-primary/15 text-primary font-medium">
                  认证
                </span>
              )}
              {rankBadge}
              {item.isBursting && (
                <span className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[11px] bg-orange-500/15 text-orange-400 font-bold">
                  <Flame size={11} />
                  飙升
                </span>
              )}
            </div>
            {/* Platform + timestamp */}
            <div className="flex items-center gap-1.5 mt-0.5">
              <img src={getPlatformIcon(item.platform)} alt="" width={12} height={12} className="opacity-50" />
              <span className="text-[10px] text-muted-foreground">
                {getPlatformLabel(item.platform)}
              </span>
              <span className="text-[10px] text-muted-foreground/50">{"·"}</span>
              <span className="text-[10px] text-muted-foreground">{item.timestamp}</span>
            </div>
          </div>

{/* 删除右侧评分标签（金狗/银狗等），仅保留认证标签 */}
  </div>

        {/* ═══════ Row 2: Hot rank + Title (ALWAYS VISIBLE) ═══════ */}
        {item.platformRank && (
          <div className="flex items-center gap-1.5 mb-1">
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-500/15 text-red-400 border border-red-500/20">
              {"热搜 #" + item.platformRank}
            </span>
          </div>
        )}
        <h3 
          className="font-bold text-foreground leading-snug mb-2 text-balance"
          style={{ fontSize: `${Math.max(fontSize + 2, 16)}px` }}
        >
          {item.title}
        </h3>

        {/* ═══════ Row 3: Content Text (2-3 lines) - 修复2: 加强空字符串检查 ═══════ */}
        {isValidString(contentText) && (
          <p 
            className="leading-relaxed line-clamp-3 text-foreground/80 mb-2.5"
            style={{ fontSize: `${fontSize}px` }}
          >
            {contentText}
          </p>
        )}

        {/* ═══════ Row 4: Image/Video Thumbnail - 缩略图样式，左对齐、不裁切 ═══════ */}
        {isValidString(item.imageUrl) && isValidString(imageUrl) && !imgError && (
          <div className="w-full rounded-xl overflow-hidden mb-3 flex justify-start">
            <a
              href={item.url || getPlatformSearchUrl(item.platform, item.title)}
              target="_blank"
              rel="noopener noreferrer"
              className="block relative"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={imageUrl}
                alt={item.title}
                loading="lazy"
                onError={(e) => {
                  if (item.imageUrl) failedImageUrls.add(item.imageUrl)
                  const target = e.target as HTMLImageElement
                  if (target.parentElement?.parentElement) {
                    target.parentElement.parentElement.style.display = 'none'
                  }
                  setImgError(true)
                }}
                style={{
                  maxHeight: '120px',
                  maxWidth: '220px',
                  width: 'auto',
                  height: 'auto',
                  objectFit: 'contain',
                  borderRadius: '8px',
                  display: 'block',
                }}
              />
              {/* Video play overlay */}
              {isVideo && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors rounded-lg">
                  <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                    <Play size={16} className="text-black ml-0.5" fill="black" />
                  </div>
                </div>
              )}
            </a>
          </div>
        )}

{/* 已删除推文正文下方的红色标签 */}

        {/* ═══════ Row 6: Interaction bar (ALWAYS VISIBLE) ═══════ */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-5">
            <button className="flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors">
              <MessageCircle size={14} />
              <span className="text-[11px]">{formatNumber(item.comments)}</span>
            </button>
            <button className="flex items-center gap-1 text-muted-foreground hover:text-emerald-400 transition-colors">
              <Repeat2 size={14} />
              <span className="text-[11px]">{formatNumber(item.reposts)}</span>
            </button>
            <button className="flex items-center gap-1 text-muted-foreground hover:text-red-400 transition-colors">
              <Heart size={14} />
              <span className="text-[11px]">{formatNumber(item.likes)}</span>
            </button>
            <a
              href={getPlatformSearchUrl(item.platform, item.title)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink size={13} />
              <span className="text-[11px]">原文</span>
            </a>
          </div>

          <a
            href={item.url || getPlatformSearchUrl(item.platform, item.title)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary/70 hover:text-primary flex items-center gap-1"
          >
            查看原文 <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {/* ═══════ AI Summary (toggleable) ═══════ */}
        {showAiSummary && (
          <div className="mt-3 p-3 rounded-lg bg-primary/5 border border-primary/15 relative">
            <button
              onClick={() => setShowAiSummary(false)}
              className="absolute top-2 right-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={12} />
            </button>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Sparkles size={12} className="text-primary" />
              <span className="text-[11px] font-bold text-primary">AI 智能总结</span>
            </div>
            {isLoadingSummary ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 size={14} className="animate-spin" />
                <span>{"正在生成智能总结..."}</span>
              </div>
            ) : (
              <p className="text-sm text-foreground/80 leading-relaxed">{aiSummary}</p>
            )}
          </div>
        )}

        {/* ═══════ Expanded: Deep detail (on click "详情") ═══════ */}
        <div
          className={cn(
            "overflow-hidden transition-all duration-300 ease-in-out",
            isExpanded ? "max-h-[800px] opacity-100 mt-3" : "max-h-0 opacity-0"
          )}
        >
          <div className="space-y-3">
            {/* Loading skeleton */}
            {isLoadingDetail && (
              <div className="p-3 rounded-lg bg-muted/30 border border-border/20 space-y-2">
                <div className="h-3 w-3/4 bg-secondary rounded animate-pulse" />
                <div className="h-3 w-full bg-secondary rounded animate-pulse" />
                <div className="h-3 w-1/2 bg-secondary rounded animate-pulse" />
              </div>
            )}

            {/* Deep-scraped detail content */}
            {detailData?.detailContent && (
              <div className="p-3 rounded-lg bg-muted/40 border border-border/20">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Pin size={10} className="text-primary" />
                  <span className="text-[10px] font-bold text-primary">置顶博文</span>
                  {detailData.authorName && (
                    <span className="text-[10px] text-muted-foreground">{"@" + detailData.authorName}</span>
                  )}
                </div>
                <p className="text-sm text-foreground/85 leading-relaxed">
                  {detailData.detailContent}
                </p>
              </div>
            )}

            {/* Deep-scraped media */}
            {detailData?.mediaUrl && detailData.mediaType === "image" && (
              <div className="rounded-lg overflow-hidden border border-border/20">
                <img
                  src={proxyImage(detailData.mediaUrl) || detailData.mediaUrl}
                  alt={item.title}
                  loading="lazy"
                  className="w-full object-cover"
                  style={{ maxHeight: '240px' }}
                />
              </div>
            )}

            {detailData?.mediaUrl && detailData.mediaType === "video" && (
              /\.(mp4|webm|ogg|m3u8)(\?|$)/i.test(detailData.mediaUrl) ? (
                <div className="rounded-lg overflow-hidden border border-border/20">
                  <video
                    src={detailData.mediaUrl}
                    controls
                    playsInline
                    preload="metadata"
                    className="w-full"
                    poster={imageUrl}
                  />
                </div>
              ) : (
                <a
                  href={detailData.mediaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 border border-border/20 text-sm text-primary hover:bg-muted/50 transition-colors"
                >
                  <Play size={14} />
                  {"点击观看视频"}
                </a>
              )
            )}

            {/* Error fallback */}
            {detailError && !detailData && (
              <a
                href={getPlatformSearchUrl(item.platform, item.title)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 border border-border/20 text-sm text-primary hover:bg-muted/50 transition-colors"
              >
                <ExternalLink size={14} />
                {"点击跳转原文查看详情"}
              </a>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}
