import { NextRequest, NextResponse } from "next/server"
const BASE = "http://1.12.248.87:3003"

export async function GET(req: NextRequest) {
  const adminToken = req.headers.get("x-admin-token") || ""
  const res = await fetch(`${BASE}/admin/keys`, {
    headers: { "x-admin-token": adminToken },
    signal: AbortSignal.timeout(8000),
  })
  const data = await res.json()
  return NextResponse.json({
    success: true,
    onlineCount: data.onlineCount || 0,
    totalKeys: data.keys?.length || 0,
  })
}
