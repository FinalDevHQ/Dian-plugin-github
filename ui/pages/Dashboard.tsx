import { useState, useEffect, useCallback } from "react"
import { api } from "../api"
import type { StatusResponse, ConfigResponse } from "../types"

function fmtUptime(s: number): string {
  const h = String(Math.floor(s / 3600)).padStart(2, "0")
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0")
  const sec = String(s % 60).padStart(2, "0")
  return `${h}:${m}:${sec}`
}

export default function Dashboard({ onNavigate }: { onNavigate: (page: string) => void }) {
  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [cfg, setCfg] = useState<ConfigResponse | null>(null)
  const [pingResult, setPingResult] = useState<{ ok: boolean; ms?: number; error?: string } | null>(null)
  const [pinging, setPinging] = useState(false)
  const [uptime, setUptime] = useState("—")

  const load = useCallback(async () => {
    try {
      const [s, c] = await Promise.all([api<StatusResponse>("/status"), api<ConfigResponse>("/config")])
      setStatus(s)
      setCfg(c)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!status?.startTime) return
    const start = status.startTime
    setUptime(fmtUptime(Math.floor((Date.now() - start) / 1000)))
    const t = setInterval(() => setUptime(fmtUptime(Math.floor((Date.now() - start) / 1000))), 1000)
    return () => clearInterval(t)
  }, [status?.startTime])

  const testPing = async () => {
    setPinging(true)
    setPingResult(null)
    try {
      const r = await api<{ success: boolean; ms?: number; error?: string; authenticated?: boolean }>("/ping")
      setPingResult({ ok: r.success, ms: r.ms, error: r.error })
    } catch (e: any) {
      setPingResult({ ok: false, error: String(e) })
    } finally {
      setPinging(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg border bg-card text-2xl shadow-sm">🐙</div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold">GitHub 订阅</h1>
            <span className="inline-flex items-center rounded-md border border-emerald-600/40 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
              {status ? "运行中" : "加载中"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">v{status?.version ?? "—"}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="运行时长" value={uptime} />
        <Stat label="仓库订阅" value={status?.repoSubscriptions ?? 0} />
        <Stat label="用户关注" value={status?.userSubscriptions ?? 0} />
        <Stat label="轮询间隔" value={`${status?.config.interval ?? 30}s`} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatusBadge label="GitHub Token" ok={!!cfg?.config.tokenCount} detail={cfg ? `${cfg.config.tokenCount} 个` : "未配置"} />
        <StatusBadge label="主题" ok detail={status?.config.theme ?? "light"} />
        <StatusBadge label="自动识别" ok={cfg?.config.autoDetectRepo ?? true} detail={cfg?.config.autoDetectRepo ? "开启" : "关闭"} />
        <StatusBadge label="调试模式" ok={status?.config.debug ?? false} detail={status?.config.debug ? "开启" : "关闭"} />
      </div>

      {cfg?.config.tokenCount === 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-700">
          ⚠️ 未配置 GitHub Token，API 请求限制为 60 次/小时。请前往「基础配置」添加 Token。
        </div>
      )}

      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium">最近订阅</span>
          {cfg && cfg.subscriptions.length > 5 && (
            <button onClick={() => onNavigate("subs")} className="text-xs text-primary hover:underline">查看全部</button>
          )}
        </div>
        {!cfg?.subscriptions.length ? (
          <p className="py-4 text-center text-xs text-muted-foreground">暂无订阅</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {cfg.subscriptions.slice(0, 5).map((s, i) => (
              <div key={i} className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs">
                <span className={s.enabled ? "text-emerald-500" : "text-red-500"}>{s.enabled ? "🟢" : "🔴"}</span>
                <span className="font-medium">{s.repo}</span>
                <span className="text-muted-foreground">({s.branch})</span>
                <div className="ml-auto flex gap-1">
                  {s.types.map((t) => (
                    <span key={t} className="rounded bg-muted px-1 py-0.5 text-[10px]">{t}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium">GitHub 连接测试</span>
          <button onClick={testPing} disabled={pinging} className="h-7 rounded-md border px-3 text-xs hover:bg-accent disabled:opacity-50">
            {pinging ? "测试中..." : "测试连接"}
          </button>
        </div>
        {pingResult && (
          <div className={`rounded-md border px-3 py-2 text-xs ${pingResult.ok ? "border-emerald-600/40 bg-emerald-50 text-emerald-700" : "border-destructive/40 bg-red-50 text-destructive"}`}>
            {pingResult.ok ? `✓ 连接成功 (${pingResult.ms}ms)` : `✗ 连接失败: ${pingResult.error}`}
          </div>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border bg-card px-4 py-3">
      <div className="flex flex-col gap-1">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className="truncate text-2xl font-bold tabular-nums">{value}</span>
      </div>
    </div>
  )
}

function StatusBadge({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <div className="rounded-xl border bg-card px-3 py-2 flex items-center gap-2">
      <span className={`size-2 rounded-full ${ok ? "bg-emerald-500" : "bg-red-500"}`} />
      <div className="min-w-0">
        <div className="text-[11px] text-muted-foreground">{label}</div>
        <div className="text-xs font-medium truncate">{detail}</div>
      </div>
    </div>
  )
}
