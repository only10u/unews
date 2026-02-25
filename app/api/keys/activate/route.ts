import { NextRequest, NextResponse } from "next/server"
import { adminStore } from "@/lib/admin-store"

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"

    // Rate limit for key activation: 10 attempts per 10 minutes
    if (!adminStore.checkRateLimit(`activate:${ip}`, 10, 10 * 60_000)) {
      return NextResponse.json({ error: "尝试过于频繁，请稍后再试" }, { status: 429 })
    }

    const { key, fingerprint } = await req.json()
    if (!key || typeof key !== "string") {
      return NextResponse.json({ error: "缺少密钥" }, { status: 400 })
    }

    const fp = fingerprint || ip
    const result = adminStore.activateKey(key, fp)

    if (!result.success) {
      const failCount = adminStore.recordFailedAttempt(ip)
      adminStore.addLog(
        "密钥验证失败",
        ip,
        `尝试密钥 ${key.substring(0, 10)}... (第${failCount}次)`,
        failCount >= 3 ? "high" : "medium"
      )
      return NextResponse.json({ error: result.error }, { status: 403 })
    }

    adminStore.addLog("密钥验证成功", ip, `激活密钥 ${result.key!.key}`, "low")

    return NextResponse.json({
      success: true,
      key: result.key!.key,
      type: result.key!.type,
      expiresAt: result.key!.expiresAt,
    })
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 })
  }
}
