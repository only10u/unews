"use client"

import { useState, useEffect, useRef } from "react"
import { cn } from "@/lib/utils"
import {
  type NewsItem,
  getScoreLevel,
  getScoreColor,
  getScoreLabel,
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
  ImageOff,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import { AspectRatio } from "@/components/ui/aspect-ratio"

interface NewsCardProps {
  item: NewsItem
  isNew?: boolean
  isPinned?: boolean
  aiSummaryEnabled?: boolean
  onTogglePin?: (id: string) => void
  onHide?: (id: string) => void
}

function getPlatformIcon(platform: NewsItem["platform"]): string {
  switch (platform) {
    case "weibo": return PLATFORM_ICONS.weibo
    case "douyin": return PLATFORM_ICONS.douyin
    case "gongzhonghao": return PLATFORM_ICONS.gongzhonghao
  }
}

function getPlatformLabel(platform: NewsItem["platform"]): string {
  switch (platform) {
    case "weibo": return "微博"
    case "douyin": return "抖音"
    case "gongzhonghao": return "公众号"
  }
}

function getPlatformSearchUrl(platform: NewsItem["platform"], title: string): string {
  const q = encodeURIComponent(title)
  switch (platform) {
    case "weibo": return `https://s.weibo.com/weibo?q=${q}`
    case "douyin": return `https://www.douyin.com/search/${q}`
    case "gongzhonghao": return `https://weixin.sogou.com/weixin?query=${q}`
  }
}

function getPlatformShort(platform: NewsItem["platform"]): string {
  switch (platform) {
    case "weibo": return "微博热搜"
    case "douyin": return "抖音热榜"
    case "gongzhonghao": return "公众号"
  }
}

/** Proxy images to bypass anti-hotlink */
function proxyImageUrl(url: string | undefined): string | undefined {
  if (!url) return undefined
  const needsProxy = /sinaimg\.cn|mmbiz\.qpic\.cn|douyinpic\.com|wimg\.cn/i.test(url)
  if (needsProxy) {
    return `/api/proxy/image?url=${encodeURIComponent(url)}`
  }
  return url
}

/** Detect media type from URL */
function detectMediaType(url: string | undefined): "image" | "video" | null {
  if (!url) return null
  if (/\.(mp4|webm|ogg|m3u8)(\?|$)/i.test(url)) return "video"
  if (/\.(jpg|jpeg|png|gif|webp|avif|bmp|svg)(\?|$)/i.test(url)) return "image"
  if (/video|play|mp4/i.test(url)) return "video"
  return "image"
}

/** Weserv fallback */
function weservFallback(url: string | undefined): string | undefined {
  if (!url) return undefined
  const match = url.match(/[?&]url=([^&]+)/)
  const original = match ? decodeURIComponent(match[1]) : url
  return `https://images.weserv.nl/?url=${encodeURIComponent(original)}&w=800&q=80`
}

// ============================================================
// MediaSkeleton - pulse placeholder during detail loading
// ============================================================
function MediaSkeleton() {
  return (
    <div className="mb-3 rounded-lg overflow-hidden border border-border/20">
      <AspectRatio ratio={16 / 9}>
        <div className="w-full h-full bg-secondary animate-pulse flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <Loader2 size={20} className="text-muted-foreground/40 animate-spin" />
            <span className="text-[10px] text-muted-foreground/40">
              {"正在抓取置顶内容..."}
            </span>
          </div>
        </div>
      </AspectRatio>
    </div>
  )
}

// ============================================================
// DetailContentSkeleton - text placeholder
// ============================================================
function DetailContentSkeleton() {
  return (
    <div className="mb-3 p-3 rounded-lg bg-muted/30 border border-border/20 space-y-2">
      <div className="h-3 w-3/4 bg-secondary rounded animate-pulse" />
      <div className="h-3 w-full bg-secondary rounded animate-pulse" />
      <div className="h-3 w-1/2 bg-secondary rounded animate-pulse" />
    </div>
  )
}

// ============================================================
// Main NewsCard
// ============================================================
export function NewsCard({ item, isNew, isPinned, aiSummaryEnabled, onTogglePin, onHide }: NewsCardProps) {
  const [showAiSummary, setShowAiSummary] = useState(false)
  const [aiSummary, setAiSummary] = useState<string | null>(item.aiSummary || null)
  const [isLoadingSummary, setIsLoadingSummary] = useState(false)
  const [imgFallbackLevel, setImgFallbackLevel] = useState(0)
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

  // ---- Determine display media ----
  // Use deep-scraped detail media if available, else use item-level media
  const rawImage = detailData?.mediaUrl && detailData.mediaType === "image"
    ? detailData.mediaUrl
    : item.imageUrl
  const rawVideo = detailData?.mediaUrl && detailData.mediaType === "video"
    ? detailData.mediaUrl
    : item.videoUrl

  const proxiedImage = proxyImageUrl(rawImage)
  const proxiedAvatar = proxyImageUrl(
    detailData?.authorName ? undefined : item.authorAvatar
  ) || proxyImageUrl(item.authorAvatar)
  const weservImage = weservFallback(rawImage)

  const displayImage = imgFallbackLevel === 0 ? proxiedImage
    : imgFallbackLevel === 1 ? weservImage
    : undefined

  const effectiveMediaType = detailData?.mediaType
    || item.mediaType
    || (rawVideo ? "video" : rawImage ? detectMediaType(rawImage) : null)

  const handleImgError = () => {
    if (imgFallbackLevel === 0 && weservImage) {
      setImgFallbackLevel(1)
    } else {
      setImgFallbackLevel(2)
    }
  }

  // ---- Detail content ----
  const displayContent = detailData?.detailContent || item.detailContent || item.summary
  const displayAuthor = detailData?.authorName || item.author

  // ---- Deep fetch on expand ----
  useEffect(() => {
    if (!isExpanded || detailData || isLoadingDetail || item.detailLoaded) return

    setIsLoadingDetail(true)
    setDetailError(false)

    const platformMap: Record<string, string> = {
      weibo: "weibo",
      douyin: "douyin",
      gongzhonghao: "gzh",
    }
    const pKey = platformMap[item.platform] || item.platform

    fetch(`/api/trending/detail?platform=${pKey}&keyword=${encodeURIComponent(item.title)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Detail fetch failed")
        const data = await res.json()
        setDetailData(data)
        // Reset image fallback when new media arrives
        if (data.mediaUrl) setImgFallbackLevel(0)
      })
      .catch(() => {
        setDetailError(true)
      })
      .finally(() => {
        setIsLoadingDetail(false)
      })
  }, [isExpanded, detailData, isLoadingDetail, item.detailLoaded, item.platform, item.title])

  // AI summary toggle
  useEffect(() => {
    if (aiSummaryEnabled && !prevEnabledRef.current) {
      setShowAiSummary(true)
      if (!aiSummary && !isLoadingSummary) {
        doFetchSummary()
      }
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
        body: JSON.stringify({
          title: item.title,
          content: (item.summary || "") + (item.scoreReason ? ` [评分依据: ${item.scoreReason}]` : ""),
          platform: item.platform,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setAiSummary(data.summary)
      } else {
        setAiSummary("AI总结生成失败，请稍后重试。")
      }
    } catch {
      setAiSummary("AI总结生成失败，请稍后重试。")
    } finally {
      setIsLoadingSummary(false)
    }
  }

  const handleToggleSummary = () => {
    if (!showAiSummary) {
      setShowAiSummary(true)
      if (!aiSummary) doFetchSummary()
    } else {
      setShowAiSummary(false)
    }
  }

  // Build rank indicator
  const rankIndicator = (() => {
    if (!item.platformRank) return null
    const platformName = getPlatformShort(item.platform)
    const rankNum = item.platformRank
    const delta = item.rankDelta ?? 0
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-mono">
        <span className="text-muted-foreground">{platformName}</span>
        <span className="font-bold text-foreground">{"#" + rankNum}</span>
        {delta > 0 && (
          <span className="inline-flex items-center text-red-500 font-bold">
            <TrendingUp size={10} />
            {delta}
          </span>
        )}
        {delta < 0 && (
          <span className="inline-flex items-center text-emerald-500 font-bold">
            <TrendingDown size={10} />
            {Math.abs(delta)}
          </span>
        )}
      </span>
    )
  })()

  const hasMedia = !!(displayImage || rawVideo) && imgFallbackLevel < 2
  const isDirectVideo = rawVideo ? /\.(mp4|webm|ogg|m3u8)(\?|$)/i.test(rawVideo) : false

  // Debug: trace what data arrives at the card
  console.log("[v0] NewsCard data:", {
    id: item.id,
    author: item.author,
    avatar: item.authorAvatar?.substring(0, 40),
    imageUrl: item.imageUrl?.substring(0, 60),
    videoUrl: item.videoUrl?.substring(0, 60),
    mediaType: item.mediaType,
    detailContent: item.detailContent?.substring(0, 30),
    displayImage: displayImage?.substring(0, 60),
    rawImage: rawImage?.substring(0, 60),
    hasMedia,
    effectiveMediaType,
    imgFallbackLevel,
  })

  return (
    <article
      className={cn(
        "group relative transition-all",
        "border-b border-border/30",
        "hover:bg-accent/30",
        isNew && "animate-new-item animate-slide-in",
        isPinned && "pinned-glow bg-primary/[0.03]",
        scoreLevel === "golden" && !isPinned && "animate-golden-sweep",
        item.isBursting && "animate-burst"
      )}
    >
      {/* ─── Action buttons (hover) ─── */}
      <div className="absolute top-2 left-2 z-10 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => { e.stopPropagation(); onTogglePin?.(item.id) }}
          className={cn(
            "flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-all",
            isPinned
              ? "bg-primary/20 text-primary border border-primary/30"
              : "bg-secondary/80 text-muted-foreground hover:text-primary hover:bg-primary/10 border border-border/50"
          )}
          title={isPinned ? "取消置顶" : "置顶"}
        >
          <Pin size={10} className={cn(isPinned && "fill-primary")} />
          {isPinned ? "取消置顶" : "置顶"}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onHide?.(item.id) }}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-secondary/80 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 border border-border/50 transition-all"
          title="隐藏"
        >
          <X size={10} />
          隐藏
        </button>
      </div>

      {/* ─── Pinned indicator ─── */}
      {isPinned && (
        <div className="flex items-center gap-1.5 px-4 pt-3">
          <Pin size={12} className="text-primary fill-primary" />
          <span className="text-[11px] font-bold text-primary">
            {"置顶 - " + getScoreLabel(item.score)}
          </span>
        </div>
      )}

      {/* ─── Collapsed: Thumbnail + Title row (clickable to expand) ─── */}
      <div
        className="flex gap-3 p-4 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setIsExpanded(!isExpanded) }}
      >
        {/* Thumbnail (small, left side) */}
        <div className="relative shrink-0 w-20 h-14 rounded-md overflow-hidden bg-secondary">
          {displayImage ? (
            <img
              src={displayImage}
              alt=""
              loading="lazy"
              onError={handleImgError}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <img
                src={getPlatformIcon(item.platform)}
                alt={getPlatformLabel(item.platform)}
                width={24}
                height={24}
                className="opacity-50"
              />
            </div>
          )}
          {/* Video badge on thumbnail */}
          {effectiveMediaType === "video" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <Play size={14} className="text-white" fill="white" fillOpacity={0.8} />
            </div>
          )}
          {/* Platform mini badge */}
          <div className="absolute bottom-0.5 right-0.5 w-[14px] h-[14px] rounded-full overflow-hidden border border-background">
            <img
              src={getPlatformIcon(item.platform)}
              alt={getPlatformLabel(item.platform)}
              width={14}
              height={14}
              className="object-cover"
            />
          </div>
        </div>

        {/* Title + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span className="font-bold text-foreground text-[13px] truncate">
              {displayAuthor}
            </span>
            {item.authorVerified && (
              <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] bg-primary/15 text-primary font-medium">
                认证
              </span>
            )}
            {rankIndicator}
            {item.isBursting && (
              <span className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] bg-orange-500/15 text-orange-400 font-bold">
                <Flame size={9} />
                飙升
              </span>
            )}
            <span className="text-muted-foreground text-[10px] ml-auto shrink-0">
              {item.timestamp}
            </span>
          </div>
          <h3 className="font-bold text-foreground text-sm leading-snug line-clamp-2 text-balance">
            {item.title}
          </h3>
          {/* Score badge inline */}
          <div className="flex items-center gap-2 mt-1">
            <div
              className={cn(
                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold",
                scoreLevel === "golden" && "animate-pulse-glow"
              )}
              style={{
                background: `color-mix(in srgb, ${scoreColor} 15%, transparent)`,
                color: scoreColor,
                border: `1px solid color-mix(in srgb, ${scoreColor} 30%, transparent)`,
              }}
            >
              <span>{item.score.toFixed(1)}</span>
              <span className="opacity-70">{getScoreLabel(item.score)}</span>
            </div>
            {item.tags.slice(0, 2).map((tag) => (
              <span key={tag} className="px-1.5 py-0.5 rounded-full text-[9px] bg-secondary text-muted-foreground">
                {tag}
              </span>
            ))}
            {/* Expand indicator */}
            <span className="ml-auto text-muted-foreground/50">
              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </span>
          </div>
        </div>
      </div>

      {/* ─── Expanded: Full content with AnimatePresence-like transition ─── */}
      <div
        className={cn(
          "overflow-hidden transition-all duration-300 ease-in-out",
          isExpanded ? "max-h-[1200px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="px-4 pb-4 space-y-3">
          {/* ── Detail Content Box (pinned post text) ── */}
          {isLoadingDetail ? (
            <DetailContentSkeleton />
          ) : detailData?.detailContent || item.detailContent ? (
            <div className="p-3 rounded-lg bg-muted/40 border border-border/20 backdrop-blur-sm">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Pin size={10} className="text-primary" />
                <span className="text-[10px] font-bold text-primary">置顶博文</span>
                {detailData?.authorName && (
                  <span className="text-[10px] text-muted-foreground ml-1">
                    {"@" + detailData.authorName}
                  </span>
                )}
              </div>
              <p className="text-sm text-foreground/85 leading-relaxed line-clamp-4">
                {detailData?.detailContent || item.detailContent}
              </p>
            </div>
          ) : detailError ? (
            <a
              href={getPlatformSearchUrl(item.platform, item.title)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 border border-border/20 text-sm text-primary hover:bg-muted/50 transition-colors"
            >
              <ExternalLink size={14} />
              {"点击跳转原文查看详情"}
            </a>
          ) : null}

          {/* ── Media Container ── */}
          {isLoadingDetail && !hasMedia ? (
            <MediaSkeleton />
          ) : hasMedia ? (
            <div className="rounded-lg overflow-hidden border border-border/20 shadow-sm shadow-black/20">
              {effectiveMediaType === "video" && rawVideo ? (
                <VideoPlayer
                  videoUrl={rawVideo}
                  coverUrl={displayImage}
                  title={item.title}
                  isDirectVideo={isDirectVideo}
                />
              ) : displayImage ? (
                <a
                  href={getPlatformSearchUrl(item.platform, item.title)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  <AspectRatio ratio={16 / 9}>
                    <img
                      src={displayImage}
                      alt={item.title}
                      loading="lazy"
                      onError={handleImgError}
                      className="w-full h-full object-cover hover:scale-[1.02] transition-transform duration-300"
                    />
                  </AspectRatio>
                </a>
              ) : null}
            </div>
          ) : detailError && (
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

          {/* ── AI Summary ── */}
          {showAiSummary && (
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/15 relative">
              <button
                onClick={() => setShowAiSummary(false)}
                className="absolute top-2 right-2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="关闭AI总结"
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
                  正在生成AI总结...
                </div>
              ) : (
                <p className="text-sm text-foreground/90 leading-relaxed pr-4">
                  {aiSummary}
                </p>
              )}
            </div>
          )}

          {/* ── AI Score reason ── */}
          <p className="text-[11px] text-muted-foreground/70 italic">
            {"AI: " + item.scoreReason}
          </p>

          {/* ── Stats bar ── */}
          <div className="flex items-center gap-4 text-muted-foreground">
            <span className="flex items-center gap-1 text-[11px] hover:text-red-400 transition-colors cursor-pointer">
              <Heart size={12} />
              {formatNumber(item.likes)}
            </span>
            <span className="flex items-center gap-1 text-[11px] hover:text-emerald-400 transition-colors cursor-pointer">
              <Repeat2 size={12} />
              {formatNumber(item.reposts)}
            </span>
            <span className="flex items-center gap-1 text-[11px] hover:text-blue-400 transition-colors cursor-pointer">
              <MessageCircle size={12} />
              {formatNumber(item.comments)}
            </span>
            {/* AI summary button */}
            <button
              onClick={(e) => { e.stopPropagation(); handleToggleSummary() }}
              className={cn(
                "shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium transition-all",
                showAiSummary
                  ? "bg-primary/20 text-primary"
                  : "bg-secondary text-muted-foreground hover:text-primary hover:bg-primary/10"
              )}
            >
              {isLoadingSummary ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
              AI总结
            </button>
            <div className="ml-auto flex items-center gap-2">
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary transition-colors"
              >
                <ExternalLink size={11} />
                原文
              </a>
              <a
                href="https://x.com/10UWINA8"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="X"
              >
                <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              <a
                href="https://t.me/wewillwina8"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Telegram"
              >
                <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}

// ============================================================
// VideoPlayer sub-component
// ============================================================
function VideoPlayer({
  videoUrl,
  coverUrl,
  title,
  isDirectVideo,
}: {
  videoUrl: string
  coverUrl?: string
  title: string
  isDirectVideo: boolean
}) {
  const [playing, setPlaying] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  const handlePlay = () => {
    if (isDirectVideo) {
      setPlaying(true)
      setTimeout(() => videoRef.current?.play(), 100)
    } else {
      window.open(videoUrl, "_blank", "noopener,noreferrer")
    }
  }

  if (playing && isDirectVideo) {
    return (
      <AspectRatio ratio={16 / 9}>
        <video
          ref={videoRef}
          src={videoUrl}
          controls
          autoPlay
          playsInline
          className="w-full h-full object-contain bg-black rounded-lg"
          crossOrigin="anonymous"
        >
          <track kind="captions" />
        </video>
      </AspectRatio>
    )
  }

  return (
    <button
      onClick={handlePlay}
      className="relative block w-full cursor-pointer group/video"
      aria-label={"播放视频: " + title}
    >
      <AspectRatio ratio={16 / 9}>
        {coverUrl ? (
          <img
            src={coverUrl}
            alt={title}
            loading="lazy"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-secondary to-secondary/60 flex items-center justify-center">
            <ImageOff size={28} className="text-muted-foreground/30" />
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover/video:bg-black/30 transition-colors">
          <div className="w-12 h-12 rounded-full bg-white/25 backdrop-blur-sm flex items-center justify-center group-hover/video:bg-white/40 group-hover/video:scale-110 transition-all shadow-lg">
            <Play size={22} className="text-white ml-0.5 drop-shadow-md" fill="white" fillOpacity={0.9} />
          </div>
        </div>
        <span className="absolute top-2 right-2 text-[10px] bg-red-500/90 text-white px-2 py-0.5 rounded-full font-medium backdrop-blur-sm">
          视频
        </span>
      </AspectRatio>
    </button>
  )
}
