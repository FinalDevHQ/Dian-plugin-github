import { useState, useEffect, useCallback } from "react"
import { api } from "../api"
import type { Config } from "../types"

export default function ConfigPage({ showToast }: { showToast: (msg: string, ok?: boolean) => void }) {
  const [cfg, setCfg] = useState<Config | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tplType, setTplType] = useState<TemplateType>("commits")
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const r = await api<{ success?: boolean; config: Config; error?: string }>("/config")
      if (r.config) {
        setCfg(r.config)
        setError(null)
      } else {
        setError(r.error || "返回数据格式错误")
      }
    } catch (e: any) {
      setError(`加载失败: ${e.message || e}`)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const update = (patch: Partial<Config>) => setCfg((c) => c ? { ...c, ...patch } : c)

  const updateTemplate = (type: TemplateType, value: string) => {
    setPreviewHtml(null)
    setCfg((c) => {
      if (!c) return c
      const customHTML = { ...(c.customHTML || {}) }
      if (value.trim()) customHTML[type] = value
      else delete customHTML[type]
      return { ...c, customHTML }
    })
  }

  const clearTemplate = () => updateTemplate(tplType, "")

  const previewTemplate = () => {
    const html = cfg?.customHTML?.[tplType]?.trim()
    if (!html) {
      showToast("模板为空，无法预览", false)
      return
    }
    setPreviewHtml(applyTemplateSample(html, tplType))
  }

  const save = async () => {
    if (!cfg) return
    setSaving(true)
    try {
      // tokenCount 是 UI 专用字段；tokens 在接口中会被脱敏成 ***，原样回传会清空真实多 Token。
      const { tokenCount: _, tokens: _tokens, ...payload } = cfg as any
      await api("/config", payload)
      showToast("保存成功")
      load()
    } catch (e: any) {
      showToast(`保存失败: ${e.message || e}`, false)
    } finally {
      setSaving(false)
    }
  }

  if (error) {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-base font-semibold">基础配置</h2>
        <div className="rounded-xl border border-destructive/40 bg-red-50 p-4">
          <p className="text-sm text-destructive">{error}</p>
          <button onClick={load} className="mt-2 h-7 rounded border px-3 text-xs hover:bg-white">重试</button>
        </div>
      </div>
    )
  }

  if (!cfg) return <p className="text-xs text-muted-foreground text-center py-8">加载中...</p>

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-base font-semibold">基础配置</h2>

      {/* Token */}
      <Section title="GitHub Token">
        <div className="flex flex-col gap-2">
          <InputRow label="API Base URL" value={cfg.apiBase} onChange={(v) => update({ apiBase: v })} placeholder="https://api.github.com" />
          <InputRow label="Token" value={cfg.token} onChange={(v) => update({ token: v })} placeholder="ghp_xxxx (可选)" type="password" />
          {cfg.tokenCount > 0 && (
            <p className="text-[11px] text-muted-foreground">已配置 {cfg.tokenCount} 个 Token</p>
          )}
        </div>
      </Section>

      {/* 权限 */}
      <Section title="权限设置">
        <div className="flex flex-col gap-3">
          <ToggleRow label="允许成员订阅" checked={cfg.allowMemberSub} onChange={(v) => update({ allowMemberSub: v })} />
          <ToggleRow label="自动识别仓库链接" checked={cfg.autoDetectRepo} onChange={(v) => update({ autoDetectRepo: v })} />
          <ToggleRow label="合并通知模式" checked={cfg.mergeNotify} onChange={(v) => update({ mergeNotify: v })} />
        </div>
      </Section>

      {/* 轮询 */}
      <Section title="轮询设置">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">轮询间隔（秒）</span>
            <select
              className="h-9 rounded-md border bg-input/30 px-3 text-sm outline-none"
              value={cfg.interval}
              onChange={(e) => update({ interval: Number(e.target.value) })}
            >
              {[5, 10, 15, 30, 60, 120, 300].map((s) => (
                <option key={s} value={s}>{s}s</option>
              ))}
            </select>
          </div>
          <ToggleRow label="调试模式" checked={cfg.debug} onChange={(v) => update({ debug: v })} />
        </div>
      </Section>

      {/* Puppeteer */}
      <Section title="Puppeteer 渲染服务">
        <div className="flex flex-col gap-2">
          <InputRow label="Dian Web 端口" value={String(cfg.webuiPort || 3000)} onChange={(v) => update({ webuiPort: Number(v) || 3000 } as Partial<Config>)} placeholder="3000" />
          <InputRow label="Puppeteer 插件名" value={cfg.puppeteerPlugin || "puppeteer"} onChange={(v) => update({ puppeteerPlugin: v || "puppeteer" })} placeholder="puppeteer" />
          <p className="text-[11px] text-muted-foreground">用于调用 /plugins/&lt;插件名&gt;/api/render，当前 Dian Puppeteer 插件默认名为 puppeteer。</p>
        </div>
      </Section>

      {/* 主题 */}
      <Section title="主题">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">渲染主题</span>
          <select
            className="h-9 rounded-md border bg-input/30 px-3 text-sm outline-none"
            value={cfg.theme}
            onChange={(e) => update({ theme: e.target.value as any })}
          >
            <option value="light">亮色</option>
            <option value="dark">暗色</option>
            <option value="custom">自定义</option>
          </select>
        </div>
      </Section>

      {/* 自定义模板 */}
      <Section title="自定义 HTML 模板">
        <div className="flex flex-col gap-3">
          <div className="rounded-lg border border-blue-200/70 bg-blue-50/70 p-3 text-[11px] leading-6 text-slate-600">
            <div className="font-medium text-slate-800">可用变量</div>
            <div><code>{"{{repo}}"}</code> 仓库名 · <code>{"{{count}}"}</code> 更新数量 · <code>{"{{type}}"}</code> 类型 · <code>{"{{time}}"}</code> 当前时间</div>
            <div><code>{"{{items}}"}</code> JSON 数组，可在模板内用脚本解析渲染</div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {TEMPLATE_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => { setTplType(t.value); setPreviewHtml(null) }}
                className={`h-8 rounded-md border px-2.5 text-[11px] font-medium transition-colors ${tplType === t.value ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <textarea
            className="min-h-64 rounded-md border bg-input/30 px-3 py-2 font-mono text-xs leading-5 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            value={cfg.customHTML?.[tplType] || ""}
            onChange={(e) => updateTemplate(tplType, e.target.value)}
            placeholder="留空使用内置模板，输入完整 HTML 文档（含 <!DOCTYPE html>）..."
          />
          <div className="flex gap-2">
            <button onClick={clearTemplate} className="h-8 rounded-md border px-3 text-xs hover:bg-accent">清空当前模板</button>
            <button onClick={previewTemplate} className="h-8 rounded-md border px-3 text-xs hover:bg-accent">预览</button>
          </div>
          {previewHtml && (
            <div className="overflow-hidden rounded-lg border bg-white">
              <iframe title="模板预览" className="h-96 w-full" srcDoc={previewHtml} />
            </div>
          )}
        </div>
      </Section>

      <button
        onClick={save}
        disabled={saving}
        className="h-9 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 w-full"
      >
        {saving ? "保存中..." : "保存配置"}
      </button>
    </div>
  )
}

type TemplateType = "commits" | "issues" | "pulls" | "comments" | "actions"

const TEMPLATE_TYPES: { value: TemplateType; label: string }[] = [
  { value: "commits", label: "Commits" },
  { value: "issues", label: "Issues" },
  { value: "pulls", label: "Pull Requests" },
  { value: "comments", label: "Comments" },
  { value: "actions", label: "Actions" },
]

function applyTemplateSample(html: string, type: TemplateType): string {
  const items = type === "commits"
    ? [{ sha: "abc1234567890", sha7: "abc1234", message: "示例提交：优化 GitHub 订阅模板", author: "octocat", date: new Date().toISOString(), url: "#", files: [{ filename: "src/index.ts", status: "modified", additions: 18, deletions: 4, patch: "@@ -1,2 +1,3 @@\n+new line\n-old line" }] }]
    : type === "comments"
      ? [{ number: 12, title: "示例讨论", body: "这是一条评论内容", author: "octocat", created_at: new Date().toISOString(), url: "#", source: "issue" }]
      : type === "actions"
        ? [{ id: 1, name: "CI", run_number: 42, status: "completed", conclusion: "success", actor: "octocat", event: "push", head_branch: "main", created_at: new Date().toISOString(), url: "#" }]
        : [{ number: 8, title: "示例 Issue/PR 标题", state: "open", action: "opened", author: "octocat", created_at: new Date().toISOString(), url: "#", labels: [{ name: "bug", color: "d73a4a" }] }]
  return html
    .replace(/\{\{repo\}\}/g, "owner/example-repo")
    .replace(/\{\{count\}\}/g, "1")
    .replace(/\{\{type\}\}/g, TEMPLATE_TYPES.find((t) => t.value === type)?.label || type)
    .replace(/\{\{time\}\}/g, new Date().toLocaleString("zh-CN"))
    .replace(/\{\{items\}\}/g, JSON.stringify(items))
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">{title}</h3>
      {children}
    </div>
  )
}

function InputRow({ label, value, onChange, placeholder, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <input
        type={type}
        className="h-9 rounded-md border bg-input/30 px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  )
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between cursor-pointer">
      <span className="text-sm">{label}</span>
      <div className="relative">
        <input type="checkbox" className="sr-only peer" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <div className="h-5 w-9 rounded-full bg-muted peer-checked:bg-primary transition-colors" />
        <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
      </div>
    </label>
  )
}
