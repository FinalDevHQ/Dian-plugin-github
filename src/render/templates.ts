import type { CommitData, IssueData, ActionRunData } from "../types.js";

export function tplReplace(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_m, key) => vars[key] ?? "");
}

export function tplWrapScript(tpl: string, vars: Record<string, string>): string {
  return tplReplace(tpl, vars).replace(/<\/script>/gi, "<\\/script>");
}

export function commitsTplVars(repo: string, commits: CommitData[]): Record<string, string> {
  const itemsJson = JSON.stringify(commits.map((c) => ({
    sha: c.sha, sha7: c.sha.slice(0, 7),
    message: c.commit.message.split("\n")[0],
    author: c.commit.author.name, date: c.commit.author.date,
    url: c.html_url,
    files: (c.files || []).map((f) => ({ filename: f.filename, status: f.status, additions: f.additions, deletions: f.deletions, patch: f.patch || "" })),
  })));
  return {
    repo, count: String(commits.length), type: "Commits",
    time: new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" }),
    items: itemsJson,
  };
}

export function issuesTplVars(repo: string, items: IssueData[], type: string): Record<string, string> {
  const itemsJson = JSON.stringify(items.map((i) => ({
    number: i.number, title: i.title, state: i.state, action: i.action || "",
    author: i.user.login, created_at: i.created_at, url: i.html_url,
    labels: i.labels.map((l) => ({ name: l.name, color: l.color })),
  })));
  return {
    repo, count: String(items.length), type,
    time: new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" }),
    items: itemsJson,
  };
}
