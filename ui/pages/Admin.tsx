import { useState, useEffect, useCallback } from "react"
import { getAdminConfig, updateSuperAdmins, addAdmin, removeAdmin, type AdminData } from "../api"

export default function AdminPage({ showToast }: { showToast: (msg: string, ok?: boolean) => void }) {
  const [data, setData] = useState<AdminData | null>(null)
  const [loading, setLoading] = useState(true)
  const [newSuperAdmin, setNewSuperAdmin] = useState("")
  const [newAdmin, setNewAdmin] = useState("")
  const [operating, setOperating] = useState(false)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const r = await getAdminConfig()
      if (r.success) {
        setData(r.data)
      }
    } catch (e: any) {
      showToast(`加载失败: ${e.message}`, false)
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => { load() }, [load])

  const handleAddSuperAdmin = async () => {
    if (!newSuperAdmin.trim()) return
    setOperating(true)
    try {
      const updated = [...(data?.superAdmins || []), newSuperAdmin.trim()]
      const r = await updateSuperAdmins(updated)
      if (r.success) {
        setData(prev => prev ? { ...prev, superAdmins: r.data } : prev)
        setNewSuperAdmin("")
        showToast("已添加大管理员")
      }
    } catch (e: any) {
      showToast(`添加失败: ${e.message}`, false)
    } finally {
      setOperating(false)
    }
  }

  const handleRemoveSuperAdmin = async (userId: string) => {
    setOperating(true)
    try {
      const updated = (data?.superAdmins || []).filter(id => id !== userId)
      const r = await updateSuperAdmins(updated)
      if (r.success) {
        setData(prev => prev ? { ...prev, superAdmins: r.data } : prev)
        showToast("已移除大管理员")
      }
    } catch (e: any) {
      showToast(`移除失败: ${e.message}`, false)
    } finally {
      setOperating(false)
    }
  }

  const handleAddAdmin = async () => {
    if (!newAdmin.trim()) return
    setOperating(true)
    try {
      const r = await addAdmin(newAdmin.trim())
      if (r.success) {
        setData(prev => prev ? { ...prev, admins: r.data } : prev)
        setNewAdmin("")
        showToast("已添加普通管理员")
      } else {
        showToast(r.error || "添加失败", false)
      }
    } catch (e: any) {
      showToast(`添加失败: ${e.message}`, false)
    } finally {
      setOperating(false)
    }
  }

  const handleRemoveAdmin = async (userId: string) => {
    setOperating(true)
    try {
      const r = await removeAdmin(userId)
      if (r.success) {
        setData(prev => prev ? { ...prev, admins: r.data } : prev)
        showToast("已移除普通管理员")
      } else {
        showToast(r.error || "移除失败", false)
      }
    } catch (e: any) {
      showToast(`移除失败: ${e.message}`, false)
    } finally {
      setOperating(false)
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-400 text-center py-12">加载中...</p>
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold text-slate-900">管理员管理</h1>

      {/* 权限说明 */}
      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
        <h3 className="text-sm font-semibold text-blue-900 mb-3 flex items-center gap-2">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
            <circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>
          </svg>
          权限说明
        </h3>
        <ul className="text-xs text-blue-800 space-y-1.5 pl-6 list-disc">
          <li><strong>大管理员</strong>：通过 WebUI 添加，拥有全局权限，可执行取消订阅/取关操作，可管理普通管理员</li>
          <li><strong>普通管理员</strong>：由大管理员通过命令添加，拥有全局权限，可执行取消订阅/取关操作</li>
          <li><strong>群管理员</strong>：群主/群管理员自动拥有本群权限，可执行取消订阅/取关操作</li>
        </ul>
        <div className="mt-3 p-3 rounded-lg bg-blue-100 border border-blue-200">
          <p className="text-[11px] text-blue-700 font-mono">
            命令：gh 管理员 添加 @用户 | gh 管理员 删除 @用户 | gh 管理员 列表
          </p>
        </div>
      </div>

      {/* 大管理员 */}
      <Section
        title="大管理员"
        description="拥有全局权限，可管理普通管理员"
        icon={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
          </svg>
        }
      >
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <input
              type="text"
              className="flex-1 h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition-all"
              placeholder="输入用户 ID（如 123456789）"
              value={newSuperAdmin}
              onChange={(e) => setNewSuperAdmin(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddSuperAdmin()}
              disabled={operating}
            />
            <button
              onClick={handleAddSuperAdmin}
              disabled={operating || !newSuperAdmin.trim()}
              className="h-10 px-4 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors"
            >
              添加
            </button>
          </div>

          {(!data?.superAdmins || data.superAdmins.length === 0) ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
              <p className="text-sm text-slate-400">暂无大管理员</p>
              <p className="text-xs text-slate-300 mt-1">添加后可管理普通管理员</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {data.superAdmins.map((id) => (
                <div key={id} className="flex items-center justify-between px-4 py-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="flex size-8 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                        <path d="M12 2l2.4 7.4h7.6l-6 4.6 2.3 7-6.3-4.6L5.7 21l2.3-7L2 9.4h7.6z"/>
                      </svg>
                    </div>
                    <span className="text-sm font-mono text-slate-700">{id}</span>
                  </div>
                  <button
                    onClick={() => handleRemoveSuperAdmin(id)}
                    disabled={operating}
                    className="h-8 px-3 rounded-lg border border-red-200 bg-white text-xs font-medium text-red-500 hover:bg-red-50 disabled:opacity-50 transition-colors"
                  >
                    移除
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Section>

      {/* 普通管理员 */}
      <Section
        title="普通管理员"
        description="由大管理员添加，拥有取消订阅/取关权限"
        icon={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
          </svg>
        }
      >
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <input
              type="text"
              className="flex-1 h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition-all"
              placeholder="输入用户 ID（如 123456789）"
              value={newAdmin}
              onChange={(e) => setNewAdmin(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddAdmin()}
              disabled={operating}
            />
            <button
              onClick={handleAddAdmin}
              disabled={operating || !newAdmin.trim()}
              className="h-10 px-4 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors"
            >
              添加
            </button>
          </div>

          {(!data?.admins || data.admins.length === 0) ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
              <p className="text-sm text-slate-400">暂无普通管理员</p>
              <p className="text-xs text-slate-300 mt-1">可通过命令 gh 管理员 添加 @用户 添加</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {data.admins.map((id) => (
                <div key={id} className="flex items-center justify-between px-4 py-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="flex size-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
                      </svg>
                    </div>
                    <span className="text-sm font-mono text-slate-700">{id}</span>
                  </div>
                  <button
                    onClick={() => handleRemoveAdmin(id)}
                    disabled={operating}
                    className="h-8 px-3 rounded-lg border border-red-200 bg-white text-xs font-medium text-red-500 hover:bg-red-50 disabled:opacity-50 transition-colors"
                  >
                    移除
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Section>
    </div>
  )
}

function Section({ title, description, icon, children }: {
  title: string
  description?: string
  icon?: React.JSX.Element
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-2.5 mb-1">
        {icon && <span className="text-slate-400">{icon}</span>}
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      </div>
      {description && <p className="text-xs text-slate-400 mb-5 pl-6">{description}</p>}
      {children}
    </div>
  )
}
