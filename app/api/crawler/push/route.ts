import { NextRequest, NextResponse } from "next/server"
import { transferImage, detectPlatform } from "@/lib/r2"

/**
 * API endpoint for domestic crawler server to push trending data with real images
 * 
 * Flow:
 * 1. Domestic server crawls Weibo/Douyin/WeChat with real images
 * 2. Domestic server POSTs data to this endpoint
 * 3. This endpoint transfers images to R2 and stores data in memory cache
 * 4. Frontend fetches from /api/trending/{platform} which reads from cache
 * 
 * Auth: Simple API key in header
 */

// In-memory cache for pushed trending data (per platform)
const pushedDataCache: Record<string, { data: unknown[]; timestamp: number }> = {
  weibo: { data: [], timestamp: 0 },
  douyin: { data: [], timestamp: 0 },
  gzh: { data: [], timestamp: 0 },
}

// Cache TTL: 5 minutes (crawler should push more frequently)
const CACHE_TTL = 5 * 60 * 1000

// API Key for crawler authentication
const CRAWLER_API_KEY = process.env.CRAWLER_API_KEY || "douu-crawler-secret-2026"

interface PushedItem {
  rank: number
  title: string
  hotValue: number
  url: string
  imageUrl?: string
  videoUrl?: string
  authorName?: string
  authorAvatar?: string
  excerpt?: string
  detailContent?: string
  mediaType?: "image" | "video"
}

/**
 * GET: Retrieve cached data for a platform (used by trending API)
 */
export async function GET(req: NextRequest) {
  const platform = req.nextUrl.searchParams.get("platform")
  
  if (!platform || !["weibo", "douyin", "gzh"].includes(platform)) {
    return NextResponse.json({ error: "Invalid platform" }, { status: 400 })
  }
  
  const cached = pushedDataCache[platform]
  const now = Date.now()
  
  if (cached && cached.data.length > 0 && now - cached.timestamp < CACHE_TTL) {
    return NextResponse.json({
      source: "crawler",
      platform,
      count: cached.data.length,
      timestamp: cached.timestamp,
      data: cached.data,
    })
  }
  
  return NextResponse.json({
    source: "empty",
    platform,
    count: 0,
    timestamp: 0,
    data: [],
  })
}

/**
 * POST: Receive pushed data from crawler server
 * 
 * Headers:
 *   X-Crawler-Key: {CRAWLER_API_KEY}
 * 
 * Body:
 * {
 *   platform: "weibo" | "douyin" | "gzh",
 *   items: PushedItem[],
 *   transferImages?: boolean  // default true - transfer to R2
 * }
 */
export async function POST(req: NextRequest) {
  // Auth check
  const apiKey = req.headers.get("X-Crawler-Key") || req.headers.get("x-crawler-key")
  if (apiKey !== CRAWLER_API_KEY) {
    console.log("[CRAWLER-PUSH] unauthorized, key:", apiKey?.substring(0, 10))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  
  try {
    const body = await req.json()
    const { platform, items, transferImages = true } = body as {
      platform: string
      items: PushedItem[]
      transferImages?: boolean
    }
    
    if (!platform || !["weibo", "douyin", "gzh"].includes(platform)) {
      return NextResponse.json({ error: "Invalid platform" }, { status: 400 })
    }
    
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "No items provided" }, { status: 400 })
    }
    
    console.log(`[CRAWLER-PUSH] received ${items.length} items for ${platform}`)
    
    // Transfer images to R2 if enabled
    let processedItems = items
    if (transferImages) {
      const transferResults = await Promise.allSettled(
        items.map(async (item) => {
          const newItem = { ...item }
          
          // Transfer main image
          if (item.imageUrl && detectPlatform(item.imageUrl) !== "unknown") {
            try {
              const result = await transferImage(item.imageUrl)
              if (result.proxied) {
                console.log(`[CRAWLER-PUSH] transferred image: ${item.imageUrl.substring(0, 50)} -> ${result.proxied.substring(0, 50)}`)
                newItem.imageUrl = result.proxied
              }
            } catch (e) {
              console.log(`[CRAWLER-PUSH] image transfer failed: ${e instanceof Error ? e.message : String(e)}`)
            }
          }
          
          // Transfer author avatar
          if (item.authorAvatar && detectPlatform(item.authorAvatar) !== "unknown") {
            try {
              const result = await transferImage(item.authorAvatar)
              if (result.proxied) {
                newItem.authorAvatar = result.proxied
              }
            } catch {
              // Keep original on failure
            }
          }
          
          return newItem
        })
      )
      
      processedItems = transferResults.map((r, i) => 
        r.status === "fulfilled" ? r.value : items[i]
      )
    }
    
    // Update cache
    pushedDataCache[platform] = {
      data: processedItems,
      timestamp: Date.now(),
    }
    
    const protectedCount = processedItems.filter(
      it => it.imageUrl && (it.imageUrl.includes("10unews.com") || it.imageUrl.includes("r2."))
    ).length
    
    console.log(`[CRAWLER-PUSH] cached ${processedItems.length} items for ${platform}, R2 images: ${protectedCount}`)
    
    return NextResponse.json({
      success: true,
      platform,
      count: processedItems.length,
      r2Transferred: protectedCount,
      timestamp: pushedDataCache[platform].timestamp,
    })
  } catch (e) {
    console.error("[CRAWLER-PUSH] error:", e)
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }
}

/**
 * Export cache getter for use by trending APIs
 */
export function getCrawlerCache(platform: string): { data: unknown[]; timestamp: number } | null {
  const cached = pushedDataCache[platform]
  if (cached && cached.data.length > 0 && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached
  }
  return null
}
