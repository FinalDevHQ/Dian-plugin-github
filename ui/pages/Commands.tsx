import { useState, useEffect, useCallback } from "react"
import { api } from "../api"
import type { Config, CustomCommand } from "../types"

const SYSTEM_COMMANDS = [
  { cmd: "gh 帮助", desc: "查看所有指令", category: "基础" },
  { cmd: "gh 订阅", desc: "订阅仓库", usage: "gh 订阅 <owner/repo> [branch]", category: "仓库管理" },
  { cmd: "gh 取消", desc: "取消订阅", usage: "gh 取消 <owner/repo> [branch]", category: "仓库管理" },
  { cmd: "gh 列表", desc: "查看当前群订阅", category: "仓库管理" },
  { cmd: "gh 全部", desc: "查看所有订阅", category: "仓库管理" },
  { cmd: "gh 开启", desc: "启用订阅", usage: "gh 开启 <owner/repo> [branch]", category: "仓库管理" },
  { cmd: "gh 关闭", desc: "禁用订阅", usage: "gh 关闭 <owner/repo> [branch]", category: "仓库管理" },
  { cmd: "gh 关注", desc: "关注用户动态", usage: "gh 关注 <username>", category: "用户关注" },
  { cmd: "gh 取关", desc: "取消关注", usage: "gh 取关 <username>", category: "用户关注" },
  { cmd: "gh 关注列表", desc: "查看关注列表", category: "用户关注" },
]

const CATEGORIES = [...new Set(SYSTEM_COMMANDS.map((c) => c.category))]

export default function CommandsPage({ showToast }: { showToast: (msg: string, ok?: boolean) => void }) {
  const [cfg, setCfg] = useState<Config | null>(null)
  const [saving, setSaving] = useState(false)
  const [newAlias, setNewAlias] = useState("")
  const [newCommand, setNewCommand] = useState("")

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
    // 验证指令格式
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

  const quickAdd = async (cmd: string) => {
    setNewCommand(cmd)
    setNewAlias("")
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">指令中心</h1>
        <p className="text-sm text-slate-400 mt-0.5">查看系统指令说明，或添加自定义别名映射</p>
      </div>

      {/* ── 系统指令 ── */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4 text-slate-400"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>
            <h3 className="text-sm font-semibold text-slate-900">系统指令</h3>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">前缀 gh</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">以下为插件内置指令，直接在群聊中发送即可使用</p>
        </div>

        <div className="p-6">
          {CATEGORIES.map((cat) => (
            <div key={cat} className="mb-6 last:mb-0">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">{cat}</div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                {SYSTEM_COMMANDS.filter((c) => c.category === cat).map((c) => (
                  <div key={c.cmd} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3 hover:bg-slate-50 transition-colors group">
                    <code className="text-xs font-bold font-mono text-slate-800 bg-white border border-slate-200 px-2 py-1 rounded-lg shrink-0">{c.cmd}</code>
                    <span className="text-xs text-slate-500 flex-1">{c.desc}</span>
                    <button
                      onClick={() => quickAdd(c.cmd)}
                      className="text-[10px] text-slate-400 hover:text-slate-700 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                      title="用此指令创建别名"
                    >
                      + 设别名
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 自定义别名 ── */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4 text-slate-400"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
            <h3 className="text-sm font-semibold text-slate-900">自定义别名</h3>
          </div>
          <p className="text-xs text-slate-400 mt-1">为系统指令设置简短别名，用户发送别名即可触发对应指令</p>
        </div>

        {/* 添加新规则 */}
        <div className="p-6 border-b border-slate-100 bg-slate-50/30">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_auto] gap-3 items-end">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-medium text-slate-500">别名（用户发送的内容）</label>
              <input
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition-all"
                value={newAlias}
                onChange={(e) => setNewAlias(e.target.value)}
                placeholder="github帮助 / 订阅仓库 / ..."
                onKeyDown={(e) => e.key === "Enter" && addRule()}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-medium text-slate-500">映射到系统指令</label>
              <input
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-mono outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition-all"
                value={newCommand}
                onChange={(e) => setNewCommand(e.target.value)}
                placeholder="gh 帮助"
                onKeyDown={(e) => e.key === "Enter" && addRule()}
              />
            </div>
            <button
              onClick={addRule}
              disabled={saving || !newAlias.trim() || !newCommand.trim()}
              className="h-10 rounded-xl bg-slate-900 text-white px-5 text-sm font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors shrink-0"
            >
              {saving ? "..." : "添加"}
            </button>
          </div>
          {newCommand && (
            <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
              <span>示例：</span>
              <code className="font-mono text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded">
                {newAlias || "????"}
              </code>
              <span>→</span>
              <code className="font-mono text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded">
                {newCommand}
              </code>
            </div>
          )}
        </div>

        {/* 规则列表 */}
        <div className="divide-y divide-slate-100">
          {(!cfg?.customCommands || cfg.customCommands.length === 0) ? (
            <div className="py-12 text-center">
              <div className="text-3xl mb-2 opacity-30">🔗</div>
              <p className="text-sm text-slate-400">暂无自定义别名</p>
              <p className="text-xs text-slate-300 mt-1">点击系统指令旁的「+ 设别名」快速创建</p>
            </div>
          ) : (
            cfg.customCommands.map((rule) => (
              <div key={rule.id} className="px-6 py-4 flex items-center gap-4 hover:bg-slate-50/50 transition-colors">
                <button
                  onClick={() => toggleRule(rule.id)}
                  className={`size-2.5 rounded-full shrink-0 transition-colors ${rule.enabled ? "bg-emerald-500 hover:bg-emerald-400" : "bg-slate-300 hover:bg-slate-400"}`}
                />
                <div className="min-w-0 flex-1 flex items-center gap-3">
                  <code className="text-sm font-mono font-bold text-slate-800 bg-white border border-slate-200 px-3 py-1 rounded-lg shrink-0">
                    {rule.alias}
                  </code>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-slate-300 shrink-0">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                  <code className="text-xs font-mono text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg truncate">
                    {rule.command}
                  </code>
                </div>
                <button
                  onClick={() => deleteRule(rule.id)}
                  className="h-7 rounded-lg border border-red-200 bg-white px-2.5 text-[11px] font-medium text-red-500 hover:bg-red-50 transition-colors shrink-0"
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
