import type { CommitData, IssueData, CommentData, ActionRunData, RepoInfo, UserActivityItem } from "../types.js";
import { pluginState } from "../state.js";
import { esc, truncate, fmtNum, fmtTime } from "./utils.js";
import { getTheme, SVG } from "./theme.js";
import {
  renderToBase64,
  commitsHTML, issuesHTML, pullsHTML, commentsHTML, actionsHTML,
  repoCardHTML, userActivityHTML, wrapHTML,
  mdActionTag, mdBodyToHTML,
  USER_EVENT_MAP,
} from "./cards.js";
import { tplReplace, tplWrapScript, commitsTplVars, issuesTplVars } from "./templates.js";

export { renderToBase64 } from "./cards.js";

export async function renderCommits(repo: string, commits: CommitData[]): Promise<string | null> {
  const custom = pluginState.config.customHTML?.commits;
  if (custom) {
    pluginState.debug("[渲染] 使用自定义 Commits 模板");
    return renderToBase64(tplReplace(custom, commitsTplVars(repo, commits)));
  }
  return renderToBase64(commitsHTML(repo, commits));
}

export async function renderIssues(repo: string, issues: IssueData[]): Promise<string | null> {
  const custom = pluginState.config.customHTML?.issues;
  if (custom) {
    pluginState.debug("[渲染] 使用自定义 Issues 模板");
    return renderToBase64(tplReplace(custom, issuesTplVars(repo, issues, "Issues")));
  }
  return renderToBase64(issuesHTML(repo, issues));
}

export async function renderPulls(repo: string, pulls: IssueData[]): Promise<string | null> {
  const custom = pluginState.config.customHTML?.pulls;
  if (custom) {
    pluginState.debug("[渲染] 使用自定义 Pulls 模板");
    return renderToBase64(tplReplace(custom, issuesTplVars(repo, pulls, "Pull Requests")));
  }
  return renderToBase64(pullsHTML(repo, pulls));
}

export async function renderComments(repo: string, comments: CommentData[]): Promise<string | null> {
  const custom = pluginState.config.customHTML?.comments;
  if (custom) {
    pluginState.debug("[渲染] 使用自定义 Comments 模板");
    const itemsJson = JSON.stringify(comments.map((c) => ({
      number: c.number, title: c.title, body: c.body, author: c.user.login,
      created_at: c.created_at, url: c.html_url, source: c.source,
    })));
    return renderToBase64(tplReplace(custom, {
      repo, count: String(comments.length), type: "Comments",
      time: new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" }),
      items: itemsJson,
    }));
  }
  return renderToBase64(commentsHTML(repo, comments));
}

export async function renderActions(repo: string, runs: ActionRunData[]): Promise<string | null> {
  const custom = pluginState.config.customHTML?.actions;
  if (custom) {
    pluginState.debug("[渲染] 使用自定义 Actions 模板");
    const itemsJson = JSON.stringify(runs.map((r) => ({
      id: r.id, name: r.name, run_number: r.run_number, status: r.status,
      conclusion: r.conclusion || "", actor: r.actor.login, event: r.event,
      head_branch: r.head_branch, created_at: r.created_at, url: r.html_url,
    })));
    return renderToBase64(tplWrapScript(custom, {
      repo, count: String(runs.length), type: "Actions",
      time: new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" }),
      items: itemsJson,
    }));
  }
  return renderToBase64(actionsHTML(repo, runs));
}

export async function renderRepoCard(repo: RepoInfo, readme: string | null): Promise<string | null> {
  return renderToBase64(repoCardHTML(repo, readme));
}

export function repoSummary(repo: RepoInfo): string {
  return [
    `📦 ${repo.full_name}`,
    repo.description || "",
    `⭐ ${repo.stargazers_count} | 🍴 ${repo.forks_count} | 📝 ${repo.open_issues_count} issues`,
    repo.language ? `语言: ${repo.language}` : "",
    `默认分支: ${repo.default_branch}`,
    `🔗 ${repo.html_url}`,
  ].filter(Boolean).join("\n");
}

export function commitsSummary(repo: string, commits: CommitData[]): string {
  const lines = [`[${repo}] ${commits.length} 条新 Commit\n`];
  for (const c of commits) {
    const msg = c.commit.message.split("\n")[0].slice(0, 60);
    lines.push(`* ${c.sha.slice(0, 7)} ${c.commit.author.name}: ${msg}`);
  }
  return lines.join("\n");
}

export function issuesSummary(repo: string, issues: IssueData[], type: "Issues" | "Pull Requests"): string {
  const lines = [`[${repo}] ${issues.length} 条新 ${type}\n`];
  for (const i of issues) {
    const actionText = i.action ? `[${i.action}]` : (i.state === "open" ? "[open]" : "[closed]");
    lines.push(`${actionText} #${i.number} ${i.title.slice(0, 50)} - ${i.user.login}`);
  }
  return lines.join("\n");
}

export function commentsSummary(repo: string, comments: CommentData[]): string {
  const lines = [`[${repo}] ${comments.length} 条新评论\n`];
  for (const c of comments) {
    const src = c.source === "pull_request" ? "PR" : "Issue";
    lines.push(`[${src}#${c.number}] ${c.user.login}: ${c.body.replace(/\n/g, " ").slice(0, 500)}`);
  }
  return lines.join("\n");
}

export function actionsSummary(repo: string, runs: ActionRunData[]): string {
  const lines = [`[${repo}] ${runs.length} 条 Actions 更新\n`];
  for (const r of runs) {
    const c = r.conclusion || r.status;
    lines.push(`#${r.run_number} ${r.name} [${c}] - ${r.actor.login}`);
  }
  return lines.join("\n");
}

export async function renderUserActivity(username: string, items: UserActivityItem[]): Promise<string | null> {
  return renderToBase64(userActivityHTML(username, items));
}

export function userActivitySummary(username: string, items: UserActivityItem[]): string {
  const lines = [`[${username}] ${items.length} 条新动态\n`];
  for (const item of items) {
    const type = item.type.replace("Event", "");
    lines.push(`[${type}] ${item.repo}: ${item.desc.slice(0, 60)}`);
  }
  return lines.join("\n");
}

interface RepoCollectedData {
  repo: string;
  commits: CommitData[];
  issues: IssueData[];
  pulls: IssueData[];
  comments: CommentData[];
  actions: ActionRunData[];
}

interface UserCollectedData {
  username: string;
  items: UserActivityItem[];
}

function mergedRepoHTML(repos: RepoCollectedData[]): string {
  const t = getTheme();
  let totalCount = 0;
  const sections: string[] = [];

  for (const r of repos) {
    const parts: string[] = [];

    if (r.commits.length) {
      totalCount += r.commits.length;
      const showCommits = r.commits.slice(0, 3);
      parts.push(showCommits.map((c) => {
        const msg = esc(truncate(c.commit.message.split("\n")[0], 120));
        const sha = c.sha.slice(0, 7);
        const author = esc(c.commit.author.name);
        let diffHtml = "";
        if (c.files && c.files.length) {
          const showFiles = c.files.slice(0, 3);
          const restFiles = c.files.length - showFiles.length;
          diffHtml = showFiles.map((f) => `<div class="diff-file"><div class="diff-name"><span>${esc(f.filename)}</span><span class="add">+${f.additions}</span><span class="del">-${f.deletions}</span></div></div>`).join("");
          if (restFiles > 0) diffHtml += `<div class="diff-more">还有 ${restFiles} 个文件变更</div>`;
        }
        return `<div class="item" style="padding:6px 0"><div class="item-header"><span class="sha">${sha}</span><span style="color:${t.textSub};font-size:11px">${author}</span><span class="time">${fmtTime(c.commit.author.date)}</span></div><div class="msg">${msg}</div>${diffHtml}</div>`;
      }).join(""));
      if (r.commits.length > 3) parts.push(`<div style="font-size:11px;color:${t.textMuted};padding:2px 0">还有 ${r.commits.length - 3} 条 commit</div>`);
    }

    if (r.issues.length) {
      totalCount += r.issues.length;
      parts.push(r.issues.map((i) => {
        const tag = mdActionTag(i.action, i.state);
        const body = i.body ? `<div style="margin-top:4px;font-size:12px">${mdBodyToHTML(i.body, 500)}</div>` : "";
        return `<div class="item" style="padding:6px 0"><div class="item-header"><span style="color:#8957e5;font-size:11px">Issue #${i.number}</span>${tag}<span class="time">${fmtTime(i.created_at)}</span></div><div class="msg">${esc(truncate(i.title, 120))}</div>${body}</div>`;
      }).join(""));
    }

    if (r.pulls.length) {
      totalCount += r.pulls.length;
      parts.push(r.pulls.map((p) => {
        const tag = mdActionTag(p.action, p.state);
        const body = p.body ? `<div style="margin-top:4px;font-size:12px">${mdBodyToHTML(p.body, 500)}</div>` : "";
        return `<div class="item" style="padding:6px 0"><div class="item-header"><span style="color:#db6d28;font-size:11px">PR #${p.number}</span>${tag}<span class="time">${fmtTime(p.created_at)}</span></div><div class="msg">${esc(truncate(p.title, 120))}</div>${body}</div>`;
      }).join(""));
    }

    if (r.comments.length) {
      totalCount += r.comments.length;
      parts.push(r.comments.slice(0, 2).map((c) => {
        const src = c.source === "pull_request" ? "PR" : "Issue";
        return `<div class="item" style="padding:6px 0"><div class="item-header"><span style="color:#58a6ff;font-size:11px">${src} #${c.number} 评论</span><span class="time">${fmtTime(c.created_at)}</span></div><div class="msg">${mdBodyToHTML(c.body, 500)}</div></div>`;
      }).join(""));
    }

    if (r.actions.length) {
      totalCount += r.actions.length;
      parts.push(r.actions.slice(0, 2).map((a) => {
        const conclusion = a.conclusion || a.status;
        return `<div class="item" style="padding:6px 0"><div class="item-header"><span style="color:#d29922;font-size:11px">Action #${a.run_number}</span><span style="font-size:11px;color:${t.textMuted}">${esc(conclusion)}</span><span class="time">${fmtTime(a.created_at)}</span></div><div class="msg">${esc(truncate(a.name, 60))}</div></div>`;
      }).join(""));
    }

    if (parts.length) {
      sections.push(`<div style="margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid ${t.divider}"><div style="font-size:13px;font-weight:600;margin-bottom:6px;display:flex;align-items:center;gap:6px">${SVG.commit}<span>${esc(r.repo)}</span></div>${parts.join("")}</div>`);
    }
  }

  if (sections.length) {
    sections[sections.length - 1] = sections[sections.length - 1].replace(/border-bottom:1px solid [^;]+;/, "border-bottom:none;");
  }

  const ghIcon = `<svg width="20" height="20" viewBox="0 0 16 16" fill="${t.text}"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>`;
  return wrapHTML(`${repos.length} 个仓库`, "仓库订阅汇总", "#2ea44f", ghIcon, totalCount, sections.join(""));
}

function mergedUsersHTML(users: UserCollectedData[]): string {
  const t = getTheme();
  let totalCount = 0;
  const sections: string[] = [];

  for (const u of users) {
    totalCount += u.items.length;
    const rows = u.items.slice(0, 20).map((item) => {
      const ev = USER_EVENT_MAP[item.type] || { icon: SVG.commit, color: t.textSub };
      return `<div class="item" style="padding:6px 0"><div class="item-header"><span class="header-icon" style="display:inline-flex;align-items:center">${ev.icon}</span><span style="color:${ev.color};font-weight:500;font-size:11px">${esc(item.type.replace("Event", ""))}</span><span style="color:${t.textSub};font-size:11px">${esc(item.repo)}</span><span class="time">${fmtTime(item.time)}</span></div><div class="msg">${esc(truncate(item.desc, 80))}</div></div>`;
    }).join("");
    const extra = u.items.length > 20 ? `<div style="font-size:11px;color:${t.textMuted};padding:2px 0">还有 ${u.items.length - 20} 条动态</div>` : "";
    sections.push(`<div style="margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid ${t.divider}"><div style="font-size:13px;font-weight:600;margin-bottom:6px">${esc(u.username)}</div>${rows}${extra}</div>`);
  }

  if (sections.length) {
    sections[sections.length - 1] = sections[sections.length - 1].replace(/border-bottom:1px solid [^;]+;/, "border-bottom:none;");
  }

  const userIcon = `<svg width="20" height="20" viewBox="0 0 16 16" fill="#58a6ff"><path d="M10.561 8.073a6.005 6.005 0 0 1 3.432 5.142.75.75 0 1 1-1.498.07 4.5 4.5 0 0 0-8.99 0 .75.75 0 0 1-1.498-.07 6.004 6.004 0 0 1 3.431-5.142 3.999 3.999 0 1 1 5.123 0ZM10.5 5a2.5 2.5 0 1 0-5 0 2.5 2.5 0 0 0 5 0Z"/></svg>`;
  return wrapHTML(`${users.length} 个用户`, "用户动态汇总", "#58a6ff", userIcon, totalCount, sections.join(""));
}

export async function renderMergedRepo(repos: RepoCollectedData[]): Promise<string | null> {
  return renderToBase64(mergedRepoHTML(repos));
}

export function mergedRepoSummary(repos: RepoCollectedData[]): string {
  const lines = [`[仓库订阅汇总] ${repos.length} 个仓库有更新\n`];
  for (const r of repos) {
    const parts: string[] = [];
    if (r.commits.length) parts.push(`${r.commits.length} commits`);
    if (r.issues.length) parts.push(`${r.issues.length} issues`);
    if (r.pulls.length) parts.push(`${r.pulls.length} PRs`);
    if (r.comments.length) parts.push(`${r.comments.length} comments`);
    if (r.actions.length) parts.push(`${r.actions.length} actions`);
    lines.push(`${r.repo}: ${parts.join(", ")}`);
  }
  return lines.join("\n");
}

export async function renderMergedUsers(users: UserCollectedData[]): Promise<string | null> {
  return renderToBase64(mergedUsersHTML(users));
}

export function mergedUsersSummary(users: UserCollectedData[]): string {
  const lines = [`[用户动态汇总] ${users.length} 个用户有更新\n`];
  for (const u of users) {
    lines.push(`${u.username}: ${u.items.length} 条动态`);
  }
  return lines.join("\n");
}
