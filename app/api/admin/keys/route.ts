import { NextRequest, NextResponse } from "next/server"

const BASE = "http://1.12.248.87:3003"

function inferType(days: number): string {
  if (days === -1) return "permanent"
  if (days <= 1) return "trial"
  if (days <= 7) return "weekly"
  if (days <= 30) return "monthly"
  return "annual"
}

function inferStatus(k: {
  expired: boolean
  deviceId: string | null
  expiresAt: string | null
}): string {
  if (k.expired) return "expired"
  if (k.deviceId) return "active"
  return "unused"
}

function inferDurationLabel(days: number): string {
  if (days === -1) return "永久"
  if (days === 1) return "1天"
  if (days === 7) return "7天"
  if (days === 30) return "30天"
  if (days === 365) return "365天"
  return `${days}天`
}

export async function GET(req: NextRequest) {
  const adminToken = req.headers.get("x-admin-token") || ""
  try {
    const res = await fetch(`${BASE}/admin/keys`, {
      headers: { "x-admin-token": adminToken },
      signal: AbortSignal.timeout(8000),
    })
    const data = await res.json()
    const keys = (data.keys || []).map((k: {
      key: string
      note: string
      createdAt: string
      expiresAt: string | null
      days: number
      remainingDays: number | null
      expired: boolean
      deviceId: string | null
      isOnline: boolean
    }) => ({
      id: k.key,
      key: k.key,
      type: inferType(k.days),
      status: inferStatus(k),
      durationLabel: inferDurationLabel(k.days),
      note: k.note,
      usedBy: k.deviceId || null,
      expiresAt: k.expiresAt ? new Date(k.expiresAt).getTime() : null,
      createdAt: new Date(k.createdAt).getTime(),
      isOnline: k.isOnline,
    }))
    return NextResponse.json(keys)
  } catch {
    return NextResponse.json([])
  }
}

export async function POST(req: NextRequest) {
  const adminToken = req.headers.get("x-admin-token") || ""
  const body = await req.json()
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
