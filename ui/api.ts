const PLUGIN_NAME = "github-sub"
export const API = `/plugins/${PLUGIN_NAME}/api`

export async function api<T = any>(path: string, body?: unknown): Promise<T> {
  const opts: RequestInit = body !== undefined
    ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
    : {}
  const res = await fetch(`${API}${path}`, opts)
  if (!res.ok) {
    const text = await res.text().catch(() => "")
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
