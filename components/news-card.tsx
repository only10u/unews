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

/**
 * Proxy image URL to bypass anti-hotlink protections.
 * Uses images.weserv.nl public proxy for Weibo/Sinaimg domains.
 */
function proxyImageUrl(url: string | undefined): string | undefined {
  if (!url) return undefined
  // Weibo / Sinaimg anti-hotlink domains
  const needsProxy = /sinaimg\.cn|mmbiz\.qpic\.cn|douyinpic\.com/i.test(url)
  if (needsProxy) {
    // weserv.nl strips referer and caches the image
    return `https://images.weserv.nl/?url=${encodeURIComponent(url)}&w=800&q=80`
  }
  return url
}

export function NewsCard({ item, isNew, isPinned, aiSummaryEnabled, onTogglePin, onHide }: NewsCardProps) {
  const [showAiSummary, setShowAiSummary] = useState(false)
  const [aiSummary, setAiSummary] = useState<string | null>(item.aiSummary || null)
  const [isLoadingSummary, setIsLoadingSummary] = useState(false)
  const [imgError, setImgError] = useState(false)
  const prevEnabledRef = useRef(aiSummaryEnabled)
  const scoreLevel = getScoreLevel(item.score)
  const scoreColor = getScoreColor(item.score)

  const proxiedImage = proxyImageUrl(item.imageUrl)
  const proxiedAvatar = proxyImageUrl(item.authorAvatar)

  // React to global aiSummaryEnabled toggle
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

  // Build rank tracking indicator
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

  const hasMedia = !!(proxiedImage || item.videoUrl) && !imgError

  return (
    <article
      className={cn(
        "group relative p-4 transition-all",
        "border-b border-border/30",
        "hover:bg-accent/30",
        isNew && "animate-new-item animate-slide-in",
        isPinned && "pinned-glow bg-primary/[0.03]",
        scoreLevel === "golden" && !isPinned && "animate-golden-sweep",
        item.isBursting && "animate-burst"
      )}
    >
      {/* Action buttons: Pin + Hide (top-left, visible on hover) */}
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

      {/* Pinned indicator */}
      {isPinned && (
        <div className="flex items-center gap-1.5 mb-2">
          <Pin size={12} className="text-primary fill-primary" />
          <span className="text-[11px] font-bold text-primary">
            {"置顶 - " + getScoreLabel(item.score)}
          </span>
        </div>
      )}

      <div className="flex gap-3">
        {/* Author Avatar */}
        <div className="relative shrink-0">
          <div className="w-11 h-11 rounded-full bg-secondary flex items-center justify-center overflow-hidden">
            {proxiedAvatar ? (
              <img
                src={proxiedAvatar}
                alt={item.author}
                className="object-cover w-full h-full"
                loading="lazy"
              />
            ) : (
              <span className="text-muted-foreground text-lg font-bold">
                {item.author.charAt(0)}
              </span>
            )}
          </div>
          {/* Platform mini icon */}
          <div className="absolute -bottom-0.5 -right-0.5 w-[18px] h-[18px] rounded-full overflow-hidden border-2 border-background">
            <img
              src={getPlatformIcon(item.platform)}
              alt={getPlatformLabel(item.platform)}
              width={18}
              height={18}
              className="object-cover"
              loading="lazy"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Author line */}
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-bold text-foreground text-sm truncate">
              {item.author}
            </span>
            {item.authorVerified && (
              <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] bg-primary/15 text-primary font-medium">
                认证
              </span>
            )}
            {item.isOfficial && (
              <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] bg-red-500/15 text-red-400 font-medium">
                官方
              </span>
            )}
            <span className="text-[11px] text-muted-foreground shrink-0">
              {"粉丝 " + item.authorFollowers}
            </span>

            {/* Rank tracking indicator */}
            {rankIndicator}

            {/* Burst tag */}
            {item.isBursting && (
              <span className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] bg-orange-500/15 text-orange-400 font-bold">
                <Flame size={10} />
                飙升中
              </span>
            )}

            <span className="text-muted-foreground text-[11px] ml-auto shrink-0">
              {item.timestamp}
            </span>
            {/* AI Summary Button */}
            <button
              onClick={handleToggleSummary}
              className={cn(
                "shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium transition-all",
                showAiSummary
                  ? "bg-primary/20 text-primary"
                  : "bg-secondary text-muted-foreground hover:text-primary hover:bg-primary/10"
              )}
            >
              {isLoadingSummary ? (
                <Loader2 size={10} className="animate-spin" />
              ) : (
                <Sparkles size={10} />
              )}
              AI总结
            </button>
          </div>

          {/* Title - links to platform search results */}
          <h3 className="font-bold text-foreground mb-1 text-balance leading-relaxed">
            <a
              href={getPlatformSearchUrl(item.platform, item.title)}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary transition-colors"
            >
              {item.title}
            </a>
          </h3>

          {/* AI Summary Panel */}
          {showAiSummary && (
            <div className="mb-3 p-3 rounded-lg bg-primary/5 border border-primary/15 relative animate-slide-in">
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

          {/* Summary */}
          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2 mb-3">
            {item.summary}
          </p>

          {/* ===== Media Container (16:9 AspectRatio) ===== */}
          {hasMedia && (
            <div className="mb-3 rounded-lg overflow-hidden border border-border/20 shadow-sm shadow-black/20">
              {item.videoUrl ? (
                /* --- Video: inline HTML5 player or clickable cover --- */
                <VideoPlayer
                  videoUrl={item.videoUrl}
                  coverUrl={proxiedImage}
                  title={item.title}
                />
              ) : proxiedImage ? (
                /* --- Static image in 16:9 AspectRatio --- */
                <a
                  href={getPlatformSearchUrl(item.platform, item.title)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  <AspectRatio ratio={16 / 9}>
                    <img
                      src={proxiedImage}
                      alt={item.title}
                      loading="lazy"
                      onError={() => setImgError(true)}
                      className="w-full h-full object-cover hover:scale-[1.02] transition-transform duration-300"
                    />
                  </AspectRatio>
                </a>
              ) : null}
            </div>
          )}

          {/* Source Attribution */}
          {hasMedia && (
            <div className="flex items-center gap-2 mb-3 text-[10px] text-muted-foreground/60">
              <span>{"内容来源于该热搜下热度最高的" + (item.videoUrl ? "视频" : "贴文")}</span>
              {item.author && (
                <>
                  <span className="text-border">|</span>
                  <div className="flex items-center gap-1">
                    {proxiedAvatar && (
                      <img
                        src={proxiedAvatar}
                        alt={item.author}
                        width={14}
                        height={14}
                        className="rounded-full"
                        loading="lazy"
                      />
                    )}
                    <span>{item.author}</span>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Score Badge + Tags */}
          <div className="flex items-center flex-wrap gap-2 mb-2">
            <div
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold",
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
            {item.tags.map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 rounded-full text-[11px] bg-secondary text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>

          {/* Score reason */}
          <p className="text-[11px] text-muted-foreground/70 mb-3 italic">
            {"AI: " + item.scoreReason}
          </p>

          {/* Stats */}
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

/* ============================
   VideoPlayer sub-component
   ============================ */
function VideoPlayer({ videoUrl, coverUrl, title }: { videoUrl: string; coverUrl?: string; title: string }) {
  const [playing, setPlaying] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  // Check if the video URL is a playable direct link (mp4/webm/m3u8)
  const isDirectVideo = /\.(mp4|webm|ogg|m3u8)(\?|$)/i.test(videoUrl)

  const handlePlay = () => {
    if (isDirectVideo) {
      setPlaying(true)
      setTimeout(() => videoRef.current?.play(), 100)
    } else {
      // Open external video in new tab
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
        {/* Semi-transparent Play icon overlay */}
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
