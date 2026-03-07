import { NextRequest, NextResponse } from "next/server"
const BASE = "http://1.12.248.87:3003"

export async function POST(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params
  const adminToken = req.headers.get("x-admin-token") || ""
  const res = await fetch(`${BASE}/admin/keys/${key}/reset-device`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-admin-token": adminToken },
    body: "{}",
    signal: AbortSignal.timeout(8000),
  })
  return NextResponse.json(await res.json())
}
