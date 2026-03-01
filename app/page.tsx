"use client"

import { useState, useCallback, useEffect } from "react"
import { type Platform } from "@/lib/mock-data"
import { TopNav } from "@/components/top-nav"
import { NewsFeed } from "@/components/news-feed"
import { HotSidebar } from "@/components/hot-sidebar"
import { TickerTape } from "@/components/ticker-tape"
import { SoundControl } from "@/components/sound-control"
import { AuthDialog } from "@/components/auth-dialog"
import { PushConfig } from "@/components/push-config"
import { AudioUnlockOverlay } from "@/components/audio-unlock-overlay"
import { TutorialDialog } from "@/components/tutorial-dialog"

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
  const [pushConfigOpen, setPushConfigOpen] = useState(false)
  const [tutorialOpen, setTutorialOpen] = useState(false)
  const [isAuthed, setIsAuthed] = useState(true) // Temporarily: all users have full access
  const [aiSummaryEnabled, setAiSummaryEnabled] = useState(false)
  const [scoreThreshold, setScoreThreshold] = useState(0)
  const [keywords, setKeywords] = useState<string[]>([])
  const [sidebarWidth, setSidebarWidth] = useState(350)

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

  const handleToggleAiSummary = useCallback(() => {
    setAiSummaryEnabled((prev) => !prev)
  }, [])

  return (
    <div className="min-h-screen bg-background">
      {/* Top Navigation */}
      <TopNav
        activeChannel={activeChannel}
        onChannelChange={handleChannelChange}
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
        onOpenSoundSettings={() => setSoundSettingsOpen(true)}
        onOpenAuthDialog={() => setAuthDialogOpen(true)}
        onOpenPushConfig={() => setPushConfigOpen(true)}
        onOpenTutorial={() => setTutorialOpen(true)}
        aiSummaryEnabled={aiSummaryEnabled}
        onToggleAiSummary={handleToggleAiSummary}
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
            aiSummaryEnabled={aiSummaryEnabled}
            isAuthed={isAuthed}
            onOpenAuthDialog={() => setAuthDialogOpen(true)}
            scoreThreshold={scoreThreshold}
            keywords={keywords}
          />
        </div>

        {/* Hot Rankings Sidebar */}
        <HotSidebar activeChannel={activeChannel} onToggle={handleSidebarToggle} onWidthChange={setSidebarWidth} isAuthed={isAuthed} />
      </div>

      {/* Audio unlock overlay */}
      <AudioUnlockOverlay />

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

      {/* Push Config Dialog */}
      <PushConfig
        isOpen={pushConfigOpen}
        onClose={() => setPushConfigOpen(false)}
        scoreThreshold={scoreThreshold}
        onScoreThresholdChange={setScoreThreshold}
        keywords={keywords}
        onKeywordsChange={setKeywords}
      />
    </div>
  )
}
