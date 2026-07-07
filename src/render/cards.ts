import type { CommitData, IssueData, CommentData, ActionRunData, RepoInfo, UserActivityItem } from "../types.js";
import { pluginState } from "../state.js";
import { esc, truncate, fmtNum, fmtTime } from "./utils.js";
import { getTheme, SVG } from "./theme.js";

export async function renderToBase64(html: string): Promise<string | null> {
  try {
    const plugin = pluginState.config.puppeteerPlugin || "puppeteer";
    const url = `http://127.0.0.1:${(pluginState.config as any).webuiPort || 3000}/plugins/${encodeURIComponent(plugin)}/api/render`;

    pluginState.debug(`调用 Dian Puppeteer 渲染，插件: ${plugin}，HTML 长度: ${html.length}`);

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        html,
        selector: "body",
        type: "png",
        encoding: "base64",
        setViewport: { width: 600, height: 600, deviceScaleFactor: 1 },
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      pluginState.log("warn", `Dian Puppeteer HTTP ${res.status}: ${text || res.statusText}`);
      return null;
    }

    const data = await res.json() as { code: number; data?: string; message?: string };
    if (data.code === 0 && data.data) {
      pluginState.debug("Dian Puppeteer 渲染成功");
      return data.data;
    }
    pluginState.log("warn", `Dian Puppeteer 渲染失败: ${data.message || "未知错误"}`);
    return null;
  } catch (e) {
    pluginState.log("error", `Dian Puppeteer 渲染请求失败: ${e}`);
    return null;
  }
}

export function wrapHTML(repo: string, typeName: string, color: string, icon: string, count: number, content: string): string {
  const t = getTheme();
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;background:radial-gradient(circle at top left,${color}22,transparent 36%),${t.bg};color:${t.text};padding:20px;width:600px}
.card{background:${t.card};border:1px solid ${t.border};border-radius:16px;overflow:hidden;box-shadow:0 18px 42px rgba(31,35,40,.12)}
.header{padding:18px 20px;border-bottom:1px solid ${t.border};display:flex;align-items:center;gap:12px;background:linear-gradient(135deg,${color}18,transparent 62%)}
.header-icon{display:flex;align-items:center}
.header-info h2{font-size:17px;font-weight:700;color:${t.text};letter-spacing:-.01em}
.header-info .repo{font-size:13px;color:${t.textSub};margin-top:2px}
.badge{background:${color}20;color:${color};border:1px solid ${color}40;padding:4px 11px;border-radius:999px;font-size:12px;font-weight:700;margin-left:auto;box-shadow:inset 0 1px 0 rgba(255,255,255,.18)}
.body{padding:14px 20px}
.item{padding:10px 0;border-bottom:1px solid ${t.divider}}
.item:last-child{border-bottom:none}
.item-header{display:flex;align-items:center;gap:8px;margin-bottom:4px;font-size:12px}
.sha{background:${t.codeBg};color:${color};border:1px solid ${t.border};padding:1px 7px;border-radius:6px;font-family:monospace;font-size:11px;font-weight:700}
.author{color:${t.textSub}}
.time{color:${t.textMuted};margin-left:auto;font-size:11px}
.msg{font-size:13px;color:${t.text};line-height:1.5}
.footer{padding:10px 20px;border-top:1px solid ${t.border};text-align:center;font-size:11px;color:${t.textMuted};background:${t.codeBg}}
.diff-file{margin-top:8px;border:1px solid ${t.border};border-radius:6px;overflow:hidden}
.diff-name{padding:4px 10px;background:${t.codeHeader};font-size:11px;font-family:monospace;color:${t.textSub};display:flex;align-items:center;gap:6px;border-bottom:1px solid ${t.border}}
.diff-name .add{color:#3fb950}.diff-name .del{color:#f85149}
.diff-code{padding:6px 10px;font-family:monospace;font-size:10px;line-height:1.6;white-space:pre-wrap;word-break:break-all;background:${t.codeBg};color:${t.textSub}}
.diff-code .l-add{color:#3fb950;background:rgba(63,185,80,.1)}
.diff-code .l-del{color:#f85149;background:rgba(248,81,73,.1)}
.diff-code .l-hunk{color:#79c0ff}
.diff-more{padding:6px 10px;font-size:10px;color:${t.textSub};text-align:center;background:${t.codeBg};border-top:1px solid ${t.divider}}
</style></head><body>
<div class="card">
  <div class="header">
    <span class="header-icon">${icon}</span>
    <div class="header-info"><h2>${typeName} 更新</h2><div class="repo">${esc(repo)}</div></div>
    <span class="badge">${count} 条新更新</span>
  </div>
  <div class="body">${content}</div>
  <div class="footer">GitHub Subscription ${SVG.sep} ${new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}</div>
</div>
</body></html>`;
}

function renderPatch(patch: string, maxChars: number): string {
  const lines = patch.split("\n");
  let charCount = 0;
  let truncated = false;
  const rendered: string[] = [];
  for (const line of lines) {
    if (charCount + line.length > maxChars) { truncated = true; break; }
    charCount += line.length + 1;
    const escaped = esc(line);
    if (line.startsWith("+")) rendered.push(`<div class="l-add">${escaped}</div>`);
    else if (line.startsWith("-")) rendered.push(`<div class="l-del">${escaped}</div>`);
    else if (line.startsWith("@@")) rendered.push(`<div class="l-hunk">${escaped}</div>`);
    else rendered.push(`<div>${escaped}</div>`);
  }
  if (truncated) rendered.push(`<div style="color:#8b949e;font-style:italic">... 内容过长已截断</div>`);
  return rendered.join("");
}

function fileDiffHTML(file: { filename: string; status: string; additions: number; deletions: number; patch?: string }): string {
  const patchContent = file.patch ? renderPatch(file.patch, 3000) : '<div style="color:#8b949e">（二进制文件或无变更内容）</div>';
  return `<div class="diff-file"><div class="diff-name"><span>${esc(file.filename)}</span><span class="add">+${file.additions}</span><span class="del">-${file.deletions}</span></div><div class="diff-code">${patchContent}</div></div>`;
}

const ACTION_MAP: Record<string, { text: string; color: string; bg: string }> = {
  opened: { text: "新建", color: "#3fb950", bg: "rgba(63,185,80,.15)" },
  closed: { text: "关闭", color: "#f85149", bg: "rgba(248,81,73,.15)" },
  reopened: { text: "重新打开", color: "#d29922", bg: "rgba(210,153,34,.15)" },
  merged: { text: "已合并", color: "#a371f7", bg: "rgba(163,113,247,.15)" },
};

export function actionTag(action?: string): string {
  if (!action) return "";
  const a = ACTION_MAP[action];
  if (!a) return `<span class="action-tag" style="background:rgba(139,148,158,.15);color:#8b949e">${esc(action)}</span>`;
  return `<span class="action-tag" style="background:${a.bg};color:${a.color}">${a.text}</span>`;
}

export function wrapMarkdownHTML(repo: string, typeName: string, color: string, icon: string, count: number, mdBody: string): string {
  const t = getTheme();
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;background:radial-gradient(circle at top left,${color}22,transparent 36%),${t.bg};color:${t.text};padding:20px;width:600px}
.card{background:${t.card};border:1px solid ${t.border};border-radius:16px;overflow:hidden;box-shadow:0 18px 42px rgba(31,35,40,.12)}
.hd{padding:18px 20px;border-bottom:1px solid ${t.border};display:flex;align-items:center;gap:12px;background:linear-gradient(135deg,${color}18,transparent 62%)}
.hd-icon{display:flex;align-items:center}
.hd h2{font-size:17px;font-weight:700;color:${t.text};letter-spacing:-.01em}
.hd .repo{font-size:13px;color:${t.textSub};margin-top:2px}
.hd .badge{background:${color}20;color:${color};border:1px solid ${color}40;padding:4px 11px;border-radius:999px;font-size:12px;font-weight:700;margin-left:auto;box-shadow:inset 0 1px 0 rgba(255,255,255,.18)}
.md{padding:16px 20px;font-size:13px;line-height:1.7;color:${t.text}}
.md h3{font-size:14px;font-weight:600;margin:14px 0 6px;padding-bottom:4px;border-bottom:1px solid ${t.divider};color:${t.text}}
.md h3:first-child{margin-top:0}
.md p{margin:4px 0}
.md code{background:${t.codeBg};border:1px solid ${t.border};padding:1px 5px;border-radius:4px;font-family:monospace;font-size:12px}
.md blockquote{margin:6px 0;padding:6px 14px;border-left:3px solid ${t.border};color:${t.textSub};background:${t.codeBg};border-radius:0 6px 6px 0;font-size:12px;line-height:1.6}
.md ul{padding-left:20px;margin:4px 0}
.md li{margin:2px 0}
.md .tag{display:inline-block;padding:1px 8px;border-radius:10px;font-size:11px;font-weight:500;margin-left:4px}
.md .tag-open{background:rgba(63,185,80,.12);color:#3fb950}
.md .tag-closed{background:rgba(248,81,73,.12);color:#f85149}
.md .tag-merged{background:rgba(163,113,247,.12);color:#a371f7}
.md .tag-reopened{background:rgba(210,153,34,.12);color:#d29922}
.md .lbl{display:inline-block;padding:0 6px;border-radius:8px;font-size:10px;margin-left:3px}
.md .meta{font-size:11px;color:${t.textMuted}}
.md hr{border:none;border-top:1px solid ${t.divider};margin:8px 0}
.ft{padding:10px 20px;border-top:1px solid ${t.border};text-align:center;font-size:11px;color:${t.textMuted};background:${t.codeBg}}
</style></head><body>
<div class="card">
  <div class="hd">
    <span class="hd-icon">${icon}</span>
    <div><h2>${typeName} 更新</h2><div class="repo">${esc(repo)}</div></div>
    <span class="badge">${count} 条新更新</span>
  </div>
  <div class="md">${mdBody}</div>
  <div class="ft">GitHub Subscription ${SVG.sep} ${new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}</div>
</div>
</body></html>`;
}

export function mdActionTag(action?: string, state?: string): string {
  const a = action || state || "";
  const map: Record<string, string> = { opened: "tag-open", closed: "tag-closed", reopened: "tag-reopened", merged: "tag-merged", open: "tag-open" };
  const cls = map[a] || "";
  const textMap: Record<string, string> = { opened: "新建", closed: "已关闭", reopened: "重新打开", merged: "已合并", open: "打开中" };
  const text = textMap[a] || a;
  return text ? `<span class="tag ${cls}">${esc(text)}</span>` : "";
}

export function mdBodyToHTML(raw: string | null, maxLen = 3000): string {
  if (!raw) return "";
  let s = raw.length > maxLen ? raw.slice(0, maxLen) + "\n\n...(内容过长已截断)" : raw;

  const codeBlocks: string[] = [];
  s = s.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, _lang, code) => {
    const idx = codeBlocks.length;
    codeBlocks.push(`<pre style="background:rgba(110,118,129,.1);border:1px solid rgba(110,118,129,.2);border-radius:6px;padding:8px 12px;font-family:monospace;font-size:11px;line-height:1.6;overflow-x:auto;white-space:pre-wrap;word-break:break-all;margin:6px 0">${esc(code.trim())}</pre>`);
    return `\x00CB${idx}\x00`;
  });

  s = s.replace(/<!--[\s\S]*?-->/g, "");

  const inlineCodes: string[] = [];
  s = s.replace(/`([^`\n]+)`/g, (_, code) => {
    const idx = inlineCodes.length;
    inlineCodes.push(`<code style="background:rgba(110,118,129,.15);padding:1px 5px;border-radius:4px;font-family:monospace;font-size:12px">${esc(code)}</code>`);
    return `\x00IC${idx}\x00`;
  });

  s = esc(s);

  s = restoreReadmeHtml(s);

  s = s.replace(/^#{4,6}\s*(.+)$/gm, '<div style="font-size:12px;font-weight:700;margin:10px 0 4px;border-bottom:1px solid rgba(110,118,129,.18);padding-bottom:3px">$1</div>');
  s = s.replace(/^#{3}\s*(.+)$/gm, '<div style="font-size:13px;font-weight:600;margin:10px 0 4px;border-bottom:1px solid rgba(110,118,129,.2);padding-bottom:3px">$1</div>');
  s = s.replace(/^#{2}\s*(.+)$/gm, '<div style="font-size:14px;font-weight:700;margin:12px 0 4px;border-bottom:1px solid rgba(110,118,129,.2);padding-bottom:3px">$1</div>');
  s = s.replace(/^#{1}\s*(.+)$/gm, '<div style="font-size:15px;font-weight:700;margin:14px 0 6px;border-bottom:1px solid rgba(110,118,129,.3);padding-bottom:4px">$1</div>');

  s = s.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
  s = s.replace(/\*(.+?)\*/g, "<i>$1</i>");
  s = s.replace(/_(.+?)_/g, "<i>$1</i>");
  s = s.replace(/~~(.+?)~~/g, "<s>$1</s>");

  s = s.replace(/^[-*]\s+(.+)$/gm, '<div style="padding-left:16px;display:flex;align-items:baseline;gap:0"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:currentColor;opacity:0.4;flex-shrink:0;margin-right:6px;margin-top:6px"></span><span>$1</span></div>');
  s = s.replace(/^\d+\.\s+(.+)$/gm, (_content, content) => `<div style="padding-left:16px;display:flex;align-items:baseline;gap:0"><span style="display:inline-block;width:5px;height:5px;border-radius:50%;background:currentColor;opacity:0.35;flex-shrink:0;margin-right:6px;margin-top:7px"></span><span>${content}</span></div>`);

  s = s.replace(/:([a-z0-9_+-]+):/g, "[$1]");
  s = s.replace(/!\[([^\]]*)\]\(([^\s)]+)(?:\s+&quot;[^&]*&quot;)?\)/g, (_m, alt, src) => {
    const safeSrc = String(src).replace(/&amp;/g, "&");
    if (!/^(https?:|data:image\/)/i.test(safeSrc)) return `<span style="color:#8b949e">[图片: ${alt || safeSrc}]</span>`;
    return `<img src="${safeSrc}" alt="${alt}" style="max-width:100%;max-height:220px;border-radius:8px;margin:6px 0;border:1px solid rgba(110,118,129,.2);object-fit:contain">`;
  });
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<span style="color:#58a6ff;text-decoration:underline">$1</span>');
  s = s.replace(/^&gt;\s?(.+)$/gm, '<div style="padding:4px 12px;border-left:3px solid rgba(110,118,129,.3);color:rgba(139,148,158,1);margin:4px 0">$1</div>');
  s = s.replace(/^-{3,}$/gm, '<hr style="border:none;border-top:1px solid rgba(110,118,129,.2);margin:8px 0">');

  s = s.replace(/\x00CB(\d+)\x00/g, (_m, idx) => codeBlocks[Number(idx)] || "");
  s = s.replace(/\x00IC(\d+)\x00/g, (_m, idx) => inlineCodes[Number(idx)] || "");

  s = s.replace(/\n/g, "<br>");

  return s;
}

function restoreReadmeHtml(s: string): string {
  s = s.replace(/&lt;img\b([\s\S]*?)(?:\/)?&gt;/gi, (_match, attrs: string) => {
    const src = getEscapedAttr(attrs, "src").replace(/&amp;/g, "&");
    if (!/^(https?:|data:image\/)/i.test(src)) return "";
    const alt = getEscapedAttr(attrs, "alt");
    return `<img src="${src}" alt="${alt}" style="max-width:100%;max-height:220px;border-radius:8px;margin:6px 0;border:1px solid rgba(110,118,129,.2);object-fit:contain">`;
  });
  s = s.replace(/&lt;h1\b[\s\S]*?&gt;/gi, '<div style="font-size:15px;font-weight:700;margin:14px 0 6px;text-align:center">');
  s = s.replace(/&lt;h2\b[\s\S]*?&gt;/gi, '<div style="font-size:14px;font-weight:700;margin:12px 0 5px;text-align:center">');
  s = s.replace(/&lt;h[3-6]\b[\s\S]*?&gt;/gi, '<div style="font-size:13px;font-weight:700;margin:10px 0 4px;text-align:center">');
  s = s.replace(/&lt;\/h[1-6]&gt;/gi, "</div>");
  s = s.replace(/&lt;(?:div|p|center)\b[\s\S]*?&gt;/gi, '<div style="margin:4px 0;text-align:center">');
  s = s.replace(/&lt;\/(?:div|p|center)&gt;/gi, "</div>");
  s = s.replace(/&lt;br\s*\/?&gt;/gi, "<br>");
  s = s.replace(/&lt;a\b[\s\S]*?&gt;/gi, "");
  s = s.replace(/&lt;\/a&gt;/gi, "");
  return s;
}

function getEscapedAttr(attrs: string, name: string): string {
  const match = attrs.match(new RegExp(`${name}\\s*=\\s*(?:&quot;([\\s\\S]*?)&quot;|'([\\s\\S]*?)'|([^\\s]+))`, "i"));
  return match ? (match[1] || match[2] || match[3] || "") : "";
}

export function commitsHTML(repo: string, commits: CommitData[]): string {
  const showCommits = commits.slice(0, 5);
  const restCommits = commits.length - showCommits.length;
  const rows = showCommits.map((c) => {
    const msg = esc(truncate(c.commit.message.split("\n")[0], 80));
    const author = esc(c.commit.author.name);
    const sha = c.sha.slice(0, 7);
    const time = fmtTime(c.commit.author.date);
    let diffHtml = "";
    if (c.files && c.files.length) {
      const show = c.files.slice(0, 5);
      const rest = c.files.length - show.length;
      diffHtml = show.map((f) => fileDiffHTML(f)).join("");
      if (rest > 0) diffHtml += `<div class="diff-more">还有 ${rest} 个文件变更</div>`;
    }
    return `<div class="item"><div class="item-header"><span class="sha">${sha}</span><span class="author">${author}</span><span class="time">${time}</span></div><div class="msg">${msg}</div>${diffHtml}</div>`;
  }).join("");
  const extra = restCommits > 0 ? `<div class="diff-more">还有 ${restCommits} 条 commit，请前往 GitHub 查看</div>` : "";
  return wrapHTML(repo, "Commits", "#2ea44f", SVG.commit, commits.length, rows + extra);
}

export function issuesHTML(repo: string, issues: IssueData[]): string {
  const rows = issues.map((i) => {
    const title = esc(truncate(i.title, 80));
    const author = esc(i.user.login);
    const time = fmtTime(i.created_at);
    const tag = mdActionTag(i.action, i.state);
    const labels = i.labels.map((l) => `<span class="lbl" style="background:#${l.color}20;color:#${l.color};border:1px solid #${l.color}40">${esc(l.name)}</span>`).join("");
    const body = i.body ? `<blockquote>${mdBodyToHTML(i.body, 3000)}</blockquote>` : "";
    return `<h3><code>#${i.number}</code> ${title} ${tag}${labels}</h3>
<p class="meta">${SVG.user}${author} ${SVG.sep} ${time}</p>${body}`;
  }).join("<hr>");
  return wrapMarkdownHTML(repo, "Issues", "#8957e5", SVG.issue, issues.length, rows);
}

export function pullsHTML(repo: string, pulls: IssueData[]): string {
  const rows = pulls.map((p) => {
    const title = esc(truncate(p.title, 80));
    const author = esc(p.user.login);
    const time = fmtTime(p.created_at);
    const tag = mdActionTag(p.action, p.state);
    return `<h3><code>#${p.number}</code> ${title} ${tag}</h3>
<p class="meta">${SVG.user}${author} ${SVG.sep} ${time}</p>`;
  }).join("<hr>");
  return wrapMarkdownHTML(repo, "Pull Requests", "#db6d28", SVG.pr, pulls.length, rows);
}

export function commentsHTML(repo: string, comments: CommentData[]): string {
  const grouped = new Map<number, CommentData[]>();
  for (const c of comments) {
    const arr = grouped.get(c.number) || [];
    arr.push(c);
    grouped.set(c.number, arr);
  }

  const sections: string[] = [];
  for (const [num, group] of grouped) {
    const first = group[0];
    const srcLabel = first.source === "pull_request" ? "PR" : "Issue";
    const title = esc(truncate(first.title, 60));
    let html = `<h3><code>${srcLabel} #${num}</code> ${title} <span class="meta">(${group.length} 条评论)</span></h3>`;
    for (const c of group) {
      const author = esc(c.user.login);
      const time = fmtTime(c.created_at);
      const body = mdBodyToHTML(c.body, 3000);
      html += `<p class="meta">${SVG.user}${author} ${SVG.sep} ${time}</p><blockquote>${body}</blockquote>`;
    }
    sections.push(html);
  }

  return wrapMarkdownHTML(repo, "Comments", "#58a6ff", SVG.comment, comments.length, sections.join("<hr>"));
}

export function actionsHTML(repo: string, runs: ActionRunData[]): string {
  const rows = runs.map((r) => {
    const name = esc(truncate(r.name, 60));
    const actor = esc(r.actor.login);
    const time = fmtTime(r.created_at);
    const conclusion = r.conclusion || r.status;
    const cMap: Record<string, { text: string; cls: string }> = {
      success: { text: "成功", cls: "tag-open" },
      failure: { text: "失败", cls: "tag-closed" },
      cancelled: { text: "已取消", cls: "tag-reopened" },
      in_progress: { text: "运行中", cls: "tag-reopened" },
      queued: { text: "排队中", cls: "" },
    };
    const c = cMap[conclusion] || { text: conclusion, cls: "" };
    const tag = `<span class="tag ${c.cls}">${esc(c.text)}</span>`;
    return `<h3><code>#${r.run_number}</code> ${name} ${tag}</h3>
<p class="meta">${SVG.user}${actor} ${SVG.sep} ${esc(r.event)} ${SVG.sep} ${esc(r.head_branch)} ${SVG.sep} ${time}</p>`;
  }).join("<hr>");
  return wrapMarkdownHTML(repo, "Actions", "#d29922", SVG.actions, runs.length, rows);
}

export function repoCardHTML(repo: RepoInfo, readme: string | null): string {
  const t = getTheme();
  const desc = repo.description ? esc(truncate(repo.description, 120)) : '<span style="opacity:.55">No description</span>';
  const topics = (repo.topics || []).slice(0, 8).map((topic) =>
    `<span class="topic">${esc(topic)}</span>`
  ).join("");
  const readmeHTML = readme ? `
  <section class="readme">
    <div class="readme-title">README.md</div>
    <div class="readme-body">${mdBodyToHTML(readme.length > 4200 ? `${readme.slice(0, 4200)}\n\n...(README 内容过长已截断)` : readme, 4200)}</div>
  </section>` : "";

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;background:radial-gradient(circle at top left,#58a6ff24,transparent 38%),${t.bg};color:${t.text};padding:20px;width:600px}
.card{overflow:hidden;border:1px solid ${t.border};border-radius:18px;background:${t.card};box-shadow:0 18px 42px rgba(31,35,40,.14)}
.hero{display:flex;gap:14px;align-items:center;padding:18px 20px;border-bottom:1px solid ${t.border};background:linear-gradient(135deg,#1f6feb20,transparent 65%)}
.mark{display:flex;width:42px;height:42px;align-items:center;justify-content:center;border-radius:12px;background:#24292f;box-shadow:0 8px 20px rgba(36,41,47,.22)}
.name{font-size:18px;font-weight:800;color:#1f6feb;letter-spacing:-.02em}.desc{margin-top:4px;color:${t.textSub};font-size:13px;line-height:1.45}
.stats{display:flex;flex-wrap:wrap;gap:12px;padding:13px 20px;border-bottom:1px solid ${t.border};color:${t.textSub};font-size:12px}
.stat{display:inline-flex;gap:5px;align-items:center;border:1px solid ${t.border};border-radius:999px;background:${t.codeBg};padding:4px 9px}.dot{width:10px;height:10px;border-radius:50%;background:#3178c6}
.topics{padding:10px 20px;border-bottom:1px solid ${t.border}}.topic{display:inline-block;margin:2px 4px 2px 0;padding:2px 9px;border:1px solid #1f6feb33;border-radius:999px;background:#1f6feb14;color:#1f6feb;font-size:11px;font-weight:600}
.readme{padding:16px 20px}.readme-title{margin-bottom:10px;color:${t.text};font-size:13px;font-weight:700}.readme-body{color:${t.text};font-size:12px;line-height:1.65;word-break:break-word}.readme-body blockquote{margin:6px 0;padding:5px 12px;border-left:3px solid ${t.border};color:${t.textSub};background:${t.codeBg}}
.foot{padding:10px 20px;border-top:1px solid ${t.border};background:${t.codeBg};color:${t.textMuted};text-align:center;font-size:11px}
</style></head><body><div class="card">
  <div class="hero"><div class="mark"><svg width="24" height="24" viewBox="0 0 16 16" fill="#fff"><path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8Z"/></svg></div><div><div class="name">${esc(repo.full_name)}</div><div class="desc">${desc}</div></div></div>
  <div class="stats"><span class="stat">Star ${fmtNum(repo.stargazers_count)}</span><span class="stat">Fork ${fmtNum(repo.forks_count)}</span><span class="stat">Issues ${fmtNum(repo.open_issues_count)}</span><span class="stat">Branch ${esc(repo.default_branch)}</span>${repo.language ? `<span class="stat"><span class="dot"></span>${esc(repo.language)}</span>` : ""}${repo.license?.name ? `<span class="stat">${esc(repo.license.name)}</span>` : ""}</div>
  ${topics ? `<div class="topics">${topics}</div>` : ""}${readmeHTML}
  <div class="foot">GitHub Repo Card ${SVG.sep} ${new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}</div>
</div></body></html>`;
}

const USER_EVENT_MAP: Record<string, { icon: string; color: string }> = {
  PushEvent: { icon: SVG.commit, color: "#3fb950" },
  CreateEvent: { icon: SVG.commit, color: "#58a6ff" },
  DeleteEvent: { icon: SVG.commit, color: "#f85149" },
  IssuesEvent: { icon: SVG.issue, color: "#8957e5" },
  IssueCommentEvent: { icon: SVG.comment, color: "#58a6ff" },
  PullRequestEvent: { icon: SVG.pr, color: "#db6d28" },
  PullRequestReviewEvent: { icon: SVG.pr, color: "#db6d28" },
  PullRequestReviewCommentEvent: { icon: SVG.comment, color: "#db6d28" },
  WatchEvent: { icon: SVG.commit, color: "#e3b341" },
  ForkEvent: { icon: SVG.commit, color: "#58a6ff" },
  ReleaseEvent: { icon: SVG.commit, color: "#3fb950" },
};

export function userActivityHTML(username: string, items: UserActivityItem[]): string {
  const t = getTheme();
  const showItems = items.slice(0, 20);
  const restItems = items.length - showItems.length;
  const rows = showItems.map((item) => {
    const ev = USER_EVENT_MAP[item.type] || { icon: SVG.commit, color: t.textSub };
    const time = fmtTime(item.time);
    return `<div class="item">
  <div class="item-header">
    <span class="header-icon" style="display:inline-flex;align-items:center">${ev.icon}</span>
    <span style="color:${ev.color};font-weight:500;font-size:12px">${esc(item.type.replace("Event", ""))}</span>
    <span style="color:${t.textSub};font-size:12px">${esc(item.repo)}</span>
    <span class="time">${time}</span>
  </div>
  <div class="msg">${esc(truncate(item.desc, 120))}</div>
</div>`;
  }).join("");

  const extra = restItems > 0 ? `<div class="diff-more">还有 ${restItems} 条动态</div>` : "";
  const userIcon = `<svg width="20" height="20" viewBox="0 0 16 16" fill="#58a6ff"><path d="M10.561 8.073a6.005 6.005 0 0 1 3.432 5.142.75.75 0 1 1-1.498.07 4.5 4.5 0 0 0-8.99 0 .75.75 0 0 1-1.498-.07 6.004 6.004 0 0 1 3.431-5.142 3.999 3.999 0 1 1 5.123 0ZM10.5 5a2.5 2.5 0 1 0-5 0 2.5 2.5 0 0 0 5 0Z"/></svg>`;
  return wrapHTML(username, `${username} 动态`, "#58a6ff", userIcon, items.length, rows + extra);
}

export { USER_EVENT_MAP };
