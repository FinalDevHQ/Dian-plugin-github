import { useState, useEffect, useCallback } from "react"
import { api } from "../api"
import type { Config } from "../types"

export default function ConfigPage({ showToast }: { showToast: (msg: string, ok?: boolean) => void }) {
  const [cfg, setCfg] = useState<Config | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tokensDirty, setTokensDirty] = useState(false)
  const [dirty, setDirty] = useState(false)

  const load = useCallback(async () => {
    try {
      const r = await api<{ success?: boolean; config: Config; error?: string }>("/config")
      if (r.config) {
        setCfg(r.config)
        setError(null)
        setTokensDirty(false)
        setDirty(false)
      } else {
        setError(r.error || "返回数据格式错误")
      }
    } catch (e: any) {
      setError(`加载失败: ${e.message || e}`)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const update = (patch: Partial<Config>) => {
    setCfg((c) => c ? { ...c, ...patch } : c)
    setDirty(true)
  }

  const save = async () => {
    if (!cfg) return
    setSaving(true)
    try {
      const { tokenCount: _, tokens: _tokens, ...rest } = cfg as any
      const payload: Record<string, unknown> = { ...rest }
      if (tokensDirty && Array.isArray(_tokens)) {
        const cleaned = _tokens.filter((t: string) => t && t !== "***")
        payload.tokens = cleaned.length > 0 ? cleaned : null
      }
      await api("/config", payload)
      showToast("保存成功")
      setTokensDirty(false)
      setDirty(false)
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
      {/* 页头 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">基础配置</h1>
          <p className="text-sm text-slate-400 mt-0.5">管理 Token、权限、轮询和渲染设置</p>
        </div>
        <button
          onClick={save}
          disabled={saving || !dirty}
          className="h-9 rounded-xl bg-slate-900 text-white px-5 text-sm font-medium hover:bg-slate-800 disabled:opacity-40 transition-colors shadow-sm flex items-center gap-1.5"
        >
          {saving ? (
            <>
              <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
              保存中...
            </>
          ) : dirty ? "保存配置" : "已保存"}
        </button>
      </div>

      {/* Token 配置 */}
      <Section
        title="GitHub Token"
        desc="多个 Token 自动轮询以绕过速率限制（每个 5000 次/小时）"
        icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>}
      >
        <div className="flex flex-col gap-4">
          <InputRow label="API Base URL" value={cfg.apiBase} onChange={(v) => update({ apiBase: v })} placeholder="https://api.github.com" hint="GitHub API 地址，一般无需修改" />

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-500">Tokens</label>
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
                <span className="size-5 rounded-full bg-slate-900 text-[10px] font-bold text-white flex items-center justify-center">
                  {(cfg.tokens || []).filter((t) => t.trim()).length}
                </span>
                个已配置
              </span>
            </div>
            {(!cfg.tokens || cfg.tokens.length === 0) && (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6 text-slate-300 mx-auto mb-2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                <p className="text-xs text-slate-400">暂无 Token，点击下方按钮添加</p>
              </div>
            )}
            <div className="flex flex-col gap-2">
              {(cfg.tokens || []).map((t, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-300 font-mono w-5 shrink-0 text-right">#{i + 1}</span>
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
            </div>
            <button
              onClick={() => { update({ tokens: [...(cfg.tokens || []), ""] }); setTokensDirty(true) }}
              className="h-9 rounded-lg border border-dashed border-slate-300 bg-white text-xs font-medium text-slate-500 hover:bg-slate-50 hover:border-slate-400 transition-colors flex items-center justify-center gap-1"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>
              添加 Token
            </button>
          </div>
        </div>
      </Section>

      {/* 权限 + 功能 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Section
          title="权限设置"
          desc="控制谁能使用订阅功能"
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>}
        >
          <div className="flex flex-col gap-3">
            <ToggleRow label="允许成员订阅" sub="群内普通成员也能添加订阅" checked={cfg.allowMemberSub} onChange={(v) => update({ allowMemberSub: v })} />
            <ToggleRow label="合并通知模式" sub="同一仓库多次更新合并为一条消息" checked={cfg.mergeNotify} onChange={(v) => update({ mergeNotify: v })} />
          </div>
        </Section>

        <Section
          title="自动识别"
          desc="聊天中自动识别 GitHub 链接并订阅"
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>}
        >
          <div className="flex flex-col gap-3">
            <ToggleRow label="自动识别仓库链接" sub="发送 GitHub 链接时自动订阅" checked={cfg.autoDetectRepo} onChange={(v) => update({ autoDetectRepo: v })} />
            {cfg.autoDetectRepo && (
              <div className="ml-3 pl-3 border-l-2 border-slate-100 flex flex-col gap-3">
                <ToggleRow label="预回复表情" sub="处理中/成功/失败时自动贴表情" checked={cfg.enablePreReply} onChange={(v) => update({ enablePreReply: v })} />
                {cfg.enablePreReply && (
                  <div className="grid grid-cols-3 gap-2">
                    <EmojiInput label="检测中" value={cfg.preReplyEmojiId || "178"} onChange={(v) => update({ preReplyEmojiId: v })} />
                    <EmojiInput label="成功" value={cfg.successEmojiId || "277"} onChange={(v) => update({ successEmojiId: v })} />
                    <EmojiInput label="失败" value={cfg.failEmojiId || "14"} onChange={(v) => update({ failEmojiId: v })} />
                  </div>
                )}
              </div>
            )}
          </div>
        </Section>
      </div>

      {/* 轮询 + Puppeteer */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Section
          title="轮询设置"
          desc="控制 GitHub API 轮询频率"
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><polyline points="23,4 23,10 17,10"/><polyline points="1,20 1,14 7,14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>}
        >
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-slate-500">轮询间隔</label>
              <div className="flex flex-wrap gap-2">
                {[5, 10, 15, 30, 60, 120, 300].map((s) => (
                  <button
                    key={s}
                    onClick={() => update({ interval: s })}
                    className={`rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                      cfg.interval === s
                        ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    {s < 60 ? `${s}s` : `${s / 60}m`}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-slate-400">间隔越短 API 消耗越大，建议 30s 以上</p>
            </div>
            <ToggleRow label="调试模式" sub="输出详细日志，便于排查问题" checked={cfg.debug} onChange={(v) => update({ debug: v })} />
          </div>
        </Section>

        <Section
          title="Puppeteer 渲染"
          desc="配置推送图片渲染服务"
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>}
        >
          <div className="flex flex-col gap-4">
            <InputRow label="Web 端口" value={String(cfg.webuiPort || 3000)} onChange={(v) => update({ webuiPort: Number(v) || 3000 } as Partial<Config>)} placeholder="3000" hint="Dian Web 服务端口" />
            <InputRow label="插件名" value={cfg.puppeteerPlugin || "puppeteer"} onChange={(v) => update({ puppeteerPlugin: v || "puppeteer" })} placeholder="puppeteer" hint="调用 /plugins/<插件名>/api/render 渲染" />
            <InputRow label="代理" value={cfg.proxy || ""} onChange={(v) => update({ proxy: v })} placeholder="http://127.0.0.1:7890" hint="GitHub API 请求走代理，留空直连" />
          </div>
        </Section>
      </div>

      {/* 主题 */}
      <Section
        title="渲染主题"
        desc="选择推送图片的视觉风格"
        icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><circle cx="13.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="10.5" r="2.5"/><circle cx="8.5" cy="7.5" r="2.5"/><circle cx="6.5" cy="12.5" r="2.5"/><path d="M12 2C6.49 2 2 6.49 2 12s4.49 10 10 10c.55 0 1-.45 1-1v-.09c0-.27-.11-.52-.29-.71a1.006 1.006 0 01-.29-.71c0-.55.45-.99.99-1H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8z"/></svg>}
      >
        <div className="flex flex-wrap gap-3">
          {(["light", "dark", "custom"] as const).map((t) => (
            <button
              key={t}
              onClick={() => update({ theme: t })}
              className={`flex items-center gap-3 rounded-xl border px-5 py-3.5 text-sm font-medium transition-all ${
                cfg.theme === t
                  ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <span className="text-lg">{t === "light" ? "☀️" : t === "dark" ? "🌙" : "🎨"}</span>
              <div className="text-left">
                <div>{t === "light" ? "亮色" : t === "dark" ? "暗色" : "自定义"}</div>
                <div className={`text-[10px] mt-0.5 ${cfg.theme === t ? "text-white/60" : "text-slate-400"}`}>
                  {t === "light" ? "清爽明亮" : t === "dark" ? "护眼深色" : "自定义配色"}
                </div>
              </div>
            </button>
          ))}
        </div>
      </Section>
    </div>
  )
}

/* ── Sub Components ── */

function Section({ title, desc, icon, children }: { title: string; desc?: string; icon?: React.JSX.Element; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2.5">
        {icon && <span className="text-slate-400">{icon}</span>}
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          {desc && <p className="text-[11px] text-slate-400 mt-0.5">{desc}</p>}
        </div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function InputRow({ label, value, onChange, placeholder, type = "text", hint }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; hint?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-slate-500">{label}</label>
      <input
        type={type}
        className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition-all"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {hint && <p className="text-[10px] text-slate-400">{hint}</p>}
    </div>
  )
}

function ToggleRow({ label, sub, checked, onChange }: { label: string; sub?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between cursor-pointer py-1.5 group">
      <div>
        <span className="text-sm text-slate-700 group-hover:text-slate-900 transition-colors">{label}</span>
        {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
      </div>
      <div className="relative shrink-0 ml-4">
        <input type="checkbox" className="sr-only peer" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <div className="h-6 w-11 rounded-full bg-slate-200 peer-checked:bg-slate-900 transition-colors" />
        <div className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5" />
      </div>
    </label>
  )
}

function EmojiInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] text-slate-400">{label}</label>
      <input
        type="text"
        className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-mono text-center outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition-all"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="ID"
      />
    </div>
  )
}
