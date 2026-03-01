import { NextResponse } from "next/server"

export async function GET() {
  try {
    const res = await fetch("http://1.12.248.87:3001/api/trending/weibo", {
      next: { revalidate: 30 },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) throw new Error(`upstream ${res.status}`)
    const raw = await res.json()
    const data = raw.map((item: any, i: number) => ({
      id: `weibo-${item.rank}-${i}`,
      platform: "weibo",
      author: item.authorName || "微博热搜",
      authorAvatar: item.authorAvatar || "",
      authorVerified: false,
      authorFollowers: "",
      title: item.title,
      summary: item.excerpt || "",
      detailContent: item.excerpt || "",
      score: Math.max(9.5 - i * 0.15, 3.0),
      scoreReason: `微博热搜第${item.rank}名`,
      tags: ["微博热搜"],
      likes: Math.floor((item.hotValue || 0) / 100),
      reposts: Math.floor((item.hotValue || 0) / 300),
      comments: Math.floor((item.hotValue || 0) / 500),
      timestamp: "刚刚",
      url: item.url,
      imageUrl: item.imageUrl || undefined,
      mediaType: item.mediaType || "image",
      platformRank: item.rank,
    }))
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
