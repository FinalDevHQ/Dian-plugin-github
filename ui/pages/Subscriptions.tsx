import { useState, useEffect, useCallback } from "react"
import { api } from "../api"
import type { Subscription, UserSubscription, Config, GroupInfo } from "../types"
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
    <div className="flex flex-col gap-4">
      <h2 className="text-base font-semibold">订阅管理</h2>

      {/* 仓库订阅 */}
      <div className="rounded-xl border bg-card">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <span className="text-xs font-medium">仓库订阅 ({subs.length})</span>
        </div>
        {subs.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground">暂无订阅，前往「添加订阅」页面添加</p>
        ) : (
          <div className="divide-y">
            {subs.map((s, i) => (
              <div key={i} className="px-4 py-3 flex items-center gap-3">
                <button onClick={() => toggleSub(s)} className={s.enabled ? "text-emerald-500" : "text-red-500"}>
                  {s.enabled ? "🟢" : "🔴"}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{s.repo}</div>
                  <div className="text-[11px] text-muted-foreground">{s.branch} · {s.types.join(", ")}</div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {s.groups.map((gid) => {
                      const g = groups.find((x) => String(x.group_id) === gid)
                      return <span key={gid} className="rounded bg-muted px-1 py-0.5 text-[10px]">{g ? String(g.group_name) : gid}</span>
                    })}
                    {s.groups.length === 0 && <span className="text-[10px] text-muted-foreground">未分配群</span>}
                  </div>
                </div>
                <button onClick={() => setEditingSub({ ...s })} className="h-7 rounded border px-2 text-[11px] hover:bg-accent">编辑</button>
                <button onClick={() => deleteSub(s)} className="h-7 rounded border border-destructive/30 px-2 text-[11px] text-destructive hover:bg-red-50">删除</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 用户关注 */}
      <div className="rounded-xl border bg-card">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <span className="text-xs font-medium">用户关注 ({userSubs.length})</span>
        </div>
        {userSubs.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground">暂无关注</p>
        ) : (
          <div className="divide-y">
            {userSubs.map((u, i) => (
              <div key={i} className="px-4 py-3 flex items-center gap-3">
                <button onClick={() => toggleUser(u)} className={u.enabled ? "text-emerald-500" : "text-red-500"}>
                  {u.enabled ? "🟢" : "🔴"}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{u.username}</div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {u.groups.map((gid) => {
                      const g = groups.find((x) => String(x.group_id) === gid)
                      return <span key={gid} className="rounded bg-muted px-1 py-0.5 text-[10px]">{g ? String(g.group_name) : gid}</span>
                    })}
                  </div>
                </div>
                <button onClick={() => deleteUser(u)} className="h-7 rounded border border-destructive/30 px-2 text-[11px] text-destructive hover:bg-red-50">取消关注</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 编辑群弹窗 */}
      {editingSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setEditingSub(null)}>
          <div className="rounded-xl border bg-card p-5 shadow-xl w-96" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-medium mb-3">编辑推送群 - {editingSub.repo}</h3>
            <GroupPicker groups={editingSub.groups} allGroups={groups} onChange={(g) => setEditingSub({ ...editingSub, groups: g })} />
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setEditingSub(null)} className="h-8 rounded-md border px-3 text-xs hover:bg-accent">取消</button>
              <button onClick={saveSubGroups} className="h-8 rounded-md bg-primary text-primary-foreground px-3 text-xs hover:bg-primary/90">保存</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal open={!!confirm} message={confirm?.msg ?? ""} onConfirm={() => confirm?.onOk()} onCancel={() => setConfirm(null)} />
    </div>
  )
}
