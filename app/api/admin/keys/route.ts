import { NextRequest, NextResponse } from "next/server"
import { adminStore } from "@/lib/admin-store"

async function checkAdmin(req: NextRequest): Promise<boolean> {
  const token = req.headers.get("x-admin-token") || ""
  console.log("[v0] checkAdmin called, token length:", token.length, "token present:", !!token)
  if (!token) {
    console.log("[v0] No admin token provided in request")
    return false
  }
  const valid = await adminStore.validateAdminSession(token)
  console.log("[v0] validateAdminSession result:", valid)
  return valid
}

// GET: list all keys
export async function GET(req: NextRequest) {
  if (!(await checkAdmin(req))) return NextResponse.json({ error: "未授权" }, { status: 401 })
  const keys = await adminStore.getAllKeys()
  return NextResponse.json(keys)
}

// POST: generate new key
export async function POST(req: NextRequest) {
  console.log("[v0] POST /api/admin/keys called")
  const isAdmin = await checkAdmin(req)
  if (!isAdmin) {
    console.log("[v0] Admin check failed for POST /api/admin/keys")
    return NextResponse.json({ error: "未授权" }, { status: 401 })
  }
  console.log("[v0] Admin check passed, generating key...")
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
    const key = await adminStore.generateKey(type as "trial" | "weekly" | "monthly" | "annual", parsedDays)
    return NextResponse.json(key)
  } catch (e) {
    console.error("Key generation error:", e)
    return NextResponse.json({ error: "生成密钥失败，请重试" }, { status: 500 })
  }
}

// DELETE: revoke key
export async function DELETE(req: NextRequest) {
  if (!(await checkAdmin(req))) return NextResponse.json({ error: "未授权" }, { status: 401 })
  try {
    const { key } = await req.json()
    if (!key) return NextResponse.json({ error: "缺少密钥" }, { status: 400 })
    const success = await adminStore.revokeKey(key)
    if (!success) return NextResponse.json({ error: "密钥不存在" }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 })
  }
}
