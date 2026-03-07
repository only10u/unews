import { NextRequest, NextResponse } from "next/server"
const BASE = "http://1.12.248.87:3003"

export async function GET(req: NextRequest) {
  const adminToken = req.headers.get("x-admin-token") || ""
  try {
    const res = await fetch(`${BASE}/admin/keys`, {
      headers: { "x-admin-token": adminToken },
      signal: AbortSignal.timeout(8000),
    })
    const data = await res.json()
    return NextResponse.json(data.keys || [])
  } catch {
    return NextResponse.json([])
  }
}

export async function POST(req: NextRequest) {
  const adminToken = req.headers.get("x-admin-token") || ""
  const body = await req.json()

  // 前端发 { type, customDays }，腾讯云需要 { days, note }
  const typeMap: Record<string, number> = {
    trial: 1,
    weekly: 7,
    monthly: 30,
    annual: 365,
  }
  const days = body.customDays || typeMap[body.type] || 30
  const note = body.type || "monthly"

  try {
    const res = await fetch(`${BASE}/admin/keys`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-token": adminToken },
      body: JSON.stringify({ days, note }),
      signal: AbortSignal.timeout(8000),
    })
    return NextResponse.json(await res.json())
  } catch {
    return NextResponse.json({ error: "生成失败" }, { status: 500 })
  }
}
