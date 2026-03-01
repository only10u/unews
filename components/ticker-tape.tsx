"use client"

import { useState, useEffect, useCallback } from "react"
import { cn } from "@/lib/utils"
import { PLATFORM_ICONS } from "@/lib/mock-data"
import { TrendingUp, TrendingDown, Activity } from "lucide-react"
import Image from "next/image"
import Link from "next/link"

interface CryptoPriceData {
  symbol: string
  name: string
  price: number
  change24h: number
  change1h?: number
}

const FALLBACK_PRICES: CryptoPriceData[] = [
  { symbol: "BTC", name: "Bitcoin", price: 102345.67, change24h: 5.23 },
  { symbol: "ETH", name: "Ethereum", price: 3890.12, change24h: 3.45 },
  { symbol: "SOL", name: "Solana", price: 187.89, change24h: 8.12 },
  { symbol: "BNB", name: "BNB", price: 645.32, change24h: -1.23 },
]

export function TickerTape() {
  const [prices, setPrices] = useState<CryptoPriceData[]>(FALLBACK_PRICES)

  const fetchPrices = useCallback(async () => {
    try {
      const res = await fetch("/api/crypto/prices")
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data) && data.length > 0) {
          setPrices(data)
        }
      }
    } catch {
      // Keep existing prices on error
    }
  }, [])

  // Initial fetch + refresh every 30 seconds
  useEffect(() => {
    fetchPrices()
    const interval = setInterval(fetchPrices, 30_000)
    return () => clearInterval(interval)
  }, [fetchPrices])

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-50 h-12 bg-background border-t border-border/30">
      <div className="flex items-center justify-between h-full px-4">
        {/* Left: Crypto prices - BTC, ETH, SOL, BNB only */}
        <div className="flex items-center gap-6 overflow-hidden">
          {prices.map((p) => (
            <div key={p.symbol} className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-bold text-foreground">{p.symbol}</span>
              <span className="text-xs font-mono text-foreground/90">
                {"$" + p.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span
                className={cn(
                  "flex items-center gap-0.5 text-[11px] font-medium",
                  p.change24h >= 0 ? "text-emerald-500" : "text-red-500"
                )}
              >
                {p.change24h >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                {p.change24h >= 0 ? "+" : ""}
                {p.change24h.toFixed(2)}%
              </span>

              {/* Exchange links */}
              <div className="flex items-center gap-1 ml-1">
                <a
                  href="https://web3.binance.com/referral?ref=NSRZ08XM"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="opacity-40 hover:opacity-100 transition-opacity"
                  aria-label="币安"
                >
                  <Image
                    src={PLATFORM_ICONS.binance}
                    alt="币安"
                    width={14}
                    height={14}
                    className="rounded-sm"
                    unoptimized
                  />
                </a>
                <a
                  href="https://web3.okx.com/join/10UWINA8"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="opacity-40 hover:opacity-100 transition-opacity"
                  aria-label="欧易"
                >
                  <Image
                    src={PLATFORM_ICONS.okx}
                    alt="欧易"
                    width={14}
                    height={14}
                    className="rounded-sm"
                    unoptimized
                  />
                </a>
              </div>
            </div>
          ))}
        </div>

        {/* Right: Social Links + Price Monitor Button */}
        <div className="flex items-center gap-2 shrink-0 ml-4">
          {/* Social Links */}
          <a
            href="https://x.com/10UWINA8"
            target="_blank"
            rel="noopener noreferrer"
            className="w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
            aria-label="X (Twitter)"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </a>
          <a
            href="https://t.me/wewillwina8"
            target="_blank"
            rel="noopener noreferrer"
            className="w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
            aria-label="Telegram"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
            </svg>
          </a>

          <div className="w-px h-5 bg-border/40" />

          {/* Price Monitor Button */}
          <Link
            href="/price-monitor"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
          >
            <Activity size={13} />
            币价监控
          </Link>
        </div>
      </div>
    </footer>
  )
}
