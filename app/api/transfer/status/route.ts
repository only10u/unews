import { NextRequest, NextResponse } from "next/server"
import { detectPlatform, generateStorageKey, checkExists, getPublicUrl } from "@/lib/r2"

/**
 * GET /api/transfer/status?url={encodedOriginalUrl}
 * Check if a URL has already been transferred to R2
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url")
  
  if (!url) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 })
  }
  
  let decoded: string
  try {
    decoded = decodeURIComponent(url)
    new URL(decoded) // Validate URL
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 })
  }
  
  // Check if R2 is configured
  if (!process.env.R2_ACCOUNT_ID) {
    return NextResponse.json({ 
      exists: false,
      error: "R2 storage not configured"
    })
  }
  
  const platform = detectPlatform(decoded)
  const key = generateStorageKey(decoded, platform)
  const exists = await checkExists(key)
  
  if (exists) {
    return NextResponse.json({
      exists: true,
      proxied: getPublicUrl(key),
      platform,
    })
  }
  
  return NextResponse.json({
    exists: false,
    platform,
  })
}
