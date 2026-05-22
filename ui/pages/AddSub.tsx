import { useState, useEffect } from "react"
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

  const typeOptions: { value: EventType; label: string; color: string; activeColor: string }[] = [
    { value: "commits", label: "Commits", color: "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50", activeColor: "border-emerald-500 bg-emerald-50 text-emerald-700" },
    { value: "issues", label: "Issues", color: "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50", activeColor: "border-violet-500 bg-violet-50 text-violet-700" },
    { value: "pulls", label: "Pull Requests", color: "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50", activeColor: "border-blue-500 bg-blue-50 text-blue-700" },
    { value: "actions", label: "Actions", color: "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50", activeColor: "border-amber-500 bg-amber-50 text-amber-700" },
  ]

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold text-slate-900">添加订阅</h1>

      {/* 模式切换 */}
      <div className="flex gap-2 p-1 bg-slate-100 rounded-xl w-fit">
        <button
          onClick={() => setUserMode(false)}
          className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium transition-all ${
            !userMode ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>
          订阅仓库
        </button>
        <button
          onClick={() => setUserMode(true)}
          className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium transition-all ${
            userMode ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
          关注用户
        </button>
      </div>

      {!userMode ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {/* 仓库地址 */}
          <div className="flex flex-col gap-2 mb-6">
            <label className="text-xs font-medium text-slate-500">仓库地址</label>
            <div className="flex gap-3">
              <input
                className="flex-1 h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition-all"
                placeholder="owner/repo"
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchBranches()}
              />
              <button
                onClick={fetchBranches}
                disabled={fetching}
                className="h-11 rounded-xl border border-slate-200 bg-white px-5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors shrink-0"
              >
                {fetching ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
                    获取中...
                  </span>
                ) : "获取分支"}
              </button>
            </div>
          </div>

          {/* 分支选择 */}
          {branches.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-slate-500">选择分支</label>
                <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer">
                  <input type="checkbox" checked={useManual} onChange={(e) => setUseManual(e.target.checked)} className="rounded" />
                  手动输入
                </label>
              </div>
              {useManual ? (
                <input
                  className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition-all"
                  placeholder="分支名，默认 main"
                  value={manualBranch}
                  onChange={(e) => setManualBranch(e.target.value)}
                />
              ) : (
                <div className="flex flex-wrap gap-2">
                  {branches.map((b) => (
                    <button
                      key={b.name}
                      onClick={() => setSelectedBranches((prev) => prev.includes(b.name) ? prev.filter((x) => x !== b.name) : [...prev, b.name])}
                      className={`rounded-xl border px-4 py-2 text-xs font-medium transition-all ${
                        selectedBranches.includes(b.name)
                          ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      {b.name}
                      {b.isDefault && <span className="ml-1.5 text-[9px] opacity-60">default</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 监控类型 */}
          <div className="mb-6">
            <label className="text-xs font-medium text-slate-500 mb-2 block">监控类型</label>
            <div className="flex flex-wrap gap-2">
              {typeOptions.map((t) => (
                <button
                  key={t.value}
                  onClick={() => toggleType(t.value)}
                  className={`rounded-xl border px-4 py-2 text-xs font-medium transition-all ${
                    types.includes(t.value) ? t.activeColor : t.color
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* 推送群 */}
          <div className="mb-6">
            <label className="text-xs font-medium text-slate-500 mb-2 block">推送群</label>
            <GroupPicker groups={groups} allGroups={allGroups} onChange={setGroups} />
          </div>

          <button
            onClick={addRepoSub}
            disabled={loading || !repo.includes("/")}
            className="w-full h-11 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 transition-colors shadow-sm"
          >
            {loading ? "添加中..." : "添加订阅"}
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="max-w-md">
            <div className="flex flex-col gap-2 mb-6">
              <label className="text-xs font-medium text-slate-500">GitHub 用户名</label>
              <input
                className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition-all"
                placeholder="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addUserSub()}
              />
            </div>

            <div className="mb-6">
              <label className="text-xs font-medium text-slate-500 mb-2 block">推送群</label>
              <GroupPicker groups={userGroups} allGroups={allGroups} onChange={setUserGroups} />
            </div>

            <button
              onClick={addUserSub}
              disabled={loading || !username.trim()}
              className="w-full h-11 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 transition-colors shadow-sm"
            >
              {loading ? "关注中..." : "关注用户"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
