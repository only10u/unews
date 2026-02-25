import { NextRequest, NextResponse } from "next/server"
import { adminStore } from "@/lib/admin-store"

function checkAdmin(req: NextRequest): boolean {
  const token = req.headers.get("x-admin-token") || ""
  return adminStore.validateAdminSession(token)
}

// GET: list all keys
export async function GET(req: NextRequest) {
  if (!checkAdmin(req)) return NextResponse.json({ error: "未授权" }, { status: 401 })
  return NextResponse.json(adminStore.getAllKeys())
}

// POST: generate new key
export async function POST(req: NextRequest) {
  if (!checkAdmin(req)) return NextResponse.json({ error: "未授权" }, { status: 401 })
  try {
    const { type } = await req.json()
    if (!["trial", "weekly", "monthly", "annual"].includes(type)) {
      return NextResponse.json({ error: "无效类型" }, { status: 400 })
    }
    const key = adminStore.generateKey(type)
    return NextResponse.json(key)
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 })
  }
}

// DELETE: revoke key
export async function DELETE(req: NextRequest) {
  if (!checkAdmin(req)) return NextResponse.json({ error: "未授权" }, { status: 401 })
  try {
    const { key } = await req.json()
    const success = adminStore.revokeKey(key)
    return NextResponse.json({ success })
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 })
  }
}
