import { NextRequest, NextResponse } from "next/server"
const BASE = "http://1.12.248.87:3003"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const res = await fetch(`${BASE}/keys/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    })
    return NextResponse.json(await res.json())
  } catch {
    return NextResponse.json({ error: "服务器连接失败" }, { status: 500 })
  }
}
