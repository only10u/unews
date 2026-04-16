import { NextResponse } from "next/server"
import { fetchTrendingPath } from "@/lib/upstream"

export const dynamic = "force-dynamic"

/**
 * 近 12 小时升幅 TOP10：优先代理上游；否则用 diff 快照中「上升幅度」最大的 10 条作为近似。
 */
export async function GET() {
  const candidates = [
    "/api/trending/rise12h",
    "/api/trending/surge12h",
    "/trending/rise12h",
  ]

  for (const path of candidates) {
    try {
      const res = await fetchTrendingPath(path, {
        cache: "no-store",
        signal: AbortSignal.timeout(12_000),
      })
      if (!res.ok) continue
      const j = await res.json()
      if (Array.isArray(j?.items)) {
        return NextResponse.json({
          items: j.items.slice(0, 10),
          lastUpdate: j.lastUpdate ?? null,
          source: "upstream_rise12h",
        })
      }
      if (Array.isArray(j?.data)) {
        return NextResponse.json({
          items: j.data.slice(0, 10),
          lastUpdate: j.lastUpdate ?? null,
          source: "upstream_rise12h",
        })
      }
    } catch {
      /* try next */
    }
  }

  try {
    const res = await fetchTrendingPath("/api/trending/diff", {
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    })
    if (!res.ok) {
      return NextResponse.json({ items: [], lastUpdate: null, source: "empty" })
    }
    const data = await res.json()
    const all: unknown[] = data?.data?.all ?? []
    const top = [...all]
      .filter(
        (x) =>
          typeof x === "object" &&
          x !== null &&
          "rankChange" in x &&
          typeof (x as { rankChange?: number }).rankChange === "number" &&
          ((x as { rankChange: number }).rankChange ?? 0) > 0
      )
      .sort(
        (a, b) =>
          Math.abs((b as { rankChange?: number }).rankChange ?? 0) -
          Math.abs((a as { rankChange?: number }).rankChange ?? 0)
      )
      .slice(0, 10)

    return NextResponse.json({
      items: top,
      lastUpdate: data?.lastUpdate ?? null,
      source: "diff_rankChange_fallback",
    })
  } catch (e) {
    return NextResponse.json({
      items: [],
      lastUpdate: null,
      source: "error",
      error: String(e),
    })
  }
}
