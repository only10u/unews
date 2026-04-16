import { NextResponse } from "next/server"
import { UPSTREAM_TRENDING_3001 } from "@/lib/upstream"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const keyword = searchParams.get("keyword")
  if (!keyword) return NextResponse.json({ success: false, error: "keyword required" })

  try {
    const res = await fetch(
      `${UPSTREAM_TRENDING_3001}/api/trending/douyin`,
      { next: { revalidate: 300 } }
    )
    const list = await res.json() // 数组
    
    // 优先精确匹配，其次模糊匹配
    const item =
      list.find((i: any) => i.title === keyword) ||
      list.find((i: any) => i.title.includes(keyword) || keyword.includes(i.title))

    if (!item) return NextResponse.json({ success: false, error: "no video found" })

    return NextResponse.json({
      success: true,
      data: {
        avatar: item.authorAvatar || "",
        author: item.authorName || "抖音热搜",
        content: item.excerpt || item.title,
        imageUrl: item.imageUrl || "",
        url: item.url || "",
      }
    })
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) })
  }
}
