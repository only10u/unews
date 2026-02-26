import { NextRequest, NextResponse } from "next/server"

/**
 * Server-side image proxy to bypass anti-hotlink protections (Weibo, WeChat, Douyin).
 * Usage: /api/proxy/image?url=<encoded_original_url>
 * 
 * Features:
 * - Auto-detects platform from URL domain and sets correct Referer
 * - Mobile User-Agent for better compatibility
 * - 8-second timeout
 * - 1-hour client cache
 */

// Mobile Safari User-Agent for best compatibility with Chinese platforms
const MOBILE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1"

// Accept header for images
const ACCEPT_HEADER = "image/webp,image/apng,image/*,*/*;q=0.8"

/**
 * Get the correct Referer based on the image URL domain
 */
function getRefererForUrl(url: string): string {
  const lowerUrl = url.toLowerCase()
  
  // Weibo / Sina
  if (lowerUrl.includes("sinaimg.cn") || lowerUrl.includes("weibo.com") || lowerUrl.includes("sina.com")) {
    return "https://weibo.com"
  }
  
  // Douyin / TikTok
  if (lowerUrl.includes("douyinpic.com") || lowerUrl.includes("douyin.com") || lowerUrl.includes("tiktokcdn.com") || lowerUrl.includes("bytedance")) {
    return "https://www.douyin.com"
  }
  
  // WeChat / QQ
  if (lowerUrl.includes("mmbiz.qpic.cn") || lowerUrl.includes("wx.qq.com") || lowerUrl.includes("weixin.qq.com")) {
    return "https://mp.weixin.qq.com"
  }
  
  // Default: Weibo (most permissive)
  return "https://weibo.com"
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url")
  
  if (!url) {
    return new NextResponse("Missing url parameter", { status: 400 })
  }

  let decoded: string
  try {
    decoded = decodeURIComponent(url)
  } catch {
    console.error("[proxy/image] Failed to decode URL:", url)
    return new NextResponse("Invalid URL encoding", { status: 400 })
  }

  // Validate URL format
  try {
    new URL(decoded)
  } catch {
    console.error("[proxy/image] Invalid URL format:", decoded)
    return new NextResponse("Invalid URL format", { status: 400 })
  }

  const referer = getRefererForUrl(decoded)

  try {
    // AbortController for 8-second timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000)

    const res = await fetch(decoded, {
      headers: {
        "User-Agent": MOBILE_UA,
        "Referer": referer,
        "Accept": ACCEPT_HEADER,
        "Cache-Control": "no-cache",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      },
      signal: controller.signal,
      // Don't follow redirects automatically for debugging
      redirect: "follow",
    })

    clearTimeout(timeoutId)

    if (!res.ok) {
      console.error("[proxy/image] Upstream returned error:", {
        url: decoded.substring(0, 100),
        status: res.status,
        statusText: res.statusText,
        referer,
      })
      return new NextResponse(`Upstream error: ${res.status}`, { status: 502 })
    }

    const contentType = res.headers.get("content-type") || "image/jpeg"
    const buffer = await res.arrayBuffer()

    // Check if we got actual image data
    if (buffer.byteLength < 100) {
      console.error("[proxy/image] Response too small, likely blocked:", {
        url: decoded.substring(0, 100),
        bytes: buffer.byteLength,
        referer,
      })
      return new NextResponse("Response too small", { status: 502 })
    }

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": buffer.byteLength.toString(),
        "Cache-Control": "public, max-age=3600",
        "Access-Control-Allow-Origin": "*",
        "X-Proxy-Referer": referer, // Debug header
      },
    })
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Unknown error"
    console.error("[proxy/image] Proxy fetch failed:", {
      url: decoded.substring(0, 100),
      error: errMsg,
      referer,
    })
    return new NextResponse(`Proxy fetch failed: ${errMsg}`, { status: 502 })
  }
}
