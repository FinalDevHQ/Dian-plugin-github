import { useState, useEffect, useCallback } from "react"
import { api } from "../api"
import type { Config } from "../types"

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

export default function TemplatePage({ showToast }: { showToast: (msg: string, ok?: boolean) => void }) {
  const [cfg, setCfg] = useState<Config | null>(null)
  const [saving, setSaving] = useState(false)
  const [tplType, setTplType] = useState<TemplateType>("commits")
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const r = await api<{ success?: boolean; config: Config }>("/config")
      if (r.config) setCfg(r.config)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { load() }, [load])

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
      const { tokenCount: _, ...payload } = cfg as any
      await api("/config", payload)
      showToast("保存成功")
      load()
    } catch (e: any) {
      showToast(`保存失败: ${e.message || e}`, false)
    } finally {
      setSaving(false)
    }
  }

  if (!cfg) return <p className="text-sm text-slate-400 text-center py-12">加载中...</p>

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">自定义模板</h1>
        <p className="text-sm text-slate-400 mt-1">为推送图片编写自定义 HTML 模板，留空则使用内置模板</p>
      </div>

      {/* 可用变量 */}
      <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-5">
        <div className="text-[11px] font-semibold text-blue-700 mb-2.5 uppercase tracking-wider">可用变量</div>
        <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-slate-600 mb-3">
          <span><code className="font-mono text-blue-600 font-semibold">{"{{repo}}"}</code> <span className="text-slate-400">仓库名</span></span>
          <span><code className="font-mono text-blue-600 font-semibold">{"{{count}}"}</code> <span className="text-slate-400">更新数量</span></span>
          <span><code className="font-mono text-blue-600 font-semibold">{"{{type}}"}</code> <span className="text-slate-400">类型名</span></span>
          <span><code className="font-mono text-blue-600 font-semibold">{"{{time}}"}</code> <span className="text-slate-400">当前时间</span></span>
          <span><code className="font-mono text-blue-600 font-semibold">{"{{items}}"}</code> <span className="text-slate-400">JSON 数组（需用 JS 解析渲染）</span></span>
        </div>
        <div className="text-[11px] text-slate-500 leading-relaxed border-t border-blue-100 pt-2.5 mt-1">
          <div className="font-medium text-slate-600 mb-1.5">items 字段结构（按类型）：</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            <span><code className="font-mono text-slate-500">Commits</code> <span className="text-slate-400">sha, sha7, message, author, date, url, files[filename, status, additions, deletions, patch]</span></span>
            <span><code className="font-mono text-slate-500">Issues/PRs</code> <span className="text-slate-400">number, title, state, action, author, created_at, url, labels[name, color]</span></span>
            <span><code className="font-mono text-slate-500">Comments</code> <span className="text-slate-400">number, title, body, author, created_at, url, source</span></span>
            <span><code className="font-mono text-slate-500">Actions</code> <span className="text-slate-400">id, name, run_number, status, conclusion, actor, event, head_branch, created_at, url</span></span>
          </div>
        </div>
      </div>

      {/* 模板类型选择 */}
      <div className="flex flex-wrap gap-2">
        {TEMPLATE_TYPES.map((t) => (
          <button
            key={t.value}
            onClick={() => { setTplType(t.value); setPreviewHtml(null) }}
            className={`rounded-xl border px-4 py-2 text-xs font-medium transition-all ${
              tplType === t.value
                ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 模板编辑器 */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <textarea
          className="min-h-80 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 font-mono text-xs leading-6 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition-all resize-y"
          value={cfg.customHTML?.[tplType] || ""}
          onChange={(e) => updateTemplate(tplType, e.target.value)}
          placeholder="留空使用内置模板，输入完整 HTML 文档（含 <!DOCTYPE html>）..."
        />
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-3">
        <button onClick={clearTemplate} className="h-10 rounded-xl border border-slate-200 bg-white px-5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">清空当前模板</button>
        <button onClick={previewTemplate} className="h-10 rounded-xl border border-slate-200 bg-white px-5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">预览</button>
      </div>

      {/* 预览 */}
      {previewHtml && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <iframe title="模板预览" className="h-96 w-full" srcDoc={previewHtml} />
        </div>
      )}

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
        ) : "保存模板"}
      </button>
    </div>
  )
}
