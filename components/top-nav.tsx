"use client"

import { cn } from "@/lib/utils"
import { PLATFORM_ICONS, type Platform } from "@/lib/mock-data"
import {
  BookOpen,
  Sun,
  Moon,
  Filter,
  Type,
  Minus,
  Plus,
} from "lucide-react"
import Link from "next/link"
import { X_FOLLOW_URL } from "@/lib/site"

import { useTheme } from "next-themes"
import { useEffect, useState, useRef } from "react"

export interface FontSettings {
  hotListFontSize: number
  tweetFontSize: number
}

interface TopNavProps {
  activeChannel: Platform
  onChannelChange: (channel: Platform) => void
  onOpenTutorial?: () => void
  aiDenoiseEnabled?: boolean
  onToggleAiDenoise?: () => void
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
  onOpenTutorial,
  aiDenoiseEnabled = false,
  onToggleAiDenoise,
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
          <a
            href={X_FOLLOW_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded-lg ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="在 X 上关注"
            title="在 X 上关注 @10UWINA8"
          >
            <img
              src={LOGO_URL}
              alt="热点新闻"
              width={32}
              height={32}
              className="rounded-lg object-cover"
            />
          </a>
          <div className="hidden sm:flex items-center gap-2 min-w-0">
            <h1 className="text-foreground font-bold text-lg tracking-tight truncate">热点新闻</h1>
            <Link
              href="/skill"
              className="text-sm font-semibold text-cyan-500 hover:text-cyan-400 transition-colors"
            >
              Skill
            </Link>
          </div>
          <Link
            href="/skill"
            className="sm:hidden text-xs font-semibold text-cyan-500 shrink-0"
          >
            Skill
          </Link>
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
          {/* AI降噪 - 过滤娱乐八卦/明星动态/影视综艺/饭圈内容 */}
          <button
            onClick={onToggleAiDenoise}
            className={cn(
              "flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all",
              aiDenoiseEnabled
                ? "bg-primary/20 text-primary ring-1 ring-primary/30"
                : "text-muted-foreground hover:text-primary hover:bg-accent/50"
            )}
            title={aiDenoiseEnabled ? "关闭AI降噪" : "开启AI降噪 - 过滤娱乐八卦/明星动态/影视综艺/饭圈内容"}
          >
            <Filter size={14} />
            <span className="hidden lg:inline">AI降噪</span>
          </button>



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

          {/* Tutorial / Help */}
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
