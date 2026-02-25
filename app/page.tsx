"use client"

import { useState, useCallback, useEffect } from "react"
import { cn } from "@/lib/utils"
import { type Platform } from "@/lib/mock-data"
import { TopNav } from "@/components/top-nav"
import { NewsFeed } from "@/components/news-feed"
import { HotSidebar } from "@/components/hot-sidebar"
import { TickerTape } from "@/components/ticker-tape"
import { SoundControl } from "@/components/sound-control"
import { AuthDialog } from "@/components/auth-dialog"
import { PushConfig } from "@/components/push-config"

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
  const [isAuthed, setIsAuthed] = useState(false)
  const [aiSummaryEnabled, setAiSummaryEnabled] = useState(false)
  const [scoreThreshold, setScoreThreshold] = useState(0)
  const [keywords, setKeywords] = useState<string[]>([])

  // Load persisted state on mount
  useEffect(() => {
    setIsAuthed(getStoredAuth())
    const cfg = getStoredPushConfig()
    setScoreThreshold(cfg.scoreThreshold)
    setKeywords(cfg.keywords)
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
        aiSummaryEnabled={aiSummaryEnabled}
        onToggleAiSummary={handleToggleAiSummary}
      />

      {/* Main Content Area */}
      <div className="flex">
        {/* News Feed */}
        <div
          className={cn(
            "flex-1 transition-all duration-300",
            sidebarCollapsed ? "mr-0" : "mr-[350px]"
          )}
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
        <HotSidebar activeChannel={activeChannel} onToggle={handleSidebarToggle} />
      </div>

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
