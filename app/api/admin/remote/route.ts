import { NextRequest, NextResponse } from "next/server"

const BASE = "http://1.12.248.87:3003"

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const action = searchParams.get("action")
  const body = await req.json()
  const adminToken = req.headers.get("x-admin-token") || ""
  try {
    const res = await fetch(`${BASE}/admin/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-token": adminToken },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    })
    return NextResponse.json(await res.json())
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) })
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const action = searchParams.get("action")
  const adminToken = req.headers.get("x-admin-token") || ""
  try {
    const res = await fetch(`${BASE}/admin/${action}`, {
      headers: { "x-admin-token": adminToken },
      signal: AbortSignal.timeout(8000),
    })
    return NextResponse.json(await res.json())
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) })
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const key = searchParams.get("key")
  const adminToken = req.headers.get("x-admin-token") || ""
  try {
    const res = await fetch(`${BASE}/admin/keys/${key}`, {
      method: "DELETE",
      headers: { "x-admin-token": adminToken },
      signal: AbortSignal.timeout(8000),
    })
    return NextResponse.json(await res.json())
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) })
  }
}

export async function PATCH(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const key = searchParams.get("key")
  const body = await req.json()
  const adminToken = req.headers.get("x-admin-token") || ""
  try {
    const res = await fetch(`${BASE}/admin/keys/${key}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-admin-token": adminToken },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    })
    return NextResponse.json(await res.json())
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) })
  }
}
