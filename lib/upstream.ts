/**
 * 热点爬虫服务（原 :3001）。与 Next 同机时务必用 127.0.0.1，避免本机 fetch 公网 IP 失败导致接口恒为 []。
 */
function trimBase(url: string) {
  return url.replace(/\/$/, "")
}

export const UPSTREAM_TRENDING_3001 = trimBase(
  process.env.UPSTREAM_TRENDING_3001 ?? "http://127.0.0.1:3001"
)
