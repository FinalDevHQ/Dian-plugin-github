import { useState, useRef, useEffect } from "react"
import type { GroupInfo } from "../types"

export function GroupPicker({
  groups, allGroups, onChange,
}: {
  groups: string[]; allGroups: GroupInfo[]; onChange: (g: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const filtered = allGroups.filter(
    (g) =>
      !groups.includes(String(g.group_id)) &&
      (String(g.group_name).toLowerCase().includes(search.toLowerCase()) ||
        String(g.group_id).includes(search)),
  )

  const remove = (gid: string) => onChange(groups.filter((g) => g !== gid))
  const add = (gid: string) => {
    onChange([...groups, gid])
    setSearch("")
  }

  const nameOf = (gid: string) => {
    const found = allGroups.find((g) => String(g.group_id) === gid)
    return found ? String(found.group_name) : gid
  }

  return (
    <div ref={ref} className="relative">
      <div
        className="flex flex-wrap items-center gap-1.5 min-h-[40px] rounded-xl border border-slate-200 bg-white px-3 py-2 cursor-pointer hover:border-slate-300 transition-colors"
        onClick={() => setOpen(true)}
      >
        {groups.length === 0 && <span className="text-xs text-slate-400">点击选择群...</span>}
        {groups.map((gid) => (
          <span key={gid} className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2 py-1 text-[11px] font-medium text-white">
            {nameOf(gid)}
            <button onClick={(e) => { e.stopPropagation(); remove(gid) }} className="text-white/50 hover:text-white ml-0.5">×</button>
          </span>
        ))}
      </div>
      {open && (
        <div className="absolute z-50 mt-1.5 w-full min-w-[280px] rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="p-2 border-b border-slate-100">
            <input
              className="w-full h-8 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs outline-none focus:border-slate-400 focus:bg-white transition-all"
              placeholder="搜索群名或群号..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="px-4 py-3 text-xs text-slate-400 text-center">无匹配结果</p>
            ) : (
              filtered.map((g) => (
                <button
                  key={g.group_id}
                  className="w-full text-left px-4 py-2.5 text-xs hover:bg-slate-50 flex items-center justify-between transition-colors"
                  onClick={() => add(String(g.group_id))}
                >
                  <span className="text-slate-700 font-medium truncate">{String(g.group_name)}</span>
                  <span className="text-slate-400 ml-3 shrink-0 font-mono text-[10px]">{String(g.group_id)}</span>
                </button>
              ))
            )}
          </div>
          <div className="px-3 py-2 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[10px] text-slate-400">{filtered.length} 个群</span>
            {groups.length > 0 && (
              <button onClick={() => onChange([])} className="text-[10px] text-red-400 hover:text-red-600 transition-colors">清空选择</button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
