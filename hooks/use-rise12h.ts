"use client"

import useSWR from "swr"
import type { TrendingDiffItem } from "@/hooks/use-trending-diff"

interface Rise12hPayload {
  items: TrendingDiffItem[]
  lastUpdate: string | null
  source?: string
}

async function fetchRise12h(): Promise<Rise12hPayload> {
  const res = await fetch("/api/trending/rise12h", {
    signal: AbortSignal.timeout(12_000),
  })
  if (!res.ok) return { items: [], lastUpdate: null }
  return (await res.json()) as Rise12hPayload
}

export function useRise12h() {
  const { data, isValidating, mutate } = useSWR("trending-rise12h", fetchRise12h, {
    refreshInterval: 5 * 60 * 1000,
    revalidateOnFocus: true,
    dedupingInterval: 30 * 1000,
  })

  return {
    items: data?.items ?? [],
    lastUpdate: data?.lastUpdate ?? null,
    source: data?.source,
    isLoading: isValidating,
    refresh: mutate,
  }
}
