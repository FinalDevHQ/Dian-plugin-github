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

  const clearTemplate = () => {
    updateTemplate(tplType, "")
    setPreviewHtml(null)
  }

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
      const { tokenCount: _, token: _t, tokens: _ts, ...payload } = cfg as any
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

  const currentHtml = cfg.customHTML?.[tplType] || ""

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 3rem)" }}>
      {/* 顶部标题栏 */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div>
          <h1 className="text-xl font-bold text-slate-900">自定义模板</h1>
          <p className="text-sm text-slate-400 mt-0.5">为推送图片编写自定义 HTML 模板，留空则使用内置模板</p>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="h-10 rounded-xl bg-slate-900 text-white px-6 text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 transition-colors shadow-sm"
        >
          {saving ? "保存中..." : "保存模板"}
        </button>
      </div>

      {/* 可用变量 */}
      <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4 mb-4 shrink-0">
        <div className="text-[11px] font-semibold text-blue-700 mb-2 uppercase tracking-wider">可用变量</div>
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-600">
          <span><code className="font-mono text-blue-600 font-semibold">{"{{repo}}"}</code> <span className="text-slate-400">仓库名</span></span>
          <span><code className="font-mono text-blue-600 font-semibold">{"{{count}}"}</code> <span className="text-slate-400">更新数量</span></span>
          <span><code className="font-mono text-blue-600 font-semibold">{"{{type}}"}</code> <span className="text-slate-400">类型名</span></span>
          <span><code className="font-mono text-blue-600 font-semibold">{"{{time}}"}</code> <span className="text-slate-400">当前时间</span></span>
          <span><code className="font-mono text-blue-600 font-semibold">{"{{items}}"}</code> <span className="text-slate-400">JSON 数组</span></span>
        </div>
        <div className="text-[11px] text-slate-500 leading-relaxed border-t border-blue-100 pt-2 mt-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
            <span><code className="font-mono text-slate-500">Commits</code> <span className="text-slate-400">sha, message, author, files[...]</span></span>
            <span><code className="font-mono text-slate-500">Issues/PRs</code> <span className="text-slate-400">number, title, state, labels[...]</span></span>
            <span><code className="font-mono text-slate-500">Comments</code> <span className="text-slate-400">number, title, body, source</span></span>
            <span><code className="font-mono text-slate-500">Actions</code> <span className="text-slate-400">name, conclusion, run_number</span></span>
          </div>
        </div>
      </div>

      {/* 类型切换 */}
      <div className="flex gap-2 mb-4 shrink-0">
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

      {/* 左右两栏：编辑 + 预览 */}
      <div className="flex-1 grid grid-cols-2 gap-4 min-h-0">
        {/* 左侧：编辑器 */}
        <div className="flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between shrink-0">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">编辑器</span>
            <div className="flex gap-1.5">
              <button onClick={clearTemplate} className="h-7 rounded-lg border border-slate-200 px-2.5 text-[11px] font-medium text-slate-500 hover:bg-slate-50 transition-colors">清空</button>
              <button onClick={previewTemplate} className="h-7 rounded-lg border border-slate-200 bg-slate-900 px-2.5 text-[11px] font-medium text-white hover:bg-slate-800 transition-colors">预览</button>
            </div>
          </div>
          <textarea
            className="flex-1 w-full p-4 font-mono text-xs leading-6 outline-none resize-none bg-slate-50/30"
            value={currentHtml}
            onChange={(e) => updateTemplate(tplType, e.target.value)}
            placeholder={`留空使用内置模板，输入完整 HTML 文档（含 <!DOCTYPE html>）...\n\n示例：\n<!DOCTYPE html>\n<html>\n<head><meta charset="utf-8"></head>\n<body>\n  <h1>{{repo}} - {{type}}</h1>\n  <div>更新数量: {{count}}</div>\n  <div>时间: {{time}}</div>\n  <script>\n    const items = JSON.parse('{{items}}');\n    // 渲染 items...\n  </script>\n</body>\n</html>`}
          />
        </div>

        {/* 右侧：预览 */}
        <div className="flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-100 shrink-0">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">预览效果</span>
          </div>
          <div className="flex-1 bg-white min-h-0">
            {previewHtml ? (
              <iframe title="模板预览" className="w-full h-full border-0" srcDoc={previewHtml} />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-300">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="w-16 h-16 mb-3 opacity-40"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                <p className="text-sm">点击「预览」查看效果</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
