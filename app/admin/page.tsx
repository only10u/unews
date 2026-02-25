"use client"

import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import {
  ShieldCheck,
  Users,
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
} from "lucide-react"
import Link from "next/link"

const ADMIN_PASSWORD = "admin2026"

interface LicenseKey {
  id: string
  key: string
  type: string
  duration: string
  createdAt: string
  usedBy: string | null
  expiresAt: string | null
  status: "active" | "expired" | "revoked" | "unused"
}

interface OnlineUser {
  id: string
  ip: string
  keyUsed: string
  page: string
  lastActive: string
  location: string
}

interface AuditLog {
  id: string
  time: string
  action: string
  user: string
  detail: string
  risk: "low" | "medium" | "high"
}

const MOCK_KEYS: LicenseKey[] = [
  { id: "1", key: "DOUU-TRIAL-2026", type: "trial", duration: "1天", createdAt: "2026-02-20", usedBy: "user@example.com", expiresAt: "2026-02-26", status: "active" },
  { id: "2", key: "DOUU-WEEK-A1B2", type: "weekly", duration: "7天", createdAt: "2026-02-18", usedBy: null, expiresAt: null, status: "unused" },
  { id: "3", key: "DOUU-MONTH-X9Y8", type: "monthly", duration: "30天", createdAt: "2026-02-15", usedBy: "vip@example.com", expiresAt: "2026-03-17", status: "active" },
  { id: "4", key: "DOUU-VIP-FOREVER", type: "annual", duration: "365天", createdAt: "2026-01-01", usedBy: "whale@example.com", expiresAt: "2027-01-01", status: "active" },
  { id: "5", key: "DOUU-TRIAL-OLD1", type: "trial", duration: "1天", createdAt: "2026-01-10", usedBy: "old@example.com", expiresAt: "2026-01-11", status: "expired" },
  { id: "6", key: "DOUU-BAD-REVOKE", type: "weekly", duration: "7天", createdAt: "2026-02-01", usedBy: "spam@example.com", expiresAt: null, status: "revoked" },
]

const MOCK_ONLINE: OnlineUser[] = [
  { id: "o1", ip: "203.0.113.42", keyUsed: "DOUU-TRIAL-2026", page: "/", lastActive: "刚刚", location: "北京" },
  { id: "o2", ip: "198.51.100.88", keyUsed: "DOUU-MONTH-X9Y8", page: "/price-monitor", lastActive: "1分钟前", location: "上海" },
  { id: "o3", ip: "192.0.2.17", keyUsed: "DOUU-VIP-FOREVER", page: "/", lastActive: "3分钟前", location: "深圳" },
  { id: "o4", ip: "198.51.100.12", keyUsed: "免费用户", page: "/price-monitor", lastActive: "刚刚", location: "杭州" },
  { id: "o5", ip: "203.0.113.99", keyUsed: "免费用户", page: "/price-monitor", lastActive: "2分钟前", location: "成都" },
]

const MOCK_AUDIT: AuditLog[] = [
  { id: "a1", time: "14:32:05", action: "密钥验证", user: "203.0.113.42", detail: "使用 DOUU-TRIAL-2026 登录成功", risk: "low" },
  { id: "a2", time: "14:28:11", action: "密钥验证", user: "192.0.2.17", detail: "使用 DOUU-VIP-FOREVER 登录成功", risk: "low" },
  { id: "a3", time: "14:25:33", action: "密钥验证失败", user: "10.0.0.55", detail: "尝试无效密钥 FAKE-KEY-XXX (第3次)", risk: "high" },
  { id: "a4", time: "14:20:17", action: "API调用", user: "198.51.100.88", detail: "请求 /api/ai/summary 频率异常 (120次/分钟)", risk: "medium" },
  { id: "a5", time: "14:15:02", action: "页面访问", user: "198.51.100.12", detail: "免费用户访问 /price-monitor", risk: "low" },
  { id: "a6", time: "14:10:45", action: "密钥验证失败", user: "10.0.0.55", detail: "尝试无效密钥 HACK-ATTEMPT (第2次)", risk: "high" },
  { id: "a7", time: "14:05:00", action: "密钥吊销", user: "admin", detail: "管理员吊销密钥 DOUU-BAD-REVOKE", risk: "medium" },
]

function getStatusColor(status: string) {
  switch (status) {
    case "active": return "text-emerald-500 bg-emerald-500/10"
    case "expired": return "text-muted-foreground bg-muted"
    case "revoked": return "text-red-500 bg-red-500/10"
    case "unused": return "text-blue-400 bg-blue-400/10"
    default: return "text-muted-foreground bg-muted"
  }
}

function getRiskColor(risk: string) {
  switch (risk) {
    case "high": return "text-red-500 bg-red-500/10"
    case "medium": return "text-amber-500 bg-amber-500/10"
    default: return "text-muted-foreground bg-muted"
  }
}

export default function AdminPage() {
  const [isAuthed, setIsAuthed] = useState(false)
  const [password, setPassword] = useState("")
  const [activeTab, setActiveTab] = useState("overview")
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [onlineCount, setOnlineCount] = useState(MOCK_ONLINE.length)

  // Simulate live online count
  useEffect(() => {
    if (!isAuthed) return
    const interval = setInterval(() => {
      setOnlineCount((prev) => Math.max(1, prev + (Math.random() > 0.5 ? 1 : -1)))
    }, 8000)
    return () => clearInterval(interval)
  }, [isAuthed])

  const handleLogin = () => {
    if (password === ADMIN_PASSWORD) setIsAuthed(true)
  }

  const handleCopy = (key: string, id: string) => {
    navigator.clipboard.writeText(key)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 1500)
  }

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
          <button
            onClick={handleLogin}
            className="w-full py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            登录
          </button>
          <p className="text-[10px] text-muted-foreground text-center">演示密码: admin2026</p>
          <Link href="/" className="flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={12} /> 返回首页
          </Link>
        </div>
      </div>
    )
  }

  const tabs = [
    { key: "overview", label: "总览", icon: Activity },
    { key: "keys", label: "密钥管理", icon: Key },
    { key: "online", label: "在线用户", icon: Globe },
    { key: "audit", label: "行为监控", icon: Eye },
    { key: "risk", label: "风控系统", icon: Shield },
    { key: "settings", label: "系统设置", icon: Settings },
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
            {/* Live online count */}
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
        {/* Overview */}
        {activeTab === "overview" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: "实时在线", value: String(onlineCount), icon: Globe, color: "text-emerald-500" },
                { label: "活跃密钥", value: String(MOCK_KEYS.filter((k) => k.status === "active").length), icon: Key, color: "text-primary" },
                { label: "今日PV", value: "5,678", icon: BarChart3, color: "text-blue-400" },
                { label: "风控警报", value: String(MOCK_AUDIT.filter((a) => a.risk === "high").length), icon: AlertTriangle, color: "text-red-500" },
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

            {/* Recent audit */}
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="text-sm font-bold text-foreground mb-3">最近行为日志</h3>
              <div className="space-y-2">
                {MOCK_AUDIT.slice(0, 5).map((log) => (
                  <div key={log.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-secondary/30">
                    <span className="text-[11px] text-muted-foreground font-mono w-16 shrink-0">{log.time}</span>
                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0", getRiskColor(log.risk))}>
                      {log.risk.toUpperCase()}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0">{log.action}</span>
                    <span className="text-xs text-foreground/80 truncate flex-1">{log.detail}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Keys */}
        {activeTab === "keys" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-foreground">密钥管理</h2>
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors">
                <Plus size={13} /> 生成新密钥
              </button>
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
                    <th className="px-4 py-2.5 text-left font-medium">到期时间</th>
                    <th className="px-4 py-2.5 text-center font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {MOCK_KEYS.map((k) => (
                    <tr key={k.id} className="border-b border-border/20 hover:bg-accent/20 transition-colors">
                      <td className="px-4 py-3 text-sm font-mono text-foreground">{k.key}</td>
                      <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-full text-[10px] bg-primary/10 text-primary font-medium">{k.type}</span></td>
                      <td className="px-4 py-3"><span className={cn("px-2 py-0.5 rounded-full text-[10px] font-medium", getStatusColor(k.status))}>{k.status}</span></td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{k.duration}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{k.usedBy || "-"}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{k.expiresAt || "-"}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => handleCopy(k.key, k.id)} className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                            {copiedId === k.id ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                          </button>
                          <button className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Online Users */}
        {activeTab === "online" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-foreground">在线用户 ({onlineCount})</h2>
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span className="text-xs text-emerald-500 font-medium">实时更新</span>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="text-[11px] text-muted-foreground border-b border-border/30">
                    <th className="px-4 py-2.5 text-left font-medium">IP地址</th>
                    <th className="px-4 py-2.5 text-left font-medium">使用密钥</th>
                    <th className="px-4 py-2.5 text-left font-medium">当前页面</th>
                    <th className="px-4 py-2.5 text-left font-medium">地区</th>
                    <th className="px-4 py-2.5 text-left font-medium">最后活跃</th>
                  </tr>
                </thead>
                <tbody>
                  {MOCK_ONLINE.map((u) => (
                    <tr key={u.id} className="border-b border-border/20 hover:bg-accent/20 transition-colors">
                      <td className="px-4 py-3 text-sm font-mono text-foreground">{u.ip}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{u.keyUsed}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{u.page}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{u.location}</td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Clock size={10} /> {u.lastActive}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Audit Logs */}
        {activeTab === "audit" && (
          <div className="space-y-4">
            <h2 className="text-base font-bold text-foreground">行为监控日志</h2>
            <div className="space-y-2">
              {MOCK_AUDIT.map((log) => (
                <div key={log.id} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-card hover:bg-accent/20 transition-colors">
                  <span className="text-xs text-muted-foreground font-mono w-16 shrink-0">{log.time}</span>
                  <span className={cn("text-[10px] px-2 py-0.5 rounded font-bold shrink-0 uppercase", getRiskColor(log.risk))}>
                    {log.risk}
                  </span>
                  <span className="text-xs font-medium text-foreground shrink-0 w-24">{log.action}</span>
                  <span className="text-xs text-muted-foreground shrink-0 font-mono w-28">{log.user}</span>
                  <span className="text-xs text-foreground/70 truncate flex-1">{log.detail}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Risk Control */}
        {activeTab === "risk" && (
          <div className="space-y-4">
            <h2 className="text-base font-bold text-foreground">风控系统</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* IP Blacklist */}
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Shield size={16} className="text-red-500" />
                  <h3 className="text-sm font-bold text-foreground">IP黑名单</h3>
                </div>
                <div className="space-y-2">
                  {["10.0.0.55 - 多次密钥破解尝试", "172.16.0.99 - API爬取行为"].map((ip) => (
                    <div key={ip} className="flex items-center justify-between px-3 py-2 rounded-lg bg-red-500/5 border border-red-500/10">
                      <span className="text-xs text-foreground/80 font-mono">{ip}</span>
                      <button className="text-[10px] text-red-500 hover:text-red-400">解封</button>
                    </div>
                  ))}
                </div>
                <button className="mt-3 w-full py-1.5 rounded-md bg-red-500/10 text-red-500 text-xs font-medium hover:bg-red-500/20 transition-colors">
                  添加IP到黑名单
                </button>
              </div>

              {/* Rate Limiting */}
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle size={16} className="text-amber-500" />
                  <h3 className="text-sm font-bold text-foreground">速率限制规则</h3>
                </div>
                <div className="space-y-3">
                  {[
                    { rule: "API总调用", limit: "100次/分钟", status: "active" },
                    { rule: "AI总结调用", limit: "20次/分钟", status: "active" },
                    { rule: "密钥验证尝试", limit: "5次/10分钟", status: "active" },
                    { rule: "热搜榜刷新", limit: "不限制", status: "inactive" },
                  ].map((r) => (
                    <div key={r.rule} className="flex items-center justify-between px-3 py-2 rounded-lg bg-secondary/30">
                      <span className="text-xs text-foreground">{r.rule}</span>
                      <span className="text-xs text-muted-foreground">{r.limit}</span>
                      <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium",
                        r.status === "active" ? "text-emerald-500 bg-emerald-500/10" : "text-muted-foreground bg-muted"
                      )}>
                        {r.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Settings */}
        {activeTab === "settings" && (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <Settings size={40} className="text-muted-foreground mx-auto mb-3" />
            <h3 className="text-foreground font-bold mb-1">系统设置</h3>
            <p className="text-sm text-muted-foreground">配置项开发中</p>
          </div>
        )}
      </main>
    </div>
  )
}
