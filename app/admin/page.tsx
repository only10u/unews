"use client"

import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import {
  ShieldCheck,
  Key,
  BarChart3,
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
  Users,
  Database,
  Search,
  ChevronDown,
  XCircle,
  Zap,
  Lock,
  Download,
  Hash,
  Server,
  Fingerprint,
  Ban,
  FileText,
  Settings,
  LogOut,
} from "lucide-react"
import Link from "next/link"
import useSWR from "swr"

// ---- Helpers ----

function getStatusColor(s: string) {
  switch (s) {
    case "active": return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
    case "expired": return "text-muted-foreground bg-muted/50 border-border/30"
    case "revoked": return "text-red-400 bg-red-500/10 border-red-500/20"
    case "unused": return "text-blue-400 bg-blue-500/10 border-blue-500/20"
    default: return "text-muted-foreground bg-muted/50 border-border/30"
  }
}
function getStatusLabel(s: string) {
  switch (s) { case "active": return "使用中"; case "expired": return "已过期"; case "revoked": return "已吊销"; case "unused": return "未使用"; default: return s }
}
function getRiskColor(r: string) {
  switch (r) { case "high": return "text-red-400 bg-red-500/10"; case "medium": return "text-amber-400 bg-amber-500/10"; default: return "text-emerald-400 bg-emerald-500/10" }
}
function getRiskLabel(r: string) {
  switch (r) { case "high": return "高危"; case "medium": return "中风险"; default: return "安全" }
}
function formatTime(ts: number) { return new Date(ts).toLocaleString("zh-CN", { hour12: false }) }
function formatTimeShort(ts: number) { return new Date(ts).toLocaleTimeString("zh-CN", { hour12: false }) }
function relativeTime(ts: number) {
  const d = Date.now() - ts
  if (d < 60_000) return "刚刚"
  if (d < 3600_000) return `${Math.floor(d / 60_000)} 分钟前`
  if (d < 86400_000) return `${Math.floor(d / 3600_000)} 小时前`
  return `${Math.floor(d / 86400_000)} 天前`
}

function createFetcher(token: string) {
  return (url: string) => fetch(url, { headers: { "x-admin-token": token } }).then((r) => { if (!r.ok) throw new Error("Unauthorized"); return r.json() })
}

// ---- Stat Card ----
function StatCard({ label, value, icon: Icon, color, sub }: { label: string; value: string | number; icon: React.ComponentType<{ size?: number; className?: string }>; color: string; sub?: string }) {
  return (
    <div className="p-4 rounded-xl border border-border/60 bg-card hover:border-border transition-colors">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", color.replace("text-", "bg-").replace("500", "500/10"))}>
          <Icon size={16} className={color} />
        </div>
      </div>
      <p className="text-2xl font-bold text-foreground tracking-tight">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-1">{sub}</p>}
    </div>
  )
}

// ---- Main ----

export default function AdminPage() {
  const [isAuthed, setIsAuthed] = useState(false)
  const [adminToken, setAdminToken] = useState("")
  const [password, setPassword] = useState("")
  const [loginError, setLoginError] = useState("")
  const [activeTab, setActiveTab] = useState("dashboard")
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [generateType, setGenerateType] = useState<string>("trial")
  const [isGenerating, setIsGenerating] = useState(false)
  const [keyFilter, setKeyFilter] = useState("all")
  const [logSearch, setLogSearch] = useState("")
  const [logRiskFilter, setLogRiskFilter] = useState("all")

  // Push state
  const [dingtalkUrl, setDingtalkUrl] = useState("")
  const [tgBotToken, setTgBotToken] = useState("")
  const [tgChatId, setTgChatId] = useState("")
  const [pushStatus, setPushStatus] = useState("")

  // Seed data state
  const [seedKeyType, setSeedKeyType] = useState<string>("trial")
  const [seedCount, setSeedCount] = useState(5)
  const [seeding, setSeeding] = useState(false)
  const [seedResult, setSeedResult] = useState("")

  const fetcher = createFetcher(adminToken)

  const { data: stats, mutate: mutateStats } = useSWR(isAuthed ? "/api/admin/stats" : null, fetcher, { refreshInterval: 5000 })
  const { data: keys, mutate: mutateKeys } = useSWR(isAuthed ? "/api/admin/keys" : null, fetcher, { refreshInterval: 10000 })
  const { data: onlineUsers } = useSWR(isAuthed ? "/api/admin/heartbeat" : null, fetcher, { refreshInterval: 5000 })
  const { data: logs, mutate: mutateLogs } = useSWR(isAuthed ? "/api/admin/logs?limit=100" : null, fetcher, { refreshInterval: 5000 })

  // Persist session
  useEffect(() => {
    const saved = sessionStorage.getItem("admin-token")
    if (saved) { setAdminToken(saved); setIsAuthed(true) }
  }, [])

  const handleLogin = async () => {
    setLoginError("")
    try {
      const res = await fetch("/api/admin/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) })
      if (res.ok) {
        const { token } = await res.json()
        setAdminToken(token)
        sessionStorage.setItem("admin-token", token)
        setIsAuthed(true)
      } else { setLoginError("密码错误，请重试") }
    } catch { setLoginError("网络连接失败") }
  }

  const handleLogout = () => {
    setIsAuthed(false)
    setAdminToken("")
    sessionStorage.removeItem("admin-token")
  }

  const handleGenerateKey = async () => {
    setIsGenerating(true)
    try {
      await fetch("/api/admin/keys", { method: "POST", headers: { "Content-Type": "application/json", "x-admin-token": adminToken }, body: JSON.stringify({ type: generateType }) })
      mutateKeys(); mutateStats()
    } catch { /* */ }
    setIsGenerating(false)
  }

  const handleRevokeKey = async (key: string) => {
    try {
      await fetch("/api/admin/keys", { method: "DELETE", headers: { "Content-Type": "application/json", "x-admin-token": adminToken }, body: JSON.stringify({ key }) })
      mutateKeys(); mutateLogs()
    } catch { /* */ }
  }

  const handleCopy = (key: string, id: string) => {
    navigator.clipboard.writeText(key); setCopiedId(id); setTimeout(() => setCopiedId(null), 1500)
  }

  const handlePushTest = async (type: "dingtalk" | "telegram") => {
    setPushStatus("发送中...")
    try {
      const config = type === "dingtalk" ? { webhook: dingtalkUrl } : { botToken: tgBotToken, chatId: tgChatId }
      const res = await fetch("/api/admin/push/test", { method: "POST", headers: { "Content-Type": "application/json", "x-admin-token": adminToken }, body: JSON.stringify({ type, config }) })
      const data = await res.json()
      setPushStatus(data.message || data.error || "完成")
    } catch { setPushStatus("发送失败") }
    setTimeout(() => setPushStatus(""), 3000)
  }

  const handleSeedBatch = async () => {
    setSeeding(true); setSeedResult("")
    try {
      const results = []
      for (let i = 0; i < seedCount; i++) {
        const res = await fetch("/api/admin/keys", { method: "POST", headers: { "Content-Type": "application/json", "x-admin-token": adminToken }, body: JSON.stringify({ type: seedKeyType }) })
        if (res.ok) { const k = await res.json(); results.push(k.key) }
      }
      setSeedResult(`成功生成 ${results.length} 个密钥`)
      mutateKeys(); mutateStats()
    } catch { setSeedResult("批量生成失败") }
    setSeeding(false)
  }

  // ---- Login Screen ----
  if (!isAuthed) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-[380px]">
          <div className="p-8 rounded-2xl border border-border/60 bg-card shadow-2xl shadow-black/5">
            <div className="flex flex-col items-center gap-3 mb-8">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <ShieldCheck size={28} className="text-primary" />
              </div>
              <div className="text-center">
                <h1 className="text-xl font-bold text-foreground">管理后台</h1>
                <p className="text-xs text-muted-foreground mt-1">10U News Control Panel</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">管理员密码</label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                    placeholder="请输入密码"
                    className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-input border border-border text-foreground text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all"
                  />
                </div>
              </div>
              {loginError && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
                  <XCircle size={13} className="text-red-400 shrink-0" />
                  <p className="text-xs text-red-400">{loginError}</p>
                </div>
              )}
              <button onClick={handleLogin} className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-colors active:scale-[0.98]">
                验证并登录
              </button>
            </div>

            <div className="mt-6 pt-4 border-t border-border/40">
              <Link href="/" className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft size={12} /> 返回网站首页
              </Link>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground/40 text-center mt-4">Admin Panel v2.0 - Authorized Access Only</p>
        </div>
      </div>
    )
  }

  // ---- Computed ----
  const onlineCount = stats?.onlineCount ?? 0
  const activeKeys = stats?.activeKeys ?? 0
  const totalKeys = stats?.totalKeys ?? 0
  const todayPV = stats?.todayPV ?? 0
  const highRisk = stats?.highRiskAlerts ?? 0
  const blacklistedIPs = stats?.blacklistedIPs ?? 0

  const filteredKeys = (keys || []).filter((k: { status: string }) => keyFilter === "all" || k.status === keyFilter)
  const filteredLogs = (logs || []).filter((l: { risk: string; action: string; detail: string; user: string }) => {
    if (logRiskFilter !== "all" && l.risk !== logRiskFilter) return false
    if (logSearch) {
      const q = logSearch.toLowerCase()
      return l.action.toLowerCase().includes(q) || l.detail.toLowerCase().includes(q) || l.user.toLowerCase().includes(q)
    }
    return true
  })

  const tabs = [
    { key: "dashboard", label: "仪表盘", icon: BarChart3 },
    { key: "keys", label: "密钥管理", icon: Key },
    { key: "users", label: "用户管理", icon: Users },
    { key: "audit", label: "行为日志", icon: FileText },
    { key: "risk", label: "风控系统", icon: Shield },
    { key: "seed", label: "种子数据", icon: Database },
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* ---- Header ---- */}
      <header className="sticky top-0 z-50 glass border-b border-border/40">
        <div className="flex items-center justify-between px-4 lg:px-6 h-14">
          <div className="flex items-center gap-3">
            <Link href="/" className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors" title="返回首页">
              <ArrowLeft size={16} />
            </Link>
            <div className="h-5 w-px bg-border/60" />
            <div className="flex items-center gap-2">
              <ShieldCheck size={18} className="text-primary" />
              <h1 className="text-foreground font-bold hidden sm:block">10U News Admin</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Live indicator */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-xs font-bold text-emerald-400">{onlineCount} 在线</span>
            </div>

            {/* Tab Nav */}
            <nav className="flex items-center gap-0.5 bg-secondary/60 p-0.5 rounded-lg overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    "flex items-center gap-1.5 px-2 lg:px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap",
                    activeTab === tab.key
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  )}
                >
                  <tab.icon size={13} />
                  <span className="hidden lg:inline">{tab.label}</span>
                </button>
              ))}
            </nav>

            <button onClick={handleLogout} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors" title="退出登录">
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 lg:p-6">

        {/* ========== DASHBOARD ========== */}
        {activeTab === "dashboard" && (
          <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard label="实时在线" value={onlineCount} icon={Globe} color="text-emerald-500" sub="30秒心跳 / 5分钟超时" />
              <StatCard label="活跃密钥" value={`${activeKeys} / ${totalKeys}`} icon={Key} color="text-primary" sub={`${totalKeys - activeKeys} 已失效`} />
              <StatCard label="今日PV" value={todayPV} icon={BarChart3} color="text-blue-400" sub="页面访问总量" />
              <StatCard label="风控警报" value={highRisk} icon={AlertTriangle} color="text-red-500" sub={`${blacklistedIPs} 个IP被封`} />
            </div>

            {/* Two columns: Recent Logs + Online Users */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Recent Logs */}
              <div className="rounded-xl border border-border/60 bg-card p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Activity size={14} className="text-primary" /> 实时日志
                  </h3>
                  <button onClick={() => setActiveTab("audit")} className="text-[10px] text-primary hover:text-primary/80 font-medium">查看全部</button>
                </div>
                <div className="space-y-1.5">
                  {(logs || []).slice(0, 10).map((log: { id: string; time: number; action: string; user: string; detail: string; risk: string }) => (
                    <div key={log.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-accent/30 transition-colors">
                      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", log.risk === "high" ? "bg-red-500" : log.risk === "medium" ? "bg-amber-500" : "bg-emerald-500")} />
                      <span className="text-[10px] text-muted-foreground font-mono w-14 shrink-0">{formatTimeShort(log.time)}</span>
                      <span className="text-[11px] text-foreground/80 font-medium w-20 shrink-0 truncate">{log.action}</span>
                      <span className="text-[10px] text-muted-foreground truncate flex-1">{log.detail}</span>
                    </div>
                  ))}
                  {(!logs || logs.length === 0) && <p className="text-xs text-muted-foreground text-center py-6">暂无日志</p>}
                </div>
              </div>

              {/* Online Users Preview */}
              <div className="rounded-xl border border-border/60 bg-card p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Globe size={14} className="text-emerald-500" /> 在线用户
                  </h3>
                  <button onClick={() => setActiveTab("users")} className="text-[10px] text-primary hover:text-primary/80 font-medium">查看全部</button>
                </div>
                <div className="space-y-1.5">
                  {(onlineUsers || []).slice(0, 8).map((u: { id: string; ip: string; keyUsed: string; page: string; lastActive: number; fingerprint?: string }) => (
                    <div key={u.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-accent/30 transition-colors">
                      <span className="relative flex h-2 w-2 shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                      </span>
                      <span className="text-[11px] font-mono text-foreground/80 w-24 shrink-0 truncate">{u.ip}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0 w-16 truncate">{u.keyUsed === "free" ? "免费" : u.keyUsed.slice(0, 10)}</span>
                      <span className="text-[10px] text-muted-foreground truncate flex-1">{u.page}</span>
                      <span className="text-[10px] text-muted-foreground/60 shrink-0">{relativeTime(u.lastActive)}</span>
                    </div>
                  ))}
                  {(!onlineUsers || onlineUsers.length === 0) && <p className="text-xs text-muted-foreground text-center py-6">暂无在线用户</p>}
                </div>
              </div>
            </div>

            {/* System Architecture Flow */}
            <div className="rounded-xl border border-border/60 bg-card p-4">
              <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                <Server size={14} className="text-primary" /> 系统架构流程
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  { step: "1", title: "密钥生成", desc: "管理员生成不同时效密钥", icon: Key, col: "text-blue-400" },
                  { step: "2", title: "用户激活", desc: "用户输入密钥绑定设备", icon: Fingerprint, col: "text-primary" },
                  { step: "3", title: "心跳追踪", desc: "30秒上报 / 5分钟超时", icon: Activity, col: "text-emerald-400" },
                  { step: "4", title: "行为审计", desc: "全链路日志与风险评估", icon: Eye, col: "text-amber-400" },
                  { step: "5", title: "风控封禁", desc: "5次失败自动封禁IP", icon: Ban, col: "text-red-400" },
                ].map((item) => (
                  <div key={item.step} className="p-3 rounded-lg bg-secondary/30 border border-border/30 text-center">
                    <div className={cn("w-8 h-8 rounded-lg mx-auto mb-2 flex items-center justify-center", item.col.replace("text-", "bg-").replace("400", "500/10"))}>
                      <item.icon size={14} className={item.col} />
                    </div>
                    <p className="text-xs font-bold text-foreground mb-0.5">{item.title}</p>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ========== KEYS ========== */}
        {activeTab === "keys" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2"><Key size={18} className="text-primary" /> 密钥管理</h2>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Filter */}
                <div className="flex items-center gap-0.5 bg-secondary/60 p-0.5 rounded-lg">
                  {[
                    { k: "all", l: "全部" }, { k: "active", l: "使用中" }, { k: "unused", l: "未使用" }, { k: "expired", l: "已过期" }, { k: "revoked", l: "已吊销" },
                  ].map((f) => (
                    <button key={f.k} onClick={() => setKeyFilter(f.k)} className={cn("px-2 py-1 rounded-md text-[11px] font-medium transition-colors", keyFilter === f.k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                      {f.l}
                    </button>
                  ))}
                </div>
                {/* Generate */}
                <select value={generateType} onChange={(e) => setGenerateType(e.target.value)} className="px-2 py-1.5 rounded-lg bg-input border border-border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary/40">
                  <option value="trial">试用 (1天)</option>
                  <option value="weekly">周卡 (7天)</option>
                  <option value="monthly">月卡 (30天)</option>
                  <option value="annual">年卡 (365天)</option>
                </select>
                <button onClick={handleGenerateKey} disabled={isGenerating} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 active:scale-[0.98]">
                  {isGenerating ? <RefreshCw size={13} className="animate-spin" /> : <Plus size={13} />}
                  生成密钥
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-[11px] text-muted-foreground border-b border-border/40 bg-secondary/20">
                      <th className="px-4 py-3 text-left font-semibold">密钥</th>
                      <th className="px-4 py-3 text-left font-semibold">类型</th>
                      <th className="px-4 py-3 text-left font-semibold">状态</th>
                      <th className="px-4 py-3 text-left font-semibold">有效期</th>
                      <th className="px-4 py-3 text-left font-semibold">使用者</th>
                      <th className="px-4 py-3 text-left font-semibold">过期时间</th>
                      <th className="px-4 py-3 text-center font-semibold">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredKeys.map((k: { id: string; key: string; type: string; status: string; durationLabel: string; usedBy: string | null; expiresAt: number | null; createdAt: number }) => (
                      <tr key={k.id} className="border-b border-border/20 hover:bg-accent/20 transition-colors group">
                        <td className="px-4 py-3">
                          <span className="text-sm font-mono text-foreground bg-secondary/40 px-2 py-0.5 rounded">{k.key}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] bg-primary/10 text-primary font-bold border border-primary/20">{k.type}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold border", getStatusColor(k.status))}>{getStatusLabel(k.status)}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{k.durationLabel}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{k.usedBy || <span className="text-muted-foreground/40">-</span>}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{k.expiresAt ? formatTime(k.expiresAt) : <span className="text-muted-foreground/40">-</span>}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => handleCopy(k.key, k.id)} className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors" title="复制">
                              {copiedId === k.id ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                            </button>
                            {k.status !== "revoked" && (
                              <button onClick={() => handleRevokeKey(k.key)} className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors" title="吊销">
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredKeys.length === 0 && (
                      <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">暂无密钥数据</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-2.5 border-t border-border/30 bg-secondary/10 flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">共 {filteredKeys.length} 条记录</span>
                <button onClick={() => mutateKeys()} className="text-[10px] text-primary hover:text-primary/80 font-medium flex items-center gap-1"><RefreshCw size={10} /> 刷新</button>
              </div>
            </div>
          </div>
        )}

        {/* ========== USERS ========== */}
        {activeTab === "users" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2"><Users size={18} className="text-emerald-500" /> 用户管理 <span className="text-sm font-normal text-muted-foreground">({onlineCount} 在线)</span></h2>
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" /></span>
                <span className="text-xs text-emerald-400 font-medium">实时更新中 (5s)</span>
              </div>
            </div>
            <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-[11px] text-muted-foreground border-b border-border/40 bg-secondary/20">
                      <th className="px-4 py-3 text-left font-semibold">状态</th>
                      <th className="px-4 py-3 text-left font-semibold">IP 地址</th>
                      <th className="px-4 py-3 text-left font-semibold">使用密钥</th>
                      <th className="px-4 py-3 text-left font-semibold">当前页面</th>
                      <th className="px-4 py-3 text-left font-semibold">设备指纹</th>
                      <th className="px-4 py-3 text-left font-semibold">最后活跃</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(onlineUsers || []).map((u: { id: string; ip: string; keyUsed: string; page: string; fingerprint?: string; lastActive: number }) => (
                      <tr key={u.id} className="border-b border-border/20 hover:bg-accent/20 transition-colors">
                        <td className="px-4 py-3">
                          <span className="relative flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm font-mono text-foreground">{u.ip}</td>
                        <td className="px-4 py-3">
                          <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium border", u.keyUsed === "free" ? "bg-secondary/50 text-muted-foreground border-border/30" : "bg-primary/10 text-primary border-primary/20")}>
                            {u.keyUsed === "free" ? "免费用户" : u.keyUsed.length > 15 ? u.keyUsed.slice(0, 15) + "..." : u.keyUsed}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{u.page}</td>
                        <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{u.fingerprint ? u.fingerprint.substring(0, 16) : "-"}</td>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-1 text-xs text-muted-foreground"><Clock size={10} /> {relativeTime(u.lastActive)}</span>
                        </td>
                      </tr>
                    ))}
                    {(!onlineUsers || onlineUsers.length === 0) && (
                      <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">暂无在线用户</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========== AUDIT LOGS ========== */}
        {activeTab === "audit" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2"><FileText size={18} className="text-amber-400" /> 行为日志</h2>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text" value={logSearch} onChange={(e) => setLogSearch(e.target.value)} placeholder="搜索日志..."
                    className="pl-8 pr-3 py-1.5 w-44 rounded-lg bg-input border border-border text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/40"
                  />
                </div>
                <div className="flex items-center gap-0.5 bg-secondary/60 p-0.5 rounded-lg">
                  {[
                    { k: "all", l: "全部" }, { k: "low", l: "安全" }, { k: "medium", l: "中危" }, { k: "high", l: "高危" },
                  ].map((f) => (
                    <button key={f.k} onClick={() => setLogRiskFilter(f.k)} className={cn("px-2 py-1 rounded-md text-[11px] font-medium transition-colors", logRiskFilter === f.k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                      {f.l}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
              <div className="divide-y divide-border/20">
                {filteredLogs.map((log: { id: string; time: number; action: string; user: string; detail: string; risk: string }) => (
                  <div key={log.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent/20 transition-colors">
                    <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", log.risk === "high" ? "bg-red-500" : log.risk === "medium" ? "bg-amber-500" : "bg-emerald-500")} />
                    <span className="text-[10px] text-muted-foreground font-mono w-16 shrink-0">{formatTimeShort(log.time)}</span>
                    <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0", getRiskColor(log.risk))}>{getRiskLabel(log.risk)}</span>
                    <span className="text-[11px] font-medium text-foreground shrink-0 w-24 truncate">{log.action}</span>
                    <span className="text-[10px] text-muted-foreground font-mono shrink-0 w-24 truncate">{log.user}</span>
                    <span className="text-[11px] text-foreground/60 truncate flex-1">{log.detail}</span>
                  </div>
                ))}
                {filteredLogs.length === 0 && <div className="px-4 py-12 text-center text-sm text-muted-foreground">暂无日志记录</div>}
              </div>
              <div className="px-4 py-2.5 border-t border-border/30 bg-secondary/10 flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">共 {filteredLogs.length} 条 (最近100条)</span>
                <button onClick={() => mutateLogs()} className="text-[10px] text-primary hover:text-primary/80 font-medium flex items-center gap-1"><RefreshCw size={10} /> 刷新</button>
              </div>
            </div>
          </div>
        )}

        {/* ========== RISK ========== */}
        {activeTab === "risk" && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2"><Shield size={18} className="text-red-400" /> 风控系统</h2>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <StatCard label="封禁IP数" value={blacklistedIPs} icon={Ban} color="text-red-500" sub="5次失败自动封禁" />
              <StatCard label="高危事件" value={highRisk} icon={AlertTriangle} color="text-amber-500" sub="需要关注处理" />
              <StatCard label="今日请求" value={todayPV} icon={Zap} color="text-blue-400" sub="API总调用量" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* IP Blacklist */}
              <div className="rounded-xl border border-border/60 bg-card p-4">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center"><Ban size={14} className="text-red-400" /></div>
                  <h3 className="text-sm font-bold text-foreground">IP 黑名单</h3>
                  <span className="text-[10px] text-muted-foreground ml-auto bg-secondary/50 px-2 py-0.5 rounded-full">{blacklistedIPs} 个</span>
                </div>
                <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
                  密钥验证连续失败 5 次的 IP 将被自动加入黑名单。高频异常访问也会触发速率限制。
                </p>
                <div className="space-y-1.5">
                  {(logs || []).filter((l: { risk: string }) => l.risk === "high").slice(0, 6).map((log: { id: string; user: string; detail: string; time: number }) => (
                    <div key={log.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/5 border border-red-500/10">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                      <span className="text-xs text-foreground/80 font-mono w-24 shrink-0 truncate">{log.user}</span>
                      <span className="text-[10px] text-muted-foreground truncate flex-1">{log.detail}</span>
                      <span className="text-[10px] text-muted-foreground/60 shrink-0">{relativeTime(log.time)}</span>
                    </div>
                  ))}
                  {(logs || []).filter((l: { risk: string }) => l.risk === "high").length === 0 && (
                    <div className="text-center py-6 text-xs text-muted-foreground">暂无高危事件，系统运行正常</div>
                  )}
                </div>
              </div>

              {/* Rate Limit Rules */}
              <div className="rounded-xl border border-border/60 bg-card p-4">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center"><Zap size={14} className="text-amber-400" /></div>
                  <h3 className="text-sm font-bold text-foreground">速率限制规则</h3>
                </div>
                <div className="space-y-2">
                  {[
                    { rule: "API 总调用", limit: "200 次/分钟", desc: "全局接口限制", active: true },
                    { rule: "AI 总结调用", limit: "20 次/分钟", desc: "防止滥用AI接口", active: true },
                    { rule: "密钥验证尝试", limit: "10 次/10分钟", desc: "防暴力破解密钥", active: true },
                    { rule: "心跳上报", limit: "200 次/分钟", desc: "在线状态追踪", active: true },
                    { rule: "管理员登录", limit: "5 次/30分钟", desc: "失败5次封禁IP", active: true },
                  ].map((r) => (
                    <div key={r.rule} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-secondary/30 border border-border/20">
                      <div>
                        <p className="text-xs font-medium text-foreground">{r.rule}</p>
                        <p className="text-[10px] text-muted-foreground">{r.desc}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-muted-foreground">{r.limit}</span>
                        <span className="w-2 h-2 rounded-full bg-emerald-500" title="已启用" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Security Architecture */}
            <div className="rounded-xl border border-border/60 bg-card p-4">
              <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2"><Lock size={14} className="text-primary" /> 安全机制总览</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { t: "设备绑定", d: "密钥激活后绑定设备指纹，防止共享", icon: Fingerprint },
                  { t: "密钥过期", d: "到期自动失效，按类型设置有效期", icon: Clock },
                  { t: "行为审计", d: "全链路日志记录，三级风险评估", icon: Eye },
                  { t: "自动封禁", d: "5次密钥验证失败即封禁IP", icon: Ban },
                ].map((s) => (
                  <div key={s.t} className="p-3 rounded-lg bg-secondary/20 border border-border/20">
                    <s.icon size={14} className="text-primary mb-2" />
                    <p className="text-xs font-bold text-foreground mb-0.5">{s.t}</p>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">{s.d}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ========== SEED DATA ========== */}
        {activeTab === "seed" && (
          <div className="space-y-6">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2"><Database size={18} className="text-blue-400" /> 种子数据</h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Batch Key Generation */}
              <div className="rounded-xl border border-border/60 bg-card p-5 space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center"><Key size={16} className="text-primary" /></div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">批量生成密钥</h3>
                    <p className="text-[10px] text-muted-foreground">一键批量生成指定类型的密钥</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-1 block">密钥类型</label>
                    <select value={seedKeyType} onChange={(e) => setSeedKeyType(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary/40">
                      <option value="trial">试用 (1天)</option>
                      <option value="weekly">周卡 (7天)</option>
                      <option value="monthly">月卡 (30天)</option>
                      <option value="annual">年卡 (365天)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-1 block">生成数量</label>
                    <input type="number" value={seedCount} onChange={(e) => setSeedCount(Number(e.target.value))} min={1} max={50} className="w-full px-3 py-2 rounded-lg bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary/40" />
                  </div>
                </div>
                <button onClick={handleSeedBatch} disabled={seeding} className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 active:scale-[0.98]">
                  {seeding ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
                  {seeding ? "生成中..." : `批量生成 ${seedCount} 个密钥`}
                </button>
                {seedResult && (
                  <div className="px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 font-medium flex items-center gap-2">
                    <Check size={13} /> {seedResult}
                  </div>
                )}
              </div>

              {/* Push Notification Config */}
              <div className="rounded-xl border border-border/60 bg-card p-5 space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center"><Send size={16} className="text-blue-400" /></div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">推送通知配置</h3>
                    <p className="text-[10px] text-muted-foreground">配置钉钉/Telegram实时推送</p>
                  </div>
                </div>

                {/* DingTalk */}
                <div className="space-y-2">
                  <label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">钉钉 Webhook</label>
                  <input type="text" value={dingtalkUrl} onChange={(e) => setDingtalkUrl(e.target.value)} placeholder="https://oapi.dingtalk.com/robot/send?access_token=..." className="w-full px-3 py-2 rounded-lg bg-input border border-border text-foreground text-xs placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/40" />
                  <button onClick={() => handlePushTest("dingtalk")} disabled={!dingtalkUrl} className="px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 text-xs font-medium hover:bg-blue-500/20 transition-colors disabled:opacity-30">
                    发送测试
                  </button>
                </div>

                {/* Telegram */}
                <div className="space-y-2">
                  <label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Telegram Bot</label>
                  <div className="grid grid-cols-2 gap-2">
                    <input type="text" value={tgBotToken} onChange={(e) => setTgBotToken(e.target.value)} placeholder="Bot Token" className="px-3 py-2 rounded-lg bg-input border border-border text-foreground text-xs placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/40" />
                    <input type="text" value={tgChatId} onChange={(e) => setTgChatId(e.target.value)} placeholder="Chat ID" className="px-3 py-2 rounded-lg bg-input border border-border text-foreground text-xs placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/40" />
                  </div>
                  <button onClick={() => handlePushTest("telegram")} disabled={!tgBotToken || !tgChatId} className="px-3 py-1.5 rounded-lg bg-sky-500/10 text-sky-400 text-xs font-medium hover:bg-sky-500/20 transition-colors disabled:opacity-30">
                    发送测试
                  </button>
                </div>

                {pushStatus && (
                  <div className="px-3 py-2 rounded-lg bg-primary/10 text-primary text-xs font-medium">{pushStatus}</div>
                )}
              </div>
            </div>

            {/* Data Overview */}
            <div className="rounded-xl border border-border/60 bg-card p-5">
              <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2"><Hash size={14} className="text-primary" /> 数据存储概览</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "密钥总数", value: totalKeys, icon: Key, color: "text-primary" },
                  { label: "在线用户", value: onlineCount, icon: Users, color: "text-emerald-400" },
                  { label: "审计日志", value: (logs || []).length, icon: FileText, color: "text-amber-400" },
                  { label: "黑名单IP", value: blacklistedIPs, icon: Ban, color: "text-red-400" },
                ].map((item) => (
                  <div key={item.label} className="p-3 rounded-lg bg-secondary/20 border border-border/20 text-center">
                    <item.icon size={16} className={cn(item.color, "mx-auto mb-2")} />
                    <p className="text-xl font-bold text-foreground">{item.value}</p>
                    <p className="text-[10px] text-muted-foreground">{item.label}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 p-3 rounded-lg bg-amber-500/5 border border-amber-500/10">
                <p className="text-[10px] text-amber-400 leading-relaxed flex items-start gap-2">
                  <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                  当前使用内存存储模式，服务重启后数据将重置。如需持久化，请在侧栏 Connect 中接入 Supabase 或 Neon 数据库。
                </p>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  )
}
