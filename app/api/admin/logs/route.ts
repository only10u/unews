import { NextRequest, NextResponse } from "next/server"
import { adminStore } from "@/lib/admin-store"

async function checkAdmin(req: NextRequest): Promise<boolean> {
  const token = req.headers.get("x-admin-token") || ""
  return adminStore.validateAdminSession(token)
}

export async function GET(req: NextRequest) {
  if (!(await checkAdmin(req))) return NextResponse.json({ error: "未授权" }, { status: 401 })
  const url = new URL(req.url)
  const limit = parseInt(url.searchParams.get("limit") || "50", 10)
  const logs = await adminStore.getLogs(limit)
  return NextResponse.json(logs)
}
