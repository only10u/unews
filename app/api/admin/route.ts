import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  const action = req.nextUrl.searchParams.get("action")
  const body = await req.json()

  // 登录操作不需要 x-admin-token
  if (action === "login") {
    try {
      const res = await fetch("http://1.12.248.87:3003/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(8000),
      })
      const data = await res.json()
      return NextResponse.json(data)
    } catch (e) {
      return NextResponse.json({ success: false, error: String(e) })
    }
  }

  return NextResponse.json({ success: false, error: "Unknown action" })
}
