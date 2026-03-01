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
  Type,
  Minus,
  Plus,
} from "lucide-react"

import { useTheme } from "next-themes"
import { useEffect, useState, useRef } from "react"

export interface FontSettings {
  hotListFontSize: number
  tweetFontSize: number
}

interface TopNavProps {
  activeChannel: Platform
  onChannelChange: (channel: Platform) => void
  isMuted: boolean
  onToggleMute: () => void
  onOpenSoundSettings?: () => void
  onOpenAuthDialog?: () => void
  onOpenPushConfig?: () => void
  onOpenTutorial?: () => void
  aiSummaryEnabled?: boolean
  onToggleAiSummary?: () => void
  fontSettings?: FontSettings
  onFontSettingsChange?: (settings: FontSettings) => void
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
  onOpenTutorial,
  aiSummaryEnabled = false,
  onToggleAiSummary,
  fontSettings = { hotListFontSize: 14, tweetFontSize: 14 },
  onFontSettingsChange,
}: TopNavProps) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [fontMenuOpen, setFontMenuOpen] = useState(false)
  const fontMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Close font menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (fontMenuRef.current && !fontMenuRef.current.contains(event.target as Node)) {
        setFontMenuOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const updateFontSize = (key: keyof FontSettings, delta: number) => {
    const newSettings = { ...fontSettings }
    newSettings[key] = Math.max(10, Math.min(24, fontSettings[key] + delta))
    onFontSettingsChange?.(newSettings)
  }

  return (
    <header className="sticky top-0 z-50 bg-background border-b border-border/40">
      <div className="flex items-center justify-between px-4 h-14">
        {/* Left: Logo */}
        <div className="flex items-center gap-2.5 shrink-0">
          <img
            src={LOGO_URL}
            alt="热点新闻"
            width={32}
            height={32}
            className="rounded-lg object-cover"
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
                <img
                  src={ch.icon}
                  alt={ch.label}
                  width={18}
                  height={18}
                  className="rounded-sm object-cover"
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

          {/* Font Size Settings */}
          <div className="relative" ref={fontMenuRef}>
            <button
              onClick={() => setFontMenuOpen(!fontMenuOpen)}
              className="w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
              aria-label="字体设置"
              title="调节字体大小"
            >
              <Type size={15} />
            </button>
            
            {fontMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 rounded-lg border border-border/50 bg-background shadow-lg z-50 p-3 space-y-3">
                <div className="text-xs font-medium text-foreground mb-2">字体大小设置</div>
                
                {/* Hot List Font Size */}
                <div className="space-y-1.5">
                  <div className="text-[11px] text-muted-foreground">热榜字体</div>
                  <div className="flex items-center justify-between gap-2">
                    <button
                      onClick={() => updateFontSize("hotListFontSize", -1)}
                      className="w-7 h-7 rounded-md flex items-center justify-center bg-secondary hover:bg-accent transition-colors"
                    >
                      <Minus size={12} />
                    </button>
                    <span className="text-sm font-mono w-8 text-center">{fontSettings.hotListFontSize}</span>
                    <button
                      onClick={() => updateFontSize("hotListFontSize", 1)}
                      className="w-7 h-7 rounded-md flex items-center justify-center bg-secondary hover:bg-accent transition-colors"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                </div>
                
                {/* Tweet Font Size */}
                <div className="space-y-1.5">
                  <div className="text-[11px] text-muted-foreground">推文字体</div>
                  <div className="flex items-center justify-between gap-2">
                    <button
                      onClick={() => updateFontSize("tweetFontSize", -1)}
                      className="w-7 h-7 rounded-md flex items-center justify-center bg-secondary hover:bg-accent transition-colors"
                    >
                      <Minus size={12} />
                    </button>
                    <span className="text-sm font-mono w-8 text-center">{fontSettings.tweetFontSize}</span>
                    <button
                      onClick={() => updateFontSize("tweetFontSize", 1)}
                      className="w-7 h-7 rounded-md flex items-center justify-center bg-secondary hover:bg-accent transition-colors"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

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
          <button
            onClick={onOpenTutorial}
            className="w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
            aria-label="使用说明"
            title="使用说明"
          >
            <BookOpen size={15} />
          </button>
        </div>
      </div>
    </header>
  )
}
