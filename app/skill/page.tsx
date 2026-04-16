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
          className="text-xs text-cyan-500 hover:underline"
        >
          关注 X @10UWINA8
        </a>
      </header>

      <main className="max-w-xl mx-auto px-4 py-10 text-center space-y-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">兜U新闻.skill</h1>
          <p className="text-muted-foreground text-sm">
            让 AI Agent 读取本站热搜与 10 分钟趋势变动，与网页「热点速览」数据同源。
          </p>
        </div>

        <div className="rounded-xl border border-cyan-500/50 bg-card/80 p-6 text-left space-y-4">
          <div className="text-center text-sm font-semibold text-cyan-400">
            接入说明（Skill 文档）
          </div>
          <div className="rounded-lg bg-secondary/80 p-3 font-mono text-xs text-cyan-300 break-all border border-border/50">
            Read {skillUrl} and follow the instructions to call the JSON APIs.
          </div>
          <ol className="list-decimal list-inside space-y-2 text-sm text-cyan-400/90">
            <li>用 HTTPS GET 上述文档中列出的接口（返回 JSON）</li>
            <li>将 <code className="text-foreground/90">/api/trending/diff</code>{" "}
              用于「10 分钟内排名变动」推送逻辑</li>
            <li>正文级微博抓取建议配合自建服务使用{" "}
              <a
                className="text-primary underline"
                href="https://github.com/Praeviso/crawl4weibo"
                target="_blank"
                rel="noreferrer"
              >
                crawl4weibo
              </a>
            </li>
          </ol>
        </div>

        <p className="text-xs text-muted-foreground">
          文档文件亦可通过{" "}
          <a href="/dou-u-skill.md" className="text-cyan-500 underline" target="_blank">
            /dou-u-skill.md
          </a>{" "}
          直接访问。
        </p>
      </main>
    </div>
  )
}
