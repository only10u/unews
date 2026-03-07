import { NextResponse } from "next/server"

// 代理 /trending/current 接口到腾讯云服务器
// 使用端口 3001（与其他 trending API 一致），避免混合内容错误
export async function GET() {
  try {
    const res = await fetch("http://1.12.248.87:3001/api/trending/current", {
      next: { revalidate: 60 }, // 1分钟缓存
      signal: AbortSignal.timeout(25000), // 与其他路由一致的超时时间
      headers: {
        "Accept": "application/json",
      },
    })
    
    if (!res.ok) {
      throw new Error(`upstream returned ${res.status}`)
    }
    
    const data = await res.json()
    
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
      },
    })
  } catch (e) {
    console.error("[trending/current proxy] error:", e)
    // 返回空数据结构以避免前端报错
    return NextResponse.json(
      {
        lastUpdate: new Date().toISOString(),
        data: {
          weibo: [],
          douyin: [],
          gzh: [],
        },
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
        },
      }
    )
  }
}
