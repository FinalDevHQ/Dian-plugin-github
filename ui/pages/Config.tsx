import { useState, useEffect, useCallback } from "react"
import { api } from "../api"
import type { Config } from "../types"

export default function ConfigPage({ showToast }: { showToast: (msg: string, ok?: boolean) => void }) {
  const [cfg, setCfg] = useState<Config | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tokensDirty, setTokensDirty] = useState(false)

  const load = useCallback(async () => {
    try {
      const r = await api<{ success?: boolean; config: Config; error?: string }>("/config")
      if (r.config) {
        setCfg(r.config)
        setError(null)
        setTokensDirty(false)
      } else {
        setError(r.error || "返回数据格式错误")
      }
    } catch (e: any) {
      setError(`加载失败: ${e.message || e}`)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const update = (patch: Partial<Config>) => setCfg((c) => c ? { ...c, ...patch } : c)

  const save = async () => {
    if (!cfg) return
    setSaving(true)
    try {
      const { tokenCount: _, tokens: _tokens, ...rest } = cfg as any
      const payload: Record<string, unknown> = { ...rest }
      // 只在用户实际修改了 tokens 时才发送（避免脱敏占位符 "***" 覆盖真实 token）
      if (tokensDirty && Array.isArray(_tokens)) {
        const cleaned = _tokens.filter((t: string) => t && t !== "***")
        // 用 null 表示用户明确删除了所有 token（而非未修改）
        payload.tokens = cleaned.length > 0 ? cleaned : null
      }
      await api("/config", payload)
      showToast("保存成功")
      setTokensDirty(false)
      load()
    } catch (e: any) {
      showToast(`保存失败: ${e.message || e}`, false)
    } finally {
      setSaving(false)
    }
  }

  if (error) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-xl font-bold text-slate-900">基础配置</h1>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <p className="text-sm text-red-700">{error}</p>
          <button onClick={load} className="mt-3 h-9 rounded-xl border border-red-200 px-4 text-sm font-medium text-red-700 hover:bg-white transition-colors">重试</button>
        </div>
      </div>
    )
  }

  if (!cfg) return <p className="text-sm text-slate-400 text-center py-12">加载中...</p>

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold text-slate-900">基础配置</h1>

      {/* 两栏布局：Token + 权限 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Section title="GitHub Token" icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>}>
          <div className="flex flex-col gap-4">
            <InputRow label="API Base URL" value={cfg.apiBase} onChange={(v) => update({ apiBase: v })} placeholder="https://api.github.com" />

            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-slate-500">Tokens</label>
              <p className="text-[11px] text-slate-400">
                支持多个 Token 轮询，自动切换以绕过 GitHub API 速率限制（每个 Token 5000 次/小时）
              </p>
              {(!cfg.tokens || cfg.tokens.length === 0) && (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center">
                  <p className="text-xs text-slate-400">暂无 Token，点击下方按钮添加</p>
                </div>
              )}
              {(cfg.tokens || []).map((t, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-300 font-mono w-5 shrink-0">#{i + 1}</span>
                  <input
                    type="password"
                    className="flex-1 h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-mono outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition-all"
                    value={t}
                    onChange={(e) => {
                      const newTokens = [...cfg.tokens]
                      newTokens[i] = e.target.value
                      update({ tokens: newTokens })
                      setTokensDirty(true)
                    }}
                    placeholder="ghp_xxxx"
                  />
                  <button
                    onClick={() => { update({ tokens: cfg.tokens.filter((_, j) => j !== i) }); setTokensDirty(true) }}
                    className="h-9 rounded-lg border border-red-200 bg-white px-2 text-[10px] font-medium text-red-500 hover:bg-red-50 transition-colors shrink-0"
                  >
                    删除
                  </button>
                </div>
              ))}
              <button
                onClick={() => { update({ tokens: [...(cfg.tokens || []), ""] }); setTokensDirty(true) }}
                className="h-9 rounded-lg border border-dashed border-slate-300 bg-white text-xs font-medium text-slate-500 hover:bg-slate-50 hover:border-slate-400 transition-colors"
              >
                + 添加 Token
              </button>
            </div>

            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-100">
              <span className="text-xs text-slate-500">已配置</span>
              <span className="inline-flex items-center justify-center size-5 rounded-full bg-slate-900 text-[10px] font-bold text-white">
                {(cfg.tokens || []).filter((t) => t.trim()).length}
              </span>
              <span className="text-xs text-slate-500">个 Token</span>
            </div>
          </div>
        </Section>

        <Section title="权限设置" icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>}>
          <div className="flex flex-col gap-4">
            <ToggleRow label="允许成员订阅" checked={cfg.allowMemberSub} onChange={(v) => update({ allowMemberSub: v })} />
            <ToggleRow label="自动识别仓库链接" checked={cfg.autoDetectRepo} onChange={(v) => update({ autoDetectRepo: v })} />
            {cfg.autoDetectRepo && (
              <div className="pl-3 border-l-2 border-slate-100 flex flex-col gap-3">
                <ToggleRow label="预回复表情（处理中提示）" checked={cfg.enablePreReply} onChange={(v) => update({ enablePreReply: v })} />
                {cfg.enablePreReply && (
                  <>
                    <InputRow label="检测中表情 ID" value={cfg.preReplyEmojiId || "178"} onChange={(v) => update({ preReplyEmojiId: v })} placeholder="178" />
                    <InputRow label="成功表情 ID" value={cfg.successEmojiId || "277"} onChange={(v) => update({ successEmojiId: v })} placeholder="277" />
                    <InputRow label="失败表情 ID" value={cfg.failEmojiId || "14"} onChange={(v) => update({ failEmojiId: v })} placeholder="14" />
                  </>
                )}
              </div>
            )}
            <ToggleRow label="合并通知模式" checked={cfg.mergeNotify} onChange={(v) => update({ mergeNotify: v })} />
          </div>
        </Section>
      </div>

      {/* 两栏布局：轮询 + Puppeteer */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Section title="轮询设置" icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><polyline points="23,4 23,10 17,10"/><polyline points="1,20 1,14 7,14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-slate-500">轮询间隔</label>
              <select
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition-all"
                value={cfg.interval}
                onChange={(e) => update({ interval: Number(e.target.value) })}
              >
                {[5, 10, 15, 30, 60, 120, 300].map((s) => (
                  <option key={s} value={s}>{s} 秒</option>
                ))}
              </select>
            </div>
            <ToggleRow label="调试模式" checked={cfg.debug} onChange={(v) => update({ debug: v })} />
          </div>
        </Section>

        <Section title="Puppeteer 渲染" icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>}>
          <div className="flex flex-col gap-4">
            <InputRow label="Dian Web 端口" value={String(cfg.webuiPort || 3000)} onChange={(v) => update({ webuiPort: Number(v) || 3000 } as Partial<Config>)} placeholder="3000" />
            <InputRow label="插件名" value={cfg.puppeteerPlugin || "puppeteer"} onChange={(v) => update({ puppeteerPlugin: v || "puppeteer" })} placeholder="puppeteer" />
            <p className="text-xs text-slate-400">调用 /plugins/&lt;插件名&gt;/api/render 进行截图渲染</p>
          </div>
        </Section>
      </div>

      {/* 主题 */}
      <Section title="渲染主题" icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><circle cx="13.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="10.5" r="2.5"/><circle cx="8.5" cy="7.5" r="2.5"/><circle cx="6.5" cy="12.5" r="2.5"/><path d="M12 2C6.49 2 2 6.49 2 12s4.49 10 10 10c.55 0 1-.45 1-1v-.09c0-.27-.11-.52-.29-.71a1.006 1.006 0 01-.29-.71c0-.55.45-.99.99-1H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8z"/></svg>}>
        <div className="flex flex-wrap gap-3">
          {(["light", "dark", "custom"] as const).map((t) => (
            <button
              key={t}
              onClick={() => update({ theme: t })}
              className={`flex items-center gap-2.5 rounded-xl border px-5 py-3 text-sm font-medium transition-all ${
                cfg.theme === t
                  ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <span className="text-lg">{t === "light" ? "☀️" : t === "dark" ? "🌙" : "🎨"}</span>
              <span>{t === "light" ? "亮色" : t === "dark" ? "暗色" : "自定义"}</span>
            </button>
          ))}
        </div>
      </Section>

      {/* 保存按钮 */}
      <button
        onClick={save}
        disabled={saving}
        className="h-11 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 transition-colors shadow-sm"
      >
        {saving ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
            保存中...
          </span>
        ) : "保存配置"}
      </button>
    </div>
  )
}

function Section({ title, icon, children }: { title: string; icon?: React.JSX.Element; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-2.5 mb-5">
        {icon && <span className="text-slate-400">{icon}</span>}
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      </div>
      {children}
    </div>
  )
}

function InputRow({ label, value, onChange, placeholder, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-medium text-slate-500">{label}</label>
      <input
        type={type}
        className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition-all"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  )
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between cursor-pointer py-1">
      <span className="text-sm text-slate-700">{label}</span>
      <div className="relative">
        <input type="checkbox" className="sr-only peer" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <div className="h-6 w-11 rounded-full bg-slate-200 peer-checked:bg-slate-900 transition-colors" />
        <div className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5" />
      </div>
    </label>
  )
}
