// Redis-backed admin data store using Upstash
// All data persists across Vercel serverless invocations

import { Redis } from "@upstash/redis"
import crypto from "crypto"

// ─── Redis client ────────────────────────────────────────────────────

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
})

// ─── Redis key constants ─────────────────────────────────────────────

const KEYS_HASH = "admin:keys"              // hash: keyStr -> JSON AccessKey
const LOGS_LIST = "admin:logs"              // list of JSON AuditLog
const ONLINE_HASH = "admin:online"          // hash: id -> JSON OnlineUser
const SESSIONS_SET = "admin:sessions"       // set of session tokens
const BLACKLIST_SET = "admin:blacklist"      // set of IPs
const PUSH_CONFIG_KEY = "admin:push_config"  // string: JSON PushConfig
const PV_KEY = "admin:pv"                    // string: number
const RATE_PREFIX = "admin:rate:"            // string with TTL
const FAIL_PREFIX = "admin:fail:"            // string with TTL

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
  usedBy: string | null
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
  user: string
  detail: string
  risk: "low" | "medium" | "high"
}

export interface PushConfig {
  dingtalkWebhook: string
  telegramBotToken: string
  telegramChatId: string
}

// ─── Duration map ────────────────────────────────────────────────────

const DURATION_MAP: Record<AccessKey["type"], { ms: number; label: string }> = {
  trial:   { ms: 1 * 24 * 60 * 60 * 1000, label: "1天" },
  weekly:  { ms: 7 * 24 * 60 * 60 * 1000, label: "7天" },
  monthly: { ms: 30 * 24 * 60 * 60 * 1000, label: "30天" },
  annual:  { ms: 365 * 24 * 60 * 60 * 1000, label: "365天" },
}

export function getDurationMap() { return DURATION_MAP }

// ─── Helper ──────────────────────────────────────────────────────────

function parseJSON<T>(val: unknown): T | null {
  if (val === null || val === undefined) return null
  if (typeof val === "string") {
    try { return JSON.parse(val) as T } catch { return null }
  }
  return val as T
}

// ─── Async Store ─────────────────────────────────────────────────────

export const adminStore = {

  // ─── Key Management ──────────────────────────────────────────────

  async generateKey(type: AccessKey["type"], customDays?: number): Promise<AccessKey> {
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
    await redis.hset(KEYS_HASH, { [key]: JSON.stringify(ak) })
    await adminStore.addLog("密钥生成", "admin", `生成 ${type} 密钥 (${durationLabel}): ${key}`, "low")
    return ak
  },

  async activateKey(keyStr: string, fingerprint: string): Promise<{ success: boolean; key?: AccessKey; error?: string }> {
    const raw = await redis.hget(KEYS_HASH, keyStr.toUpperCase())
    const ak = parseJSON<AccessKey>(raw)
    if (!ak) return { success: false, error: "密钥不存在" }
    if (ak.status === "revoked") return { success: false, error: "密钥已被吊销" }
    if (ak.status === "expired") return { success: false, error: "密钥已过期" }

    if (ak.status === "active") {
      if (ak.usedBy && ak.usedBy !== fingerprint) {
        return { success: false, error: "密钥已绑定其他设备" }
      }
      if (ak.expiresAt && Date.now() > ak.expiresAt) {
        ak.status = "expired"
        await redis.hset(KEYS_HASH, { [ak.key]: JSON.stringify(ak) })
        return { success: false, error: "密钥已过期" }
      }
      return { success: true, key: ak }
    }

    // Activate unused key
    ak.status = "active"
    ak.activatedAt = Date.now()
    ak.expiresAt = Date.now() + ak.durationMs
    ak.usedBy = fingerprint
    await redis.hset(KEYS_HASH, { [ak.key]: JSON.stringify(ak) })
    await adminStore.addLog("密钥激活", fingerprint, `激活密钥 ${keyStr}`, "low")
    return { success: true, key: ak }
  },

  async checkKey(keyStr: string): Promise<{ valid: boolean; expiresAt?: number }> {
    const raw = await redis.hget(KEYS_HASH, keyStr.toUpperCase())
    const ak = parseJSON<AccessKey>(raw)
    if (!ak || ak.status !== "active") return { valid: false }
    if (ak.expiresAt && Date.now() > ak.expiresAt) {
      ak.status = "expired"
      await redis.hset(KEYS_HASH, { [ak.key]: JSON.stringify(ak) })
      return { valid: false }
    }
    return { valid: true, expiresAt: ak.expiresAt || undefined }
  },

  async revokeKey(keyStr: string): Promise<boolean> {
    const raw = await redis.hget(KEYS_HASH, keyStr.toUpperCase())
    const ak = parseJSON<AccessKey>(raw)
    if (!ak) return false
    ak.status = "revoked"
    await redis.hset(KEYS_HASH, { [ak.key]: JSON.stringify(ak) })
    await adminStore.addLog("密钥吊销", "admin", `吊销密钥 ${keyStr}`, "medium")
    return true
  },

  async getAllKeys(): Promise<AccessKey[]> {
    const raw = await redis.hgetall(KEYS_HASH)
    if (!raw || Object.keys(raw).length === 0) return []
    const now = Date.now()
    const keys: AccessKey[] = []
    for (const val of Object.values(raw)) {
      const ak = parseJSON<AccessKey>(val)
      if (!ak) continue
      if (ak.status === "active" && ak.expiresAt && now > ak.expiresAt) {
        ak.status = "expired"
        await redis.hset(KEYS_HASH, { [ak.key]: JSON.stringify(ak) })
      }
      keys.push(ak)
    }
    return keys.sort((a, b) => b.createdAt - a.createdAt)
  },

  // ─── Online Tracking ─────────────────────────────────────────────

  async heartbeat(data: { ip: string; keyUsed: string; page: string; fingerprint?: string; userAgent?: string }) {
    const id = `${data.ip}-${data.fingerprint || "anon"}`
    const user: OnlineUser = {
      id,
      ip: data.ip,
      keyUsed: data.keyUsed,
      page: data.page,
      lastActive: Date.now(),
      userAgent: data.userAgent,
      fingerprint: data.fingerprint,
    }
    await redis.hset(ONLINE_HASH, { [id]: JSON.stringify(user) })
    await redis.incr(PV_KEY)
  },

  async getOnlineUsers(): Promise<OnlineUser[]> {
    const raw = await redis.hgetall(ONLINE_HASH)
    if (!raw || Object.keys(raw).length === 0) return []
    const cutoff = Date.now() - 5 * 60 * 1000
    const online: OnlineUser[] = []
    for (const [id, val] of Object.entries(raw)) {
      const u = parseJSON<OnlineUser>(val)
      if (!u) continue
      if (u.lastActive < cutoff) {
        await redis.hdel(ONLINE_HASH, id)
      } else {
        online.push(u)
      }
    }
    return online.sort((a, b) => b.lastActive - a.lastActive)
  },

  // ─── Audit Logs ──────────────────────────────────────────────────

  async addLog(action: string, user: string, detail: string, risk: AuditLog["risk"]) {
    const log: AuditLog = {
      id: crypto.randomUUID(),
      time: Date.now(),
      action,
      user,
      detail,
      risk,
    }
    await redis.lpush(LOGS_LIST, JSON.stringify(log))
    await redis.ltrim(LOGS_LIST, 0, 499)  // Keep last 500
  },

  async getLogs(limit = 50): Promise<AuditLog[]> {
    const raw = await redis.lrange(LOGS_LIST, 0, limit - 1)
    if (!raw || raw.length === 0) return []
    return raw.map(v => parseJSON<AuditLog>(v)).filter(Boolean) as AuditLog[]
  },

  // ─── Rate Limiting ───────────────────────────────────────────────

  async checkRateLimit(ip: string, limit = 100, windowMs = 60_000): Promise<boolean> {
    const isBlack = await redis.sismember(BLACKLIST_SET, ip)
    if (isBlack) return false

    const rKey = `${RATE_PREFIX}${ip}`
    const current = await redis.incr(rKey)
    if (current === 1) {
      await redis.pexpire(rKey, windowMs)
    }
    if (current > limit) {
      await adminStore.addLog("速率限制", ip, `IP ${ip} 超过速率限制 (${current}/${limit})`, "medium")
      return false
    }
    return true
  },

  async recordFailedAttempt(ip: string): Promise<number> {
    const fKey = `${FAIL_PREFIX}${ip}`
    const count = await redis.incr(fKey)
    if (count === 1) {
      await redis.expire(fKey, 3600) // 1 hour window
    }
    if (count >= 5) {
      await redis.sadd(BLACKLIST_SET, ip)
      await adminStore.addLog("风控封禁", ip, `IP ${ip} 因多次失败尝试被自动封禁`, "high")
    }
    return count
  },

  // ─── Admin Auth ──────────────────────────────────────────────────

  async createAdminSession(): Promise<string> {
    const token = crypto.randomBytes(32).toString("hex")
    await redis.sadd(SESSIONS_SET, token)
    // Session expires in 24 hours - set individual key too for TTL
    await redis.set(`admin:session:${token}`, "1", { ex: 86400 })
    return token
  },

  async validateAdminSession(token: string): Promise<boolean> {
    if (!token) return false
    // Check individual session key (has TTL)
    const exists = await redis.get(`admin:session:${token}`)
    return exists === "1"
  },

  // ─── Push Config ─────────────────────────────────────────────────

  async getPushConfig(): Promise<PushConfig> {
    const raw = await redis.get(PUSH_CONFIG_KEY)
    const config = parseJSON<PushConfig>(raw)
    return config || { dingtalkWebhook: "", telegramBotToken: "", telegramChatId: "" }
  },

  async setPushConfig(config: Partial<PushConfig>) {
    const current = await adminStore.getPushConfig()
    const updated = { ...current, ...config }
    await redis.set(PUSH_CONFIG_KEY, JSON.stringify(updated))
  },

  // ─── IP Blacklist ────────────────────────────────────────────────

  async getBlacklistedIPs(): Promise<string[]> {
    const members = await redis.smembers(BLACKLIST_SET)
    return members || []
  },

  async addToBlacklist(ip: string) {
    await redis.sadd(BLACKLIST_SET, ip)
  },

  async removeFromBlacklist(ip: string) {
    await redis.srem(BLACKLIST_SET, ip)
  },

  // ─── Stats ───────────────────────────────────────────────────────

  async getStats() {
    const allKeys = await adminStore.getAllKeys()
    const onlineUsers = await adminStore.getOnlineUsers()
    const pv = (await redis.get(PV_KEY)) || 0
    const logs = await adminStore.getLogs(200)
    const blacklist = await adminStore.getBlacklistedIPs()

    return {
      onlineCount: onlineUsers.length,
      activeKeys: allKeys.filter((k) => k.status === "active").length,
      totalKeys: allKeys.length,
      todayPV: Number(pv),
      highRiskAlerts: logs.filter((l) => l.risk === "high").length,
      blacklistedIPs: blacklist.length,
    }
  },
}
