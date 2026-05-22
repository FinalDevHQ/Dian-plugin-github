import { useState, useEffect, useCallback } from "react"
import { api } from "../api"
import type { StatusResponse, ConfigResponse } from "../types"

function fmtUptime(s: number): string {
  const h = String(Math.floor(s / 3600)).padStart(2, "0")
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0")
  const sec = String(s % 60).padStart(2, "0")
  return `${h}:${m}:${sec}`
}

export default function Dashboard({ onNavigate, onVersion }: { onNavigate: (page: string) => void; onVersion?: (v: string) => void }) {
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
      if (s?.version && onVersion) onVersion(s.version)
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
    <div className="flex flex-col gap-6">
      {/* 页头 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 text-white text-2xl shadow-md">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold text-slate-900">GitHub 订阅</h1>
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-600 ring-1 ring-inset ring-emerald-500/20">
                <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {status ? "运行中" : "加载中"}
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-0.5">v{status?.version ?? "—"}</p>
          </div>
        </div>
      </div>

      {/* 状态卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="运行时长" value={uptime} icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5"><circle cx="12" cy="12" r="9"/><polyline points="12,7 12,12 15,15"/></svg>} accent="from-blue-500 to-blue-600" />
        <StatCard label="仓库订阅" value={status?.repoSubscriptions ?? 0} icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5"><path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>} accent="from-violet-500 to-violet-600" />
        <StatCard label="用户关注" value={status?.userSubscriptions ?? 0} icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>} accent="from-amber-500 to-amber-600" />
        <StatCard label="轮询间隔" value={`${status?.config.interval ?? 30}s`} icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5"><polyline points="23,4 23,10 17,10"/><polyline points="1,20 1,14 7,14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>} accent="from-emerald-500 to-emerald-600" />
      </div>

      {/* 主区域两栏 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧：状态 + 连接测试 */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          {/* 状态快照 */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">状态快照</h3>
            <div className="flex flex-col gap-3">
              <StatusRow label="GitHub Token" ok={!!cfg?.config.tokenCount} detail={cfg ? `${cfg.config.tokenCount} 个` : "未配置"} />
              <StatusRow label="主题" ok detail={status?.config.theme ?? "light"} />
              <StatusRow label="自动识别" ok={cfg?.config.autoDetectRepo ?? true} detail={cfg?.config.autoDetectRepo ? "已开启" : "已关闭"} />
              <StatusRow label="调试模式" ok={status?.config.debug ?? false} detail={status?.config.debug ? "已开启" : "已关闭"} />
            </div>
          </div>

          {/* 连接测试 */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">GitHub 连接</h3>
            <button
              onClick={testPing}
              disabled={pinging}
              className="w-full h-10 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors"
            >
              {pinging ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
                  测试中...
                </span>
              ) : "测试连接"}
            </button>
            {pingResult && (
              <div className={`mt-3 rounded-xl px-4 py-3 text-sm font-medium ${
                pingResult.ok
                  ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/10"
                  : "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/10"
              }`}>
                {pingResult.ok ? `✓ 连接成功 (${pingResult.ms}ms)` : `✗ ${pingResult.error}`}
              </div>
            )}
          </div>
        </div>

        {/* 右侧：订阅列表 */}
        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">最近订阅</h3>
              {cfg && cfg.subscriptions.length > 5 && (
                <button onClick={() => onNavigate("subs")} className="text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors">
                  查看全部 →
                </button>
              )}
            </div>
            {!cfg?.subscriptions.length ? (
              <div className="py-16 text-center">
                <div className="text-4xl mb-3 opacity-30">📦</div>
                <p className="text-sm text-slate-400">暂无订阅</p>
                <p className="text-xs text-slate-300 mt-1">前往「添加订阅」开始使用</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {cfg.subscriptions.slice(0, 5).map((s, i) => (
                  <div key={i} className="px-5 py-3.5 flex items-center gap-4 hover:bg-slate-50/50 transition-colors">
                    <div className={`size-2.5 rounded-full shrink-0 ${s.enabled ? "bg-emerald-500" : "bg-slate-300"}`} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-slate-800 truncate">{s.repo}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{s.branch}</div>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      {s.types.map((t) => (
                        <span key={t} className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">{t}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 警告 */}
      {cfg?.config.tokenCount === 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 flex items-start gap-3">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-amber-500 shrink-0 mt-0.5"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <div>
            <p className="text-sm font-medium text-amber-800">未配置 GitHub Token</p>
            <p className="text-xs text-amber-600 mt-0.5">API 请求限制为 60 次/小时，请前往「基础配置」添加 Token</p>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, icon, accent }: { label: string; value: string | number; icon: React.JSX.Element; accent: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</p>
          <p className="text-2xl font-bold text-slate-900 mt-2 tabular-nums">{value}</p>
        </div>
        <div className={`p-2.5 rounded-xl bg-gradient-to-br ${accent} text-white shadow-sm`}>
          {icon}
        </div>
      </div>
    </div>
  )
}

function StatusRow({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <div className="flex items-center gap-2.5">
        <span className={`size-2 rounded-full ${ok ? "bg-emerald-500" : "bg-slate-300"}`} />
        <span className="text-sm text-slate-600">{label}</span>
      </div>
      <span className="text-sm font-medium text-slate-800">{detail}</span>
    </div>
  )
}
