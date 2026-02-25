import { NextRequest, NextResponse } from "next/server"
import { adminStore } from "@/lib/admin-store"

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin226"

export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json()
    if (password !== ADMIN_PASSWORD) {
      const ip = req.headers.get("x-forwarded-for") || "unknown"
      adminStore.addLog("管理员登录失败", ip, "密码错误", "high")
      return NextResponse.json({ error: "密码错误" }, { status: 401 })
    }
    const token = adminStore.createAdminSession()
    adminStore.addLog("管理员登录", "admin", "管理员登录成功", "low")
    return NextResponse.json({ token })
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 })
  }
}
