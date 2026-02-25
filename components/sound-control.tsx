"use client"

import { useState, useEffect, useCallback } from "react"
import { cn } from "@/lib/utils"
import { PLATFORM_ICONS } from "@/lib/mock-data"
import {
  X,
  Volume2,
  VolumeX,
  AlertTriangle,
  Mic,
  Music,
} from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import Image from "next/image"
import { playDing, playCoinClink, speakTTS } from "@/lib/audio-engine"

// Types
export interface SoundChannelConfig {
  enabled: boolean
  volume: number
  rate: number
  voice: "male" | "female"
  mode: "tts" | "tone"  // Mode A = TTS, Mode B = tone
}

export interface PriceAlertConfig {
  enabled: boolean
  period: string
  threshold: number
  cooldown: number
}

export interface SoundSettings {
  channels: {
    aggregate: SoundChannelConfig
    weibo: SoundChannelConfig
    douyin: SoundChannelConfig
    gongzhonghao: SoundChannelConfig
    price: SoundChannelConfig
  }
  priceAlert: PriceAlertConfig
}

const DEFAULT_SETTINGS: SoundSettings = {
  channels: {
    aggregate: { enabled: false, volume: 70, rate: 1.0, voice: "female", mode: "tts" },
    weibo: { enabled: false, volume: 70, rate: 1.0, voice: "female", mode: "tts" },
    douyin: { enabled: false, volume: 70, rate: 1.0, voice: "female", mode: "tts" },
    gongzhonghao: { enabled: false, volume: 70, rate: 1.0, voice: "female", mode: "tone" },
    price: { enabled: true, volume: 80, rate: 1.0, voice: "male", mode: "tts" },
  },
  priceAlert: {
    enabled: true,
    period: "1h",
    threshold: 5,
    cooldown: 60,
  },
}

const CHANNEL_LABELS: Record<string, { label: string; icon?: string; desc: string }> = {
  aggregate: { label: "聚合", desc: "全平台热点播报" },
  weibo: { label: "微博", icon: PLATFORM_ICONS.weibo, desc: "微博热搜新词条" },
  douyin: { label: "抖音", icon: PLATFORM_ICONS.douyin, desc: "抖音热搜新词条" },
  gongzhonghao: { label: "公众号", icon: PLATFORM_ICONS.gongzhonghao, desc: "公众号热文推送" },
  price: { label: "币价", desc: "币价异动报警" },
}

const PERIOD_OPTIONS = [
  { value: "1m", label: "1分钟" },
  { value: "15m", label: "15分钟" },
  { value: "30m", label: "30分钟" },
  { value: "1h", label: "1小时" },
  { value: "6h", label: "6小时" },
  { value: "12h", label: "12小时" },
  { value: "24h", label: "24小时" },
]

interface SoundControlProps {
  isOpen: boolean
  onClose: () => void
}

function loadSettings(): SoundSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS
  try {
    const saved = localStorage.getItem("dou-u-sound-settings")
    if (saved) {
      const parsed = JSON.parse(saved)
      // Merge defaults for any missing mode fields
      for (const key of Object.keys(DEFAULT_SETTINGS.channels)) {
        if (parsed.channels?.[key] && !parsed.channels[key].mode) {
          parsed.channels[key].mode = "tts"
        }
      }
      return parsed
    }
  } catch { /* ignore */ }
  return DEFAULT_SETTINGS
}

function saveSettings(settings: SoundSettings) {
  if (typeof window === "undefined") return
  localStorage.setItem("dou-u-sound-settings", JSON.stringify(settings))
}

export function SoundControl({ isOpen, onClose }: SoundControlProps) {
  const [settings, setSettings] = useState<SoundSettings>(DEFAULT_SETTINGS)

  useEffect(() => {
    setSettings(loadSettings())
  }, [])

  const updateChannel = useCallback(
    (key: string, updates: Partial<SoundChannelConfig>) => {
      setSettings((prev) => {
        const newSettings = {
          ...prev,
          channels: {
            ...prev.channels,
            [key]: { ...prev.channels[key as keyof typeof prev.channels], ...updates },
          },
        }
        saveSettings(newSettings)
        return newSettings
      })
    },
    []
  )

  const updatePriceAlert = useCallback(
    (updates: Partial<PriceAlertConfig>) => {
      setSettings((prev) => {
        const newSettings = {
          ...prev,
          priceAlert: { ...prev.priceAlert, ...updates },
        }
        saveSettings(newSettings)
        return newSettings
      })
    },
    []
  )

  const testSound = useCallback((key: string) => {
    const config = settings.channels[key as keyof typeof settings.channels]
    if (!config) return
    const vol = config.volume / 100
    if (config.mode === "tts") {
      const label = CHANNEL_LABELS[key]?.label || key
      speakTTS(`${label}新热点：测试播报内容`, {
        volume: vol,
        rate: config.rate,
        voice: config.voice,
      })
    } else {
      if (key === "price") {
        playCoinClink(vol)
      } else {
        playDing(vol)
      }
    }
  }, [settings])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-xl border border-border bg-card shadow-2xl m-4">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b border-border bg-card rounded-t-xl">
          <div className="flex items-center gap-2">
            <Volume2 size={18} className="text-primary" />
            <h2 className="text-base font-bold text-foreground">声音控制中心</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            aria-label="关闭"
          >
            <X size={16} />
          </button>
        </div>

        {/* Channel Cards */}
        <div className="p-4 flex flex-col gap-4">
          <h3 className="text-sm font-bold text-foreground">分频道声音设置</h3>

          {Object.entries(settings.channels).map(([key, config]) => {
            const info = CHANNEL_LABELS[key]
            return (
              <div key={key} className="p-3 rounded-lg bg-secondary/50 border border-border/30">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {info.icon ? (
                      <Image src={info.icon} alt={info.label} width={20} height={20} className="rounded-sm" unoptimized />
                    ) : key === "price" ? (
                      <AlertTriangle size={18} className="text-primary" />
                    ) : (
                      <Volume2 size={18} className="text-muted-foreground" />
                    )}
                    <div>
                      <span className="text-sm font-bold text-foreground">{info.label}</span>
                      <p className="text-[10px] text-muted-foreground">{info.desc}</p>
                    </div>
                  </div>
                  <Switch
                    checked={config.enabled}
                    onCheckedChange={(v) => updateChannel(key, { enabled: v })}
                  />
                </div>

                {config.enabled && (
                  <div className="flex flex-col gap-3 pl-1">
                    {/* Mode selector: TTS vs Tone */}
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-12">模式</span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => updateChannel(key, { mode: "tts" })}
                          className={cn(
                            "flex items-center gap-1 px-3 py-1 rounded-md text-xs transition-colors",
                            config.mode === "tts"
                              ? "bg-primary text-primary-foreground"
                              : "bg-accent text-muted-foreground hover:text-foreground"
                          )}
                        >
                          <Mic size={10} />
                          TTS语音
                        </button>
                        <button
                          onClick={() => updateChannel(key, { mode: "tone" })}
                          className={cn(
                            "flex items-center gap-1 px-3 py-1 rounded-md text-xs transition-colors",
                            config.mode === "tone"
                              ? "bg-primary text-primary-foreground"
                              : "bg-accent text-muted-foreground hover:text-foreground"
                          )}
                        >
                          <Music size={10} />
                          提示音
                        </button>
                      </div>
                    </div>

                    {/* Voice (only for TTS mode) */}
                    {config.mode === "tts" && (
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-12">语音</span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => updateChannel(key, { voice: "male" })}
                            className={cn(
                              "px-3 py-1 rounded-md text-xs transition-colors",
                              config.voice === "male"
                                ? "bg-primary text-primary-foreground"
                                : "bg-accent text-muted-foreground hover:text-foreground"
                            )}
                          >
                            男声
                          </button>
                          <button
                            onClick={() => updateChannel(key, { voice: "female" })}
                            className={cn(
                              "px-3 py-1 rounded-md text-xs transition-colors",
                              config.voice === "female"
                                ? "bg-primary text-primary-foreground"
                                : "bg-accent text-muted-foreground hover:text-foreground"
                            )}
                          >
                            女声
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Volume */}
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-12">音量</span>
                      <Slider
                        value={[config.volume]}
                        onValueChange={([v]) => updateChannel(key, { volume: v })}
                        max={100}
                        step={5}
                        className="flex-1"
                      />
                      <span className="text-xs text-muted-foreground w-8 text-right">{config.volume}%</span>
                    </div>

                    {/* Rate */}
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-12">语速</span>
                      <Slider
                        value={[config.rate * 100]}
                        onValueChange={([v]) => updateChannel(key, { rate: v / 100 })}
                        min={50}
                        max={200}
                        step={10}
                        className="flex-1"
                      />
                      <span className="text-xs text-muted-foreground w-8 text-right">{config.rate.toFixed(1)}x</span>
                    </div>

                    {/* Test button */}
                    <button
                      onClick={() => testSound(key)}
                      className="self-start flex items-center gap-1 px-3 py-1 rounded-md text-xs bg-accent text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Volume2 size={10} />
                      测试播放
                    </button>

                    <p className="text-[10px] text-muted-foreground/60 italic">
                      {config.mode === "tts"
                        ? (key === "price"
                          ? '播报: "币价预警：BTC 在1小时内上涨5.2%"'
                          : `播报: "检测到[${info.label}]新热点：标题内容"`)
                        : (key === "price" ? '提示音: 金币碰撞声' : '提示音: 清脆叮声')
                      }
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Price Alert Settings */}
        <div className="p-4 border-t border-border/30">
          <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
            <AlertTriangle size={14} className="text-primary" />
            币价异动预警
          </h3>
          <div className="p-3 rounded-lg bg-secondary/50 border border-border/30 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-foreground">启用预警</span>
              <Switch
                checked={settings.priceAlert.enabled}
                onCheckedChange={(v) => updatePriceAlert({ enabled: v })}
              />
            </div>

            {settings.priceAlert.enabled && (
              <>
                <div>
                  <span className="text-xs text-muted-foreground block mb-2">监控周期</span>
                  <div className="flex flex-wrap gap-1.5">
                    {PERIOD_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => updatePriceAlert({ period: opt.value })}
                        className={cn(
                          "px-2.5 py-1 rounded-md text-xs transition-colors",
                          settings.priceAlert.period === opt.value
                            ? "bg-primary text-primary-foreground"
                            : "bg-accent text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-16">波动阈值</span>
                  <Slider
                    value={[settings.priceAlert.threshold]}
                    onValueChange={([v]) => updatePriceAlert({ threshold: v })}
                    min={1}
                    max={50}
                    step={1}
                    className="flex-1"
                  />
                  <span className="text-xs font-mono text-foreground w-10 text-right">
                    {settings.priceAlert.threshold}%
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-16">冷却时间</span>
                  <Slider
                    value={[settings.priceAlert.cooldown]}
                    onValueChange={([v]) => updatePriceAlert({ cooldown: v })}
                    min={10}
                    max={300}
                    step={10}
                    className="flex-1"
                  />
                  <span className="text-xs font-mono text-foreground w-10 text-right">
                    {settings.priceAlert.cooldown}s
                  </span>
                </div>

                <div className="text-[10px] text-muted-foreground/60 flex flex-col gap-1">
                  <p>普通热搜: 温和提示音 (Ding)</p>
                  <p>币价异动 (达阈值): 循环报警音，点击"已读"停止</p>
                  <p>{"金狗 (>9.0): 金币碰撞声，最高优先级"}</p>
                  <p>后台标签页/息屏时声音仍可触发</p>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-border/30 text-center">
          <p className="text-[11px] text-muted-foreground">
            首次访问请点击"开启声音"按钮激活浏览器音频权限
          </p>
          <p className="text-[10px] text-muted-foreground/60 mt-1">
            所有设置自动保存至本地，刷新后不丢失
          </p>
        </div>
      </div>
    </div>
  )
}
