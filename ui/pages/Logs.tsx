import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { api } from "../api"
import type { LogEntry } from "../types"

type Level = "all" | "info" | "debug" | "warn" | "error"

const LEVEL_STYLES: Record<string, { bg: string; text: string; dot: string; border: string }> = {
  info:  { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500", border: "border-blue-200" },
  debug: { bg: "bg-slate-50", text: "text-slate-500", dot: "bg-slate-400", border: "border-slate-200" },
  warn:  { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500", border: "border-amber-200" },
  error: { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500", border: "border-red-200" },
}

export default function Logs({ showToast }: { showToast: (msg: string, ok?: boolean) => void }) {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [filter, setFilter] = useState<Level>("all")
  const [search, setSearch] = useState("")
  const [autoScroll, setAutoScroll] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const endRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    try {
      const r = await api<{ data: LogEntry[] }>("/logs")
      setLogs(r.data || [])
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    load()
    if (!autoRefresh) return
    const t = setInterval(load, 3000)
    return () => clearInterval(t)
  }, [load, autoRefresh])

  useEffect(() => {
    if (autoScroll && endRef.current) {
      endRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [logs, autoScroll])

  const clear = async () => {
    await api("/logs/clear")
    showToast("日志已清空")
    load()
  }

  const counts = useMemo(() => ({
    all: logs.length,
    info: logs.filter((l) => l.level === "info").length,
    debug: logs.filter((l) => l.level === "debug").length,
    warn: logs.filter((l) => l.level === "warn").length,
    error: logs.filter((l) => l.level === "error").length,
  }), [logs])

  const filtered = useMemo(() => {
    let result = filter === "all" ? logs : logs.filter((l) => l.level === filter)
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter((l) => l.msg.toLowerCase().includes(q))
    }
    return result
  }, [logs, filter, search])

  const fmt = (ts: number) => {
    const d = new Date(ts)
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 页头 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">调试日志</h1>
          <p className="text-sm text-slate-400 mt-0.5">实时查看插件运行日志</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer">
            <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} className="rounded border-slate-300" />
            自动刷新
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer">
            <input type="checkbox" checked={autoScroll} onChange={(e) => setAutoScroll(e.target.checked)} className="rounded border-slate-300" />
            自动滚动
          </label>
          <button onClick={clear} className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors flex items-center gap-1.5">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
            清空
          </button>
        </div>
      </div>

      {/* 搜索 + 过滤 */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索日志内容..."
            className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition-all"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>
            </button>
          )}
        </div>

        <div className="flex gap-1.5">
          {(["all", "info", "debug", "warn", "error"] as Level[]).map((l) => {
            const style = l !== "all" ? LEVEL_STYLES[l] : null
            return (
              <button
                key={l}
                onClick={() => setFilter(l)}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                  filter === l
                    ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
              >
                {l !== "all" && <span className={`size-1.5 rounded-full ${filter === l ? "bg-white" : style?.dot}`} />}
                <span>{l === "all" ? "全部" : l.toUpperCase()}</span>
                <span className={`rounded-full px-1.5 py-0.5 text-[9px] ${filter === l ? "bg-white/20" : "bg-slate-100"}`}>{counts[l]}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* 日志内容 */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden flex-1">
        {/* 状态栏 */}
        <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <span className={`size-1.5 rounded-full ${autoRefresh ? "bg-emerald-500 animate-pulse" : "bg-slate-300"}`} />
            <span className="text-[10px] text-slate-400">
              {autoRefresh ? "实时刷新中" : "已暂停"}
              {search && ` · 搜索: "${search}"`}
            </span>
          </div>
          <span className="text-[10px] text-slate-400">
            {filtered.length}{(filter !== "all" || search) ? `/${logs.length}` : ""} 条
          </span>
        </div>

        <div className="max-h-[600px] overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="py-16 text-center">
              <div className="flex justify-center mb-3">
                <div className="flex size-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-300">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-7 h-7"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>
                </div>
              </div>
              {logs.length === 0 ? (
                <>
                  <p className="text-sm text-slate-400">暂无日志</p>
                  <p className="text-xs text-slate-300 mt-1">插件运行后将自动记录日志</p>
                </>
              ) : (
                <>
                  <p className="text-sm text-slate-400">无匹配日志</p>
                  <p className="text-xs text-slate-300 mt-1">尝试调整搜索或筛选条件</p>
                </>
              )}
            </div>
          ) : (
            <div className="p-3 font-mono text-xs leading-relaxed">
              {filtered.map((log, i) => {
                const style = LEVEL_STYLES[log.level] || LEVEL_STYLES.debug
                return (
                  <div key={i} className="flex gap-3 py-1.5 px-2 rounded-lg hover:bg-slate-50 transition-colors">
                    <span className="text-slate-300 shrink-0 tabular-nums w-16">{fmt(log.time)}</span>
                    <span className={`shrink-0 w-16 text-center uppercase font-semibold ${style.text}`}>
                      <span className={`inline-block size-1.5 rounded-full mr-1 ${style.dot}`} />
                      {log.level}
                    </span>
                    <span className="text-slate-700 break-all flex-1">{log.msg}</span>
                  </div>
                )
              })}
              <div ref={endRef} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
