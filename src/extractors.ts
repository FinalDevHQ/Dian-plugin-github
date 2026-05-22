import type { GitHubEvent, CommitData, IssueData, CommentData, UserActivityItem } from "./types.js";

export function extractCommits(events: GitHubEvent[], branch: string): CommitData[] {
  const commits: CommitData[] = [];
  for (const ev of events) {
    if (ev.type !== "PushEvent") continue;
    const ref = ev.payload.ref as string || "";
    if (branch && !ref.endsWith(`/${branch}`)) continue;
    const payloadCommits = ev.payload.commits as any[] || [];
    if (payloadCommits.length) {
      for (const c of payloadCommits) {
        commits.push({
          sha: c.sha,
          commit: {
            message: c.message || "",
            author: { name: c.author?.name || ev.actor.login, date: ev.created_at },
            committer: { name: c.author?.name || ev.actor.login, date: ev.created_at },
          },
          author: { login: ev.actor.login, avatar_url: ev.actor.avatar_url },
          html_url: `https://github.com/${ev.payload.repo || ""}/commit/${c.sha}`,
        });
      }
    } else if (ev.payload.head) {
      const sha = ev.payload.head as string;
      commits.push({
        sha,
        commit: {
          message: `Push to ${ref.replace("refs/heads/", "")}`,
          author: { name: ev.actor.login, date: ev.created_at },
          committer: { name: ev.actor.login, date: ev.created_at },
        },
        author: { login: ev.actor.login, avatar_url: ev.actor.avatar_url },
        html_url: `https://github.com/${ev.payload.repo || ""}/commit/${sha}`,
      });
    }
  }
  return commits;
}

export function extractIssues(events: GitHubEvent[]): IssueData[] {
  const issues: IssueData[] = [];
  const seen = new Set<number>();
  for (const ev of events) {
    if (ev.type !== "IssuesEvent") continue;
    const i = ev.payload.issue as any;
    if (!i || seen.has(i.number)) continue;
    seen.add(i.number);
    issues.push({
      number: i.number,
      title: i.title || "",
      state: i.state || "open",
      user: { login: i.user?.login || ev.actor.login, avatar_url: i.user?.avatar_url || "" },
      created_at: i.created_at || ev.created_at,
      updated_at: i.updated_at || ev.created_at,
      html_url: i.html_url || "",
      body: i.body || null,
      labels: (i.labels || []).map((l: any) => ({ name: l.name || "", color: l.color || "888888" })),
      action: ev.payload.action as string || undefined,
    });
  }
  return issues;
}

export function extractPulls(events: GitHubEvent[]): IssueData[] {
  const pulls: IssueData[] = [];
  const seen = new Set<number>();
  for (const ev of events) {
    if (ev.type !== "PullRequestEvent") continue;
    const p = ev.payload.pull_request as any;
    if (!p || seen.has(p.number)) continue;
    seen.add(p.number);
    pulls.push({
      number: p.number,
      title: p.title || "",
      state: p.merged ? "merged" : (p.state || "open"),
      user: { login: p.user?.login || ev.actor.login, avatar_url: p.user?.avatar_url || "" },
      created_at: p.created_at || ev.created_at,
      updated_at: p.updated_at || ev.created_at,
      html_url: p.html_url || "",
      body: p.body || null,
      labels: (p.labels || []).map((l: any) => ({ name: l.name || "", color: l.color || "888888" })),
      action: p.merged ? "merged" : (ev.payload.action as string || undefined),
      pull_request: true,
    });
  }
  return pulls;
}

export function extractComments(events: GitHubEvent[]): CommentData[] {
  const comments: CommentData[] = [];
  const seen = new Set<string>();
  for (const ev of events) {
    if (ev.type !== "IssueCommentEvent" && ev.type !== "PullRequestReviewCommentEvent") continue;
    const comment = ev.payload.comment as any;
    if (!comment) continue;
    const key = String(comment.id);
    if (seen.has(key)) continue;
    seen.add(key);
    const issue = ev.payload.issue as any;
    const pr = ev.payload.pull_request as any;
    const target = issue || pr;
    comments.push({
      number: target?.number || 0,
      title: target?.title || "",
      body: comment.body || "",
      user: { login: comment.user?.login || ev.actor.login, avatar_url: comment.user?.avatar_url || "" },
      created_at: comment.created_at || ev.created_at,
      html_url: comment.html_url || "",
      source: ev.type === "PullRequestReviewCommentEvent" ? "pull_request" : "issue",
    });
  }
  return comments;
}

export function extractUserActivity(events: GitHubEvent[], _username: string): UserActivityItem[] {
  const items: UserActivityItem[] = [];
  for (const ev of events) {
    const repo = (ev.payload as any).repo?.name || (ev as any).repo?.name || "";
    let desc = "";
    switch (ev.type) {
      case "PushEvent": {
        const commits = (ev.payload.commits as any[]) || [];
        const count = ev.payload.size || ev.payload.distinct_size || commits.length || 1;
        const msg = commits[0]?.message?.split("\n")[0] || "";
        desc = `推送 ${count} 个 commit` + (msg ? `: ${msg}` : "");
        break;
      }
      case "CreateEvent":
        desc = `创建 ${ev.payload.ref_type || "repository"}` + (ev.payload.ref ? ` ${ev.payload.ref}` : "");
        break;
      case "DeleteEvent":
        desc = `删除 ${ev.payload.ref_type || ""} ${ev.payload.ref || ""}`;
        break;
      case "IssuesEvent": {
        const issue = ev.payload.issue as any;
        desc = `${ev.payload.action || ""} Issue #${issue?.number || ""}: ${issue?.title || ""}`;
        break;
      }
      case "IssueCommentEvent": {
        const issue = ev.payload.issue as any;
        const body = (ev.payload.comment as any)?.body || "";
        desc = `评论 #${issue?.number || ""}: ${body.replace(/\n/g, " ")}`;
        break;
      }
      case "PullRequestEvent": {
        const pr = ev.payload.pull_request as any;
        desc = `${ev.payload.action || ""} PR #${pr?.number || ""}: ${pr?.title || ""}`;
        break;
      }
      case "PullRequestReviewEvent": {
        const pr = ev.payload.pull_request as any;
        desc = `Review PR #${pr?.number || ""}: ${pr?.title || ""}`;
        break;
      }
      case "PullRequestReviewCommentEvent": {
        const pr = ev.payload.pull_request as any;
        const body = (ev.payload.comment as any)?.body || "";
        desc = `评论 PR #${pr?.number || ""}: ${body.replace(/\n/g, " ")}`;
        break;
      }
      case "WatchEvent":
        desc = "Star 了仓库";
        break;
      case "ForkEvent":
        desc = "Fork 了仓库";
        break;
      case "ReleaseEvent": {
        const rel = ev.payload.release as any;
        desc = `${ev.payload.action || ""} Release ${rel?.tag_name || ""}`;
        break;
      }
      default:
        desc = ev.type.replace("Event", "");
    }
    items.push({ type: ev.type, repo, desc, time: ev.created_at, url: "" });
  }
  return items;
}
