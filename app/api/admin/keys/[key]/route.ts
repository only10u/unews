import { NextRequest, NextResponse } from "next/server"
const BASE = "http://1.12.248.87:3003"

export async function DELETE(req: NextRequest, { params }: { params: { key: string } }) {
  const adminToken = req.headers.get("x-admin-token") || ""
  const res = await fetch(`${BASE}/admin/keys/${params.key}`, {
    method: "DELETE",
    headers: { "x-admin-token": adminToken },
    signal: AbortSignal.timeout(8000),
  })
  return NextResponse.json(await res.json())
}

export async function PATCH(req: NextRequest, { params }: { params: { key: string } }) {
  const adminToken = req.headers.get("x-admin-token") || ""
  const body = await req.json()
  const res = await fetch(`${BASE}/admin/keys/${params.key}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "x-admin-token": adminToken },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  })
  return NextResponse.json(await res.json())
}
