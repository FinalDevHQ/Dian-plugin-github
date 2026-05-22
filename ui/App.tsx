import { useState } from "react"
import { useToast } from "./components/Toast"
import Dashboard from "./pages/Dashboard"
import ConfigPage from "./pages/Config"
import Subscriptions from "./pages/Subscriptions"
import AddSub from "./pages/AddSub"
import TemplatePage from "./pages/Template"
import CommandsPage from "./pages/Commands"
import Logs from "./pages/Logs"

type Page = "dashboard" | "config" | "subs" | "add" | "template" | "commands" | "logs"

const NAV: { id: Page; label: string; icon: React.JSX.Element }[] = [
  { id: "dashboard", label: "仪表盘", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg> },
  { id: "config", label: "基础配置", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg> },
  { id: "subs", label: "订阅管理", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><path d="M4 6h16M4 12h16M4 18h10"/></svg> },
  { id: "add", label: "添加订阅", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg> },
  { id: "template", label: "自定义模板", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><polyline points="16,18 22,12 16,6"/><polyline points="8,6 2,12 8,18"/></svg> },
  { id: "commands", label: "指令中心", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg> },
  { id: "logs", label: "调试日志", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/></svg> },
]

export default function App() {
  const [page, setPage] = useState<Page>("dashboard")
  const [version, setVersion] = useState("v1.0.0")
  const { show, ToastPortal } = useToast()

  const pages: Record<Page, React.ReactNode> = {
    dashboard: <Dashboard onNavigate={(p) => setPage(p as Page)} onVersion={(v) => setVersion(`v${v}`)} />,
    config: <ConfigPage showToast={show} />,
    subs: <Subscriptions showToast={show} />,
    add: <AddSub showToast={show} />,
    template: <TemplatePage showToast={show} />,
    commands: <CommandsPage showToast={show} />,
    logs: <Logs showToast={show} />,
  }

  return (
    <div className="flex h-screen bg-[#f8fafc]">
      {/* 侧边栏 */}
      <aside className="w-56 shrink-0 border-r border-slate-200 bg-white flex flex-col">
        <div className="px-5 py-5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-slate-800 to-slate-900 text-white text-sm shadow-sm">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900">GitHub 订阅</div>
              <div className="text-[10px] text-slate-400">{version}</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 flex flex-col gap-1">
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => setPage(n.id)}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-all text-left ${
                page === n.id
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              }`}
            >
              {n.icon}
              <span>{n.label}</span>
            </button>
          ))}
        </nav>
        <div className="px-5 py-4 border-t border-slate-100">
          <div className="text-[10px] text-slate-400 text-center">Dian Plugin System</div>
        </div>
      </aside>

      {/* 主内容区 */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-8 py-6">
          {pages[page]}
        </div>
      </main>

      <ToastPortal />
    </div>
  )
}
