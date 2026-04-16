"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import useSWR from "swr"

// 后端接口返回的单条数据结构
export interface TrendingDiffItem {
  title: string
  platform: "weibo" | "douyin" | "gzh"
  rank: number
  prevRank: number | null
  rankChange: number
  status: "new" | "top10" | "rising" | null
  url: string
}

// 后端接口返回的完整数据结构
export interface TrendingDiffData {
  lastUpdate: string
  data: {
    all: TrendingDiffItem[]
    weibo: TrendingDiffItem[]
    douyin: TrendingDiffItem[]
    gzh: TrendingDiffItem[]
  }
}

// 获取趋势变化数据 - 通过本地API代理路由请求，避免HTTPS页面请求HTTP资源产生混合内容错误
async function fetchTrendingDiff(): Promise<TrendingDiffData | null> {
  try {
    // 使用本地代理路由，不直接请求 http://1.12.248.87:3003
    const res = await fetch("/api/trending/diff", {
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data as TrendingDiffData
  } catch (e) {
    console.error("Failed to fetch trending diff:", e)
    return null
  }
}

// 全局状态管理 hook
export function useTrendingDiff() {
  const { data, isValidating, mutate } = useSWR<TrendingDiffData | null>(
    "trending-diff",
    fetchTrendingDiff,
    {
      refreshInterval: 60 * 1000, // 每分钟拉取，与后端「近10分钟窗口」快照对齐
      revalidateOnFocus: true,
      dedupingInterval: 15 * 1000,
    }
  )

  const refresh = useCallback(() => {
    mutate()
  }, [mutate])

  return {
    data,
    isLoading: isValidating,
    lastUpdate: data?.lastUpdate || null,
    all: data?.data?.all || [],
    weibo: data?.data?.weibo || [],
    douyin: data?.data?.douyin || [],
    gzh: data?.data?.gzh || [],
    refresh,
  }
}

// 用于匹配热搜标题获取趋势状态的辅助函数
export function getTrendingStatus(
  title: string,
  platform: "weibo" | "douyin" | "gzh" | "gongzhonghao",
  diffData: TrendingDiffData | null
): {
  status: "new" | "top10" | "rising" | null
  rankChange: number
  prevRank: number | null
} {
  if (!diffData) return { status: null, rankChange: 0, prevRank: null }

  // 平台映射
  const platformKey = platform === "gongzhonghao" ? "gzh" : platform
  const platformList = diffData.data[platformKey] || []

  // 按标题匹配
  const match = platformList.find(item => item.title === title)
  if (!match) return { status: null, rankChange: 0, prevRank: null }

  return {
    status: match.status,
    rankChange: match.rankChange,
    prevRank: match.prevRank,
  }
}
