"use client"

import { X, BookOpen, Database, Bell, HelpCircle, Clock } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"

interface TutorialDialogProps {
  isOpen: boolean
  onClose: () => void
}

const sections = [
  {
    icon: Database,
    title: "数据来源",
    items: [
      "微博热搜 TOP 50 — 实时抓取，15秒刷新",
      "抖音热榜 TOP 50 — 实时抓取，15秒刷新",
      "公众号热文 TOP 50 — 今日头条热榜，15秒刷新",
    ],
  },
  {
    icon: Bell,
    title: "新消息提示",
    items: [
      "新上榜推文自动置顶10秒，绿色光效提示",
      "趋势上升条目显示红色边框",
      "热搜前三显示黄色边框",
      "开启语音播报后，新上榜时自动朗读平台名称",
    ],
  },
  {
    icon: HelpCircle,
    title: "功能说明",
    items: [
      "AI降噪：过滤娱乐八卦、明星饭圈类内容",
      "热点速览：显示10分钟内排名变化最大的条目",
      "字体调节：点击 T 图标调整推文字体大小",
      "固定置顶：点击推文右上角图钉固定任意条目",
    ],
  },
  {
    icon: Clock,
    title: "更新频率",
    items: [
      "推文列表每15秒自动刷新",
      "热点速览每10分钟更新",
    ],
  },
]

export function TutorialDialog({ isOpen, onClose }: TutorialDialogProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg max-h-[85vh] rounded-xl border border-border bg-card shadow-2xl m-4 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <BookOpen size={18} className="text-primary" />
            <h2 className="text-base font-bold text-foreground">使用说明</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            aria-label="关闭"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="p-4 flex flex-col gap-5">
            {sections.map((section) => (
              <div key={section.title}>
                <div className="flex items-center gap-2 mb-2">
                  <section.icon size={16} className="text-primary" />
                  <h3 className="text-sm font-bold text-foreground">{section.title}</h3>
                </div>
                <ul className="flex flex-col gap-1.5 pl-6">
                  {section.items.map((item) => (
                    <li key={item} className="text-xs text-muted-foreground leading-relaxed list-disc">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            <div className="pt-4 border-t border-border/30 text-center">
              <p className="text-xs text-muted-foreground">
                {"如有问题或建议，请联系："}
                <a href="https://x.com/10UWINA8" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  @10UWINA8
                </a>
              </p>
              <p className="text-[10px] text-muted-foreground/60 mt-1">
                10U News - 实时热搜聚合监控平台
              </p>
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
