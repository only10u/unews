import { NextRequest, NextResponse } from "next/server"
import { transferImage, TransferResult } from "@/lib/r2"

/**
 * POST /api/transfer
 * Transfer a single image to R2
 * Request: { "url": "https://..." }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { url } = body
    
    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "Missing url parameter" }, { status: 400 })
    }
    
    // Validate URL format
    try {
      new URL(url)
    } catch {
      return NextResponse.json({ error: "Invalid URL format" }, { status: 400 })
    }
    
    // Check if R2 is configured
    if (!process.env.R2_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID) {
      return NextResponse.json({ 
        error: "R2 storage not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL environment variables." 
      }, { status: 500 })
    }
    
    console.log("[TRANSFER] Processing:", url.substring(0, 60))
    
    const result = await transferImage(url)
    
    if (result.error) {
      console.log("[TRANSFER] Error:", result.error)
      return NextResponse.json(result, { status: 502 })
    }
    
    console.log("[TRANSFER] Success:", result.cached ? "cached" : "uploaded", "size:", result.size)
    
    return NextResponse.json(result)
  } catch (error) {
    console.error("[TRANSFER] Exception:", error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : "Internal server error" 
    }, { status: 500 })
  }
}
