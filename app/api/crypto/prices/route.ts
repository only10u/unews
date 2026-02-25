import { NextResponse } from "next/server"

// CoinGecko free API - no key required, 30 calls/min rate limit
const COINGECKO_API = "https://api.coingecko.com/api/v3"

const COIN_IDS: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  BNB: "binancecoin",
}

interface CoinGeckoMarketData {
  id: string
  symbol: string
  name: string
  current_price: number
  price_change_percentage_24h: number
  price_change_percentage_1h_in_currency: number
  high_24h: number
  low_24h: number
  total_volume: number
  market_cap: number
  image: string
}

let cache: { data: unknown; timestamp: number } | null = null
const CACHE_TTL = 30_000

export async function GET() {
  const now = Date.now()
  if (cache && now - cache.timestamp < CACHE_TTL) {
    return NextResponse.json(cache.data)
  }

  try {
    const ids = Object.values(COIN_IDS).join(",")
    const res = await fetch(
      `${COINGECKO_API}/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&sparkline=false&price_change_percentage=1h,24h`,
      {
        headers: { Accept: "application/json" },
        next: { revalidate: 30 },
      }
    )

    if (!res.ok) throw new Error(`CoinGecko API error: ${res.status}`)

    const data: CoinGeckoMarketData[] = await res.json()
    const formatted = data.map((coin) => ({
      symbol: coin.symbol.toUpperCase(),
      name: coin.name,
      price: coin.current_price,
      change24h: coin.price_change_percentage_24h ?? 0,
      change1h: coin.price_change_percentage_1h_in_currency ?? 0,
      high24h: coin.high_24h,
      low24h: coin.low_24h,
      volume24h: coin.total_volume,
      marketCap: coin.market_cap,
      image: coin.image,
    }))

    const order = ["BTC", "ETH", "SOL", "BNB"]
    formatted.sort((a, b) => order.indexOf(a.symbol) - order.indexOf(b.symbol))

    cache = { data: formatted, timestamp: now }
    return NextResponse.json(formatted)
  } catch (error) {
    console.error("Failed to fetch crypto prices:", error)
    if (cache) return NextResponse.json(cache.data)

    // Fallback
    return NextResponse.json([
      { symbol: "BTC", name: "Bitcoin", price: 102345.67, change24h: 5.23, change1h: 0.82, high24h: 103500, low24h: 97200, volume24h: 42500000000, marketCap: 2010000000000 },
      { symbol: "ETH", name: "Ethereum", price: 3890.12, change24h: 3.45, change1h: 1.12, high24h: 3950, low24h: 3720, volume24h: 18900000000, marketCap: 468000000000 },
      { symbol: "SOL", name: "Solana", price: 187.89, change24h: 8.12, change1h: 2.34, high24h: 195, low24h: 172, volume24h: 5600000000, marketCap: 82000000000 },
      { symbol: "BNB", name: "BNB", price: 645.32, change24h: -1.23, change1h: -0.45, high24h: 658, low24h: 635, volume24h: 2100000000, marketCap: 96000000000 },
    ])
  }
}
