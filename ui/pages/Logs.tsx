import { useState, useEffect, useRef, useCallback } from "react"
import { api } from "../api"
import type { LogEntry } from "../types"

type Level = "all" | "info" | "debug" | "warn" | "error"

const LEVEL_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  info:  { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500" },
  debug: { bg: "bg-slate-50", text: "text-slate-500", dot: "bg-slate-400" },
  warn:  { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" },
  error: { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500" },
}

export default function Logs({ showToast }: { showToast: (msg: string, ok?: boolean) => void }) {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [filter, setFilter] = useState<Level>("all")
  const [autoScroll, setAutoScroll] = useState(true)
  const endRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    try {
      const r = await api<{ data: LogEntry[] }>("/logs")
      setLogs(r.data || [])
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 3000)
    return () => clearInterval(t)
  }, [load])

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

  const filtered = filter === "all" ? logs : logs.filter((l) => l.level === filter)

  const fmt = (ts: number) => {
    const d = new Date(ts)
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`
  }

  const counts = {
    all: logs.length,
    info: logs.filter((l) => l.level === "info").length,
    debug: logs.filter((l) => l.level === "debug").length,
    warn: logs.filter((l) => l.level === "warn").length,
    error: logs.filter((l) => l.level === "error").length,
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">调试日志</h1>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer">
            <input type="checkbox" checked={autoScroll} onChange={(e) => setAutoScroll(e.target.checked)} className="rounded" />
            自动滚动
          </label>
          <button onClick={clear} className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors">清空日志</button>
        </div>
      </div>

      {/* 过滤器 */}
      <div className="flex gap-2">
        {(["all", "info", "debug", "warn", "error"] as Level[]).map((l) => (
          <button
            key={l}
            onClick={() => setFilter(l)}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition-all ${
              filter === l
                ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            {l !== "all" && <span className={`size-1.5 rounded-full ${filter === l ? "bg-white" : LEVEL_STYLES[l]?.dot}`} />}
            <span>{l === "all" ? "全部" : l.toUpperCase()}</span>
            <span className={`rounded-full px-1.5 py-0.5 text-[9px] ${filter === l ? "bg-white/20" : "bg-slate-100"}`}>{counts[l]}</span>
          </button>
        ))}
      </div>

      {/* 日志内容 */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="max-h-[600px] overflow-y-auto p-4 font-mono text-xs leading-relaxed">
          {filtered.length === 0 ? (
            <div className="py-16 text-center">
              <div className="text-4xl mb-3 opacity-30">📝</div>
              <p className="text-sm text-slate-400">暂无日志</p>
            </div>
          ) : (
            filtered.map((log, i) => {
              const style = LEVEL_STYLES[log.level] || LEVEL_STYLES.debug
              return (
                <div key={i} className="flex gap-3 py-1 px-2 rounded-lg hover:bg-slate-50 transition-colors group">
                  <span className="text-slate-300 shrink-0 tabular-nums">{fmt(log.time)}</span>
                  <span className={`shrink-0 w-14 uppercase font-semibold ${style.text}`}>
                    <span className={`inline-block size-1.5 rounded-full mr-1.5 ${style.dot}`} />
                    {log.level}
                  </span>
                  <span className="text-slate-700 break-all">{log.msg}</span>
                </div>
              )
            })
          )}
          <div ref={endRef} />
        </div>
      </div>
    </div>
  )
}
