import type { Metadata } from "next"
import Link from "next/link"
import { X_FOLLOW_URL } from "@/lib/site"

export const metadata: Metadata = {
  title: "兜U新闻.skill — Agent 接入",
  description: "通过 HTTPS 读取热搜 JSON 与趋势变动，投喂给 AI Agent",
}

export default function SkillPage() {
  const origin = process.env.NEXT_PUBLIC_SITE_ORIGIN ?? "https://10unews.com"
  const skillUrl = `${origin.replace(/\/$/, "")}/dou-u-skill.md`

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/40 px-4 py-3 flex items-center justify-between">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← 返回热点新闻
        </Link>
        <a
          href={X_FOLLOW_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-amber-400 hover:underline"
        >
          关注 X @10UWINA8
        </a>
      </header>

      <main className="max-w-xl mx-auto px-4 py-10 text-center space-y-6">
        <div className="inline-block rounded-2xl border-4 border-amber-400 bg-gradient-to-b from-amber-500/25 to-amber-900/20 shadow-[0_0_40px_rgba(251,191,36,0.15)] px-8 py-6 text-left">
          <div className="rounded-lg bg-amber-950/40 border border-amber-500/50 px-4 py-2 text-center mb-4">
            <span className="text-2xl font-black tracking-tight text-amber-200 drop-shadow-sm">Skill</span>
          </div>
          <p className="text-xs text-amber-200/90 mb-3 text-center">
            使用说明：让 Agent 按文档调用本站公开 JSON，与「热点速览」数据同源。
          </p>
          <div className="rounded-lg bg-amber-950/30 p-3 font-mono text-[11px] text-amber-100 break-all border border-amber-600/40">
            Read {skillUrl} and follow the instructions to call the JSON APIs.
          </div>
          <ol className="list-decimal list-inside space-y-2 text-sm text-amber-50/95 mt-4">
            <li>用 HTTPS GET 文档中列出的接口（返回 JSON）</li>
            <li>
              将 <code className="text-amber-200 bg-amber-950/50 px-1 rounded">/api/trending/diff</code>{" "}
              用于趋势与排名变动逻辑（热点速览同源）
            </li>
          </ol>
        </div>

        <p className="text-[13px] text-muted-foreground">
          文档亦可{" "}
          <a href="/dou-u-skill.md" className="text-amber-500 underline underline-offset-2" target="_blank">
            /dou-u-skill.md
          </a>{" "}
          直接访问。
        </p>

        <p className="text-sm text-muted-foreground/90">
          本 skill 由{" "}
          <a
            href={X_FOLLOW_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-amber-300 hover:text-amber-200 underline decoration-amber-400/80 underline-offset-4"
          >
            小兜
          </a>{" "}
          开源使用。
        </p>
      </main>
    </div>
  )
}
