import { useState, useEffect, useCallback } from "react"
import { api } from "../api"
import type { Config, CustomCommand } from "../types"

interface SystemCommand {
  cmd: string
  desc: string
  usage?: string
  category: string
  badge?: string
}

const SYSTEM_COMMANDS: SystemCommand[] = [
  { cmd: "gh 帮助", desc: "查看所有指令", category: "基础" },
  { cmd: "gh 订阅", desc: "订阅仓库", usage: "gh 订阅 <owner/repo> [branch]", category: "仓库管理" },
  { cmd: "gh 取消", desc: "取消订阅（需管理员）", usage: "gh 取消 <owner/repo> [branch]", category: "仓库管理", badge: "管理员" },
  { cmd: "gh 列表", desc: "查看当前群订阅", category: "仓库管理" },
  { cmd: "gh 全部", desc: "查看所有订阅", category: "仓库管理" },
  { cmd: "gh 开启", desc: "启用订阅", usage: "gh 开启 <owner/repo> [branch]", category: "仓库管理" },
  { cmd: "gh 关闭", desc: "禁用订阅", usage: "gh 关闭 <owner/repo> [branch]", category: "仓库管理" },
  { cmd: "gh 关注", desc: "关注用户动态", usage: "gh 关注 <username>", category: "用户关注" },
  { cmd: "gh 取关", desc: "取消关注（需管理员）", usage: "gh 取关 <username>", category: "用户关注", badge: "管理员" },
  { cmd: "gh 关注列表", desc: "查看关注列表", category: "用户关注" },
  { cmd: "gh 管理员 添加", desc: "添加普通管理员", usage: "gh 管理员 添加 @用户", category: "管理员", badge: "大管理员" },
  { cmd: "gh 管理员 删除", desc: "删除普通管理员", usage: "gh 管理员 删除 @用户", category: "管理员", badge: "大管理员" },
  { cmd: "gh 管理员 列表", desc: "查看管理员列表", category: "管理员" },
  { cmd: "gh 管理员 帮助", desc: "查看管理员命令", category: "管理员" },
]

const CATEGORIES = [...new Set(SYSTEM_COMMANDS.map((c) => c.category))]

const CATEGORY_META: Record<string, { icon: React.JSX.Element; color: string }> = {
  "基础": {
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>,
    color: "slate",
  },
  "仓库管理": {
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><path d="M4 6h16M4 12h16M4 18h10"/></svg>,
    color: "blue",
  },
  "用户关注": {
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>,
    color: "violet",
  },
  "管理员": {
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
    color: "amber",
  },
}

const BADGE_STYLES: Record<string, string> = {
  "管理员": "bg-amber-100 text-amber-700 border-amber-200",
  "大管理员": "bg-red-100 text-red-700 border-red-200",
}

export default function CommandsPage({ showToast }: { showToast: (msg: string, ok?: boolean) => void }) {
  const [cfg, setCfg] = useState<Config | null>(null)
  const [saving, setSaving] = useState(false)
  const [newAlias, setNewAlias] = useState("")
  const [newCommand, setNewCommand] = useState("")
  const [expandedCat, setExpandedCat] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const r = await api<{ config: Config }>("/config")
      if (r.config) setCfg(r.config)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { load() }, [load])

  const save = async (updated: Config) => {
    setSaving(true)
    try {
      const { tokenCount: _, token: _t, tokens: _ts, ...payload } = updated as any
      await api("/config", payload)
    } catch (e: any) {
      showToast(`保存失败: ${e.message}`, false)
    } finally {
      setSaving(false)
    }
  }

  const addRule = async () => {
    if (!cfg || !newAlias.trim() || !newCommand.trim()) {
      showToast("别名和指令不能为空", false)
      return
    }
    const cmd = newCommand.trim()
    const isValid = SYSTEM_COMMANDS.some((s) => cmd.startsWith(s.cmd) || cmd === s.cmd)
    if (!isValid) {
      showToast("目标指令格式不正确，示例：gh 帮助", false)
      return
    }
    const rule: CustomCommand = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      alias: newAlias.trim(),
      command: cmd,
      enabled: true,
    }
    const updated = { ...cfg, customCommands: [...(cfg.customCommands || []), rule] }
    setCfg(updated)
    setNewAlias("")
    setNewCommand("")
    await save(updated)
    showToast("已添加")
  }

  const toggleRule = async (id: string) => {
    if (!cfg) return
    const updated = {
      ...cfg,
      customCommands: (cfg.customCommands || []).map((r) => r.id === id ? { ...r, enabled: !r.enabled } : r),
    }
    setCfg(updated)
    await save(updated)
  }

  const deleteRule = async (id: string) => {
    if (!cfg) return
    const updated = {
      ...cfg,
      customCommands: (cfg.customCommands || []).filter((r) => r.id !== id),
    }
    setCfg(updated)
    await save(updated)
    showToast("已删除")
  }

  const quickAdd = (cmd: string) => {
    setNewCommand(cmd)
    setNewAlias("")
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 标题 */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">指令中心</h1>
        <p className="text-sm text-slate-400 mt-0.5">查看系统指令说明，或添加自定义别名映射</p>
      </div>

      {/* 系统指令 */}
      <div className="flex flex-col gap-4">
        {CATEGORIES.map((cat) => {
          const meta = CATEGORY_META[cat] || CATEGORY_META["基础"]
          const cmds = SYSTEM_COMMANDS.filter((c) => c.category === cat)
          const isExpanded = expandedCat === null || expandedCat === cat

          return (
            <div key={cat} className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <button
                onClick={() => setExpandedCat(isExpanded && expandedCat !== null ? null : cat)}
                className="w-full px-5 py-4 flex items-center gap-3 hover:bg-slate-50/50 transition-colors"
              >
                <div className={`flex size-8 items-center justify-center rounded-lg bg-${meta.color}-100 text-${meta.color}-600`}>
                  {meta.icon}
                </div>
                <div className="flex-1 text-left">
                  <div className="text-sm font-semibold text-slate-900">{cat}</div>
                  <div className="text-[11px] text-slate-400">{cmds.length} 个指令</div>
                </div>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                >
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>

              {isExpanded && (
                <div className="px-5 pb-4">
                  <div className="grid grid-cols-1 gap-1.5">
                    {cmds.map((c) => (
                      <div
                        key={c.cmd}
                        className="flex items-center gap-3 rounded-xl px-4 py-3 hover:bg-slate-50 transition-colors group"
                      >
                        <div className="min-w-0 flex-1 flex items-center gap-3">
                          <code className="text-xs font-bold font-mono text-slate-800 bg-slate-100 border border-slate-200 px-2.5 py-1.5 rounded-lg shrink-0">
                            {c.cmd}
                          </code>
                          {c.badge && (
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border shrink-0 ${BADGE_STYLES[c.badge] || "bg-slate-100 text-slate-600 border-slate-200"}`}>
                              {c.badge}
                            </span>
                          )}
                          <span className="text-xs text-slate-500">{c.desc}</span>
                        </div>
                        {c.usage && (
                          <code className="text-[11px] font-mono text-slate-400 hidden xl:block shrink-0">
                            {c.usage}
                          </code>
                        )}
                        <button
                          onClick={() => quickAdd(c.cmd)}
                          className="text-[10px] text-slate-400 hover:text-slate-700 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                          title="用此指令创建别名"
                        >
                          + 别名
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* 自定义别名 */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
                <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
                <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">自定义别名</h3>
              <p className="text-[11px] text-slate-400">为系统指令设置简短别名</p>
            </div>
            <span className="ml-auto text-xs text-slate-400">
              {(cfg?.customCommands || []).length} 个别名
            </span>
          </div>
        </div>

        {/* 添加表单 */}
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/30">
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition-all"
                value={newAlias}
                onChange={(e) => setNewAlias(e.target.value)}
                placeholder="别名，如：github帮助"
                onKeyDown={(e) => e.key === "Enter" && addRule()}
              />
              <input
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-mono outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition-all"
                value={newCommand}
                onChange={(e) => setNewCommand(e.target.value)}
                placeholder="系统指令，如：gh 帮助"
                onKeyDown={(e) => e.key === "Enter" && addRule()}
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={addRule}
                disabled={saving || !newAlias.trim() || !newCommand.trim()}
                className="h-10 rounded-xl bg-slate-900 text-white px-5 text-sm font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors"
              >
                {saving ? "保存中..." : "添加别名"}
              </button>
              {newCommand && (
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <code className="font-mono text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded">
                    {newAlias || "????"}
                  </code>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                  <code className="font-mono text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded">
                    {newCommand}
                  </code>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 别名列表 */}
        <div className="divide-y divide-slate-100">
          {(!cfg?.customCommands || cfg.customCommands.length === 0) ? (
            <div className="py-12 text-center">
              <div className="flex justify-center mb-3">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6">
                    <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
                    <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
                  </svg>
                </div>
              </div>
              <p className="text-sm text-slate-400">暂无自定义别名</p>
              <p className="text-xs text-slate-300 mt-1">点击指令旁的「+ 别名」快速创建</p>
            </div>
          ) : (
            cfg.customCommands.map((rule) => (
              <div key={rule.id} className="px-5 py-3.5 flex items-center gap-3 hover:bg-slate-50/50 transition-colors">
                <button
                  onClick={() => toggleRule(rule.id)}
                  className={`size-2.5 rounded-full shrink-0 transition-colors ${rule.enabled ? "bg-emerald-500 hover:bg-emerald-400" : "bg-slate-300 hover:bg-slate-400"}`}
                  title={rule.enabled ? "点击禁用" : "点击启用"}
                />
                <div className="min-w-0 flex-1 flex items-center gap-2">
                  <code className="text-sm font-mono font-bold text-slate-800 bg-white border border-slate-200 px-2.5 py-1 rounded-lg shrink-0">
                    {rule.alias}
                  </code>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 text-slate-300 shrink-0">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                  <code className="text-xs font-mono text-slate-500 bg-slate-100 border border-slate-200 px-2 py-1 rounded-lg truncate">
                    {rule.command}
                  </code>
                </div>
                <button
                  onClick={() => deleteRule(rule.id)}
                  className="h-7 rounded-lg border border-red-200 bg-white px-2 text-[11px] font-medium text-red-500 hover:bg-red-50 transition-colors shrink-0"
                >
                  删除
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
