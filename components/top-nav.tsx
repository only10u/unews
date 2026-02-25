"use client"

import { cn } from "@/lib/utils"
import { PLATFORM_ICONS, type Platform } from "@/lib/mock-data"
import {
  Volume2,
  VolumeX,
  BookOpen,
  Sun,
  Moon,
  Sparkles,
  Key,
  Settings,
  Bell,
} from "lucide-react"
import Image from "next/image"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"

interface TopNavProps {
  activeChannel: Platform
  onChannelChange: (channel: Platform) => void
  isMuted: boolean
  onToggleMute: () => void
  onOpenSoundSettings?: () => void
  onOpenAuthDialog?: () => void
  onOpenPushConfig?: () => void
  aiSummaryEnabled?: boolean
  onToggleAiSummary?: () => void
}

const LOGO_URL = "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/%E5%BE%AE%E4%BF%A1%E5%9B%BE%E7%89%87_2026-01-08_132539_207-jMLYjL7vnEzvdHUsumdh9xabe09HlA.png"

const channels: { key: Platform; label: string; icon?: string }[] = [
  { key: "aggregate", label: "聚合" },
  { key: "weibo", label: "微博", icon: PLATFORM_ICONS.weibo },
  { key: "gongzhonghao", label: "公众号", icon: PLATFORM_ICONS.gongzhonghao },
  { key: "douyin", label: "抖音", icon: PLATFORM_ICONS.douyin },
]

export function TopNav({
  activeChannel,
  onChannelChange,
  isMuted,
  onToggleMute,
  onOpenSoundSettings,
  onOpenAuthDialog,
  onOpenPushConfig,
  aiSummaryEnabled = false,
  onToggleAiSummary,
}: TopNavProps) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <header className="sticky top-0 z-50 bg-background border-b border-border/40">
      <div className="flex items-center justify-between px-4 h-14">
        {/* Left: Logo */}
        <div className="flex items-center gap-2.5 shrink-0">
          <Image
            src={LOGO_URL}
            alt="热点新闻"
            width={32}
            height={32}
            className="rounded-lg object-cover"
            unoptimized
          />
          <h1 className="text-foreground font-bold text-lg tracking-tight hidden sm:block">
            热点新闻
          </h1>
        </div>

        {/* Center: Channel tabs */}
        <nav className="flex items-center gap-1 rounded-lg bg-secondary/60 p-1">
          {channels.map((ch) => (
            <button
              key={ch.key}
              onClick={() => onChannelChange(ch.key)}
              className={cn(
                "flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-sm font-medium transition-all",
                activeChannel === ch.key
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
              )}
            >
              {ch.icon && (
                <Image
                  src={ch.icon}
                  alt={ch.label}
                  width={18}
                  height={18}
                  className="rounded-sm object-cover"
                  unoptimized
                />
              )}
              <span>{ch.label}</span>
            </button>
          ))}
        </nav>

        {/* Right: Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {/* AI Summary global toggle */}
          <button
            onClick={onToggleAiSummary}
            className={cn(
              "flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all",
              aiSummaryEnabled
                ? "bg-primary/20 text-primary ring-1 ring-primary/30"
                : "text-muted-foreground hover:text-primary hover:bg-accent/50"
            )}
            title={aiSummaryEnabled ? "关闭AI总结" : "开启AI总结"}
          >
            <Sparkles size={14} />
            <span className="hidden lg:inline">AI总结</span>
          </button>

          {/* Push config */}
          <button
            onClick={onOpenPushConfig}
            className="w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
            aria-label="推送配置"
            title="推送触发器配置"
          >
            <Bell size={15} />
          </button>

          <div className="w-px h-5 bg-border/40" />

          {/* Social Links */}
          <a
            href="https://x.com/10UWINA8"
            target="_blank"
            rel="noopener noreferrer"
            className="w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
            aria-label="X (Twitter)"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </a>
          <a
            href="https://t.me/wewillwina8"
            target="_blank"
            rel="noopener noreferrer"
            className="w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
            aria-label="Telegram"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
            </svg>
          </a>

          <div className="w-px h-5 bg-border/40" />

          {/* Theme toggle */}
          {mounted && (
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
              aria-label={theme === "dark" ? "切换日间模式" : "切换夜间模式"}
            >
              {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
            </button>
          )}

          {/* Sound mute toggle */}
          <div className="relative">
            <button
              onClick={onToggleMute}
              className={cn(
                "w-8 h-8 rounded-md flex items-center justify-center transition-colors",
                isMuted
                  ? "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  : "text-primary hover:bg-accent/50"
              )}
              aria-label={isMuted ? "取消静音" : "静音"}
            >
              {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
              {!isMuted && (
                <span className="absolute inset-0 rounded-md border-2 border-primary/40 animate-sound-pulse pointer-events-none" />
              )}
            </button>
          </div>

          {/* Sound settings */}
          <button
            onClick={onOpenSoundSettings}
            className="w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
            aria-label="声音设置"
            title="声音控制中心"
          >
            <Settings size={15} />
          </button>

          <div className="w-px h-5 bg-border/40" />

          {/* Auth / Key */}
          <button
            onClick={onOpenAuthDialog}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:text-primary hover:bg-accent/50 transition-colors"
            title="输入密钥解锁付费功能"
          >
            <Key size={14} />
            <span className="hidden lg:inline">密钥</span>
          </button>

          {/* Subscribe */}
          <a
            href="https://forms.gle/EUa4992WD3K18may5"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
          >
            订阅
          </a>

          {/* Tutorial */}
          <a
            href="#tutorial"
            className="w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
            aria-label="使用教程"
          >
            <BookOpen size={15} />
          </a>
        </div>
      </div>
    </header>
  )
}
