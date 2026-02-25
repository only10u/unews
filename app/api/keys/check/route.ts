import { NextRequest, NextResponse } from "next/server"
import { adminStore } from "@/lib/admin-store"

export async function POST(req: NextRequest) {
  try {
    const { key } = await req.json()
    if (!key) return NextResponse.json({ valid: false })

    const result = adminStore.checkKey(key)
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ valid: false })
  }
}
