import { NextResponse } from "next/server"

// Returns NewsItem[] format for frontend
export async function GET() {
  try {
    const res = await fetch("http://1.12.248.87:3001/api/trending/weibo", {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(25000),
    })
    if (!res.ok) throw new Error(`upstream ${res.status}`)
    const raw = await res.json()
    
    // 调试日志：打印上游API返回的第一条原始数据的完整字段
    if (raw && raw[0]) {
      console.log('[v0] [weibo raw item #1]', JSON.stringify(raw[0], null, 2))
    }
    
    // Map to NewsItem format expected by frontend
    // 扩展字段映射，覆盖微博API可能的各种字段名
    const data = raw.map((item: any, i: number) => ({
      id: `w${i + 1}`,
      title: item.title || item.word || item.note || "",
      hotValue: item.hotValue || item.hot_num || item.num || 0,
      url: item.url || item.link || item.scheme || "",
      // 图片：覆盖多种可能的字段名
      imageUrl: item.pic || item.pic_url || item.image || item.imageUrl || item.cover || item.icon || "",
      videoUrl: item.videoUrl || item.video_url || "",
      mediaType: item.mediaType || "image",
      isBurst: item.isBurst || item.is_hot || item.is_new || false,
      rankDelta: item.rankDelta || item.rank_diff || 0,
      prevRank: item.prevRank || item.prev_rank,
      // 作者：优先从user对象取，然后是各种可能的字段名
      author: item.user?.screen_name || item.user?.name || item.authorName || item.topAuthor || item.author || item.nick || "微博热搜",
      // 头像：优先从user对象取
      authorAvatar: item.user?.profile_image_url || item.user?.avatar_large || item.user?.avatar || item.authorAvatar || item.topAuthorAvatar || item.icon_url || "",
      // 正文：覆盖多种可能的字段名
      summary: item.text || item.content || item.desc || item.summary || item.excerpt || item.label_name || "",
      platformRank: item.rank || item.realpos || i + 1,
    }))
    
    console.log("[WEIBO-API] returning", data.length, "items, sample:", JSON.stringify({
      title: data[0]?.title?.substring(0, 20),
      imageUrl: data[0]?.imageUrl?.substring(0, 50),
      author: data[0]?.author,
      platformRank: data[0]?.platformRank,
    }))
    
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    })
  } catch (e) {
    console.log("[WEIBO-API] error:", String(e))
    return NextResponse.json([], { 
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    })
  }
}
