import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "热点新闻管理后台",
  description: "热点新闻管理后台 - 用户管理、密钥管理、数据监控",
  robots: "noindex, nofollow",
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
