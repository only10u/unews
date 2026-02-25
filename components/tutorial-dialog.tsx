"use client"

import { X, BookOpen, Key, Volume2, Bell, TrendingUp, Shield, Coins } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"

interface TutorialDialogProps {
  isOpen: boolean
  onClose: () => void
}

const sections = [
  {
    icon: TrendingUp,
    title: "实时热搜聚合",
    items: [
      "支持微博、抖音、公众号三大平台热搜实时同步",
      "聚合频道可同时查看所有平台热搜排行",
      "推文卡片展示详细内容摘要、首图/视频封面",
      "点击标题直接跳转至对应平台的搜索结果页",
      "AI 智能总结功能可一键获取热搜深度分析",
    ],
  },
  {
    icon: Bell,
    title: "侧边栏排行榜",
    items: [
      "右侧侧边栏展示三个平台的热搜排行榜",
      "每个板块底部有独立的展开/收起按钮",
      "向左拖动侧边栏左侧拖拽手柄可扩大宽度",
      "拖至 700px 以上时，三个板块自动并排显示",
      "排名变化有实时上升/下降标识",
    ],
  },
  {
    icon: Volume2,
    title: "声音播报系统",
    items: [
      "支持 TTS 语音播报和提示音两种模式",
      "五大频道可独立开关：聚合、微博、抖音、公众号、币价",
      "可分别调整音量和语速",
      "男声/女声切换（TTS 模式）",
      "声音设置保存在本地，刷新不丢失",
    ],
  },
  {
    icon: Coins,
    title: "币价监控",
    items: [
      "底部滚动条实时显示主流加密货币价格",
      "支持自定义异动报警阈值和监控周期",
      "币价波动达阈值时触发循环报警音",
      "金狗（评分 > 9.0）触发金币碰撞音",
      "免费用户也可使用币价监控功能",
    ],
  },
  {
    icon: Key,
    title: "密钥与付费",
    items: [
      "免费用户可使用底部币价监控功能",
      "付费用户解锁推文推送、热搜排行、AI总结、声音播报",
      "点击右上角「密钥」按钮输入访问密钥",
      "密钥支持试用(1天)、周卡、月卡、年卡",
      "密钥绑定设备指纹，确保安全",
    ],
  },
  {
    icon: Shield,
    title: "其他功能",
    items: [
      "支持亮色/暗色主题切换",
      "推文可置顶、隐藏、手动刷新",
      "推送触发器可设置评分阈值和关键词过滤",
      "管理员可通过 /admin 路径进入管理后台",
      "支持钉钉 Webhook 和 Telegram Bot 推送通知",
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
