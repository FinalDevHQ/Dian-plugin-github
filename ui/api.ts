const PLUGIN_NAME = "github-sub"
export const API = `/plugins/${PLUGIN_NAME}/api`
const TOKEN_KEY = "dian_token"

export async function api<T = any>(path: string, body?: unknown): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY)
  const headers: Record<string, string> = {
    ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
  const opts: RequestInit = body !== undefined
    ? { method: "POST", headers, body: JSON.stringify(body) }
    : { headers }
  const res = await fetch(`${API}${path}`, opts)
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    if (res.status === 401) {
      throw new Error("未登录或登录已过期，请刷新主控制台后重新登录")
    }
    throw new Error(`HTTP ${res.status}: ${text || res.statusText}`)
  }
  const contentType = res.headers.get("content-type") || ""
  if (!contentType.includes("application/json")) {
    const text = await res.text().catch(() => "")
    const brief = text.slice(0, 120).replace(/\s+/g, " ")
    throw new Error(`接口返回非 JSON（${contentType || "unknown"}）: ${brief || "empty response"}`)
  }
  return res.json() as Promise<T>
}

// ── 管理员 API ──

export interface AdminData {
  superAdmins: string[]
  admins: string[]
}

export async function getAdminConfig(): Promise<{ success: boolean; data: AdminData }> {
  return api("/admin")
}

export async function updateSuperAdmins(superAdmins: string[]): Promise<{ success: boolean; data: string[] }> {
  return api("/admin/super", { superAdmins })
}

export async function addAdmin(userId: string): Promise<{ success: boolean; data: string[]; error?: string }> {
  return api("/admin/add", { userId })
}

export async function removeAdmin(userId: string): Promise<{ success: boolean; data: string[]; error?: string }> {
  return api("/admin/remove", { userId })
}
