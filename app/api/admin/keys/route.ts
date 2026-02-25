import { NextRequest, NextResponse } from "next/server"
import { adminStore } from "@/lib/admin-store"

function checkAdmin(req: NextRequest): boolean {
  const token = req.headers.get("x-admin-token") || ""
  return adminStore.validateAdminSession(token)
}

// GET: list all keys
export async function GET(req: NextRequest) {
  if (!checkAdmin(req)) return NextResponse.json({ error: "未授权" }, { status: 401 })
  const keys = adminStore.getAllKeys()
  return NextResponse.json(keys)
}

// POST: generate new key
export async function POST(req: NextRequest) {
  if (!checkAdmin(req)) return NextResponse.json({ error: "未授权" }, { status: 401 })
  try {
    const body = await req.json()
    const { type, customDays } = body
    if (!type || !["trial", "weekly", "monthly", "annual"].includes(type)) {
      return NextResponse.json({ error: "无效类型，可选: trial, weekly, monthly, annual" }, { status: 400 })
    }
    const parsedDays = customDays ? Number(customDays) : undefined
    if (parsedDays !== undefined && (isNaN(parsedDays) || parsedDays <= 0 || parsedDays > 3650)) {
      return NextResponse.json({ error: "自定义天数必须在 1-3650 之间" }, { status: 400 })
    }
    const key = adminStore.generateKey(type as "trial" | "weekly" | "monthly" | "annual", parsedDays)
    return NextResponse.json(key)
  } catch (e) {
    console.error("Key generation error:", e)
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 })
  }
}

// DELETE: revoke key
export async function DELETE(req: NextRequest) {
  if (!checkAdmin(req)) return NextResponse.json({ error: "未授权" }, { status: 401 })
  try {
    const { key } = await req.json()
    if (!key) return NextResponse.json({ error: "缺少密钥" }, { status: 400 })
    const success = adminStore.revokeKey(key)
    if (!success) return NextResponse.json({ error: "密钥不存在" }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 })
  }
}
