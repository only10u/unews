// In-memory admin data store
// NOTE: Data resets on server restart. For production, connect to a database.

import crypto from "crypto"

// ─── Types ───────────────────────────────────────────────────────────

export interface AccessKey {
  id: string
  key: string
  type: "trial" | "weekly" | "monthly" | "annual"
  durationMs: number
  durationLabel: string
  createdAt: number
  activatedAt: number | null
  expiresAt: number | null
  usedBy: string | null          // device fingerprint or email
  status: "unused" | "active" | "expired" | "revoked"
}

export interface OnlineUser {
  id: string
  ip: string
  keyUsed: string
  page: string
  lastActive: number
  userAgent?: string
  fingerprint?: string
}

export interface AuditLog {
  id: string
  time: number
  action: string
  user: string       // IP or user identifier
  detail: string
  risk: "low" | "medium" | "high"
}

export interface PushConfig {
  dingtalkWebhook: string
  telegramBotToken: string
  telegramChatId: string
}

export interface RateLimitEntry {
  count: number
  resetAt: number
}

// ─── Duration map ────────────────────────────────────────────────────

const DURATION_MAP: Record<AccessKey["type"], { ms: number; label: string }> = {
  trial:   { ms: 1 * 24 * 60 * 60 * 1000, label: "1天" },
  weekly:  { ms: 7 * 24 * 60 * 60 * 1000, label: "7天" },
  monthly: { ms: 30 * 24 * 60 * 60 * 1000, label: "30天" },
  annual:  { ms: 365 * 24 * 60 * 60 * 1000, label: "365天" },
}

export function getDurationMap() { return DURATION_MAP }

// ─── Store ───────────────────────────────────────────────────────────

class AdminStore {
  keys: Map<string, AccessKey> = new Map()
  onlineUsers: Map<string, OnlineUser> = new Map()
  auditLogs: AuditLog[] = []
  pushConfig: PushConfig = { dingtalkWebhook: "", telegramBotToken: "", telegramChatId: "" }
  ipBlacklist: Set<string> = new Set()
  rateLimits: Map<string, RateLimitEntry> = new Map()
  failedAttempts: Map<string, number> = new Map()   // IP → count
  adminSessions: Set<string> = new Set()
  totalPV: number = 0

  constructor() {
    // Seed some default keys
    this.seedDefaults()
  }

  private seedDefaults() {
    const defaults: { key: string; type: AccessKey["type"]; status: AccessKey["status"]; usedBy?: string }[] = [
      { key: "DOUU-TRIAL-2026", type: "trial", status: "active", usedBy: "demo-user" },
      { key: "DOUU-WEEK-A1B2", type: "weekly", status: "unused" },
      { key: "DOUU-MONTH-X9Y8", type: "monthly", status: "active", usedBy: "vip-user" },
      { key: "DOUU-VIP-FOREVER", type: "annual", status: "active", usedBy: "whale-user" },
    ]
    for (const d of defaults) {
      const dur = DURATION_MAP[d.type]
      const createdAt = Date.now() - 7 * 24 * 60 * 60 * 1000
      this.keys.set(d.key, {
        id: crypto.randomUUID(),
        key: d.key,
        type: d.type,
        durationMs: dur.ms,
        durationLabel: dur.label,
        createdAt,
        activatedAt: d.status === "active" ? createdAt + 1000 : null,
        expiresAt: d.status === "active" ? createdAt + 1000 + dur.ms : null,
        usedBy: d.usedBy || null,
        status: d.status,
      })
    }
  }

  // ─── Key Management ──────────────────────────────────────────────

  generateKey(type: AccessKey["type"], customDays?: number): AccessKey {
    let durationMs: number
    let durationLabel: string

    if (customDays && customDays > 0) {
      durationMs = customDays * 24 * 60 * 60 * 1000
      durationLabel = `${customDays}天`
    } else {
      const dur = DURATION_MAP[type]
      durationMs = dur.ms
      durationLabel = dur.label
    }

    const prefix = type === "trial" ? "TRIAL" : type === "weekly" ? "WEEK" : type === "monthly" ? "MONTH" : "ANNUAL"
    const suffix = crypto.randomBytes(4).toString("hex").toUpperCase()
    const key = `DOUU-${prefix}-${suffix}`
    const ak: AccessKey = {
      id: crypto.randomUUID(),
      key,
      type,
      durationMs,
      durationLabel,
      createdAt: Date.now(),
      activatedAt: null,
      expiresAt: null,
      usedBy: null,
      status: "unused",
    }
    this.keys.set(key, ak)
    this.addLog("密钥生成", "admin", `生成 ${type} 密钥 (${durationLabel}): ${key}`, "low")
    return ak
  }

  activateKey(keyStr: string, fingerprint: string): { success: boolean; key?: AccessKey; error?: string } {
    const ak = this.keys.get(keyStr.toUpperCase())
    if (!ak) return { success: false, error: "密钥不存在" }
    if (ak.status === "revoked") return { success: false, error: "密钥已被吊销" }
    if (ak.status === "expired") return { success: false, error: "密钥已过期" }

    if (ak.status === "active") {
      // Already active - check device binding
      if (ak.usedBy && ak.usedBy !== fingerprint) {
        return { success: false, error: "密钥已绑定其他设备" }
      }
      // Check expiry
      if (ak.expiresAt && Date.now() > ak.expiresAt) {
        ak.status = "expired"
        return { success: false, error: "密钥已过期" }
      }
      return { success: true, key: ak }
    }

    // Activate unused key
    ak.status = "active"
    ak.activatedAt = Date.now()
    ak.expiresAt = Date.now() + ak.durationMs
    ak.usedBy = fingerprint
    this.addLog("密钥激活", fingerprint, `激活密钥 ${keyStr}`, "low")
    return { success: true, key: ak }
  }

  checkKey(keyStr: string): { valid: boolean; expiresAt?: number } {
    const ak = this.keys.get(keyStr.toUpperCase())
    if (!ak || ak.status !== "active") return { valid: false }
    if (ak.expiresAt && Date.now() > ak.expiresAt) {
      ak.status = "expired"
      return { valid: false }
    }
    return { valid: true, expiresAt: ak.expiresAt || undefined }
  }

  revokeKey(keyStr: string): boolean {
    const ak = this.keys.get(keyStr.toUpperCase())
    if (!ak) return false
    ak.status = "revoked"
    this.addLog("密钥吊销", "admin", `吊销密钥 ${keyStr}`, "medium")
    return true
  }

  getAllKeys(): AccessKey[] {
    // Refresh expired statuses
    const now = Date.now()
    for (const ak of this.keys.values()) {
      if (ak.status === "active" && ak.expiresAt && now > ak.expiresAt) {
        ak.status = "expired"
      }
    }
    return Array.from(this.keys.values()).sort((a, b) => b.createdAt - a.createdAt)
  }

  // ─── Online Tracking ─────────────────────────────────────────────

  heartbeat(data: { ip: string; keyUsed: string; page: string; fingerprint?: string; userAgent?: string }) {
    const id = `${data.ip}-${data.fingerprint || "anon"}`
    this.onlineUsers.set(id, {
      id,
      ip: data.ip,
      keyUsed: data.keyUsed,
      page: data.page,
      lastActive: Date.now(),
      userAgent: data.userAgent,
      fingerprint: data.fingerprint,
    })
    this.totalPV++
  }

  getOnlineUsers(): OnlineUser[] {
    const cutoff = Date.now() - 5 * 60 * 1000  // 5 min timeout
    const online: OnlineUser[] = []
    for (const [id, u] of this.onlineUsers.entries()) {
      if (u.lastActive < cutoff) {
        this.onlineUsers.delete(id)
      } else {
        online.push(u)
      }
    }
    return online.sort((a, b) => b.lastActive - a.lastActive)
  }

  // ─── Audit Logs ──────────────────────────────────────────────────

  addLog(action: string, user: string, detail: string, risk: AuditLog["risk"]) {
    this.auditLogs.unshift({
      id: crypto.randomUUID(),
      time: Date.now(),
      action,
      user,
      detail,
      risk,
    })
    // Keep last 500 logs
    if (this.auditLogs.length > 500) this.auditLogs.length = 500
  }

  getLogs(limit = 50): AuditLog[] {
    return this.auditLogs.slice(0, limit)
  }

  // ─── Rate Limiting ───────────────────────────────────────────────

  checkRateLimit(ip: string, limit = 100, windowMs = 60_000): boolean {
    if (this.ipBlacklist.has(ip)) return false
    const key = `rate:${ip}`
    const now = Date.now()
    const entry = this.rateLimits.get(key)
    if (!entry || now > entry.resetAt) {
      this.rateLimits.set(key, { count: 1, resetAt: now + windowMs })
      return true
    }
    entry.count++
    if (entry.count > limit) {
      this.addLog("速率限制", ip, `IP ${ip} 超过速率限制 (${entry.count}/${limit})`, "medium")
      return false
    }
    return true
  }

  recordFailedAttempt(ip: string): number {
    const count = (this.failedAttempts.get(ip) || 0) + 1
    this.failedAttempts.set(ip, count)
    if (count >= 5) {
      this.ipBlacklist.add(ip)
      this.addLog("风控封禁", ip, `IP ${ip} 因多次失败尝试被自动封禁`, "high")
    }
    return count
  }

  // ─── Admin Auth ──────────────────────────────────────────────────

  createAdminSession(): string {
    const token = crypto.randomBytes(32).toString("hex")
    this.adminSessions.add(token)
    return token
  }

  validateAdminSession(token: string): boolean {
    return this.adminSessions.has(token)
  }

  // ─── Stats ───────────────────────────────────────────────────────

  getStats() {
    const allKeys = this.getAllKeys()
    return {
      onlineCount: this.getOnlineUsers().length,
      activeKeys: allKeys.filter((k) => k.status === "active").length,
      totalKeys: allKeys.length,
      todayPV: this.totalPV,
      highRiskAlerts: this.auditLogs.filter((l) => l.risk === "high").length,
      blacklistedIPs: this.ipBlacklist.size,
    }
  }
}

// Singleton
export const adminStore = new AdminStore()
