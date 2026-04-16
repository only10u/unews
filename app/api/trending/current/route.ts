import { NextResponse } from "next/server"
import { fetchTrendingPath } from "@/lib/upstream"

export async function GET() {
  try {
    let res = await fetchTrendingPath("/api/trending/current", {
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
    })
    if (!res.ok) {
      res = await fetchTrendingPath("/trending/current", {
        signal: AbortSignal.timeout(10000),
        cache: "no-store",
      })
    }
    if (!res.ok) {
      return NextResponse.json({ error: `upstream ${res.status}` }, { status: res.status })
    }
    const data = await res.json()
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
