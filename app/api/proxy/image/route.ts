import { NextRequest, NextResponse } from "next/server"

/**
 * Server-side image proxy to bypass anti-hotlink protections (Weibo, WeChat, Douyin).
 * Usage: /api/proxy/image?url=<encoded_original_url>
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url")
  if (!url) return new NextResponse("Missing url parameter", { status: 400 })

  try {
    const decoded = decodeURIComponent(url)
    const res = await fetch(decoded, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Referer": new URL(decoded).origin + "/",
        "Accept": "image/*,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(8000),
    })

    if (!res.ok) return new NextResponse("Upstream error", { status: 502 })

    const contentType = res.headers.get("content-type") || "image/jpeg"
    const buffer = await res.arrayBuffer()

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
        "Access-Control-Allow-Origin": "*",
      },
    })
  } catch {
    return new NextResponse("Proxy fetch failed", { status: 502 })
  }
}
