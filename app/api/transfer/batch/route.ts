import { NextRequest, NextResponse } from "next/server"
import { transferImage, TransferResult } from "@/lib/r2"

/**
 * POST /api/transfer/batch
 * Transfer multiple images to R2 concurrently
 * Request: { "urls": ["...", "...", "..."] }
 * Max 20 URLs per request
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { urls } = body
    
    if (!urls || !Array.isArray(urls)) {
      return NextResponse.json({ error: "Missing urls array" }, { status: 400 })
    }
    
    if (urls.length === 0) {
      return NextResponse.json({ results: [] })
    }
    
    if (urls.length > 20) {
      return NextResponse.json({ error: "Maximum 20 URLs per batch" }, { status: 400 })
    }
    
    // Validate all URLs
    const validUrls: string[] = []
    const invalidResults: TransferResult[] = []
    
    for (const url of urls) {
      if (typeof url !== "string") {
        invalidResults.push({
          original: String(url),
          proxied: "",
          platform: "unknown",
          cached: false,
          size: 0,
          warning: null,
          error: "Invalid URL type",
        })
        continue
      }
      
      try {
        new URL(url)
        validUrls.push(url)
      } catch {
        invalidResults.push({
          original: url,
          proxied: "",
          platform: "unknown",
          cached: false,
          size: 0,
          warning: null,
          error: "Invalid URL format",
        })
      }
    }
    
    // Check if R2 is configured
    if (!process.env.R2_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID) {
      return NextResponse.json({ 
        error: "R2 storage not configured" 
      }, { status: 500 })
    }
    
    console.log("[TRANSFER-BATCH] Processing", validUrls.length, "URLs")
    
    // Process all valid URLs concurrently
    const settledResults = await Promise.allSettled(
      validUrls.map(url => transferImage(url))
    )
    
    const results: TransferResult[] = settledResults.map((result, i) => {
      if (result.status === "fulfilled") {
        return result.value
      } else {
        return {
          original: validUrls[i],
          proxied: "",
          platform: "unknown" as const,
          cached: false,
          size: 0,
          warning: null,
          error: result.reason?.message || "Unknown error",
        }
      }
    })
    
    // Combine with invalid results
    const allResults = [...results, ...invalidResults]
    
    const success = allResults.filter(r => !r.error).length
    const failed = allResults.filter(r => r.error).length
    
    console.log("[TRANSFER-BATCH] Complete:", success, "success,", failed, "failed")
    
    return NextResponse.json({
      results: allResults,
      summary: {
        total: allResults.length,
        success,
        failed,
        cached: allResults.filter(r => r.cached).length,
      },
    })
  } catch (error) {
    console.error("[TRANSFER-BATCH] Exception:", error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : "Internal server error" 
    }, { status: 500 })
  }
}
