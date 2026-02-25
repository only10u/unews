"use client"

import { useState, useEffect } from "react"
import { X, Plus, Trash2, Bell } from "lucide-react"
import { cn } from "@/lib/utils"

interface PushConfigProps {
  isOpen: boolean
  onClose: () => void
  scoreThreshold: number
  onScoreThresholdChange: (v: number) => void
  keywords: string[]
  onKeywordsChange: (kw: string[]) => void
}

export function PushConfig({
  isOpen,
  onClose,
  scoreThreshold,
  onScoreThresholdChange,
  keywords,
  onKeywordsChange,
}: PushConfigProps) {
  const [newKeyword, setNewKeyword] = useState("")

  // Persist to localStorage
  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      localStorage.setItem(
        "dou-u-push-config",
        JSON.stringify({ scoreThreshold, keywords })
      )
    } catch { /* ignore */ }
  }, [scoreThreshold, keywords])

  const addKeyword = () => {
    const kw = newKeyword.trim()
    if (kw && !keywords.includes(kw)) {
      onKeywordsChange([...keywords, kw])
      setNewKeyword("")
    }
  }

  const removeKeyword = (kw: string) => {
    onKeywordsChange(keywords.filter((k) => k !== kw))
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-md mx-4 max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border/50">
          <div className="flex items-center gap-2">
            <Bell size={18} className="text-primary" />
            <h2 className="text-foreground font-bold text-base">推送触发器配置</h2>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-6">
          {/* Score Threshold */}
          <div>
            <label className="text-sm font-bold text-foreground mb-3 block">
              评分阈值推送
            </label>
            <p className="text-xs text-muted-foreground mb-3">
              低于此分数的信息将进入静默列表（不震动、不报警、不置顶）
            </p>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min={0}
                max={10}
                step={0.5}
                value={scoreThreshold}
                onChange={(e) => onScoreThresholdChange(parseFloat(e.target.value))}
                className="flex-1 h-1.5 rounded-full appearance-none bg-secondary accent-primary cursor-pointer"
              />
              <span className="text-sm font-mono font-bold text-primary w-10 text-center">
                {scoreThreshold.toFixed(1)}
              </span>
            </div>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1.5 px-0.5">
              <span>全部推送</span>
              <span>仅高分</span>
            </div>
          </div>

          {/* Keyword Subscriptions */}
          <div>
            <label className="text-sm font-bold text-foreground mb-3 block">
              关键词订阅推送
            </label>
            <p className="text-xs text-muted-foreground mb-3">
              内容命中关键词时，强制弹窗+声音提醒
            </p>

            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addKeyword()}
                placeholder="输入关键词，如 Listing、空投..."
                className="flex-1 px-3 py-2 rounded-md bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                onClick={addKeyword}
                className="px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                <Plus size={16} />
              </button>
            </div>

            {keywords.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {keywords.map((kw) => (
                  <span
                    key={kw}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium"
                  >
                    {kw}
                    <button
                      onClick={() => removeKeyword(kw)}
                      className="hover:text-destructive transition-colors"
                    >
                      <Trash2 size={10} />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground/60 italic">暂无关键词</p>
            )}
          </div>

          {/* Push layer explanation */}
          <div className="p-3 rounded-lg bg-secondary/50 border border-border/30">
            <h3 className="text-xs font-bold text-foreground mb-2">推送分层说明</h3>
            <div className="space-y-1.5 text-[11px] text-muted-foreground">
              <p>
                <span className="text-primary font-bold">第一层 - 全局置顶：</span>
                {"AI评分 >= 9.0 或币价1小时异动 > 10%，带流光特效"}
              </p>
              <p>
                <span className="text-foreground font-bold">第二层 - 实时流：</span>
                {"评分 > 1.0，按时间倒序排列"}
              </p>
              <p>
                <span className="text-muted-foreground font-bold">第三层 - 叙事聚合：</span>
                {"15分钟内 > 3条同标签自动折叠为\u201C相关消息\u201D"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
