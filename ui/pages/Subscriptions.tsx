import { useState, useEffect, useCallback, useMemo } from "react"
import { api } from "../api"
import type { Subscription, UserSubscription, GroupInfo, EventType } from "../types"
import { ConfirmModal } from "../components/Toast"
import { GroupPicker } from "../components/GroupPicker"

const TYPE_META: Record<EventType, { label: string; color: string; bg: string }> = {
  commits: { label: "Commits", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
  issues:  { label: "Issues",  color: "text-violet-700",  bg: "bg-violet-50 border-violet-200"  },
  pulls:   { label: "PRs",     color: "text-blue-700",    bg: "bg-blue-50 border-blue-200"      },
  actions: { label: "Actions", color: "text-amber-700",   bg: "bg-amber-50 border-amber-200"    },
}

type SortKey = "name" | "date" | "groups"

export default function Subscriptions({ showToast }: { showToast: (msg: string, ok?: boolean) => void }) {
  const [subs, setSubs] = useState<Subscription[]>([])
  const [userSubs, setUserSubs] = useState<UserSubscription[]>([])
  const [groups, setGroups] = useState<GroupInfo[]>([])
  const [editingSub, setEditingSub] = useState<Subscription | null>(null)
  const [confirm, setConfirm] = useState<{ msg: string; onOk: () => void } | null>(null)

  // Filters
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "enabled" | "disabled">("all")
  const [sortKey, setSortKey] = useState<SortKey>("name")
  const [sortAsc, setSortAsc] = useState(true)

  const load = useCallback(async () => {
    try {
      const [cfg, gl] = await Promise.all([api<{ subscriptions: Subscription[]; userSubscriptions: UserSubscription[] }>("/config"), api<{ data: GroupInfo[] }>("/groups").catch(() => ({ data: [] }))])
      setSubs(cfg.subscriptions)
      setUserSubs(cfg.userSubscriptions)
      setGroups(gl.data || [])
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { load() }, [load])

  const toggleSub = async (sub: Subscription) => {
    try {
      await api("/sub/toggle", { repo: sub.repo, branch: sub.branch })
      load()
    } catch (e: any) {
      showToast(`操作失败: ${e.message}`, false)
    }
  }

  const deleteSub = (sub: Subscription) => {
    setConfirm({
      msg: `确认删除 ${sub.repo} (${sub.branch}) 的订阅？`,
      onOk: async () => {
        try {
          await api("/sub/delete", { repo: sub.repo, branch: sub.branch })
          showToast("已删除")
          load()
          setConfirm(null)
        } catch (e: any) {
          showToast(`删除失败: ${e.message}`, false)
        }
      },
    })
  }

  const toggleUser = async (u: UserSubscription) => {
    try {
      await api("/user/toggle", { username: u.username })
      load()
    } catch (e: any) {
      showToast(`操作失败: ${e.message}`, false)
    }
  }

  const deleteUser = (u: UserSubscription) => {
    setConfirm({
      msg: `确认取消关注 ${u.username}？`,
      onOk: async () => {
        try {
          await api("/user/delete", { username: u.username })
          showToast("已取消关注")
          load()
          setConfirm(null)
        } catch (e: any) {
          showToast(`操作失败: ${e.message}`, false)
        }
      },
    })
  }

  const saveSubGroups = async () => {
    if (!editingSub) return
    try {
      await api("/sub/update", { repo: editingSub.repo, branch: editingSub.branch, groups: editingSub.groups })
      showToast("已保存")
      setEditingSub(null)
      load()
    } catch (e: any) {
      showToast(`保存失败: ${e.message}`, false)
    }
  }

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc)
    } else {
      setSortKey(key)
      setSortAsc(true)
    }
  }

  const filteredSubs = useMemo(() => {
    let result = [...subs]

    // Search
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(s =>
        s.repo.toLowerCase().includes(q) ||
        s.branch.toLowerCase().includes(q) ||
        s.groups.some(g => {
          const group = groups.find(x => String(x.group_id) === g)
          return group?.group_name.toLowerCase().includes(q)
        })
      )
    }

    // Status filter
    if (statusFilter === "enabled") result = result.filter(s => s.enabled)
    if (statusFilter === "disabled") result = result.filter(s => !s.enabled)

    // Sort
    result.sort((a, b) => {
      let cmp = 0
      if (sortKey === "name") cmp = a.repo.localeCompare(b.repo)
      else if (sortKey === "date") cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      else if (sortKey === "groups") cmp = a.groups.length - b.groups.length
      return sortAsc ? cmp : -cmp
    })

    return result
  }, [subs, search, statusFilter, sortKey, sortAsc, groups])

  const filteredUserSubs = useMemo(() => {
    if (!search.trim()) return userSubs
    const q = search.toLowerCase()
    return userSubs.filter(u =>
      u.username.toLowerCase().includes(q) ||
      u.groups.some(g => {
        const group = groups.find(x => String(x.group_id) === g)
        return group?.group_name.toLowerCase().includes(q)
      })
    )
  }, [userSubs, search, groups])

  const enabledCount = subs.filter(s => s.enabled).length
  const disabledCount = subs.length - enabledCount

  return (
    <div className="flex flex-col gap-6">
      {/* 页头 */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">订阅管理</h1>
        <p className="text-sm text-slate-400 mt-0.5">管理仓库订阅和用户关注</p>
      </div>

      {/* 搜索 + 筛选 */}
      <div className="flex flex-wrap items-center gap-3">
        {/* 搜索框 */}
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索仓库、分支、群名..."
            className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition-all"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>
            </button>
          )}
        </div>

        {/* 状态筛选 */}
        <div className="flex gap-1 p-0.5 bg-slate-100 rounded-lg">
          {([["all", "全部"], ["enabled", "启用"], ["disabled", "禁用"]] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                statusFilter === key
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {label}
              {key === "enabled" && ` (${enabledCount})`}
              {key === "disabled" && ` (${disabledCount})`}
            </button>
          ))}
        </div>

        {/* 排序 */}
        <div className="flex items-center gap-1">
          {([["name", "名称"], ["date", "时间"], ["groups", "群数"]] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => toggleSort(key)}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md transition-all ${
                sortKey === key
                  ? "bg-slate-900 text-white"
                  : "text-slate-500 hover:bg-slate-100"
              }`}
            >
              {label}
              {sortKey === key && (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`w-3 h-3 transition-transform ${sortAsc ? "" : "rotate-180"}`}>
                  <path d="M12 5v14M5 12l7 7 7-7"/>
                </svg>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 仓库订阅 */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4 text-slate-400"><path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>
            <h3 className="text-sm font-semibold text-slate-900">仓库订阅</h3>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">{filteredSubs.length}{search || statusFilter !== "all" ? `/${subs.length}` : ""}</span>
          </div>
        </div>
        {filteredSubs.length === 0 ? (
          <div className="py-16 text-center">
            {subs.length === 0 ? (
              <>
                <div className="flex justify-center mb-3">
                  <div className="flex size-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-300">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-7 h-7"><path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>
                  </div>
                </div>
                <p className="text-sm text-slate-400">暂无订阅</p>
                <p className="text-xs text-slate-300 mt-1">前往「添加订阅」页面添加</p>
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8 text-slate-300 mx-auto mb-2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                <p className="text-sm text-slate-400">无匹配结果</p>
                <p className="text-xs text-slate-300 mt-1">尝试调整搜索条件</p>
              </>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredSubs.map((s, i) => {
              const repoParts = s.repo.split("/")
              return (
                <div key={`${s.repo}-${s.branch}`} className="px-5 py-4 hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-start gap-4">
                    {/* 状态指示 */}
                    <button
                      onClick={() => toggleSub(s)}
                      className={`mt-1 size-2.5 rounded-full shrink-0 transition-colors ${s.enabled ? "bg-emerald-500 hover:bg-emerald-400" : "bg-slate-300 hover:bg-slate-400"}`}
                      title={s.enabled ? "点击禁用" : "点击启用"}
                    />

                    {/* 主信息 */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-xs text-slate-400">{repoParts[0]}/</span>
                        <span className="text-sm font-semibold text-slate-900">{repoParts[1]}</span>
                        <span className="text-xs text-slate-300 bg-slate-100 px-1.5 py-0.5 rounded font-mono">{s.branch}</span>
                        {!s.enabled && (
                          <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">已禁用</span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {s.types.map((t) => (
                          <span key={t} className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${TYPE_META[t]?.color ?? "text-slate-600"} ${TYPE_META[t]?.bg ?? "bg-slate-50 border-slate-200"}`}>
                            {TYPE_META[t]?.label ?? t}
                          </span>
                        ))}
                        {s.groups.length > 0 ? (
                          s.groups.map((gid) => {
                            const g = groups.find((x) => String(x.group_id) === gid)
                            return (
                              <span key={gid} className="rounded bg-slate-900 px-1.5 py-0.5 text-[10px] font-medium text-white">
                                {g ? String(g.group_name) : gid}
                              </span>
                            )
                          })
                        ) : (
                          <span className="text-[10px] text-slate-300 italic">未分配群</span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-300 mt-1.5">
                        创建于 {new Date(s.createdAt).toLocaleDateString("zh-CN")}
                      </div>
                    </div>

                    {/* 操作按钮 */}
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        onClick={() => setEditingSub({ ...s })}
                        className="h-7 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                      >
                        编辑群
                      </button>
                      <button
                        onClick={() => deleteSub(s)}
                        className="h-7 rounded-lg border border-red-200 bg-white px-2.5 text-[11px] font-medium text-red-600 hover:bg-red-50 transition-colors"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 用户关注 */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4 text-slate-400"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
            <h3 className="text-sm font-semibold text-slate-900">用户关注</h3>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">{filteredUserSubs.length}{search ? `/${userSubs.length}` : ""}</span>
          </div>
        </div>
        {filteredUserSubs.length === 0 ? (
          <div className="py-16 text-center">
            {userSubs.length === 0 ? (
              <>
                <div className="flex justify-center mb-3">
                  <div className="flex size-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-300">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-7 h-7"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                  </div>
                </div>
                <p className="text-sm text-slate-400">暂无关注</p>
              </>
            ) : (
              <p className="text-sm text-slate-400">无匹配结果</p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
            {filteredUserSubs.map((u, i) => (
              <div key={u.username} className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <button onClick={() => toggleUser(u)} className={`size-2.5 rounded-full shrink-0 transition-colors ${u.enabled ? "bg-emerald-500 hover:bg-emerald-400" : "bg-slate-300 hover:bg-slate-400"}`} />
                    <span className="text-sm font-semibold text-slate-800">{u.username}</span>
                  </div>
                  <button onClick={() => deleteUser(u)} className="h-7 rounded-lg border border-red-200 bg-white px-2.5 text-[11px] font-medium text-red-600 hover:bg-red-50 transition-colors">取消关注</button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {u.groups.map((gid) => {
                    const g = groups.find((x) => String(x.group_id) === gid)
                    return <span key={gid} className="rounded-md bg-slate-900 px-2 py-0.5 text-[10px] font-medium text-white">{g ? String(g.group_name) : gid}</span>
                  })}
                  {u.groups.length === 0 && <span className="text-[10px] text-slate-300 italic">未分配群</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 编辑群弹窗 */}
      {editingSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setEditingSub(null)}>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl w-[420px] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-slate-900 mb-1">编辑推送群</h3>
            <p className="text-sm text-slate-500 mb-4">{editingSub.repo} ({editingSub.branch})</p>
            <GroupPicker groups={editingSub.groups} allGroups={groups} onChange={(g) => setEditingSub({ ...editingSub, groups: g })} />
            <div className="flex justify-end gap-2.5 mt-6">
              <button onClick={() => setEditingSub(null)} className="h-9 rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">取消</button>
              <button onClick={saveSubGroups} className="h-9 rounded-xl bg-slate-900 text-white px-4 text-sm font-medium hover:bg-slate-800 transition-colors">保存</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal open={!!confirm} message={confirm?.msg ?? ""} onConfirm={() => confirm?.onOk()} onCancel={() => setConfirm(null)} />
    </div>
  )
}
