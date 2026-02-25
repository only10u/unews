import { NextRequest, NextResponse } from "next/server"
import { adminStore } from "@/lib/admin-store"

async function checkAdmin(req: NextRequest): Promise<boolean> {
  const token = req.headers.get("x-admin-token") || ""
  return adminStore.validateAdminSession(token)
}

export async function GET(req: NextRequest) {
  if (!(await checkAdmin(req))) return NextResponse.json({ error: "未授权" }, { status: 401 })
  const stats = await adminStore.getStats()
  return NextResponse.json(stats)
}
