/**
 * 热点爬虫上游（默认 :3001）。
 *
 * 环境变量：
 * - UPSTREAM_TRENDING_3001 — 主爬虫基址，默认 http://127.0.0.1:3001
 * - UPSTREAM_TRENDING_ALT — 可选第二套爬虫基址（新爬法）
 * - TRENDING_SOURCE — 取值：
 *   - legacy（默认）— 仅用 UPSTREAM_TRENDING_3001
 *   - alt — 仅用 UPSTREAM_TRENDING_ALT（未配置时回退主站）
 *   - alt_fallback — 先请求 ALT，非 2xx 或抛错则回退主站
 * - TRENDING_ENRICH — 设为 1 或 true 时，在榜单映射后再请求 GET /api/enrich/{weibo|douyin|gzh} 合并深度字段
 * - UPSTREAM_ENRICH_BASE — 可选；仅「深度合并」请求使用该基址；不设置则与 fetchTrendingPath 同源（同一套 alt/legacy 逻辑）
 */

function trimBase(url: string) {
  return url.replace(/\/$/, "")
}

export const UPSTREAM_TRENDING_3001 = trimBase(
  process.env.UPSTREAM_TRENDING_3001 ?? "http://127.0.0.1:3001"
)

/** 第二套爬虫；未设置则为 null */
export const UPSTREAM_TRENDING_ALT = process.env.UPSTREAM_TRENDING_ALT?.trim()
  ? trimBase(process.env.UPSTREAM_TRENDING_ALT.trim())
  : null

/** 是否开启「增强/深度」合并（GET /api/enrich/{platform}） */
export const TRENDING_ENRICH =
  process.env.TRENDING_ENRICH === "1" ||
  process.env.TRENDING_ENRICH === "true"

/** 深度接口专用基址；未设置则 enrich 与主榜单走同一套上游切换 */
export const UPSTREAM_ENRICH_BASE = process.env.UPSTREAM_ENRICH_BASE?.trim()
  ? trimBase(process.env.UPSTREAM_ENRICH_BASE.trim())
  : null

export type TrendingSourceMode = "legacy" | "alt" | "alt_fallback"

function normalizeTrendingSource(): TrendingSourceMode {
  const raw = (process.env.TRENDING_SOURCE ?? "legacy").toLowerCase()
  if (raw === "alt" || raw === "alt_fallback") return raw
  return "legacy"
}

function joinUrl(base: string, path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`
  return `${trimBase(base)}${p}`
}

/**
 * 按 TRENDING_SOURCE 请求上游路径（path 以 / 开头，如 /api/trending/weibo）。
 * alt_fallback：先 ALT，失败再主站。
 */
export async function fetchTrendingPath(
  path: string,
  init?: RequestInit
): Promise<Response> {
  const mode = normalizeTrendingSource()
  const alt = UPSTREAM_TRENDING_ALT

  if (mode === "legacy" || !alt) {
    return fetch(joinUrl(UPSTREAM_TRENDING_3001, path), init)
  }

  if (mode === "alt") {
    return fetch(joinUrl(alt, path), init)
  }

  // alt_fallback
  try {
    const res = await fetch(joinUrl(alt, path), init)
    if (res.ok) return res
  } catch {
    /* fallback */
  }
  return fetch(joinUrl(UPSTREAM_TRENDING_3001, path), init)
}

/**
 * 深度合并接口：优先 UPSTREAM_ENRICH_BASE；否则与 fetchTrendingPath 相同（含 alt_fallback）。
 */
export async function fetchEnrichPath(
  path: string,
  init?: RequestInit
): Promise<Response> {
  if (UPSTREAM_ENRICH_BASE) {
    return fetch(joinUrl(UPSTREAM_ENRICH_BASE, path), init)
  }
  return fetchTrendingPath(path, init)
}
