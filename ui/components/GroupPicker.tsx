import { useState, useRef, useEffect, type ReactNode } from "react"
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
    setOpen(false)
  }

  const nameOf = (gid: string) => {
    const found = allGroups.find((g) => String(g.group_id) === gid)
    return found ? String(found.group_name) : gid
  }

  return (
    <div ref={ref} className="relative">
      <div className="flex flex-wrap gap-1 min-h-[36px] rounded-md border bg-input/30 px-2 py-1.5 cursor-pointer" onClick={() => setOpen(true)}>
        {groups.length === 0 && <span className="text-xs text-muted-foreground">点击选择群...</span>}
        {groups.map((gid) => (
          <span key={gid} className="inline-flex items-center gap-1 rounded bg-primary/10 border border-primary/20 px-1.5 py-0.5 text-[11px]">
            {nameOf(gid)}
            <button onClick={(e) => { e.stopPropagation(); remove(gid) }} className="text-muted-foreground hover:text-destructive ml-0.5">×</button>
          </span>
        ))}
      </div>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-card shadow-lg max-h-48 overflow-y-auto">
          <input
            className="w-full border-b px-3 py-1.5 text-xs outline-none bg-transparent"
            placeholder="搜索群..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">无匹配结果</p>
          ) : (
            filtered.map((g) => (
              <button
                key={g.group_id}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent flex justify-between"
                onClick={() => add(String(g.group_id))}
              >
                <span className="truncate">{String(g.group_name)}</span>
                <span className="text-muted-foreground ml-2 shrink-0">{String(g.group_id)}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
