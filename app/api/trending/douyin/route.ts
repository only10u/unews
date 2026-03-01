import { NextResponse } from "next/server"

export async function GET() {
  try {
    const res = await fetch("http://1.12.248.87:3001/api/trending/douyin", {
      next: { revalidate: 30 },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) throw new Error(`upstream ${res.status}`)
    const data = await res.json()
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}