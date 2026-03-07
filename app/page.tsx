"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { type Platform } from "@/lib/mock-data"
import { TopNav, type FontSettings } from "@/components/top-nav"
import { NewsFeed } from "@/components/news-feed"
import { HotSidebar } from "@/components/hot-sidebar"
import { TickerTape } from "@/components/ticker-tape"
import { SoundControl } from "@/components/sound-control"
import { AuthDialog } from "@/components/auth-dialog"

// AudioUnlockOverlay removed - no longer prompting for audio permission
import { TutorialDialog } from "@/components/tutorial-dialog"
import { useIsMobile } from "@/hooks/use-mobile"

function getStoredAuth(): boolean {
  if (typeof window === "undefined") return false
  try {
    const saved = localStorage.getItem("dou-u-auth")
    if (saved) {
      const data = JSON.parse(saved)
      return data.expiresAt > Date.now()
    }
  } catch { /* ignore */ }
  return false
}

function getStoredPushConfig(): { scoreThreshold: number; keywords: string[] } {
  if (typeof window === "undefined") return { scoreThreshold: 0, keywords: [] }
  try {
    const saved = localStorage.getItem("dou-u-push-config")
    if (saved) return JSON.parse(saved)
  } catch { /* ignore */ }
  return { scoreThreshold: 0, keywords: [] }
}

export default function HomePage() {
  const [activeChannel, setActiveChannel] = useState<Platform>("aggregate")
  const [isMuted, setIsMuted] = useState(true)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [soundSettingsOpen, setSoundSettingsOpen] = useState(false)
  const [authDialogOpen, setAuthDialogOpen] = useState(false)

  const [tutorialOpen, setTutorialOpen] = useState(false)
  const [isAuthed, setIsAuthed] = useState(true) // Temporarily: all users have full access
  const [aiDenoiseEnabled, setAiDenoiseEnabled] = useState(false)
  const [scoreThreshold, setScoreThreshold] = useState(0)
  const [keywords, setKeywords] = useState<string[]>([])
  const [sidebarWidth, setSidebarWidth] = useState(350)
  const [fontSettings, setFontSettings] = useState<FontSettings>({
    hotListFontSize: 14,
    tweetFontSize: 14,
  })

  // 移动端检测 - 移动端两栏合并为单列时禁用滚动联动
  const isMobile = useIsMobile()

  // 滚动联动相关
  const mainFeedScrollRef = useRef<HTMLDivElement>(null)
  const sidebarScrollRef = useRef<HTMLDivElement>(null)
  const isScrollingSyncRef = useRef(false) // 防止循环触发
  const scrollSyncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null) // 防抖定时器

  // Load persisted state on mount
  useEffect(() => {
    setIsAuthed(getStoredAuth())
    const cfg = getStoredPushConfig()
    setScoreThreshold(cfg.scoreThreshold)
    setKeywords(cfg.keywords)
  }, [])

  // Heartbeat: report to admin backend every 30 seconds
  useEffect(() => {
    function sendHeartbeat() {
      try {
        const auth = localStorage.getItem("dou-u-auth")
        const keyUsed = auth ? JSON.parse(auth).key : "free"
        // Simple fingerprint
        const fp = [navigator.userAgent, navigator.language, screen.width, screen.height].join("|")
        let hash = 0
        for (let i = 0; i < fp.length; i++) hash = ((hash << 5) - hash + fp.charCodeAt(i)) | 0
        const fingerprint = Math.abs(hash).toString(36)

        fetch("/api/admin/heartbeat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            keyUsed,
            page: window.location.pathname,
            fingerprint,
          }),
        }).catch(() => { /* silent */ })
      } catch { /* silent */ }
    }

    sendHeartbeat()
    const interval = setInterval(sendHeartbeat, 30_000)
    return () => clearInterval(interval)
  }, [])

  const handleChannelChange = useCallback((channel: Platform) => {
    setActiveChannel(channel)
  }, [])

  const handleToggleMute = useCallback(() => {
    setIsMuted((prev) => !prev)
  }, [])

  const handleSidebarToggle = useCallback((collapsed: boolean) => {
    setSidebarCollapsed(collapsed)
  }, [])

  const handleToggleAiDenoise = useCallback(() => {
    setAiDenoiseEnabled((prev) => !prev)
  }, [])

  // 滚动联动处理：左侧滚动时同步右侧
  // 移动端两栏合并为单列时自动禁用联动
  const handleMainFeedScroll = useCallback((scrollTop: number, scrollHeight: number, clientHeight: number) => {
    // 移动端或侧边栏收起时禁用联动
    if (isMobile || isScrollingSyncRef.current || sidebarCollapsed) return
    if (!sidebarScrollRef.current) return
    
    // 清除之前的防抖定时器
    if (scrollSyncTimeoutRef.current) {
      clearTimeout(scrollSyncTimeoutRef.current)
    }
    
    isScrollingSyncRef.current = true
    const sidebarEl = sidebarScrollRef.current
    const ratio = scrollTop / (scrollHeight - clientHeight || 1)
    const targetTop = ratio * (sidebarEl.scrollHeight - sidebarEl.clientHeight)
    sidebarEl.scrollTop = targetTop
    
    // 使用防抖避免循环触发
    scrollSyncTimeoutRef.current = setTimeout(() => {
      isScrollingSyncRef.current = false
    }, 50)
  }, [sidebarCollapsed, isMobile])

  // 滚动联动处理：右侧滚动时同步左侧
  // 移动端两栏合并为单列时自动禁用联动
  const handleSidebarScroll = useCallback((scrollTop: number, scrollHeight: number, clientHeight: number) => {
    // 移动端或侧边栏收起时禁用联动
    if (isMobile || isScrollingSyncRef.current || sidebarCollapsed) return
    if (!mainFeedScrollRef.current) return
    
    // 清除之前的防抖定时器
    if (scrollSyncTimeoutRef.current) {
      clearTimeout(scrollSyncTimeoutRef.current)
    }
    
    isScrollingSyncRef.current = true
    const mainEl = mainFeedScrollRef.current
    const ratio = scrollTop / (scrollHeight - clientHeight || 1)
    const targetTop = ratio * (mainEl.scrollHeight - mainEl.clientHeight)
    mainEl.scrollTop = targetTop
    
    // 使用防抖避免循环触发
    scrollSyncTimeoutRef.current = setTimeout(() => {
      isScrollingSyncRef.current = false
    }, 50)
  }, [sidebarCollapsed, isMobile])

  return (
    <div className="min-h-screen bg-background">
      {/* Top Navigation */}
      <TopNav
        activeChannel={activeChannel}
        onChannelChange={handleChannelChange}
        onOpenTutorial={() => setTutorialOpen(true)}
        aiDenoiseEnabled={aiDenoiseEnabled}
        onToggleAiDenoise={handleToggleAiDenoise}
        fontSettings={fontSettings}
        onFontSettingsChange={setFontSettings}
      />

      {/* Main Content Area */}
      <div className="flex">
        {/* News Feed */}
        <div
          className="flex-1 transition-all duration-300"
          style={{ marginRight: sidebarCollapsed ? 0 : `${sidebarWidth}px` }}
          id="main-feed"
        >
          <NewsFeed
            activeChannel={activeChannel}
            aiDenoiseEnabled={aiDenoiseEnabled}
            isAuthed={isAuthed}
            onOpenAuthDialog={() => setAuthDialogOpen(true)}
            scoreThreshold={scoreThreshold}
            keywords={keywords}
            tweetFontSize={fontSettings.tweetFontSize}
            isMuted={isMuted}
            onToggleMute={handleToggleMute}
            scrollRef={mainFeedScrollRef}
            onScroll={handleMainFeedScroll}
          />
        </div>

        {/* Hot Rankings Sidebar */}
        <HotSidebar 
          activeChannel={activeChannel} 
          onToggle={handleSidebarToggle} 
          onWidthChange={setSidebarWidth} 
          isAuthed={isAuthed} 
          hotListFontSize={fontSettings.hotListFontSize}
          scrollRef={sidebarScrollRef}
          onScroll={handleSidebarScroll}
        />
      </div>

      {/* Audio unlock overlay removed */}

      {/* Bottom Ticker Tape */}
      <TickerTape />

      {/* Sound Control Center */}
      <SoundControl
        isOpen={soundSettingsOpen}
        onClose={() => setSoundSettingsOpen(false)}
      />

      {/* Auth Dialog */}
      <AuthDialog
        isOpen={authDialogOpen}
        onClose={() => setAuthDialogOpen(false)}
        onAuth={setIsAuthed}
      />

      {/* Tutorial Dialog */}
      <TutorialDialog
        isOpen={tutorialOpen}
        onClose={() => setTutorialOpen(false)}
      />


    </div>
  )
}
