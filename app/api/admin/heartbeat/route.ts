import { NextRequest, NextResponse } from "next/server"
import { adminStore } from "@/lib/admin-store"

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
    const userAgent = req.headers.get("user-agent") || ""

    // Rate limit check
    if (!adminStore.checkRateLimit(ip, 200, 60_000)) {
      return NextResponse.json({ error: "rate limited" }, { status: 429 })
    }

    const body = await req.json()
    adminStore.heartbeat({
      ip,
      keyUsed: body.keyUsed || "free",
      page: body.page || "/",
      fingerprint: body.fingerprint || undefined,
      userAgent,
    })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 })
  }
}

// GET: admin can fetch online users
export async function GET(req: NextRequest) {
  const token = req.headers.get("x-admin-token") || ""
  if (!adminStore.validateAdminSession(token)) {
    return NextResponse.json({ error: "未授权" }, { status: 401 })
  }
  return NextResponse.json(adminStore.getOnlineUsers())
}
