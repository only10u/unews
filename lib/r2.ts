import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3"
import crypto from "crypto"

// Cloudflare R2 client (S3-compatible)
const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
  },
})

const BUCKET = process.env.R2_BUCKET_NAME || "images"
const PUBLIC_URL = process.env.R2_PUBLIC_URL || ""

export type Platform = "weibo" | "wechat" | "douyin" | "unknown"

/**
 * Detect platform from URL hostname
 */
export function detectPlatform(url: string): Platform {
  const lower = url.toLowerCase()
  if (lower.includes("sinaimg.cn") || lower.includes("weibo.com") || lower.includes("sina.com")) {
    return "weibo"
  }
  if (lower.includes("mmbiz.qpic.cn") || lower.includes("mmbiz.qlogo.cn") || lower.includes("wx.qq.com")) {
    return "wechat"
  }
  if (lower.includes("douyinpic.com") || lower.includes("douyin.com") || lower.includes("snssdk.com") || lower.includes("bytedance")) {
    return "douyin"
  }
  return "unknown"
}

/**
 * Get platform-specific fetch headers to bypass hotlink protection
 */
export function getPlatformHeaders(platform: Platform): Record<string, string> {
  switch (platform) {
    case "weibo":
      return {
        "Referer": "https://weibo.com/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      }
    case "wechat":
      return {
        "Referer": "https://mp.weixin.qq.com/",
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.0",
      }
    case "douyin":
      return {
        "Referer": "https://www.douyin.com/",
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
      }
    default:
      return {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      }
  }
}

/**
 * Generate storage key from URL: {platform}/{md5}.{ext}
 */
export function generateStorageKey(url: string, platform: Platform, contentType?: string): string {
  const hash = crypto.createHash("md5").update(url).digest("hex")
  
  // Try to extract extension from URL or content-type
  let ext = "jpg"
  const urlExt = url.match(/\.([a-zA-Z0-9]+)(?:\?|$)/)
  if (urlExt) {
    ext = urlExt[1].toLowerCase()
  } else if (contentType) {
    const ctExt = contentType.split("/")[1]?.split(";")[0]
    if (ctExt && ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ctExt)) {
      ext = ctExt === "jpeg" ? "jpg" : ctExt
    }
  }
  
  return `${platform}/${hash}.${ext}`
}

/**
 * Check if an image already exists in R2
 */
export async function checkExists(key: string): Promise<boolean> {
  if (!process.env.R2_ACCOUNT_ID) return false
  
  try {
    await r2Client.send(new HeadObjectCommand({
      Bucket: BUCKET,
      Key: key,
    }))
    return true
  } catch {
    return false
  }
}

/**
 * Upload image to R2
 */
export async function uploadToR2(
  key: string,
  body: ArrayBuffer,
  contentType: string,
  originalUrl: string
): Promise<string> {
  await r2Client.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: new Uint8Array(body),
    ContentType: contentType,
    Metadata: {
      "original-url": originalUrl.substring(0, 1024), // R2 metadata size limit
    },
  }))
  
  return `${PUBLIC_URL}/${key}`
}

/**
 * Get public URL for a stored image
 */
export function getPublicUrl(key: string): string {
  return `${PUBLIC_URL}/${key}`
}

/**
 * Check if URL is a signed Douyin URL (will expire)
 */
export function isSignedDouyinUrl(url: string): boolean {
  return url.toLowerCase().includes("-sign.") || url.includes("X-Expires")
}

export interface TransferResult {
  original: string
  proxied: string
  platform: Platform
  cached: boolean
  size: number
  warning: string | null
  error?: string
}

/**
 * Transfer a single image to R2
 */
export async function transferImage(url: string): Promise<TransferResult> {
  const platform = detectPlatform(url)
  const warning = platform === "douyin" && isSignedDouyinUrl(url)
    ? "Douyin signed URLs may expire, transfer immediately after crawling"
    : null
  
  try {
    // Generate key and check if already cached
    const tempKey = generateStorageKey(url, platform)
    const exists = await checkExists(tempKey)
    
    if (exists) {
      return {
        original: url,
        proxied: getPublicUrl(tempKey),
        platform,
        cached: true,
        size: 0,
        warning,
      }
    }
    
    // Fetch the image with platform-specific headers
    const headers = getPlatformHeaders(platform)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)
    
    const response = await fetch(url, {
      headers,
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    // Check file size (max 20MB)
    const contentLength = response.headers.get("content-length")
    if (contentLength && parseInt(contentLength) > 20 * 1024 * 1024) {
      throw new Error("File too large (max 20MB)")
    }
    
    const contentType = response.headers.get("content-type") || "image/jpeg"
    const buffer = await response.arrayBuffer()
    
    // Generate final key with content type
    const key = generateStorageKey(url, platform, contentType)
    
    // Upload to R2
    const proxiedUrl = await uploadToR2(key, buffer, contentType, url)
    
    return {
      original: url,
      proxied: proxiedUrl,
      platform,
      cached: false,
      size: buffer.byteLength,
      warning,
    }
  } catch (error) {
    return {
      original: url,
      proxied: "",
      platform,
      cached: false,
      size: 0,
      warning,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}
