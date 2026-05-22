import { useState, useEffect, useRef, useCallback } from "react"
import { api } from "../api"
import type { LogEntry } from "../types"

type Level = "all" | "info" | "debug" | "warn" | "error"

const LEVEL_COLORS: Record<string, string> = {
  info: "text-blue-600",
  debug: "text-muted-foreground",
  warn: "text-amber-600",
  error: "text-destructive",
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">调试日志</h2>
        <div className="flex gap-2">
          <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer">
            <input type="checkbox" checked={autoScroll} onChange={(e) => setAutoScroll(e.target.checked)} className="rounded" />
            自动滚动
          </label>
          <button onClick={clear} className="h-7 rounded border px-2 text-[11px] hover:bg-accent">清空</button>
        </div>
      </div>

      <div className="flex gap-1.5">
        {(["all", "info", "debug", "warn", "error"] as Level[]).map((l) => (
          <button
            key={l}
            onClick={() => setFilter(l)}
            className={`h-7 rounded-md border px-2 text-[11px] font-medium transition-colors ${
              filter === l ? "bg-primary text-primary-foreground" : "hover:bg-accent"
            }`}
          >
            {l === "all" ? "全部" : l.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="rounded-xl border bg-card">
        <div className="max-h-[500px] overflow-y-auto p-3 font-mono text-[11px] leading-relaxed">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">暂无日志</p>
          ) : (
            filtered.map((log, i) => (
              <div key={i} className="flex gap-2 py-0.5 hover:bg-muted/30">
                <span className="text-muted-foreground shrink-0">{fmt(log.time)}</span>
                <span className={`shrink-0 w-12 uppercase font-medium ${LEVEL_COLORS[log.level] ?? ""}`}>{log.level}</span>
                <span className="break-all">{log.msg}</span>
              </div>
            ))
          )}
          <div ref={endRef} />
        </div>
      </div>
    </div>
  )
}
