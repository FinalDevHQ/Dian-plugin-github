import { useState } from "react"
import { useToast } from "./components/Toast"
import Dashboard from "./pages/Dashboard"
import ConfigPage from "./pages/Config"
import Subscriptions from "./pages/Subscriptions"
import AddSub from "./pages/AddSub"
import Logs from "./pages/Logs"

type Page = "dashboard" | "config" | "subs" | "add" | "logs"

const NAV: { id: Page; label: string; icon: string }[] = [
  { id: "dashboard", label: "仪表盘", icon: "📊" },
  { id: "config", label: "基础配置", icon: "⚙️" },
  { id: "subs", label: "订阅管理", icon: "📋" },
  { id: "add", label: "添加订阅", icon: "➕" },
  { id: "logs", label: "调试日志", icon: "📝" },
]

export default function App() {
  const [page, setPage] = useState<Page>("dashboard")
  const { show, ToastPortal } = useToast()

  const pages: Record<Page, React.ReactNode> = {
    dashboard: <Dashboard onNavigate={(p) => setPage(p as Page)} />,
    config: <ConfigPage showToast={show} />,
    subs: <Subscriptions showToast={show} />,
    add: <AddSub showToast={show} />,
    logs: <Logs showToast={show} />,
  }

  return (
    <div className="flex h-screen bg-background">
      {/* 侧边栏 */}
      <aside className="w-48 shrink-0 border-r bg-card flex flex-col">
        <div className="px-4 py-4 border-b">
          <div className="flex items-center gap-2">
            <span className="text-xl">🐙</span>
            <span className="text-sm font-semibold">GitHub 订阅</span>
          </div>
        </div>
        <nav className="flex-1 p-2 flex flex-col gap-0.5">
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => setPage(n.id)}
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors text-left ${
                page === n.id ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              }`}
            >
              <span>{n.icon}</span>
              <span>{n.label}</span>
            </button>
          ))}
        </nav>
        <div className="px-4 py-3 border-t text-[10px] text-muted-foreground text-center">
          GitHub Sub Plugin
        </div>
      </aside>

      {/* 主内容区 */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto p-5">
          {pages[page]}
        </div>
      </main>

      <ToastPortal />
    </div>
  )
}
