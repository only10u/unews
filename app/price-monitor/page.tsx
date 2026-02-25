"use client"

import { useState, useEffect, useCallback } from "react"
import { cn } from "@/lib/utils"
import { PLATFORM_ICONS } from "@/lib/mock-data"
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Bell,
  BellOff,
  Settings,
  Activity,
  Sun,
  Moon,
} from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import Image from "next/image"
import Link from "next/link"
import { useTheme } from "next-themes"

interface CoinData {
  symbol: string
  name: string
  price: number
  change24h: number
  change1h: number
  high24h: number
  low24h: number
  volume24h: number
  marketCap: number
}

const FALLBACK_COINS: CoinData[] = [
  { symbol: "BTC", name: "Bitcoin", price: 102345.67, change24h: 5.23, change1h: 0.82, high24h: 103500, low24h: 97200, volume24h: 42500000000, marketCap: 2010000000000 },
  { symbol: "ETH", name: "Ethereum", price: 3890.12, change24h: 3.45, change1h: 1.12, high24h: 3950, low24h: 3720, volume24h: 18900000000, marketCap: 468000000000 },
  { symbol: "SOL", name: "Solana", price: 187.89, change24h: 8.12, change1h: 2.34, high24h: 195, low24h: 172, volume24h: 5600000000, marketCap: 82000000000 },
  { symbol: "BNB", name: "BNB", price: 645.32, change24h: -1.23, change1h: -0.45, high24h: 658, low24h: 635, volume24h: 2100000000, marketCap: 96000000000 },
]

interface AlertConfig {
  symbol: string
  enabled: boolean
  period: string
  threshold: number
}

export default function PriceMonitorPage() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [coins, setCoins] = useState<CoinData[]>(FALLBACK_COINS)
  const [alerts, setAlerts] = useState<AlertConfig[]>([
    { symbol: "BTC", enabled: true, period: "1h", threshold: 5 },
    { symbol: "ETH", enabled: true, period: "1h", threshold: 5 },
    { symbol: "SOL", enabled: false, period: "1h", threshold: 5 },
    { symbol: "BNB", enabled: false, period: "1h", threshold: 5 },
  ])
  const [showSettings, setShowSettings] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  useEffect(() => {
    setMounted(true)
    // Load alert settings from localStorage
    const saved = localStorage.getItem("dou-u-price-alerts")
    if (saved) {
      try {
        setAlerts(JSON.parse(saved))
      } catch { /* ignore */ }
    }
  }, [])

  // Save alerts to localStorage
  useEffect(() => {
    if (mounted) {
      localStorage.setItem("dou-u-price-alerts", JSON.stringify(alerts))
    }
  }, [alerts, mounted])

  const fetchPrices = useCallback(async () => {
    try {
      const res = await fetch("/api/crypto/prices")
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data) && data.length > 0) {
          setCoins(data.map((d: CoinData) => ({
            symbol: d.symbol,
            name: d.name,
            price: d.price,
            change24h: d.change24h ?? 0,
            change1h: d.change1h ?? 0,
            high24h: d.high24h ?? d.price * 1.02,
            low24h: d.low24h ?? d.price * 0.98,
            volume24h: d.volume24h ?? 0,
            marketCap: d.marketCap ?? 0,
          })))
          setLastUpdated(new Date())
        }
      }
    } catch { /* keep existing */ }
  }, [])

  // Fetch real prices every 30 seconds
  useEffect(() => {
    fetchPrices()
    const interval = setInterval(fetchPrices, 30_000)
    return () => clearInterval(interval)
  }, [fetchPrices])

  const updateAlert = (symbol: string, updates: Partial<AlertConfig>) => {
    setAlerts((prev) =>
      prev.map((a) => (a.symbol === symbol ? { ...a, ...updates } : a))
    )
  }

  const PERIODS = ["1m", "15m", "30m", "1h", "6h", "12h", "24h"]

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-border/50">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
            >
              <ArrowLeft size={18} />
            </Link>
            <div className="flex items-center gap-2">
              <Activity size={18} className="text-primary" />
              <h1 className="text-foreground font-bold text-lg">币价监控中心</h1>
            </div>
            {lastUpdated && (
              <span className="text-[10px] text-muted-foreground ml-2">
                {"更新于 " + lastUpdated.toLocaleTimeString("zh-CN")}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {mounted && (
              <button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
              >
                {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
              </button>
            )}
            <Link
              href="/"
              className="px-3 py-1.5 rounded-md bg-secondary text-secondary-foreground text-xs font-medium hover:bg-accent transition-colors"
            >
              返回首页
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto p-4 space-y-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {coins.map((coin) => {
            const alert = alerts.find((a) => a.symbol === coin.symbol)
            return (
              <div
                key={coin.symbol}
                className="p-4 rounded-xl bg-card border border-border/50 relative"
              >
                {alert?.enabled && (
                  <div className="absolute top-3 right-3">
                    <Bell size={12} className="text-primary" />
                  </div>
                )}

                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg font-bold text-foreground">{coin.symbol}</span>
                  <span className="text-xs text-muted-foreground">{coin.name}</span>
                </div>

                <div className="text-2xl font-bold font-mono text-foreground mb-2">
                  {"$" + coin.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "flex items-center gap-0.5 text-sm font-medium",
                      coin.change1h >= 0 ? "text-emerald-500" : "text-red-500"
                    )}
                  >
                    {coin.change1h >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {coin.change1h >= 0 ? "+" : ""}{coin.change1h.toFixed(2)}%
                    <span className="text-[10px] text-muted-foreground ml-0.5">1h</span>
                  </span>
                  <span
                    className={cn(
                      "flex items-center gap-0.5 text-sm font-medium",
                      coin.change24h >= 0 ? "text-emerald-500" : "text-red-500"
                    )}
                  >
                    {coin.change24h >= 0 ? "+" : ""}{coin.change24h.toFixed(2)}%
                    <span className="text-[10px] text-muted-foreground ml-0.5">24h</span>
                  </span>
                </div>

                {/* Quick links */}
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/30">
                  <a
                    href="https://web3.binance.com/referral?ref=NSRZ08XM"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Image src={PLATFORM_ICONS.binance} alt="币安" width={14} height={14} className="rounded-sm" unoptimized />
                    币安
                  </a>
                  <a
                    href="https://web3.okx.com/join/10UWINA8"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Image src={PLATFORM_ICONS.okx} alt="欧易" width={14} height={14} className="rounded-sm" unoptimized />
                    欧易
                  </a>
                  <button
                    onClick={() => setShowSettings(showSettings === coin.symbol ? null : coin.symbol)}
                    className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors"
                  >
                    <Settings size={11} />
                    报警设置
                  </button>
                </div>

                {/* Alert Settings Expanded */}
                {showSettings === coin.symbol && alert && (
                  <div className="mt-3 p-3 rounded-lg bg-secondary/50 border border-border/30 space-y-3 animate-slide-in">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-foreground font-medium">启用报警</span>
                      <Switch
                        checked={alert.enabled}
                        onCheckedChange={(v) => updateAlert(coin.symbol, { enabled: v })}
                      />
                    </div>

                    {alert.enabled && (
                      <>
                        <div>
                          <span className="text-[10px] text-muted-foreground block mb-1.5">监控周期</span>
                          <div className="flex flex-wrap gap-1">
                            {PERIODS.map((p) => (
                              <button
                                key={p}
                                onClick={() => updateAlert(coin.symbol, { period: p })}
                                className={cn(
                                  "px-2 py-0.5 rounded text-[10px] transition-colors",
                                  alert.period === p
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-accent text-muted-foreground"
                                )}
                              >
                                {p}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground w-14">波动阈值</span>
                          <Slider
                            value={[alert.threshold]}
                            onValueChange={([v]) => updateAlert(coin.symbol, { threshold: v })}
                            min={1}
                            max={50}
                            step={1}
                            className="flex-1"
                          />
                          <span className="text-[10px] font-mono text-foreground w-8 text-right">{alert.threshold}%</span>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Detailed Table */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border/50">
            <h2 className="text-sm font-bold text-foreground">详细数据</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-[11px] text-muted-foreground border-b border-border/30">
                  <th className="px-4 py-2 text-left font-medium">币种</th>
                  <th className="px-4 py-2 text-right font-medium">价格</th>
                  <th className="px-4 py-2 text-right font-medium">1h涨跌</th>
                  <th className="px-4 py-2 text-right font-medium">24h涨跌</th>
                  <th className="px-4 py-2 text-right font-medium">24h最高</th>
                  <th className="px-4 py-2 text-right font-medium">24h最低</th>
                  <th className="px-4 py-2 text-right font-medium">24h成交量</th>
                  <th className="px-4 py-2 text-right font-medium">市值</th>
                  <th className="px-4 py-2 text-center font-medium">报警</th>
                </tr>
              </thead>
              <tbody>
                {coins.map((coin) => {
                  const alert = alerts.find((a) => a.symbol === coin.symbol)
                  return (
                    <tr key={coin.symbol} className="border-b border-border/20 hover:bg-accent/20 transition-colors">
                      <td className="px-4 py-3 text-sm font-bold text-foreground">{coin.symbol}</td>
                      <td className="px-4 py-3 text-sm font-mono text-foreground text-right">
                        {"$" + coin.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className={cn("px-4 py-3 text-sm font-mono text-right", coin.change1h >= 0 ? "text-emerald-500" : "text-red-500")}>
                        {coin.change1h >= 0 ? "+" : ""}{coin.change1h.toFixed(2)}%
                      </td>
                      <td className={cn("px-4 py-3 text-sm font-mono text-right", coin.change24h >= 0 ? "text-emerald-500" : "text-red-500")}>
                        {coin.change24h >= 0 ? "+" : ""}{coin.change24h.toFixed(2)}%
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-foreground/80 text-right">
                        {"$" + coin.high24h.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-foreground/80 text-right">
                        {"$" + coin.low24h.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-foreground/80 text-right">
                        {"$" + (coin.volume24h / 1e9).toFixed(1) + "B"}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-foreground/80 text-right">
                        {"$" + (coin.marketCap / 1e9).toFixed(0) + "B"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => updateAlert(coin.symbol, { enabled: !alert?.enabled })}
                          className={cn(
                            "w-7 h-7 rounded-md flex items-center justify-center transition-colors mx-auto",
                            alert?.enabled
                              ? "text-primary bg-primary/10"
                              : "text-muted-foreground hover:text-foreground hover:bg-accent"
                          )}
                        >
                          {alert?.enabled ? <Bell size={13} /> : <BellOff size={13} />}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Info */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-bold text-foreground mb-2">使用说明</h3>
          <ul className="space-y-1.5 text-xs text-muted-foreground">
            <li>币价数据通过 CoinGecko API 获取，每30秒自动刷新</li>
            <li>点击每个币种卡片的"报警设置"可自定义异动报警规则</li>
            <li>报警触发时会通过声音提示（需在首页声音控制中心开启）</li>
            <li>上涨超过阈值播放金币碰撞音，暴跌播放紧急报警音</li>
            <li>此页面为免费功能，无需密钥即可使用</li>
          </ul>
        </div>
      </main>
    </div>
  )
}
