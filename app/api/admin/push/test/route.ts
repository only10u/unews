import { NextRequest, NextResponse } from "next/server"
import { adminStore } from "@/lib/admin-store"

async function checkAdmin(req: NextRequest): Promise<boolean> {
  const token = req.headers.get("x-admin-token") || ""
  return adminStore.validateAdminSession(token)
}

export async function POST(req: NextRequest) {
  if (!(await checkAdmin(req))) return NextResponse.json({ error: "未授权" }, { status: 401 })

  try {
    const { type, config } = await req.json()

    if (type === "dingtalk" && config?.webhook) {
      const res = await fetch(config.webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          msgtype: "text",
          text: { content: "[热点新闻后台] 推送测试消息 - " + new Date().toLocaleString("zh-CN") },
        }),
      })
      if (res.ok) {
        await adminStore.setPushConfig({ dingtalkWebhook: config.webhook })
        await adminStore.addLog("推送测试", "admin", "钉钉推送测试成功", "low")
        return NextResponse.json({ success: true, message: "钉钉推送测试成功" })
      }
      return NextResponse.json({ success: false, message: "钉钉推送失败" })
    }

    if (type === "telegram" && config?.botToken && config?.chatId) {
      const res = await fetch(
        `https://api.telegram.org/bot${config.botToken}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: config.chatId,
            text: `[热点新闻后台] 推送测试消息\n${new Date().toLocaleString("zh-CN")}`,
          }),
        }
      )
      if (res.ok) {
        await adminStore.setPushConfig({ telegramBotToken: config.botToken, telegramChatId: config.chatId })
        await adminStore.addLog("推送测试", "admin", "Telegram推送测试成功", "low")
        return NextResponse.json({ success: true, message: "Telegram推送测试成功" })
      }
      return NextResponse.json({ success: false, message: "Telegram推送失败" })
    }

    return NextResponse.json({ error: "无效的推送类型" }, { status: 400 })
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 })
  }
}

// GET: get current push config
export async function GET(req: NextRequest) {
  if (!(await checkAdmin(req))) return NextResponse.json({ error: "未授权" }, { status: 401 })
  const config = await adminStore.getPushConfig()
  return NextResponse.json({
    dingtalkWebhook: config.dingtalkWebhook ? "已配置" : "",
    telegramBotToken: config.telegramBotToken ? "已配置" : "",
    telegramChatId: config.telegramChatId || "",
  })
}
