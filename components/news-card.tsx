"use client"

import { useState, useEffect, useRef } from "react"
import useSWR from "swr"
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
  X,
  Play,
  Pin,
  TrendingUp,
  TrendingDown,
  Flame,
} from "lucide-react"

// 内嵌推文数据类型
interface EmbeddedPost {
  avatar?: string
  author?: string
  title?: string
  content?: string
  imageUrl?: string
  videoUrl?: string
  url?: string
  pubDate?: string
  platform?: "weibo" | "douyin" | "wechat"
}




interface NewsCardProps {
  item: NewsItem
  isNew?: boolean
  isTempTop?: boolean // 临时置顶状态（3秒内）
  isPinned?: boolean
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

// 内嵌推文数据获取函数
async function fetchEmbeddedPost(itemId: string, title: string): Promise<EmbeddedPost | null> {
  try {
    let url = ""
    let platform: "weibo" | "douyin" | "wechat" = "weibo"
    
    if (itemId.startsWith("w")) {
      // 微博 - 不显示内嵌推文，返回null
      return null
    } else if (itemId.startsWith("d")) {
      // 抖音
      url = `/api/posts/douyin?keyword=${encodeURIComponent(title)}`
      platform = "douyin"
    } else if (itemId.startsWith("g")) {
      // 公众号 - 使用热搜标题作为关键词匹配
      url = `/api/posts/wechat?keyword=${encodeURIComponent(title)}`
      platform = "wechat"
    } else {
      return null
    }
    
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) return null
    
    const data = await res.json()
    
    // 检查是否成功
    if (data.success === false) return null
    
    // 微博/抖音格式
    if (platform === "weibo" || platform === "douyin") {
      if (!data.data && !data.user) return null
      const post = data.data || data
      return {
        avatar: post.user?.avatar || post.avatar || post.author_avatar || "",
        author: post.user?.nickname || post.user?.screen_name || post.author || post.nickname || "",
        title: post.title || post.desc || "",
        content: (post.text || post.content || post.desc || "").substring(0, 80),
        imageUrl: post.pic || post.cover || post.imageUrl || post.image || "",
        videoUrl: post.videoUrl || post.video_url || "",
        url: post.url || post.link || post.share_url || "",
        pubDate: post.created_at || post.pubDate || "",
        platform,
      }
    }
    
    // 公众号格式
    if (platform === "wechat" && data.data) {
      return {
        avatar: "", // 公众号RSS没有头像
        author: data.data.author || "",
        title: data.data.title || "",
        content: data.data.summary || "",
        imageUrl: data.data.imageUrl || "",
        url: data.data.url || "",
        pubDate: data.data.pubDate || "",
        platform,
      }
    }
    
    return null
  } catch {
    return null
  }
}

// ─────────────────────────────────────────────────
// Main NewsCard - social card layout
// Images, content text, and avatar are ALWAYS visible
// Expand reveals: detail/video + AI summary + interactions
// ─────────────────────────────────────────────────
export function NewsCard({ item, isNew, isTempTop, isPinned, onTogglePin, onHide, fontSize = 14 }: NewsCardProps) {
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
  const scoreLevel = getScoreLevel(item.score)
  const scoreColor = getScoreColor(item.score)

  // ─── 内嵌推文数据获取 ───
  const { data: embeddedPost, isLoading: isLoadingPost } = useSWR(
    `embedded-post-${item.id}`,
    () => fetchEmbeddedPost(item.id, item.title),
    { 
      revalidateOnFocus: false, 
      dedupingInterval: 300000, // 5分钟内不重复请求
      errorRetryCount: 1,
    }
  )

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

  // Rank badge and background color based on rank change
  const delta = item.rankDelta ?? 0
  
  // 根据规则计算左侧边框颜色：
  // isTempTop（新上榜置顶中）→ 淡绿色闪烁
  // platformRank <= 3（平台热搜前三）→ 淡黄色静态
  // rankDelta >= 1 或 isBursting（趋势上升）→ 淡红色静态
  // 其他 → 无边框
  const getLeftBorderClass = (): string => {
    if (isTempTop) {
      return "border-l-2 border-emerald-400/60 animate-pulse"
    }
    if (item.platformRank && item.platformRank <= 3) {
      return "border-l-2 border-yellow-400/40"
    }
    if ((item.rankDelta && item.rankDelta >= 1) || item.isBursting) {
      return "border-l-2 border-red-400/40"
    }
    return "border-l-2 border-transparent"
  }
  const leftBorderClass = getLeftBorderClass()
  
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
        // 左侧边框光效：根据条件显示不同颜色
        leftBorderClass
      )}
    >
      {/* 新消息闪烁灯条 - 置顶期间显示 */}
      {isTempTop && <div className="new-bar" />}

      {isPinned && (
        <div className="flex items-center gap-1.5 px-4 pt-3">
          <Pin size={12} className="text-primary fill-primary" />
          <span className="text-[12px] font-bold text-primary">置顶</span>
        </div>
      )}

      {/* ═══════ 左文右图双栏布局 ═══════ */}
      <div 
        className="flex flex-row gap-3 w-full p-4 rounded-xl bg-card/50 dark:bg-white/[0.03] border border-border/30 dark:border-white/[0.07] backdrop-blur-sm"
      >
        {/* ═══════ 左侧文字区 - 自动填充剩��空间 ═══════ */}
        <div 
          className="flex flex-col justify-between min-w-0 flex-1"
        >
          {/* 热榜标签 + 平台信息 */}
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            {item.platformRank && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-500/15 text-red-400 border border-red-500/20">
                {"热搜 #" + item.platformRank}
              </span>
            )}
            {rankBadge}
            {item.isBursting && (
              <span className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[11px] bg-orange-500/15 text-orange-400 font-bold">
                <Flame size={11} />
                飙升
              </span>
            )}
            <div className="flex items-center gap-1.5">
              <img src={getPlatformIcon(item.platform)} alt="" width={12} height={12} className="opacity-50" />
              <span className="text-[10px] text-muted-foreground">{getPlatformLabel(item.platform)}</span>
              <span className="text-[10px] text-muted-foreground/50">{"·"}</span>
              <span className="text-[10px] text-muted-foreground">{item.timestamp}</span>
            </div>
          </div>

          {/* 标题 - 加粗加大，使用 text-foreground 适配日夜模式 */}
          <h3 
            className="font-bold leading-tight mb-2 text-balance sm:text-lg text-foreground"
            style={{ 
              fontSize: '18px', 
              fontWeight: '700', 
              lineHeight: '1.4',
            }}
          >
            {item.title}
          </h3>

          {/* ═══════ 内嵌推文区块 ═══════ */}
          {isLoadingPost && (
            <div className="mt-2 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-border/20">
              <div className="flex gap-3">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-secondary animate-pulse" />
                    <div className="h-3 w-20 bg-secondary rounded animate-pulse" />
                    <div className="h-3 w-12 bg-secondary rounded animate-pulse ml-auto" />
                  </div>
                  <div className="h-3 w-full bg-secondary rounded animate-pulse" />
                  <div className="h-3 w-3/4 bg-secondary rounded animate-pulse" />
                </div>
                <div className="w-20 h-20 rounded-lg bg-secondary animate-pulse shrink-0" />
              </div>
            </div>
          )}
          
          {embeddedPost && !isLoadingPost && (
            <a
              href={embeddedPost.url || "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="block mt-2 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-border/20 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex gap-3 items-start">
                {/* 左侧：账号名 + 标题 + 正文 */}
                <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                  {/* 第一行：头像 + 账号名称（加大字体） */}
                  <div className="flex items-center gap-1.5 mb-0.5">
                    {embeddedPost.avatar ? (
                      <img
                        src={proxyImage(embeddedPost.avatar) || embeddedPost.avatar}
                        alt=""
                        className="w-5 h-5 rounded-full object-cover shrink-0"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
                      />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold text-muted-foreground shrink-0">
                        {(embeddedPost.author || "U")[0]}
                      </div>
                    )}
                    <span className="text-[13px] font-semibold text-foreground truncate">
                      {embeddedPost.author || (embeddedPost.platform === "wechat" ? "公众号" : embeddedPost.platform === "weibo" ? "微博用户" : "抖音用户")}
                    </span>
                  </div>

                  {/* 第二行：标题（加粗） */}
                  {embeddedPost.title && (
                    <p className="text-[13px] font-bold text-foreground truncate leading-snug">
                      {embeddedPost.title}
                    </p>
                  )}

                  {/* 第三行：正文内容（灰色，2行省略） */}
                  {embeddedPost.content && (
                    <p
                      className="text-[12px] text-gray-500 dark:text-gray-400 leading-snug"
                      style={{
                        overflow: "hidden",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                      }}
                    >
                      {embeddedPost.content}
                    </p>
                  )}
                </div>

                {/* 右侧：图片 */}
                {embeddedPost.imageUrl && (
                  <div
                    className="shrink-0 relative overflow-hidden rounded-lg"
                    style={{
                      width: embeddedPost.platform === "douyin" ? "96px" : "72px",
                      height: embeddedPost.platform === "douyin" ? "54px" : "72px",
                    }}
                  >
                    <img
                      src={proxyImage(embeddedPost.imageUrl) || embeddedPost.imageUrl}
                      alt=""
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).parentElement!.style.display = "none"
                      }}
                    />
                    {embeddedPost.platform === "douyin" && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <Play size={16} className="text-white" fill="white" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </a>
          )}

          {/* 正文摘要 - 3行截断，字体大小由 fontSize prop 控制 */}
          {isValidString(contentText) && (
            <p 
              className="mb-3"
              style={{ 
                fontSize: `${fontSize}px`, 
                color: '#AAAAAA', 
                lineHeight: '1.6',
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
              }}
            >
              {contentText}
            </p>
          )}

          {/* 底部交互栏 - 左对齐 */}
          <div className="flex items-center gap-4 mt-auto">
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
        </div>

        {/* ═══════ 右侧操作按钮区（hover显示） ═══════ */}
        <div className="absolute top-4 right-4 z-10 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
            {isPinned ? "取消" : "置顶"}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onHide?.(item.id) }}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-secondary/80 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 border border-border/50 transition-all"
          >
            <X size={10} />
            隐藏
          </button>
        </div>

        {/* ═══════ 右侧图片区 - 仅抖音和公众号显示 ═══════ */}
        {item.platform !== "weibo" && isValidString(item.imageUrl) && isValidString(imageUrl) && !imgError && (
          <div 
            className="shrink-0 sm:w-[240px] w-[120px]"
            style={{ 
              flex: '0 0 auto',
              minWidth: '120px',
              maxWidth: '280px',
            }}
          >
            <a
              href={item.url || getPlatformSearchUrl(item.platform, item.title)}
              target="_blank"
              rel="noopener noreferrer"
              className="block relative"
              onClick={(e) => e.stopPropagation()}
            >
              <div 
                className="w-full relative overflow-hidden"
                style={{ 
                  paddingTop: '75%', /* 4:3 aspect ratio */
                  borderRadius: '10px',
                }}
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
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />
                {/* Video play overlay */}
                {isVideo && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors">
                    <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                      <Play size={16} className="text-black ml-0.5" fill="black" />
                    </div>
                  </div>
                )}
              </div>
            </a>
          </div>
        )}
      </div>

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
    </article>
  )
}
