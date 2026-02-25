import { NextRequest, NextResponse } from "next/server"
import { adminStore } from "@/lib/admin-store"

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin226"

export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json()
    console.log("[v0] Admin login attempt, password match:", password === ADMIN_PASSWORD)
    if (password !== ADMIN_PASSWORD) {
      const ip = req.headers.get("x-forwarded-for") || "unknown"
      await adminStore.addLog("管理员登录失败", ip, "密码错误", "high")
      return NextResponse.json({ error: "密码错误" }, { status: 401 })
    }
    const token = await adminStore.createAdminSession()
    console.log("[v0] Admin login success, token length:", token.length)
    await adminStore.addLog("管理员登录", "admin", "管理员登录成功", "low")
    return NextResponse.json({ token })
  } catch (e) {
    console.error("[v0] Admin auth error:", e)
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 })
  }
}
