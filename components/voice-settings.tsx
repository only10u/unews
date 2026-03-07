"use client"

import { useState, useEffect, useCallback } from "react"
import { cn } from "@/lib/utils"
import {
  X,
  Volume2,
  Play,
  User,
  Settings2,
} from "lucide-react"

// 预设提示音
const SOUND_PRESETS = [
  { id: "voice", label: "人声播报", icon: "🎙️" },
  { id: "ding", label: "滴答", icon: "🔔" },
  { id: "coin", label: "金钱", icon: "💰" },
  { id: "soft", label: "柔和", icon: "🌊" },
  { id: "alert", label: "警报", icon: "🚨" },
  { id: "bubble", label: "气泡", icon: "💬" },
] as const

export type SoundType = typeof SOUND_PRESETS[number]["id"]

export interface VoiceSettings {
  volume: number
  voiceGender: "male" | "female"
  soundType: SoundType
}

interface VoiceSettingsDialogProps {
  isOpen: boolean
  onClose: () => void
  settings: VoiceSettings
  onSettingsChange: (settings: VoiceSettings) => void
  activeChannel: string
  onTest: () => void
}

// 提示音 Web Audio 生成
function playNotificationSound(type: SoundType, volume: number) {
  if (typeof window === "undefined") return
  
  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
  const gainNode = audioCtx.createGain()
  gainNode.gain.value = volume / 100
  gainNode.connect(audioCtx.destination)

  const now = audioCtx.currentTime

  switch (type) {
    case "ding": {
      // 滴答声
      const osc = audioCtx.createOscillator()
      osc.type = "sine"
      osc.frequency.setValueAtTime(880, now)
      osc.frequency.exponentialRampToValueAtTime(440, now + 0.1)
      osc.connect(gainNode)
      osc.start(now)
      osc.stop(now + 0.15)
      break
    }
    case "coin": {
      // 金币声
      const osc1 = audioCtx.createOscillator()
      const osc2 = audioCtx.createOscillator()
      osc1.type = "sine"
      osc2.type = "sine"
      osc1.frequency.setValueAtTime(1200, now)
      osc2.frequency.setValueAtTime(1500, now)
      osc1.connect(gainNode)
      osc2.connect(gainNode)
      osc1.start(now)
      osc2.start(now + 0.05)
      osc1.stop(now + 0.1)
      osc2.stop(now + 0.15)
      break
    }
    case "soft": {
      // 柔和提示
      const osc = audioCtx.createOscillator()
      osc.type = "sine"
      osc.frequency.setValueAtTime(523, now)
      const envGain = audioCtx.createGain()
      envGain.gain.setValueAtTime(0, now)
      envGain.gain.linearRampToValueAtTime(volume / 100, now + 0.1)
      envGain.gain.linearRampToValueAtTime(0, now + 0.5)
      osc.connect(envGain)
      envGain.connect(audioCtx.destination)
      osc.start(now)
      osc.stop(now + 0.5)
      break
    }
    case "alert": {
      // 警报声
      const osc = audioCtx.createOscillator()
      osc.type = "square"
      osc.frequency.setValueAtTime(800, now)
      osc.frequency.setValueAtTime(600, now + 0.1)
      osc.frequency.setValueAtTime(800, now + 0.2)
      osc.connect(gainNode)
      osc.start(now)
      osc.stop(now + 0.3)
      break
    }
    case "bubble": {
      // 气泡声
      const osc = audioCtx.createOscillator()
      osc.type = "sine"
      osc.frequency.setValueAtTime(300, now)
      osc.frequency.exponentialRampToValueAtTime(600, now + 0.1)
      osc.connect(gainNode)
      osc.start(now)
      osc.stop(now + 0.12)
      break
    }
    default:
      break
  }
}

// 语音播报函数
export function speakText(text: string, settings: VoiceSettings) {
  if (typeof window === "undefined" || !window.speechSynthesis) return

  // 如果不是人声模式，播放提示音
  if (settings.soundType !== "voice") {
    playNotificationSound(settings.soundType, settings.volume)
    return
  }

  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = "zh-CN"
  utterance.rate = 1.0
  utterance.pitch = 1.0
  utterance.volume = settings.volume / 100

  // 获取声音列表
  const voices = window.speechSynthesis.getVoices()
  
  // 根据性别选择声音
  const zhVoices = voices.filter(v => v.lang.includes("zh"))
  
  if (settings.voiceGender === "female") {
    // 优先选择女声
    const femaleVoice = zhVoices.find(v => 
      v.name.includes("Female") || 
      v.name.includes("女") || 
      v.name.includes("Ting-Ting") ||
      v.name.includes("Mei-Jia") ||
      v.name.includes("Google") // Google中文通常是女声
    ) || zhVoices[0]
    if (femaleVoice) utterance.voice = femaleVoice
  } else {
    // 优先选择男声
    const maleVoice = zhVoices.find(v => 
      v.name.includes("Male") || 
      v.name.includes("男") ||
      v.name.includes("Yu-Shu")
    ) || zhVoices[1] || zhVoices[0]
    if (maleVoice) utterance.voice = maleVoice
  }

  window.speechSynthesis.speak(utterance)
}

export function VoiceSettingsDialog({
  isOpen,
  onClose,
  settings,
  onSettingsChange,
  activeChannel,
  onTest,
}: VoiceSettingsDialogProps) {
  const [localSettings, setLocalSettings] = useState<VoiceSettings>(settings)

  useEffect(() => {
    setLocalSettings(settings)
  }, [settings])

  const handleSave = useCallback(() => {
    onSettingsChange(localSettings)
    onClose()
  }, [localSettings, onSettingsChange, onClose])

  const handleTest = useCallback(() => {
    const platformLabel = 
      activeChannel === "weibo" ? "微博" :
      activeChannel === "douyin" ? "抖音" :
      activeChannel === "gongzhonghao" ? "公众号" : "热搜"
    
    if (localSettings.soundType === "voice") {
      speakText(`${platformLabel}新消息`, localSettings)
    } else {
      playNotificationSound(localSettings.soundType, localSettings.volume)
    }
    onTest()
  }, [activeChannel, localSettings, onTest])

  const handlePreviewSound = useCallback((soundType: SoundType) => {
    if (soundType === "voice") {
      speakText("测试语音", { ...localSettings, soundType: "voice" })
    } else {
      playNotificationSound(soundType, localSettings.volume)
    }
  }, [localSettings])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Dialog */}
      <div className="relative w-full max-w-md mx-4 bg-card border border-border rounded-xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Settings2 size={18} className="text-primary" />
            <h3 className="font-bold text-foreground">语音设置</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-accent transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-6">
          {/* 音量调节 */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              音量: {localSettings.volume}%
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={localSettings.volume}
              onChange={(e) => setLocalSettings({ ...localSettings, volume: parseInt(e.target.value) })}
              className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
            />
          </div>

          {/* 提示音类型 */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-3">
              提示音类型
            </label>
            <div className="grid grid-cols-3 gap-2">
              {SOUND_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => {
                    setLocalSettings({ ...localSettings, soundType: preset.id })
                    handlePreviewSound(preset.id)
                  }}
                  className={cn(
                    "flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-all",
                    localSettings.soundType === preset.id
                      ? "bg-primary/10 border-primary text-primary"
                      : "bg-secondary/50 border-border hover:border-primary/50"
                  )}
                >
                  <span className="text-xl">{preset.icon}</span>
                  <span className="text-xs font-medium">{preset.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 人声设置（仅在选择人声时显示） */}
          {localSettings.soundType === "voice" && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-3">
                声音性别
              </label>
              <div className="flex gap-3">
                <button
                  onClick={() => setLocalSettings({ ...localSettings, voiceGender: "female" })}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border transition-all",
                    localSettings.voiceGender === "female"
                      ? "bg-pink-500/10 border-pink-500 text-pink-500"
                      : "bg-secondary/50 border-border hover:border-pink-500/50"
                  )}
                >
                  <User size={16} />
                  <span className="font-medium">女声</span>
                </button>
                <button
                  onClick={() => setLocalSettings({ ...localSettings, voiceGender: "male" })}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border transition-all",
                    localSettings.voiceGender === "male"
                      ? "bg-blue-500/10 border-blue-500 text-blue-500"
                      : "bg-secondary/50 border-border hover:border-blue-500/50"
                  )}
                >
                  <User size={16} />
                  <span className="font-medium">男声</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-border">
          <button
            onClick={handleTest}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary text-foreground hover:bg-accent transition-colors"
          >
            <Play size={14} />
            测试
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
