"use client"

import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { X, Key, Check, AlertCircle, ShieldCheck, Loader2 } from "lucide-react"

interface AuthDialogProps {
  isOpen: boolean
  onClose: () => void
  onAuth: (isAuthed: boolean) => void
}

function getStoredAuth(): { key: string; expiresAt: number } | null {
  if (typeof window === "undefined") return null
  try {
    const saved = localStorage.getItem("dou-u-auth")
    if (saved) {
      const data = JSON.parse(saved)
      if (data.expiresAt > Date.now()) return data
      localStorage.removeItem("dou-u-auth")
    }
  } catch {
    // ignore
  }
  return null
}

function getFingerprint(): string {
  if (typeof window === "undefined") return "server"
  try {
    const nav = window.navigator
    const screen = window.screen
    const raw = [
      nav.userAgent,
      nav.language,
      screen.width,
      screen.height,
      screen.colorDepth,
      new Date().getTimezoneOffset(),
    ].join("|")
    // Simple hash
    let hash = 0
    for (let i = 0; i < raw.length; i++) {
      hash = ((hash << 5) - hash + raw.charCodeAt(i)) | 0
    }
    return Math.abs(hash).toString(36)
  } catch {
    return "unknown"
  }
}

export function AuthDialog({ isOpen, onClose, onAuth }: AuthDialogProps) {
  const [keyInput, setKeyInput] = useState("")
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [errorMsg, setErrorMsg] = useState("")
  const [currentAuth, setCurrentAuth] = useState<{ key: string; expiresAt: number } | null>(null)

  useEffect(() => {
    const auth = getStoredAuth()
    setCurrentAuth(auth)
    if (auth) {
      // Verify with server
      fetch("/api/keys/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: auth.key }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.valid) {
            onAuth(true)
          } else {
            // Key expired/invalid on server
            localStorage.removeItem("dou-u-auth")
            setCurrentAuth(null)
            onAuth(false)
          }
        })
        .catch(() => {
          // Network error, trust local cache
          onAuth(true)
        })
    }
  }, [onAuth])

  const handleSubmit = async () => {
    const trimmed = keyInput.trim().toUpperCase()
    if (!trimmed) return

    setStatus("loading")
    setErrorMsg("")

    try {
      const res = await fetch("/api/keys/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: trimmed,
          fingerprint: getFingerprint(),
        }),
      })

      const data = await res.json()

      if (res.ok && data.success) {
        const authData = { key: data.key, expiresAt: data.expiresAt }
        localStorage.setItem("dou-u-auth", JSON.stringify(authData))
        setCurrentAuth(authData)
        setStatus("success")
        onAuth(true)
        setTimeout(() => {
          setStatus("idle")
          onClose()
        }, 1500)
      } else {
        setStatus("error")
        setErrorMsg(data.error || "密钥无效")
        setTimeout(() => setStatus("idle"), 2000)
      }
    } catch {
      setStatus("error")
      setErrorMsg("网络错误，请重试")
      setTimeout(() => setStatus("idle"), 2000)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem("dou-u-auth")
    setCurrentAuth(null)
    onAuth(false)
  }

  const formatExpiry = (ts: number) => {
    const remaining = ts - Date.now()
    const days = Math.floor(remaining / (24 * 60 * 60 * 1000))
    const hours = Math.floor((remaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000))
    if (days > 0) return `${days}天${hours}小时`
    return `${hours}小时`
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-sm rounded-xl border border-border bg-card shadow-2xl m-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Key size={18} className="text-primary" />
            <h2 className="text-base font-bold text-foreground">密钥验证</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {currentAuth ? (
            <div className="text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto">
                <ShieldCheck size={28} className="text-emerald-500" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">付费功能已激活</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {"剩余有效期: " + formatExpiry(currentAuth.expiresAt)}
                </p>
                <p className="text-[10px] text-muted-foreground/60 mt-0.5 font-mono">
                  {currentAuth.key}
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="px-4 py-2 rounded-md bg-destructive/10 text-destructive text-xs font-medium hover:bg-destructive/20 transition-colors"
              >
                退出登录
              </button>
            </div>
          ) : (
            <>
              <div>
                <p className="text-sm text-foreground mb-1">免费功能</p>
                <p className="text-xs text-muted-foreground">
                  底部币价监控、币价异动报警（注册即可使用）
                </p>
              </div>

              <div>
                <p className="text-sm text-foreground mb-1">付费功能</p>
                <p className="text-xs text-muted-foreground">
                  新闻热点推送、AI总结、声音播报（需输入密钥）
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground" htmlFor="key-input">
                  请输入访问密钥
                </label>
                <input
                  id="key-input"
                  type="text"
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                  placeholder="DOUU-XXXX-XXXX"
                  className="w-full px-3 py-2 rounded-md bg-input border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              {errorMsg && status === "error" && (
                <p className="text-xs text-destructive">{errorMsg}</p>
              )}

              <button
                onClick={handleSubmit}
                disabled={!keyInput.trim() || status === "loading"}
                className={cn(
                  "w-full py-2 rounded-md text-sm font-medium transition-all",
                  status === "success"
                    ? "bg-emerald-500 text-white"
                    : status === "error"
                    ? "bg-destructive text-destructive-foreground"
                    : "bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
                )}
              >
                {status === "loading" ? (
                  <span className="flex items-center justify-center gap-1.5">
                    <Loader2 size={14} className="animate-spin" />
                    验证中...
                  </span>
                ) : status === "success" ? (
                  <span className="flex items-center justify-center gap-1.5">
                    <Check size={14} />
                    验证成功
                  </span>
                ) : status === "error" ? (
                  <span className="flex items-center justify-center gap-1.5">
                    <AlertCircle size={14} />
                    {errorMsg || "密钥无效"}
                  </span>
                ) : (
                  "验证密钥"
                )}
              </button>

              <p className="text-[10px] text-muted-foreground/60 text-center">
                {"演示密钥: DOUU-TRIAL-2026 (1天有效)"}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
