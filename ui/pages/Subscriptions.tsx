import { useState, useEffect, useCallback } from "react"
import { api } from "../api"
import type { Subscription, UserSubscription, GroupInfo } from "../types"
import { ConfirmModal } from "../components/Toast"
import { GroupPicker } from "../components/GroupPicker"

export default function Subscriptions({ showToast }: { showToast: (msg: string, ok?: boolean) => void }) {
  const [subs, setSubs] = useState<Subscription[]>([])
  const [userSubs, setUserSubs] = useState<UserSubscription[]>([])
  const [groups, setGroups] = useState<GroupInfo[]>([])
  const [editingSub, setEditingSub] = useState<Subscription | null>(null)
  const [confirm, setConfirm] = useState<{ msg: string; onOk: () => void } | null>(null)

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
    await api("/sub/toggle", { repo: sub.repo, branch: sub.branch })
    load()
  }

  const deleteSub = (sub: Subscription) => {
    setConfirm({
      msg: `确认删除 ${sub.repo} (${sub.branch}) 的订阅？`,
      onOk: async () => { await api("/sub/delete", { repo: sub.repo, branch: sub.branch }); showToast("已删除"); load(); setConfirm(null) },
    })
  }

  const toggleUser = async (u: UserSubscription) => {
    await api("/user/toggle", { username: u.username })
    load()
  }

  const deleteUser = (u: UserSubscription) => {
    setConfirm({
      msg: `确认取消关注 ${u.username}？`,
      onOk: async () => { await api("/user/delete", { username: u.username }); showToast("已取消关注"); load(); setConfirm(null) },
    })
  }

  const saveSubGroups = async () => {
    if (!editingSub) return
    await api("/sub/update", { repo: editingSub.repo, branch: editingSub.branch, groups: editingSub.groups })
    showToast("已保存")
    setEditingSub(null)
    load()
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold text-slate-900">订阅管理</h1>

      {/* 仓库订阅 */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4 text-slate-400"><path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>
            <h3 className="text-sm font-semibold text-slate-900">仓库订阅</h3>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">{subs.length}</span>
          </div>
        </div>
        {subs.length === 0 ? (
          <div className="py-16 text-center">
            <div className="text-4xl mb-3 opacity-30">📦</div>
            <p className="text-sm text-slate-400">暂无订阅</p>
            <p className="text-xs text-slate-300 mt-1">前往「添加订阅」页面添加</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4">
            {subs.map((s, i) => (
              <div key={i} className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <button onClick={() => toggleSub(s)} className={`size-2.5 rounded-full shrink-0 transition-colors ${s.enabled ? "bg-emerald-500 hover:bg-emerald-400" : "bg-slate-300 hover:bg-slate-400"}`} />
                    <div>
                      <div className="text-sm font-semibold text-slate-800">{s.repo}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{s.branch}</div>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={() => setEditingSub({ ...s })} className="h-7 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50 transition-colors">编辑</button>
                    <button onClick={() => deleteSub(s)} className="h-7 rounded-lg border border-red-200 bg-white px-2.5 text-[11px] font-medium text-red-600 hover:bg-red-50 transition-colors">删除</button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {s.types.map((t) => (
                    <span key={t} className="rounded-md bg-white border border-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-600">{t}</span>
                  ))}
                  {s.groups.map((gid) => {
                    const g = groups.find((x) => String(x.group_id) === gid)
                    return <span key={gid} className="rounded-md bg-slate-900 px-2 py-0.5 text-[10px] font-medium text-white">{g ? String(g.group_name) : gid}</span>
                  })}
                  {s.groups.length === 0 && <span className="text-[10px] text-slate-300 italic">未分配群</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 用户关注 */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4 text-slate-400"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
            <h3 className="text-sm font-semibold text-slate-900">用户关注</h3>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">{userSubs.length}</span>
          </div>
        </div>
        {userSubs.length === 0 ? (
          <div className="py-16 text-center">
            <div className="text-4xl mb-3 opacity-30">👤</div>
            <p className="text-sm text-slate-400">暂无关注</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
            {userSubs.map((u, i) => (
              <div key={i} className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 hover:bg-slate-50 transition-colors">
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
            <h3 className="text-base font-semibold text-slate-900 mb-4">编辑推送群</h3>
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
