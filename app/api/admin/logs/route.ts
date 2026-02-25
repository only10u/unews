import { NextRequest, NextResponse } from "next/server"
import { adminStore } from "@/lib/admin-store"

function checkAdmin(req: NextRequest): boolean {
  const token = req.headers.get("x-admin-token") || ""
  return adminStore.validateAdminSession(token)
}

export async function GET(req: NextRequest) {
  if (!checkAdmin(req)) return NextResponse.json({ error: "未授权" }, { status: 401 })
  const url = new URL(req.url)
  const limit = parseInt(url.searchParams.get("limit") || "50", 10)
  return NextResponse.json(adminStore.getLogs(limit))
}
