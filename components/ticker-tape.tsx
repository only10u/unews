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

        {/* Right: Price Monitor Button */}
        <Link
          href="/price-monitor"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors shrink-0 ml-4"
        >
          <Activity size={13} />
          币价监控
        </Link>
      </div>
    </footer>
  )
}
