import { useState, useEffect, useCallback } from "react"
import { api } from "../api"
import type { BranchInfo, GroupInfo, EventType } from "../types"
import { GroupPicker } from "../components/GroupPicker"

export default function AddSub({ showToast }: { showToast: (msg: string, ok?: boolean) => void }) {
  const [repo, setRepo] = useState("")
  const [branches, setBranches] = useState<BranchInfo[]>([])
  const [selectedBranches, setSelectedBranches] = useState<string[]>([])
  const [manualBranch, setManualBranch] = useState("")
  const [useManual, setUseManual] = useState(false)
  const [types, setTypes] = useState<EventType[]>(["commits", "issues", "pulls"])
  const [groups, setGroups] = useState<string[]>([])
  const [allGroups, setAllGroups] = useState<GroupInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(false)

  const [userMode, setUserMode] = useState(false)
  const [username, setUsername] = useState("")
  const [userGroups, setUserGroups] = useState<string[]>([])

  useEffect(() => {
    api<{ data: GroupInfo[] }>("/groups").then((r) => setAllGroups(r.data || [])).catch(() => {})
  }, [])

  const fetchBranches = async () => {
    if (!repo.includes("/")) { showToast("请输入正确的仓库格式 owner/repo", false); return }
    setFetching(true)
    try {
      const r = await api<{ success: boolean; data?: BranchInfo[]; error?: string }>("/repo/branches", { repo: repo.trim().toLowerCase() })
      if (r.success && r.data) {
        setBranches(r.data)
        setSelectedBranches(r.data.filter((b) => b.isDefault).map((b) => b.name))
        setUseManual(false)
      } else {
        showToast(r.error || "获取分支失败", false)
      }
    } catch {
      showToast("请求失败", false)
    } finally {
      setFetching(false)
    }
  }

  const toggleType = (t: EventType) => {
    setTypes((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t])
  }

  const addRepoSub = async () => {
    if (!repo.includes("/")) { showToast("仓库格式错误", false); return }
    setLoading(true)
    try {
      const branchList = useManual ? [manualBranch || "main"] : selectedBranches
      const r = await api<{ success: boolean; error?: string; message?: string }>("/sub/add", {
        repo: repo.trim().toLowerCase(),
        branches: branchList.length ? branchList : undefined,
        types,
        groups,
      })
      if (r.success) {
        showToast(r.message || "添加成功")
        setRepo("")
        setBranches([])
        setSelectedBranches([])
      } else {
        showToast(r.error || "添加失败", false)
      }
    } catch {
      showToast("请求失败", false)
    } finally {
      setLoading(false)
    }
  }

  const addUserSub = async () => {
    if (!username.trim()) { showToast("用户名不能为空", false); return }
    setLoading(true)
    try {
      const r = await api<{ success: boolean; error?: string }>("/user/add", { username: username.trim(), groups: userGroups })
      if (r.success) {
        showToast("关注成功")
        setUsername("")
        setUserGroups([])
      } else {
        showToast(r.error || "关注失败", false)
      }
    } catch {
      showToast("请求失败", false)
    } finally {
      setLoading(false)
    }
  }

  const typeOptions: { value: EventType; label: string; color: string }[] = [
    { value: "commits", label: "Commits", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
    { value: "issues", label: "Issues", color: "bg-purple-100 text-purple-700 border-purple-200" },
    { value: "pulls", label: "Pull Requests", color: "bg-blue-100 text-blue-700 border-blue-200" },
    { value: "actions", label: "Actions", color: "bg-amber-100 text-amber-700 border-amber-200" },
  ]

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-base font-semibold">添加订阅</h2>

      {/* 切换模式 */}
      <div className="flex gap-2">
        <button onClick={() => setUserMode(false)} className={`h-8 rounded-md px-3 text-xs font-medium border ${!userMode ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}>
          📦 订阅仓库
        </button>
        <button onClick={() => setUserMode(true)} className={`h-8 rounded-md px-3 text-xs font-medium border ${userMode ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}>
          👤 关注用户
        </button>
      </div>

      {!userMode ? (
        /* ── 仓库订阅 ── */
        <div className="rounded-xl border bg-card p-4 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">仓库地址</span>
            <div className="flex gap-2">
              <input
                className="flex-1 h-9 rounded-md border bg-input/30 px-3 text-sm outline-none focus-visible:border-ring"
                placeholder="owner/repo"
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchBranches()}
              />
              <button onClick={fetchBranches} disabled={fetching} className="h-9 rounded-md border px-3 text-xs hover:bg-accent disabled:opacity-50 shrink-0">
                {fetching ? "获取中..." : "获取分支"}
              </button>
            </div>
          </div>

          {branches.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">选择分支</span>
                <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer">
                  <input type="checkbox" checked={useManual} onChange={(e) => setUseManual(e.target.checked)} className="rounded" />
                  手动输入
                </label>
              </div>
              {useManual ? (
                <input
                  className="h-9 rounded-md border bg-input/30 px-3 text-sm outline-none focus-visible:border-ring"
                  placeholder="分支名，默认 main"
                  value={manualBranch}
                  onChange={(e) => setManualBranch(e.target.value)}
                />
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {branches.map((b) => (
                    <button
                      key={b.name}
                      onClick={() => setSelectedBranches((prev) => prev.includes(b.name) ? prev.filter((x) => x !== b.name) : [...prev, b.name])}
                      className={`h-7 rounded-md border px-2 text-[11px] font-medium transition-colors ${
                        selectedBranches.includes(b.name)
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-accent"
                      }`}
                    >
                      {b.name}
                      {b.isDefault && <span className="ml-1 text-[9px] opacity-70">default</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">监控类型</span>
            <div className="flex flex-wrap gap-1.5">
              {typeOptions.map((t) => (
                <button
                  key={t.value}
                  onClick={() => toggleType(t.value)}
                  className={`h-7 rounded-md border px-2 text-[11px] font-medium transition-colors ${
                    types.includes(t.value) ? t.color : "hover:bg-accent"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">推送群</span>
            <GroupPicker groups={groups} allGroups={allGroups} onChange={setGroups} />
          </div>

          <button
            onClick={addRepoSub}
            disabled={loading || !repo.includes("/")}
            className="h-9 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 w-full"
          >
            {loading ? "添加中..." : "添加订阅"}
          </button>
        </div>
      ) : (
        /* ── 用户关注 ── */
        <div className="rounded-xl border bg-card p-4 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">GitHub 用户名</span>
            <input
              className="h-9 rounded-md border bg-input/30 px-3 text-sm outline-none focus-visible:border-ring"
              placeholder="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addUserSub()}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">推送群</span>
            <GroupPicker groups={userGroups} allGroups={allGroups} onChange={setUserGroups} />
          </div>

          <button
            onClick={addUserSub}
            disabled={loading || !username.trim()}
            className="h-9 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 w-full"
          >
            {loading ? "关注中..." : "关注用户"}
          </button>
        </div>
      )}
    </div>
  )
}
