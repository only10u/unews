"use client"

import { useState, useEffect, useCallback } from "react"
import { cn } from "@/lib/utils"
import { PLATFORM_ICONS } from "@/lib/mock-data"
import {
  X,
  Volume2,
  VolumeX,
  AlertTriangle,
} from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import Image from "next/image"

// Types
export interface SoundChannelConfig {
  enabled: boolean
  volume: number
  rate: number
  voice: "male" | "female"
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
    aggregate: { enabled: false, volume: 70, rate: 1.0, voice: "female" },
    weibo: { enabled: false, volume: 70, rate: 1.0, voice: "female" },
    douyin: { enabled: false, volume: 70, rate: 1.0, voice: "female" },
    gongzhonghao: { enabled: false, volume: 70, rate: 1.0, voice: "female" },
    price: { enabled: true, volume: 80, rate: 1.0, voice: "male" },
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
    if (saved) return JSON.parse(saved)
  } catch {
    // ignore
  }
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

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
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
        <div className="p-4 space-y-4">
          <h3 className="text-sm font-bold text-foreground mb-2">TTS 播报设置</h3>

          {Object.entries(settings.channels).map(([key, config]) => {
            const info = CHANNEL_LABELS[key]
            return (
              <div key={key} className="p-3 rounded-lg bg-secondary/50 border border-border/30">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {info.icon ? (
                      <Image
                        src={info.icon}
                        alt={info.label}
                        width={20}
                        height={20}
                        className="rounded-sm"
                        unoptimized
                      />
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
                  <div className="space-y-3 pl-1">
                    {/* Voice Selection */}
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

                    {/* Template hint */}
                    <p className="text-[10px] text-muted-foreground/60 italic">
                      {key === "price"
                        ? '播报模板: "币价预警：BTC 在1小时内上涨5.2%"'
                        : `播报模板: "${info.label}新热点：标题内容"`}
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

          <div className="p-3 rounded-lg bg-secondary/50 border border-border/30 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-foreground">启用预警</span>
              <Switch
                checked={settings.priceAlert.enabled}
                onCheckedChange={(v) => updatePriceAlert({ enabled: v })}
              />
            </div>

            {settings.priceAlert.enabled && (
              <>
                {/* Period */}
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

                {/* Threshold */}
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

                {/* Cooldown */}
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

                <div className="text-[10px] text-muted-foreground/60 space-y-1">
                  <p>上涨/金狗提示: 金币碰撞音 (Coin Clink)</p>
                  <p>暴跌/剧烈波动: 紧急报警音 (Alarm)</p>
                  <p>币价报警优先级最高，会打断正在播报的语音</p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer hint */}
        <div className="p-4 border-t border-border/30 text-center">
          <p className="text-[11px] text-muted-foreground">
            请点击页面任意位置以激活浏览器音频权限 (AudioContext)
          </p>
          <p className="text-[10px] text-muted-foreground/60 mt-1">
            所有设置自动保存至本地，刷新后不丢失
          </p>
        </div>
      </div>
    </div>
  )
}
