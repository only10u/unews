import { fetchEnrichPath, TRENDING_ENRICH } from "@/lib/upstream"

/**
 * 从上游单条原始对象解析「发布时间」毫秒时间戳（新鲜度排序）。
 * 新爬虫可在任意字段名中提供，此处尽量兼容。
 */
export function parsePublishedMsFromRaw(item: unknown): number | undefined {
  if (!item || typeof item !== "object") return undefined
  const o = item as Record<string, unknown>

  const direct = o.publishedAt
  if (typeof direct === "number") {
    if (direct > 1e12) return direct
    if (direct > 1e9) return direct * 1000
  }

  const keys = [
    "publish_time",
    "publishTime",
    "created_at",
    "createdAt",
    "pubDate",
    "create_time",
    "createTime",
    "send_time",
    "sendTime",
    "article_time",
    "articleTime",
    "datetime",
    "timestamp",
    "update_time",
    "updateTime",
    "date",
    "time",
  ]

  for (const k of keys) {
    const v = o[k]
    if (typeof v === "number") {
      if (v > 1e12) return v
      if (v > 1e9) return v * 1000
    }
    if (typeof v === "string") {
      const p = Date.parse(v)
      if (!Number.isNaN(p)) return p
      const minMatch = v.match(/(\d+)\s*分钟前/)
      if (minMatch) return Date.now() - parseInt(minMatch[1], 10) * 60 * 1000
      const hourMatch = v.match(/(\d+)\s*小时前/)
      if (hourMatch) return Date.now() - parseInt(hourMatch[1], 10) * 60 * 60 * 1000
    }
  }

  const user = o.user as Record<string, unknown> | undefined
  if (user && typeof user === "object") {
    const c = user.created_at ?? user.createdAt
    if (typeof c === "number") return c > 1e12 ? c : c * 1000
  }

  return undefined
}

function pickStr(next: unknown, prev: unknown): string {
  if (typeof next === "string" && next.trim() !== "") return next
  if (typeof prev === "string") return prev
  return ""
}

/** 将深度层字段合并进榜单行（不覆盖为空的旧值） */
function mergeOneRow(row: Record<string, unknown>, e: Record<string, unknown>): Record<string, unknown> {
  const pub = parsePublishedMsFromRaw(e) ?? row.publishedAt
  const u = e.user as Record<string, unknown> | undefined

  return {
    ...row,
    summary: pickStr(
      e.summary ?? e.text ?? e.snippet ?? e.digest ?? e.abstract,
      row.summary
    ),
    detailContent: pickStr(
      e.detailContent ?? e.detail ?? e.full_text ?? e.content_full,
      row.detailContent
    ),
    author: pickStr(
      e.author ?? e.authorName ?? e.nickname ?? u?.screen_name ?? u?.name,
      row.author
    ),
    authorAvatar: pickStr(
      e.authorAvatar ?? e.avatar ?? e.avatar_large ?? u?.profile_image_url,
      row.authorAvatar
    ),
    publishedAt: typeof pub === "number" ? pub : row.publishedAt,
  }
}

/**
 * TRENDING_ENRICH=1 时请求 GET /api/enrich/{platform}，与主榜单按序或按 title 合并。
 * 新爬虫基址需实现该路径；未实现则静默忽略，行为与未开 enrich 一致。
 */
export async function mergeWithEnrichLayer(
  platform: "weibo" | "douyin" | "gzh",
  rows: Record<string, unknown>[]
): Promise<Record<string, unknown>[]> {
  if (!TRENDING_ENRICH || rows.length === 0) return rows

  try {
    const res = await fetchEnrichPath(`/api/enrich/${platform}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) return rows

    const raw = await res.json()
    const extra = Array.isArray(raw) ? raw : (raw as { data?: unknown })?.data
    if (!Array.isArray(extra) || extra.length === 0) return rows

    return rows.map((row, i) => {
      let e = extra[i] as Record<string, unknown> | undefined
      if (!e || typeof e !== "object") {
        e = extra.find(
          (x) =>
            typeof x === "object" &&
            x !== null &&
            String((x as { title?: string }).title) === String(row.title)
        ) as Record<string, unknown> | undefined
      }
      if (!e || typeof e !== "object") return row
      return mergeOneRow(row, e)
    })
  } catch {
    return rows
  }
}
