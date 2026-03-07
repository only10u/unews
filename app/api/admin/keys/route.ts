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
    // 腾讯云返回 { keys: [...] }，前端需要直接拿到数组
    return NextResponse.json(data.keys || [])
  } catch {
    return NextResponse.json([])
  }
}

export async function POST(req: NextRequest) {
  const adminToken = req.headers.get("x-admin-token") || ""
  const body = await req.json()
  const res = await fetch(`${BASE}/admin/keys`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-admin-token": adminToken },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  })
  return NextResponse.json(await res.json())
}
