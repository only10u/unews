"use client"

import { useState, useEffect } from "react"
import { Volume2 } from "lucide-react"
import { unlockAudio, isUnlocked } from "@/lib/audio-engine"

export function AudioUnlockOverlay() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    // Show overlay only if audio wasn't previously unlocked
    if (!isUnlocked()) {
      setShow(true)
    }
  }, [])

  if (!show) return null

  const handleUnlock = () => {
    unlockAudio()
    setShow(false)
  }

  const handleSkip = () => {
    setShow(false)
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background/80 backdrop-blur-sm animate-slide-in">
      <div className="flex flex-col items-center gap-4 p-8 rounded-2xl border border-border bg-card shadow-2xl max-w-sm mx-4 text-center">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <Volume2 size={32} className="text-primary" />
        </div>
        <h2 className="text-lg font-bold text-foreground">开启实时监控提醒</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          启用声音播报后，系统将在检测到新热点、币价异动时发出提示音和语音播报。
        </p>
        <div className="flex gap-3 w-full">
          <button
            onClick={handleSkip}
            className="flex-1 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            稍后再说
          </button>
          <button
            onClick={handleUnlock}
            className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-colors"
          >
            开启声音
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground/60">
          可在右上角声音设置中随时调整
        </p>
      </div>
    </div>
  )
}
