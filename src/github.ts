import type { GitHubEvent, RepoInfo } from "./types.js";
import { pluginState } from "./state.js";

let tokenIndex = 0;

function getActiveToken(): string {
  const all = [...(pluginState.config.tokens || [])];
  if (pluginState.config.token && !all.includes(pluginState.config.token)) {
    all.push(pluginState.config.token);
  }
  const valid = all.filter((t) => t.trim());
  if (!valid.length) return "";
  const t = valid[tokenIndex % valid.length];
  tokenIndex++;
  return t;
}

function getHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    "User-Agent": "dian-plugin-github",
    Accept: "application/vnd.github+json",
  };
  const token = getActiveToken();
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

async function fetchJSON<T>(url: string): Promise<T | null> {
  const start = Date.now();
  try {
    pluginState.debug(`[HTTP] GET ${url}`);
    const res = await fetch(url, { headers: getHeaders(), signal: AbortSignal.timeout(15000) });
    const ms = Date.now() - start;
    pluginState.debug(`[HTTP] 响应: ${res.status} ${res.statusText} (${ms}ms)`);

    if (!res.ok) {
      let msg = `状态码: ${res.status} ${res.statusText || ""}`;
      switch (res.status) {
        case 401: msg = "访问令牌无效或已过期 (code: 401)"; break;
        case 403: msg = "请求达到 API 速率限制或无权限 (code: 403)"; break;
        case 404: msg = "未找到仓库 (code: 404)"; break;
        case 500: msg = "服务器错误 (code: 500)"; break;
      }
      pluginState.log("warn", `请求失败: ${url}, ${msg} (${ms}ms)`);
      return null;
    }
    const data = await res.json() as T;
    const count = Array.isArray(data) ? data.length : 1;
    pluginState.debug(`[HTTP] 解析成功: ${count} 条数据 (${ms}ms)`);
    return data;
  } catch (e) {
    const ms = Date.now() - start;
    pluginState.log("error", `请求失败: ${url} (${ms}ms)，错误信息: ${e}`);
    return null;
  }
}

export async function fetchEvents(repo: string, perPage = 30): Promise<GitHubEvent[]> {
  const base = pluginState.config.apiBase || "https://api.github.com";
  const url = `${base}/repos/${repo}/events?per_page=${perPage}`;
  pluginState.debug(`[GitHub] 获取仓库事件: ${repo}`);
  const events = await fetchJSON<GitHubEvent[]>(url) || [];
  if (events.length) {
    const types = [...new Set(events.map((e) => e.type))];
    pluginState.debug(`[GitHub] ${repo}: ${events.length} 条事件，类型: ${types.join(", ")}`);
  } else {
    pluginState.debug(`[GitHub] ${repo}: 无事件`);
  }
  return events;
}

export async function fetchUserEvents(username: string, perPage = 30): Promise<GitHubEvent[]> {
  const base = pluginState.config.apiBase || "https://api.github.com";
  const url = `${base}/users/${username}/events/public?per_page=${perPage}`;
  pluginState.debug(`[GitHub] 获取用户事件: ${username}`);
  const events = await fetchJSON<GitHubEvent[]>(url) || [];
  if (events.length) {
    const types = [...new Set(events.map((e) => e.type))];
    pluginState.debug(`[GitHub] ${username}: ${events.length} 条事件，类型: ${types.join(", ")}`);
  } else {
    pluginState.debug(`[GitHub] ${username}: 无事件`);
  }
  return events;
}

export async function fetchDefaultBranch(repo: string): Promise<string> {
  const base = pluginState.config.apiBase || "https://api.github.com";
  pluginState.debug(`[GitHub] 获取默认分支: ${repo}`);
  const data = await fetchJSON<{ default_branch: string }>(`${base}/repos/${repo}`);
  const branch = data?.default_branch || "main";
  pluginState.debug(`[GitHub] ${repo} 默认分支: ${branch}`);
  return branch;
}

export async function fetchBranches(repo: string, perPage = 100): Promise<{ name: string; isDefault: boolean }[]> {
  const base = pluginState.config.apiBase || "https://api.github.com";
  pluginState.debug(`[GitHub] 获取分支列表: ${repo}`);
  const [repoData, branches] = await Promise.all([
    fetchJSON<{ default_branch: string }>(`${base}/repos/${repo}`),
    fetchJSON<{ name: string }[]>(`${base}/repos/${repo}/branches?per_page=${perPage}`),
  ]);
  const defaultBranch = repoData?.default_branch || "main";
  const list = (branches || []).map((b) => ({ name: b.name, isDefault: b.name === defaultBranch }));
  list.sort((a, b) => (a.isDefault ? -1 : 0) - (b.isDefault ? -1 : 0));
  pluginState.debug(`[GitHub] ${repo}: ${list.length} 个分支，默认: ${defaultBranch}`);
  return list;
}

export async function fetchCommitDetail(repo: string, sha: string): Promise<{ files?: any[]; commit?: { message?: string } } | null> {
  const base = pluginState.config.apiBase || "https://api.github.com";
  const url = `${base}/repos/${repo}/commits/${sha}`;
  pluginState.debug(`[GitHub] 获取 commit 详情: ${repo}@${sha.slice(0, 7)}`);
  return await fetchJSON<{ files?: any[]; commit?: { message?: string } }>(url);
}

export async function fetchActionRuns(repo: string, perPage = 10): Promise<any[]> {
  const base = pluginState.config.apiBase || "https://api.github.com";
  const url = `${base}/repos/${repo}/actions/runs?per_page=${perPage}`;
  pluginState.debug(`[GitHub] 获取 Actions runs: ${repo}`);
  const data = await fetchJSON<{ workflow_runs: any[] }>(url);
  const runs = data?.workflow_runs || [];
  pluginState.debug(`[GitHub] ${repo}: ${runs.length} 条 Actions runs`);
  return runs;
}

export async function fetchRepoInfo(repo: string): Promise<RepoInfo | null> {
  const base = pluginState.config.apiBase || "https://api.github.com";
  const url = `${base}/repos/${repo}`;
  pluginState.debug(`[GitHub] 获取仓库信息: ${repo}`);
  return await fetchJSON<RepoInfo>(url);
}

export async function fetchReadme(repo: string): Promise<string | null> {
  const base = pluginState.config.apiBase || "https://api.github.com";
  const url = `${base}/repos/${repo}/readme`;
  pluginState.debug(`[GitHub] 获取 README: ${repo}`);
  const data = await fetchJSON<{ content: string; encoding: string }>(url);
  if (!data?.content) return null;
  try {
    const decoded = Buffer.from(data.content, "base64").toString("utf-8");
    pluginState.debug(`[GitHub] README 解码成功，长度: ${decoded.length}`);
    return decoded;
  } catch (e) {
    pluginState.log("warn", `README 解码失败: ${e}`);
    return null;
  }
}
