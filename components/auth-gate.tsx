"use client"

import { useState, useEffect, useRef, type ReactNode } from "react"
import { Loader2 } from "lucide-react"

/** 构建时设为 true：自建站跳过密钥与验证请求（与 app/page 是否引用 AuthGate 无关，防止旧包仍含门禁） */
const SKIP_AUTH_GATE =
  typeof process.env.NEXT_PUBLIC_SKIP_AUTH_GATE !== "undefined" &&
  process.env.NEXT_PUBLIC_SKIP_AUTH_GATE === "true"

interface AuthGateProps {
  children: ReactNode
}

function getDeviceId(): string {
  if (typeof window === "undefined") return ""
  let deviceId = localStorage.getItem("device_id")
  if (!deviceId) {
    deviceId = crypto.randomUUID()
    localStorage.setItem("device_id", deviceId)
  }
  return deviceId
}

function AuthGateInner({ children }: AuthGateProps) {
  const [isVerifying, setIsVerifying] = useState(true)
  const [isAuthed, setIsAuthed] = useState(false)
  const [keyInput, setKeyInput] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [expiresAt, setExpiresAt] = useState<number | null>(null)
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    async function verifyToken() {
      const token = localStorage.getItem("auth_token")
      if (!token) {
        setIsVerifying(false)
        return
      }

      try {
        const res = await fetch("/api/keys/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, deviceId: getDeviceId() }),
          signal: AbortSignal.timeout(12_000),
        })
        const data = await res.json()

        if (data.valid) {
          setIsAuthed(true)
          setExpiresAt(data.expiresAt || null)
          startHeartbeat(token)
        } else {
          localStorage.removeItem("auth_token")
        }
      } catch {
        setIsAuthed(true)
      }
      setIsVerifying(false)
    }

    verifyToken()

    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current)
      }
    }
  }, [])

  const startHeartbeat = (token: string) => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current)
    }

    const sendHeartbeat = async () => {
      try {
        await fetch("/api/keys/heartbeat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
          signal: AbortSignal.timeout(10_000),
        })
      } catch {
        // 静默失败
      }
    }

    sendHeartbeat()
    heartbeatRef.current = setInterval(sendHeartbeat, 30000)
  }

  const handleActivate = async () => {
    const trimmed = keyInput.trim().toUpperCase()
    if (!trimmed) return

    setIsLoading(true)
    setError("")

    try {
      const res = await fetch("/api/keys/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: trimmed,
          deviceId: getDeviceId(),
        }),
        signal: AbortSignal.timeout(15_000),
      })

      const data = await res.json()

      if (data.success && data.token) {
        localStorage.setItem("auth_token", data.token)
        setExpiresAt(data.expiresAt || null)
        setIsAuthed(true)
        startHeartbeat(data.token)
      } else {
        setError(data.error || "密钥无效或已过期")
      }
    } catch {
      setError("网络错误，请重试")
    }

    setIsLoading(false)
  }

  if (isVerifying) {
    return (
      <div className="fixed inset-0 z-[100] bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={32} className="animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">验证中...</p>
        </div>
      </div>
    )
  }

  if (isAuthed) {
    return <>{children}</>
  }

  return (
    <div className="fixed inset-0 z-[100] bg-background flex items-center justify-center">
      <div className="w-full max-w-sm mx-4 p-8 rounded-2xl border border-border bg-card space-y-6">
        <div className="text-center space-y-2">
          <div className="text-3xl font-bold text-foreground">兜U</div>
          <h1 className="text-lg font-semibold text-foreground">热点新闻</h1>
          <p className="text-sm text-muted-foreground">请输入访问密钥以继续使用</p>
        </div>

        <input
          type="text"
          value={keyInput}
          onChange={(e) => setKeyInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleActivate()}
          className="w-full px-4 py-3 rounded-lg border border-border bg-secondary text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          placeholder="DOUU-XXXX-XXXX-XXXX"
        />

        <button
          onClick={handleActivate}
          disabled={isLoading || !keyInput.trim()}
          className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 size={16} className="animate-spin" />
              验证中...
            </span>
          ) : (
            "验证密钥"
          )}
        </button>

        {error && (
          <p className="text-xs text-destructive text-center">{error}</p>
        )}

        {expiresAt && (
          <p className="text-xs text-muted-foreground text-center">
            {"有效期至 " + new Date(expiresAt).toLocaleDateString("zh-CN")}
          </p>
        )}
      </div>
    </div>
  )
}

export function AuthGate({ children }: AuthGateProps) {
  if (SKIP_AUTH_GATE) {
    return <>{children}</>
  }
  return <AuthGateInner>{children}</AuthGateInner>
}
