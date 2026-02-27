"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Copy, Check, Loader2, AlertTriangle, ImageIcon } from "lucide-react"

interface TransferResult {
  original: string
  proxied: string
  platform: string
  cached: boolean
  size: number
  warning: string | null
  error?: string
}

interface BatchResponse {
  results: TransferResult[]
  summary: {
    total: number
    success: number
    failed: number
    cached: number
  }
}

function getPlatformColor(platform: string): string {
  switch (platform) {
    case "weibo": return "bg-red-500"
    case "wechat": return "bg-green-500"
    case "douyin": return "bg-pink-500"
    default: return "bg-gray-500"
  }
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "-"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export default function TransferPage() {
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<TransferResult[]>([])
  const [summary, setSummary] = useState<BatchResponse["summary"] | null>(null)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)

  const handleTransfer = async () => {
    const urls = input
      .split("\n")
      .map(line => line.trim())
      .filter(line => line.length > 0 && line.startsWith("http"))
    
    if (urls.length === 0) {
      alert("请输入有效的图片 URL（每行一个）")
      return
    }

    setLoading(true)
    setResults([])
    setSummary(null)

    try {
      const res = await fetch("/api/transfer/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls }),
      })
      
      const data: BatchResponse = await res.json()
      
      if (data.error) {
        alert(`错误: ${data.error}`)
        return
      }
      
      setResults(data.results || [])
      setSummary(data.summary)
    } catch (error) {
      alert(`请求失败: ${error instanceof Error ? error.message : "未知错误"}`)
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text)
    setCopiedIndex(index)
    setTimeout(() => setCopiedIndex(null), 2000)
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="w-6 h-6" />
              图片转存工具
            </CardTitle>
            <CardDescription>
              将微博、微信公众号、抖音的图片永久转存到 Cloudflare R2，绕过防盗链限制
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="粘贴图片 URL（每行一个），支持：&#10;- sinaimg.cn (微博)&#10;- mmbiz.qpic.cn (微信公众号)&#10;- douyinpic.com (抖音)"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={6}
              className="font-mono text-sm"
            />
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {input.split("\n").filter(l => l.trim().startsWith("http")).length} 个 URL
              </p>
              <Button onClick={handleTransfer} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    处理中...
                  </>
                ) : (
                  "转存全部"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {summary && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">处理结果</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 text-sm">
                <span>总计: <strong>{summary.total}</strong></span>
                <span className="text-green-600">成功: <strong>{summary.success}</strong></span>
                <span className="text-red-600">失败: <strong>{summary.failed}</strong></span>
                <span className="text-blue-600">缓存命中: <strong>{summary.cached}</strong></span>
              </div>
            </CardContent>
          </Card>
        )}

        {results.length > 0 && (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/50">
                    <tr>
                      <th className="text-left p-3 font-medium">原始 URL</th>
                      <th className="text-left p-3 font-medium w-24">平台</th>
                      <th className="text-left p-3 font-medium w-24">状态</th>
                      <th className="text-left p-3 font-medium w-24">大小</th>
                      <th className="text-left p-3 font-medium">转存 URL</th>
                      <th className="text-center p-3 font-medium w-16">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((result, i) => (
                      <tr key={i} className="border-b last:border-b-0 hover:bg-muted/30">
                        <td className="p-3">
                          <div className="max-w-xs truncate font-mono text-xs" title={result.original}>
                            {result.original}
                          </div>
                        </td>
                        <td className="p-3">
                          <Badge variant="secondary" className={`${getPlatformColor(result.platform)} text-white`}>
                            {result.platform}
                          </Badge>
                        </td>
                        <td className="p-3">
                          {result.error ? (
                            <Badge variant="destructive">失败</Badge>
                          ) : result.cached ? (
                            <Badge variant="outline" className="text-blue-600 border-blue-600">缓存</Badge>
                          ) : (
                            <Badge variant="outline" className="text-green-600 border-green-600">已转存</Badge>
                          )}
                          {result.warning && (
                            <AlertTriangle className="w-4 h-4 inline ml-1 text-yellow-500" title={result.warning} />
                          )}
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {formatSize(result.size)}
                        </td>
                        <td className="p-3">
                          {result.error ? (
                            <span className="text-red-500 text-xs">{result.error}</span>
                          ) : result.proxied ? (
                            <a 
                              href={result.proxied} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="max-w-xs truncate block font-mono text-xs text-blue-600 hover:underline"
                              title={result.proxied}
                            >
                              {result.proxied}
                            </a>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          {result.proxied && !result.error && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(result.proxied, i)}
                              className="h-8 w-8 p-0"
                            >
                              {copiedIndex === i ? (
                                <Check className="w-4 h-4 text-green-500" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="bg-muted/30">
          <CardContent className="pt-6">
            <h3 className="font-semibold mb-2">使用说明</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• 支持微博 (sinaimg.cn)、微信公众号 (mmbiz.qpic.cn)、抖音 (douyinpic.com) 图片</li>
              <li>• 图片会永久存储到 Cloudflare R2，通过自定义域名访问</li>
              <li>• 相同 URL 重复转存会命中缓存，不会重复上传</li>
              <li>• 抖音签名 URL 有时效性，请在抓取后立即转存</li>
              <li>• 单次最多处理 20 个 URL，单个文件最大 20MB</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
