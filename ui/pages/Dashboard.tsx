import { useState, useEffect, useCallback } from "react"
import { api } from "../api"
import type { StatusResponse, ConfigResponse, Subscription, EventType } from "../types"

function fmtUptime(s: number): string {
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h < 24) return `${h}h ${m}m`
  const d = Math.floor(h / 24)
  return `${d}d ${h % 24}h`
}

const TYPE_META: Record<EventType, { label: string; color: string; bg: string }> = {
  commits: { label: "Commits", color: "text-emerald-600", bg: "bg-emerald-500" },
  issues:  { label: "Issues",  color: "text-violet-600",  bg: "bg-violet-500"  },
  pulls:   { label: "PRs",     color: "text-blue-600",    bg: "bg-blue-500"    },
  actions: { label: "Actions", color: "text-amber-600",   bg: "bg-amber-500"   },
}

interface RateLimitResource {
  limit: number
  used: number
  remaining: number
  reset: number
}

interface RateLimitItem {
  index: number
  name: string
  ok: boolean
  status?: number
  ms?: number
  error?: string
  rate?: RateLimitResource
  resources?: Record<string, RateLimitResource>
}

function fmtReset(ts?: number): string {
  if (!ts) return "—"
  return new Date(ts * 1000).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })
}

export default function Dashboard({ onNavigate, onVersion }: { onNavigate: (page: string) => void; onVersion?: (v: string) => void }) {
  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [cfg, setCfg] = useState<ConfigResponse | null>(null)
  const [pingResult, setPingResult] = useState<{ ok: boolean; ms?: number; error?: string; authenticated?: boolean } | null>(null)
  const [pinging, setPinging] = useState(false)
  const [rateLimits, setRateLimits] = useState<RateLimitItem[]>([])
  const [rateLoading, setRateLoading] = useState(false)
  const [rateError, setRateError] = useState("")
  const [uptime, setUptime] = useState("—")
  const [lastPing, setLastPing] = useState<number | null>(null)

  const loadRateLimits = useCallback(async () => {
    setRateLoading(true)
    setRateError("")
    try {
      const r = await api<{ success: boolean; data: RateLimitItem[]; error?: string }>("/rate-limit")
      if (!r.success) throw new Error(r.error || "查询失败")
      setRateLimits(r.data || [])
    } catch (e: any) {
      setRateError(String(e?.message || e))
    } finally {
      setRateLoading(false)
    }
  }, [])

  const load = useCallback(async () => {
    try {
      const [s, c] = await Promise.all([api<StatusResponse>("/status"), api<ConfigResponse>("/config")])
      setStatus(s)
      setCfg(c)
      if (s?.version && onVersion) onVersion(s.version)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { loadRateLimits() }, [loadRateLimits])

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
      setPingResult({ ok: r.success, ms: r.ms, error: r.error, authenticated: r.authenticated })
      setLastPing(Date.now())
    } catch (e: any) {
      setPingResult({ ok: false, error: String(e) })
    } finally {
      setPinging(false)
    }
  }

  const subs = cfg?.subscriptions || []
  const typeDistribution = subs.reduce((acc, s) => {
    s.types.forEach(t => { acc[t] = (acc[t] || 0) + 1 })
    return acc
  }, {} as Record<string, number>)

  const enabledCount = subs.filter(s => s.enabled).length
  const disabledCount = subs.length - enabledCount
  const userSubCount = cfg?.userSubscriptions?.length || 0
  const groupCount = new Set(subs.flatMap(s => s.groups)).size

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
            <p className="text-sm text-slate-400 mt-0.5">v{status?.version ?? "—"} · 轮询间隔 {status?.config.interval ?? 30}s</p>
          </div>
        </div>
        <button
          onClick={() => onNavigate("add")}
          className="h-9 rounded-xl bg-slate-900 text-white px-4 text-sm font-medium hover:bg-slate-800 transition-colors shadow-sm flex items-center gap-1.5"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>
          添加订阅
        </button>
      </div>

      {/* 核心指标 */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard label="运行时长" value={uptime} icon={<ClockIcon />} accent="blue" />
        <StatCard label="仓库订阅" value={subs.length} sub={`${enabledCount} 启用`} icon={<RepoIcon />} accent="violet" />
        <StatCard label="用户关注" value={userSubCount} icon={<UserIcon />} accent="amber" />
        <StatCard label="推送群数" value={groupCount} icon={<GroupIcon />} accent="emerald" />
        <StatCard label="Token" value={cfg?.config.tokenCount ?? 0} sub={`${subs.length > 0 ? Math.round(5000 * (cfg?.config.tokenCount ?? 1) / Math.max(subs.length, 1)) : "∞"} 次/h/仓`} icon={<KeyIcon />} accent="slate" />
      </div>

      {/* 主区域 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧：状态 + 连接 */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          {/* 状态快照 */}
          <Card title="运行状态" icon={<StatusIcon />}>
            <div className="flex flex-col gap-2.5">
              <StatusRow label="GitHub Token" ok={!!cfg?.config.tokenCount} detail={cfg ? `${cfg.config.tokenCount} 个` : "未配置"} />
              <StatusRow label="自动识别" ok={cfg?.config.autoDetectRepo ?? true} detail={cfg?.config.autoDetectRepo ? "已开启" : "已关闭"} />
              <StatusRow label="成员订阅" ok={cfg?.config.allowMemberSub ?? false} detail={cfg?.config.allowMemberSub ? "允许" : "禁止"} />
              <StatusRow label="合并通知" ok={cfg?.config.mergeNotify ?? false} detail={cfg?.config.mergeNotify ? "已开启" : "已关闭"} />
              <StatusRow label="调试模式" ok={status?.config.debug ?? false} detail={status?.config.debug ? "已开启" : "已关闭"} />
              <StatusRow label="渲染主题" ok detail={status?.config.theme ?? "light"} />
              <StatusRow label="代理" ok={!!cfg?.config.proxy} detail={cfg?.config.proxy && cfg.config.proxy !== "" ? "已配置" : "直连"} />
            </div>
          </Card>

          {/* 连接测试 */}
          <Card title="GitHub 连接" icon={<LinkIcon />}>
            <button
              onClick={testPing}
              disabled={pinging}
              className="w-full h-10 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {pinging ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
                  测试中...
                </>
              ) : "测试连接"}
            </button>
            {pingResult && (
              <div className={`mt-3 rounded-xl px-4 py-3 text-sm font-medium ${
                pingResult.ok
                  ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/10"
                  : "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/10"
              }`}>
                <div className="flex items-center gap-2">
                  {pingResult.ok ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M20 6L9 17l-5-5"/></svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>
                  )}
                  <span>{pingResult.ok ? `连接成功 (${pingResult.ms}ms)` : pingResult.error}</span>
                </div>
                {pingResult.ok && pingResult.authenticated !== undefined && (
                  <div className="mt-1.5 text-xs opacity-75">
                    {pingResult.authenticated ? "已认证 (5000 次/h)" : "未认证 (60 次/h)"}
                  </div>
                )}
              </div>
            )}
            {lastPing && !pinging && (
              <p className="text-[10px] text-slate-300 mt-2 text-center">
                上次测试: {new Date(lastPing).toLocaleTimeString("zh-CN")}
              </p>
            )}
          </Card>
        </div>

        {/* 右侧：订阅概览 + 列表 */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <Card title="Token 额度看板" icon={<KeyIcon />} action={
            <button
              onClick={loadRateLimits}
              disabled={rateLoading}
              className="text-xs font-medium text-slate-400 hover:text-slate-600 disabled:opacity-50 transition-colors"
            >
              {rateLoading ? "刷新中..." : "刷新"}
            </button>
          }>
            {rateError ? (
              <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-inset ring-red-600/10">{rateError}</div>
            ) : rateLimits.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">
                暂无 Token，前往基础配置添加后可查看 GitHub API 剩余额度
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                {rateLimits.map((item) => <RateLimitCard key={item.index} item={item} />)}
              </div>
            )}
          </Card>

          {/* 订阅分布 */}
          {subs.length > 0 && (
            <Card title="订阅分布" icon={<ChartIcon />}>
              <div className="flex flex-col gap-4">
                {/* 类型分布条 */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-500">监控类型分布</span>
                    <span className="text-[10px] text-slate-400">{subs.length} 个订阅</span>
                  </div>
                  <div className="flex gap-1 h-2 rounded-full overflow-hidden bg-slate-100">
                    {Object.entries(typeDistribution).map(([type, count]) => (
                      <div
                        key={type}
                        className={`${TYPE_META[type as EventType]?.bg ?? "bg-slate-400"} rounded-full transition-all`}
                        style={{ width: `${(count / subs.length) * 100}%` }}
                        title={`${TYPE_META[type as EventType]?.label ?? type}: ${count}`}
                      />
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-3 mt-2">
                    {Object.entries(typeDistribution).map(([type, count]) => (
                      <div key={type} className="flex items-center gap-1.5">
                        <span className={`size-2 rounded-full ${TYPE_META[type as EventType]?.bg ?? "bg-slate-400"}`} />
                        <span className="text-[11px] text-slate-600">{TYPE_META[type as EventType]?.label ?? type}</span>
                        <span className="text-[10px] text-slate-400">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {/* 启用/禁用状态 */}
                {disabledCount > 0 && (
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="size-2 rounded-full bg-slate-300" />
                    <span>{disabledCount} 个已禁用</span>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* 最近订阅 */}
          <Card title="订阅列表" icon={<ListIcon />} action={
            subs.length > 5 ? (
              <button onClick={() => onNavigate("subs")} className="text-xs font-medium text-slate-400 hover:text-slate-600 transition-colors">
                查看全部 ({subs.length}) →
              </button>
            ) : undefined
          }>
            {subs.length === 0 ? (
              <div className="py-12 text-center">
                <div className="flex justify-center mb-3">
                  <div className="flex size-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-300">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-7 h-7"><path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>
                  </div>
                </div>
                <p className="text-sm text-slate-400">暂无订阅</p>
                <p className="text-xs text-slate-300 mt-1">点击右上角「添加订阅」开始使用</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 -mx-1">
                {subs.slice(0, 8).map((s, i) => (
                  <div key={i} className="px-1 py-3 flex items-center gap-3 hover:bg-slate-50/50 transition-colors rounded-lg">
                    <div className={`size-2 rounded-full shrink-0 ${s.enabled ? "bg-emerald-500" : "bg-slate-300"}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-800 truncate">{s.repo}</span>
                        {s.groups.length > 0 && (
                          <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">
                            {s.groups.length} 群
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-slate-400">{s.branch}</span>
                        <span className="text-slate-200">·</span>
                        <span className="text-[10px] text-slate-300">{new Date(s.createdAt).toLocaleDateString("zh-CN")}</span>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {s.types.map((t) => (
                        <span key={t} className={`rounded-md px-1.5 py-0.5 text-[9px] font-medium ${TYPE_META[t]?.color ?? "text-slate-600"} ${TYPE_META[t]?.bg ?? "bg-slate-100"} bg-opacity-20`}>
                          {TYPE_META[t]?.label ?? t}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
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
          <button onClick={() => onNavigate("config")} className="ml-auto shrink-0 h-8 rounded-lg bg-amber-100 text-amber-700 px-3 text-xs font-medium hover:bg-amber-200 transition-colors">
            前往配置
          </button>
        </div>
      )}
    </div>
  )
}

/* ── Sub Components ── */

function Card({ title, icon, action, children }: { title: string; icon?: React.JSX.Element; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          {icon && <span className="text-slate-400">{icon}</span>}
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function StatCard({ label, value, sub, icon, accent }: { label: string; value: string | number; sub?: string; icon: React.JSX.Element; accent: string }) {
  const accentMap: Record<string, { bg: string; text: string; iconBg: string }> = {
    blue:   { bg: "from-blue-500 to-blue-600",   text: "text-blue-600",   iconBg: "bg-blue-50"   },
    violet: { bg: "from-violet-500 to-violet-600", text: "text-violet-600", iconBg: "bg-violet-50" },
    amber:  { bg: "from-amber-500 to-amber-600",  text: "text-amber-600",  iconBg: "bg-amber-50"  },
    emerald:{ bg: "from-emerald-500 to-emerald-600", text: "text-emerald-600", iconBg: "bg-emerald-50" },
    slate:  { bg: "from-slate-500 to-slate-600",  text: "text-slate-600",  iconBg: "bg-slate-50"  },
  }
  const a = accentMap[accent] || accentMap.slate
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 rounded-xl ${a.iconBg}`}>
          <span className={a.text}>{icon}</span>
        </div>
      </div>
      <p className="text-2xl font-bold text-slate-900 tabular-nums leading-none">{value}</p>
      <div className="flex items-center gap-1.5 mt-1.5">
        <span className="text-[11px] text-slate-400">{label}</span>
        {sub && <span className="text-[10px] text-slate-300">· {sub}</span>}
      </div>
    </div>
  )
}

function StatusRow({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center gap-2">
        <span className={`size-1.5 rounded-full ${ok ? "bg-emerald-500" : "bg-slate-300"}`} />
        <span className="text-xs text-slate-600">{label}</span>
      </div>
      <span className="text-xs font-medium text-slate-800">{detail}</span>
    </div>
  )
}

function RateLimitCard({ item }: { item: RateLimitItem }) {
  const core = item.resources?.core || item.rate
  const search = item.resources?.search
  const graphql = item.resources?.graphql
  const percent = core && core.limit > 0 ? Math.round((core.remaining / core.limit) * 100) : 0
  const tone = percent > 50 ? "emerald" : percent > 20 ? "amber" : "red"
  const toneClass: Record<string, string> = {
    emerald: "bg-emerald-500 text-emerald-700 bg-emerald-50",
    amber: "bg-amber-500 text-amber-700 bg-amber-50",
    red: "bg-red-500 text-red-700 bg-red-50",
  }

  if (!item.ok || !core) {
    return (
      <div className="rounded-2xl border border-red-100 bg-red-50/60 p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-900">{item.name}</span>
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-600">失败</span>
        </div>
        <p className="mt-3 text-xs text-red-700">{item.error || `HTTP ${item.status || "unknown"}`}</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">{item.name}</div>
          <div className="mt-1 text-[10px] text-slate-400">重置 {fmtReset(core.reset)} · {item.ms ?? "—"}ms</div>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${toneClass[tone].split(" ").slice(1).join(" ")}`}>{percent}% 剩余</span>
      </div>
      <div className="mt-4">
        <div className="flex items-end justify-between mb-2">
          <span className="text-2xl font-bold tabular-nums text-slate-900">{core.remaining}</span>
          <span className="text-xs text-slate-400">/ {core.limit} core</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-200">
          <div className={`h-full rounded-full ${toneClass[tone].split(" ")[0]}`} style={{ width: `${percent}%` }} />
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
        <RateMini label="Used" value={core.used} />
        <RateMini label="Search" value={search ? `${search.remaining}/${search.limit}` : "—"} />
        <RateMini label="GraphQL" value={graphql ? `${graphql.remaining}/${graphql.limit}` : "—"} />
      </div>
    </div>
  )
}

function RateMini({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-white px-3 py-2 ring-1 ring-inset ring-slate-200">
      <div className="text-[10px] text-slate-400">{label}</div>
      <div className="mt-0.5 truncate font-semibold tabular-nums text-slate-700">{value}</div>
    </div>
  )
}

/* ── Icons ── */

function ClockIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><circle cx="12" cy="12" r="9"/><polyline points="12,7 12,12 15,15"/></svg>
}
function RepoIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>
}
function UserIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
}
function GroupIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
}
function KeyIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
}
function StatusIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
}
function LinkIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
}
function ChartIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>
}
function ListIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><path d="M4 6h16M4 12h16M4 18h10"/></svg>
}
