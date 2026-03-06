import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const keyword = searchParams.get("keyword")
  if (!keyword) return NextResponse.json({ success: false, error: "keyword required" })

  try {
    const res = await fetch(
      `https://m.weibo.cn/search?containerid=100103type%3D1%26q%3D${encodeURIComponent(keyword)}`,
      {
        headers: {
          Cookie: "SINAGLOBAL=6120020328159.53.1764562022092; SCF=AsbBafvpkxNyrkK-TgsaUR4yDw__NhKJR-tsJ6zKpX1nL0BKNXZRFam_1yAuIkH9WJc_ktNT7quD9CYx3pWP0_o.; UOR=,,open.weixin.qq.com; XSRF-TOKEN=1vTCDNkRIRg11U1Cj5D1oae1; _s_tentry=-; Apache=3373370684902.025.1772818681420; ULV=1772818681429:63:3:3:3373370684902.025.1772818681420:1772485935381; SUB=_2A25Er2E1DeRhGeFJ7lAT9ijEzzSIHXVnxfz9rDV8PUNbmtAbLRLFkW9Nf6To9Hf46qfBYCydCxD596HltqPwnQtv; SUBP=0033WrSXqPxfM725Ws9jqgMF55529P9D9W5DaKcYIZHdGMg269.WLoU25JpX5KzhUgL.FoMNSKzESoqRShn2dJLoIpHKCFH8SFHF1F-R1CH8SbHFSCHFSfYt; ALF=02_1775410789; WBPSESS=T14wvpd3M-Pt-jVBRK67m3zvBe7M9RYskRAitd6HmzQCAZR3nQNDJhsu5fvRaDcD_vY3qjP8yEQBvglHKwuZIK2kv-SXFDnLC6D6KNuTmb-vBIBBH2aHYaPqPOLIjyxHTIgy6980RfltLDauNwEzzA==",
          "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15",
          Referer: "https://m.weibo.cn",
          "MWeibo-Pwa": "1",
          "X-Requested-With": "XMLHttpRequest",
        },
        signal: AbortSignal.timeout(10000),
        next: { revalidate: 300 },
      }
    )
    const data = await res.json()
    const cards = data?.data?.cards || []
    const mblog = cards.find((c: any) => c.card_type === 9)?.mblog
    if (!mblog) return NextResponse.json({ success: false, error: "no post found" })
    const pics = mblog.pics || []
    return NextResponse.json({
      success: true,
      avatar: mblog.user?.profile_image_url || "",
      author: mblog.user?.screen_name || "",
      content: (mblog.text || "").replace(/<[^>]+>/g, "").slice(0, 120),
      imageUrl: pics[0]?.large?.url || pics[0]?.url || "",
      url: `https://weibo.com/${mblog.user?.id}/${mblog.bid}`,
    })
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) })
  }
}
