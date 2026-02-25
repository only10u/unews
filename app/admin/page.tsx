"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import {
  ShieldCheck,
  Key,
  BarChart3,
  Settings,
  ArrowLeft,
  Plus,
  Copy,
  Trash2,
  Check,
  AlertTriangle,
  Eye,
  Activity,
  Globe,
  Clock,
  Shield,
  Send,
  RefreshCw,
} from "lucide-react"
import Link from "next/link"
import useSWR from "swr"

// ─── Helpers ─────────────────────────────────────────────────────────

function getStatusColor(status: string) {
  switch (status) {
    case "active": return "text-emerald-500 bg-emerald-500/10"
    case "expired": return "text-muted-foreground bg-muted"
    case "revoked": return "text-red-500 bg-red-500/10"
    case "unused": return "text-blue-400 bg-blue-400/10"
    default: return "text-muted-foreground bg-muted"
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case "active": return "使用中"
    case "expired": return "已过期"
    case "revoked": return "已吊销"
    case "unused": return "未使用"
    default: return status
  }
}

function getRiskColor(risk: string) {
  switch (risk) {
    case "high": return "text-red-500 bg-red-500/10"
    case "medium": return "text-amber-500 bg-amber-500/10"
    default: return "text-muted-foreground bg-muted"
  }
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString("zh-CN", { hour12: false })
}

function formatTimeShort(ts: number): string {
  return new Date(ts).toLocaleTimeString("zh-CN", { hour12: false })
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60_000) return "刚刚"
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}分钟前`
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}小时前`
  return `${Math.floor(diff / 86400_000)}天前`
}

// ─── API fetchers ────────────────────────────────────────────────────

function createFetcher(token: string) {
  return (url: string) =>
    fetch(url, { headers: { "x-admin-token": token } }).then((r) => {
      if (!r.ok) throw new Error("Unauthorized")
      return r.json()
    })
}

// ─── Component ───────────────────────────────────────────────────────

export default function AdminPage() {
  const [isAuthed, setIsAuthed] = useState(false)
  const [adminToken, setAdminToken] = useState("")
  const [password, setPassword] = useState("")
  const [loginError, setLoginError] = useState("")
  const [activeTab, setActiveTab] = useState("overview")
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [generateType, setGenerateType] = useState<string>("trial")
  const [isGenerating, setIsGenerating] = useState(false)

  // Push config state
  const [dingtalkUrl, setDingtalkUrl] = useState("")
  const [tgBotToken, setTgBotToken] = useState("")
  const [tgChatId, setTgChatId] = useState("")
  const [pushStatus, setPushStatus] = useState("")

  const fetcher = createFetcher(adminToken)

  // SWR hooks for real-time data
  const { data: stats, mutate: mutateStats } = useSWR(
    isAuthed ? "/api/admin/stats" : null,
    fetcher,
    { refreshInterval: 5000 }
  )
  const { data: keys, mutate: mutateKeys } = useSWR(
    isAuthed ? "/api/admin/keys" : null,
    fetcher,
    { refreshInterval: 10000 }
  )
  const { data: onlineUsers } = useSWR(
    isAuthed ? "/api/admin/heartbeat" : null,
    fetcher,
    { refreshInterval: 5000 }
  )
  const { data: logs, mutate: mutateLogs } = useSWR(
    isAuthed ? "/api/admin/logs?limit=50" : null,
    fetcher,
    { refreshInterval: 5000 }
  )

  // Login handler
  const handleLogin = async () => {
    setLoginError("")
    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      })
      if (res.ok) {
        const { token } = await res.json()
        setAdminToken(token)
        setIsAuthed(true)
      } else {
        setLoginError("密码错误")
      }
    } catch {
      setLoginError("网络错误")
    }
  }

  // Key operations
  const handleGenerateKey = async () => {
    setIsGenerating(true)
    try {
      await fetch("/api/admin/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": adminToken },
        body: JSON.stringify({ type: generateType }),
      })
      mutateKeys()
      mutateStats()
    } catch { /* ignore */ }
    setIsGenerating(false)
  }

  const handleRevokeKey = async (key: string) => {
    try {
      await fetch("/api/admin/keys", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", "x-admin-token": adminToken },
        body: JSON.stringify({ key }),
      })
      mutateKeys()
      mutateLogs()
    } catch { /* ignore */ }
  }

  const handleCopy = (key: string, id: string) => {
    navigator.clipboard.writeText(key)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  // Push test
  const handlePushTest = async (type: "dingtalk" | "telegram") => {
    setPushStatus("发送中...")
    try {
      const config = type === "dingtalk"
        ? { webhook: dingtalkUrl }
        : { botToken: tgBotToken, chatId: tgChatId }
      const res = await fetch("/api/admin/push/test", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": adminToken },
        body: JSON.stringify({ type, config }),
      })
      const data = await res.json()
      setPushStatus(data.message || data.error || "完成")
    } catch {
      setPushStatus("发送失败")
    }
    setTimeout(() => setPushStatus(""), 3000)
  }

  // Login screen
  if (!isAuthed) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-full max-w-sm p-6 rounded-xl border border-border bg-card shadow-lg space-y-4">
          <div className="flex items-center gap-2 justify-center">
            <ShieldCheck size={24} className="text-primary" />
            <h1 className="text-lg font-bold text-foreground">管理后台登录</h1>
          </div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            placeholder="请输入管理员密码"
            className="w-full px-3 py-2 rounded-md bg-input border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          {loginError && <p className="text-xs text-destructive">{loginError}</p>}
          <button
            onClick={handleLogin}
            className="w-full py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            登录
          </button>
          <p className="text-[10px] text-muted-foreground text-center">{"管理员专属入口"}</p>
          <Link href="/" className="flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={12} /> 返回首页
          </Link>
        </div>
      </div>
    )
  }

  const onlineCount = stats?.onlineCount ?? 0
  const activeKeys = stats?.activeKeys ?? 0
  const todayPV = stats?.todayPV ?? 0
  const highRiskAlerts = stats?.highRiskAlerts ?? 0

  const tabs = [
    { key: "overview", label: "总览", icon: Activity },
    { key: "keys", label: "密钥管理", icon: Key },
    { key: "online", label: "在线用户", icon: Globe },
    { key: "audit", label: "行为监控", icon: Eye },
    { key: "risk", label: "风控系统", icon: Shield },
    { key: "settings", label: "推送设置", icon: Settings },
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* Admin Header */}
      <header className="sticky top-0 z-50 glass border-b border-border/40">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            <Link href="/" className="w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors">
              <ArrowLeft size={18} />
            </Link>
            <div className="flex items-center gap-2">
              <ShieldCheck size={18} className="text-primary" />
              <h1 className="text-foreground font-bold text-lg">热点新闻管理后台</h1>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-xs font-bold text-emerald-500">{onlineCount} 在线</span>
            </div>

            <nav className="flex items-center gap-0.5 bg-secondary/50 p-1 rounded-lg">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    "flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all",
                    activeTab === tab.key
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  )}
                >
                  <tab.icon size={12} />
                  <span className="hidden xl:inline">{tab.label}</span>
                </button>
              ))}
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4">
        {/* ─── Overview ─────────────────────────────────────────── */}
        {activeTab === "overview" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: "实时在线", value: String(onlineCount), icon: Globe, color: "text-emerald-500" },
                { label: "活跃密钥", value: String(activeKeys), icon: Key, color: "text-primary" },
                { label: "今日PV", value: String(todayPV), icon: BarChart3, color: "text-blue-400" },
                { label: "风控警报", value: String(highRiskAlerts), icon: AlertTriangle, color: "text-red-500" },
              ].map((stat) => (
                <div key={stat.label} className="p-4 rounded-xl border border-border bg-card">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                    <stat.icon size={16} className={stat.color} />
                  </div>
                  <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="text-sm font-bold text-foreground mb-3">最近行为日志</h3>
              <div className="space-y-2">
                {(logs || []).slice(0, 8).map((log: { id: string; time: number; action: string; user: string; detail: string; risk: string }) => (
                  <div key={log.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-secondary/30">
                    <span className="text-[11px] text-muted-foreground font-mono w-20 shrink-0">{formatTimeShort(log.time)}</span>
                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 uppercase", getRiskColor(log.risk))}>
                      {log.risk}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0 w-24">{log.action}</span>
                    <span className="text-xs text-foreground/80 truncate flex-1">{log.detail}</span>
                  </div>
                ))}
                {(!logs || logs.length === 0) && (
                  <p className="text-xs text-muted-foreground text-center py-4">暂无日志记录</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ─── Keys Management ──────────────────────────────────── */}
        {activeTab === "keys" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-foreground">密钥管理</h2>
              <div className="flex items-center gap-2">
                <select
                  value={generateType}
                  onChange={(e) => setGenerateType(e.target.value)}
                  className="px-2 py-1.5 rounded-md bg-input border border-border text-foreground text-xs"
                >
                  <option value="trial">试用 (1天)</option>
                  <option value="weekly">周卡 (7天)</option>
                  <option value="monthly">月卡 (30天)</option>
                  <option value="annual">年卡 (365天)</option>
                </select>
                <button
                  onClick={handleGenerateKey}
                  disabled={isGenerating}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {isGenerating ? <RefreshCw size={13} className="animate-spin" /> : <Plus size={13} />}
                  生成新密钥
                </button>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="text-[11px] text-muted-foreground border-b border-border/30">
                    <th className="px-4 py-2.5 text-left font-medium">密钥</th>
                    <th className="px-4 py-2.5 text-left font-medium">类型</th>
                    <th className="px-4 py-2.5 text-left font-medium">状态</th>
                    <th className="px-4 py-2.5 text-left font-medium">有效期</th>
                    <th className="px-4 py-2.5 text-left font-medium">使用者</th>
                    <th className="px-4 py-2.5 text-left font-medium">过期时间</th>
                    <th className="px-4 py-2.5 text-center font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {(keys || []).map((k: { id: string; key: string; type: string; status: string; durationLabel: string; usedBy: string | null; expiresAt: number | null }) => (
                    <tr key={k.id} className="border-b border-border/20 hover:bg-accent/20 transition-colors">
                      <td className="px-4 py-3 text-sm font-mono text-foreground">{k.key}</td>
                      <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-full text-[10px] bg-primary/10 text-primary font-medium">{k.type}</span></td>
                      <td className="px-4 py-3"><span className={cn("px-2 py-0.5 rounded-full text-[10px] font-medium", getStatusColor(k.status))}>{getStatusLabel(k.status)}</span></td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{k.durationLabel}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{k.usedBy || "-"}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{k.expiresAt ? formatTime(k.expiresAt) : "-"}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => handleCopy(k.key, k.id)} className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors" title="复制密钥">
                            {copiedId === k.id ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                          </button>
                          {k.status !== "revoked" && (
                            <button onClick={() => handleRevokeKey(k.key)} className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors" title="吊销密钥">
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {(!keys || keys.length === 0) && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">暂无密钥</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ─── Online Users ─────────────────────────────────────── */}
        {activeTab === "online" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-foreground">在线用户 ({onlineCount})</h2>
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span className="text-xs text-emerald-500 font-medium">实时更新 (5秒刷新)</span>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="text-[11px] text-muted-foreground border-b border-border/30">
                    <th className="px-4 py-2.5 text-left font-medium">IP地址</th>
                    <th className="px-4 py-2.5 text-left font-medium">使用密钥</th>
                    <th className="px-4 py-2.5 text-left font-medium">当前页面</th>
                    <th className="px-4 py-2.5 text-left font-medium">设备指纹</th>
                    <th className="px-4 py-2.5 text-left font-medium">最后活跃</th>
                  </tr>
                </thead>
                <tbody>
                  {(onlineUsers || []).map((u: { id: string; ip: string; keyUsed: string; page: string; fingerprint?: string; lastActive: number }) => (
                    <tr key={u.id} className="border-b border-border/20 hover:bg-accent/20 transition-colors">
                      <td className="px-4 py-3 text-sm font-mono text-foreground">{u.ip}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{u.keyUsed}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{u.page}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground font-mono">{u.fingerprint ? u.fingerprint.substring(0, 12) + "..." : "-"}</td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Clock size={10} /> {relativeTime(u.lastActive)}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {(!onlineUsers || onlineUsers.length === 0) && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">暂无在线用户</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ─── Audit Logs ───────────────────────────────────────── */}
        {activeTab === "audit" && (
          <div className="space-y-4">
            <h2 className="text-base font-bold text-foreground">行为监控日志</h2>
            <div className="space-y-2">
              {(logs || []).map((log: { id: string; time: number; action: string; user: string; detail: string; risk: string }) => (
                <div key={log.id} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-card hover:bg-accent/20 transition-colors">
                  <span className="text-xs text-muted-foreground font-mono w-20 shrink-0">{formatTimeShort(log.time)}</span>
                  <span className={cn("text-[10px] px-2 py-0.5 rounded font-bold shrink-0 uppercase", getRiskColor(log.risk))}>
                    {log.risk}
                  </span>
                  <span className="text-xs font-medium text-foreground shrink-0 w-24">{log.action}</span>
                  <span className="text-xs text-muted-foreground shrink-0 font-mono w-28">{log.user}</span>
                  <span className="text-xs text-foreground/70 truncate flex-1">{log.detail}</span>
                </div>
              ))}
              {(!logs || logs.length === 0) && (
                <div className="text-center py-12 text-sm text-muted-foreground">暂无日志记录</div>
              )}
            </div>
          </div>
        )}

        {/* ─── Risk Control ─────────────────────────────────────── */}
        {activeTab === "risk" && (
          <div className="space-y-4">
            <h2 className="text-base font-bold text-foreground">风控系统</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Shield size={16} className="text-red-500" />
                  <h3 className="text-sm font-bold text-foreground">IP黑名单</h3>
                  <span className="text-[10px] text-muted-foreground ml-auto">{stats?.blacklistedIPs || 0} 个IP</span>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  密钥验证失败5次的IP将被自动封禁。异常频率访问也会被限制。
                </p>
                <div className="space-y-2">
                  {(logs || [])
                    .filter((l: { risk: string; action: string }) => l.risk === "high")
                    .slice(0, 5)
                    .map((log: { id: string; user: string; detail: string; time: number }) => (
                      <div key={log.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-red-500/5 border border-red-500/10">
                        <span className="text-xs text-foreground/80 font-mono">{log.user}</span>
                        <span className="text-[10px] text-muted-foreground truncate ml-2 flex-1">{log.detail}</span>
                        <span className="text-[10px] text-muted-foreground shrink-0">{relativeTime(log.time)}</span>
                      </div>
                    ))}
                  {(logs || []).filter((l: { risk: string }) => l.risk === "high").length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">暂无高风险事件</p>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle size={16} className="text-amber-500" />
                  <h3 className="text-sm font-bold text-foreground">速率限制规则</h3>
                </div>
                <div className="space-y-3">
                  {[
                    { rule: "API总调用", limit: "200次/分钟", status: "active" },
                    { rule: "AI总结调用", limit: "20次/分钟", status: "active" },
                    { rule: "密钥验证尝试", limit: "10次/10分钟", status: "active" },
                    { rule: "心跳上报", limit: "200次/分钟", status: "active" },
                  ].map((r) => (
                    <div key={r.rule} className="flex items-center justify-between px-3 py-2 rounded-lg bg-secondary/30">
                      <span className="text-xs text-foreground">{r.rule}</span>
                      <span className="text-xs text-muted-foreground">{r.limit}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-medium text-emerald-500 bg-emerald-500/10">
                        {r.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── Push Settings ────────────────────────────────────── */}
        {activeTab === "settings" && (
          <div className="space-y-6">
            <h2 className="text-base font-bold text-foreground">推送通知设置</h2>

            {/* DingTalk */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Send size={16} className="text-blue-400" />
                <h3 className="text-sm font-bold text-foreground">钉钉 Webhook</h3>
              </div>
              <input
                type="text"
                value={dingtalkUrl}
                onChange={(e) => setDingtalkUrl(e.target.value)}
                placeholder="https://oapi.dingtalk.com/robot/send?access_token=..."
                className="w-full px-3 py-2 rounded-md bg-input border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <button
                onClick={() => handlePushTest("dingtalk")}
                disabled={!dingtalkUrl}
                className="px-4 py-1.5 rounded-md bg-blue-500/10 text-blue-400 text-xs font-medium hover:bg-blue-500/20 transition-colors disabled:opacity-40"
              >
                发送测试消息
              </button>
            </div>

            {/* Telegram */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Send size={16} className="text-sky-400" />
                <h3 className="text-sm font-bold text-foreground">Telegram Bot</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  value={tgBotToken}
                  onChange={(e) => setTgBotToken(e.target.value)}
                  placeholder="Bot Token"
                  className="px-3 py-2 rounded-md bg-input border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <input
                  type="text"
                  value={tgChatId}
                  onChange={(e) => setTgChatId(e.target.value)}
                  placeholder="Chat ID"
                  className="px-3 py-2 rounded-md bg-input border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <button
                onClick={() => handlePushTest("telegram")}
                disabled={!tgBotToken || !tgChatId}
                className="px-4 py-1.5 rounded-md bg-sky-500/10 text-sky-400 text-xs font-medium hover:bg-sky-500/20 transition-colors disabled:opacity-40"
              >
                发送测试消息
              </button>
            </div>

            {pushStatus && (
              <div className="px-4 py-2 rounded-md bg-primary/10 text-primary text-sm font-medium">
                {pushStatus}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
