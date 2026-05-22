import type {
  GitHubEvent, CommitData, IssueData, CommentData, ActionRunData,
  EventType, UserActivityItem,
} from "./types.js";
import { pluginState } from "./state.js";
import { fetchEvents, fetchCommitDetail, fetchActionRuns, fetchUserEvents } from "./github.js";
import {
  renderCommits, renderIssues, renderPulls, renderComments, renderActions,
  commitsSummary, issuesSummary, commentsSummary, actionsSummary,
  renderUserActivity, userActivitySummary,
  renderMergedRepo, mergedRepoSummary,
  renderMergedUsers, mergedUsersSummary,
} from "./render/index.js";
import {
  extractCommits, extractIssues, extractPulls, extractComments, extractUserActivity,
} from "./extractors.js";

async function sendImage(groupId: string, base64: string | null, fallbackText: string): Promise<void> {
  if (base64) {
    try {
      pluginState.debug(`[推送] 发送图片到群 ${groupId}，base64 长度: ${base64.length}`);
      await pluginState.sendGroupMsg(groupId, [
        { type: "image", data: { file: `base64://${base64}` } },
      ]);
      pluginState.debug(`[推送] 图片发送成功: 群 ${groupId}`);
      return;
    } catch (e) {
      pluginState.debug(`[推送] 图片发送失败: 群 ${groupId}，错误: ${e}，降级为文本`);
    }
  } else {
    pluginState.debug(`[推送] 渲染失败，使用文本降级: 群 ${groupId}`);
  }
  await pluginState.sendGroupMsg(groupId, [{ type: "text", data: { text: fallbackText } }]);
}

interface RepoCollected {
  repo: string;
  groups: string[];
  commits: CommitData[];
  issues: IssueData[];
  pulls: IssueData[];
  comments: CommentData[];
  actions: ActionRunData[];
}

interface UserCollected {
  username: string;
  groups: string[];
  items: UserActivityItem[];
}

async function checkRepo(
  repo: string, branch: string, types: EventType[],
  groups: string[], collect?: boolean,
): Promise<RepoCollected | null> {
  const cacheKey = `${repo}:${branch}`;
  const collected: RepoCollected = { repo, groups, commits: [], issues: [], pulls: [], comments: [], actions: [] };
  pluginState.debug(`[轮询] 检查仓库: ${repo} (分支: ${branch}, 类型: ${types.join(",")})`);

  const events = await fetchEvents(repo);
  if (!events.length) {
    pluginState.debug(`[轮询] ${repo}: 无事件，跳过`);
    return null;
  }

  const latestId = events[0].id;
  const lastKnown = pluginState.cache[cacheKey];

  pluginState.debug(`[轮询] ${repo}: 最新事件 ID=${latestId}, 缓存 ID=${lastKnown || "无"}`);

  if (!lastKnown) {
    pluginState.cache[cacheKey] = latestId;
    pluginState.saveCache();
    pluginState.log("info", `[${repo}] 首次运行，记录最新事件 ID: ${latestId}，不推送`);
    return null;
  }

  if (lastKnown === latestId) {
    pluginState.debug(`[轮询] ${repo}: 无更新`);
    return null;
  }

  const lastIdx = events.findIndex((e) => e.id === lastKnown);
  const newEvents = lastIdx > 0 ? events.slice(0, lastIdx) : events.slice(0, 10);

  if (!newEvents.length) {
    pluginState.debug(`[轮询] ${repo}: 新事件列表为空，跳过`);
    return null;
  }

  pluginState.cache[cacheKey] = latestId;
  pluginState.saveCache();

  const eventTypes = [...new Set(newEvents.map((e) => e.type))];
  pluginState.log("info", `[${repo}] 发现 ${newEvents.length} 条新事件: ${eventTypes.join(", ")}`);

  if (types.includes("commits")) {
    const commits = extractCommits(newEvents, branch);
    pluginState.debug(`[轮询] ${repo}: 提取到 ${commits.length} 条 Commit`);
    if (commits.length) {
      await Promise.all(commits.map(async (c) => {
        try {
          const detail = await fetchCommitDetail(repo, c.sha);
          if (detail?.files) {
            c.files = detail.files.map((f: any) => ({
              filename: f.filename || "", status: f.status || "",
              additions: f.additions || 0, deletions: f.deletions || 0,
              patch: f.patch || undefined,
            }));
          }
          if (detail?.commit?.message && c.commit.message.startsWith("Push to ")) {
            c.commit.message = detail.commit.message;
          }
        } catch { /* ignore */ }
      }));
      if (collect) { collected.commits = commits; } else {
        pluginState.log("info", `[${repo}] 推送 ${commits.length} 条新 Commit 到 ${groups.length} 个群`);
        const base64 = await renderCommits(repo, commits);
        const fallback = commitsSummary(repo, commits);
        for (const gid of groups) await sendImage(gid, base64, fallback);
      }
    }
  }

  if (types.includes("issues")) {
    const issues = extractIssues(newEvents);
    pluginState.debug(`[轮询] ${repo}: 提取到 ${issues.length} 条 Issue`);
    if (issues.length) {
      if (collect) { collected.issues = issues; } else {
        pluginState.log("info", `[${repo}] 推送 ${issues.length} 条新 Issue 到 ${groups.length} 个群`);
        const base64 = await renderIssues(repo, issues);
        const fallback = issuesSummary(repo, issues, "Issues");
        for (const gid of groups) await sendImage(gid, base64, fallback);
      }
    }
  }

  if (types.includes("pulls")) {
    const pulls = extractPulls(newEvents);
    pluginState.debug(`[轮询] ${repo}: 提取到 ${pulls.length} 条 PR`);
    if (pulls.length) {
      if (collect) { collected.pulls = pulls; } else {
        pluginState.log("info", `[${repo}] 推送 ${pulls.length} 条新 PR 到 ${groups.length} 个群`);
        const base64 = await renderPulls(repo, pulls);
        const fallback = issuesSummary(repo, pulls, "Pull Requests");
        for (const gid of groups) await sendImage(gid, base64, fallback);
      }
    }
  }

  const wantIssueComments = types.includes("issues");
  const wantPrComments = types.includes("pulls");
  if (wantIssueComments || wantPrComments) {
    let comments = extractComments(newEvents);
    if (!wantIssueComments) comments = comments.filter((c) => c.source === "pull_request");
    if (!wantPrComments) comments = comments.filter((c) => c.source === "issue");
    pluginState.debug(`[轮询] ${repo}: 提取到 ${comments.length} 条评论`);
    if (comments.length) {
      if (collect) { collected.comments = comments; } else {
        pluginState.log("info", `[${repo}] 推送 ${comments.length} 条新评论到 ${groups.length} 个群`);
        const base64 = await renderComments(repo, comments);
        const fallback = commentsSummary(repo, comments);
        for (const gid of groups) await sendImage(gid, base64, fallback);
      }
    }
  }

  if (types.includes("actions")) {
    const actionsCacheKey = `${repo}:actions`;
    pluginState.debug(`[轮询] ${repo}: 检查 Actions runs`);
    const runs = await fetchActionRuns(repo);
    if (runs.length) {
      const latestRunId = String(runs[0].id);
      const lastKnownRun = pluginState.cache[actionsCacheKey];
      if (!lastKnownRun) {
        pluginState.cache[actionsCacheKey] = latestRunId;
        pluginState.saveCache();
        pluginState.log("info", `[${repo}] Actions 首次运行，记录最新 run ID: ${latestRunId}`);
      } else if (lastKnownRun !== latestRunId) {
        const lastRunIdx = runs.findIndex((r) => String(r.id) === lastKnownRun);
        const newRuns: ActionRunData[] = (lastRunIdx > 0 ? runs.slice(0, lastRunIdx) : runs.slice(0, 10)).map((r: any) => ({
          id: r.id, name: r.name || r.display_title || "", head_branch: r.head_branch || "",
          head_sha: r.head_sha || "", status: r.status || "", conclusion: r.conclusion || null,
          html_url: r.html_url || "", created_at: r.created_at || "", updated_at: r.updated_at || "",
          actor: { login: r.actor?.login || "", avatar_url: r.actor?.avatar_url || "" },
          event: r.event || "", run_number: r.run_number || 0,
        }));
        pluginState.cache[actionsCacheKey] = latestRunId;
        pluginState.saveCache();
        if (newRuns.length) {
          if (collect) { collected.actions = newRuns; } else {
            pluginState.log("info", `[${repo}] 推送 ${newRuns.length} 条 Actions 更新到 ${groups.length} 个群`);
            const base64 = await renderActions(repo, newRuns);
            const fallback = actionsSummary(repo, newRuns);
            for (const gid of groups) await sendImage(gid, base64, fallback);
          }
        }
      }
    }
  }

  if (collect) {
    const hasData = collected.commits.length || collected.issues.length || collected.pulls.length || collected.comments.length || collected.actions.length;
    return hasData ? collected : null;
  }
  return null;
}

const sentUserEventIds = new Map<string, Set<string>>();

async function checkUser(username: string, groups: string[], collect?: boolean): Promise<UserCollected | null> {
  const cacheKey = `user:${username}`;
  pluginState.debug(`[轮询] 检查用户: ${username}`);

  const events = await fetchUserEvents(username);
  if (!events.length) {
    pluginState.debug(`[轮询] ${username}: 无事件`);
    return null;
  }

  const latestId = events[0].id;
  const lastKnown = pluginState.cache[cacheKey];

  if (!lastKnown) {
    pluginState.cache[cacheKey] = latestId;
    pluginState.saveCache();
    if (!sentUserEventIds.has(username)) sentUserEventIds.set(username, new Set());
    const sent = sentUserEventIds.get(username)!;
    for (const e of events) sent.add(e.id);
    pluginState.log("info", `[${username}] 用户监控首次运行，记录最新事件 ID: ${latestId}`);
    return null;
  }

  if (lastKnown === latestId) {
    pluginState.debug(`[轮询] ${username}: 无更新`);
    return null;
  }

  const lastIdx = events.findIndex((e) => e.id === lastKnown);
  let newEvents: GitHubEvent[];
  if (lastIdx > 0) {
    newEvents = events.slice(0, lastIdx);
  } else if (lastIdx === -1) {
    const lastNum = BigInt(lastKnown);
    newEvents = events.filter((e) => {
      try { return BigInt(e.id) > lastNum; } catch { return false; }
    });
    if (newEvents.length > 5) newEvents = newEvents.slice(0, 5);
  } else {
    return null;
  }

  if (!newEvents.length) return null;

  if (!sentUserEventIds.has(username)) sentUserEventIds.set(username, new Set());
  const sent = sentUserEventIds.get(username)!;
  newEvents = newEvents.filter((e) => !sent.has(e.id));

  pluginState.cache[cacheKey] = latestId;
  pluginState.saveCache();

  if (!newEvents.length) {
    pluginState.debug(`[轮询] ${username}: 新事件已推送过，跳过`);
    return null;
  }

  for (const e of newEvents) sent.add(e.id);
  if (sent.size > 100) {
    const arr = Array.from(sent);
    sentUserEventIds.set(username, new Set(arr.slice(arr.length - 100)));
  }

  const items = extractUserActivity(newEvents, username);
  if (!items.length) return null;

  if (collect) return { username, groups, items };

  pluginState.log("info", `[${username}] 推送 ${items.length} 条用户动态到 ${groups.length} 个群`);
  const base64 = await renderUserActivity(username, items);
  const fallback = userActivitySummary(username, items);
  for (const gid of groups) await sendImage(gid, base64, fallback);
  return null;
}

let polling = false;

export async function poll(): Promise<void> {
  if (polling) {
    pluginState.debug("[定时] 上一次轮询尚未完成，跳过");
    return;
  }
  polling = true;
  try {
    const activeSubs = pluginState.config.subscriptions.filter((s) => s.enabled && s.groups.length);
    const activeUsers = (pluginState.config.userSubscriptions || []).filter((u) => u.enabled && u.groups.length);
    const merge = pluginState.config.mergeNotify;
    pluginState.debug(`[定时] 开始轮询，共 ${activeSubs.length} 个仓库订阅，${activeUsers.length} 个用户监控，合并模式: ${merge}`);
    const start = Date.now();

    const repoResults: RepoCollected[] = [];
    const repoPromises = activeSubs.map(async (sub) => {
      try {
        const result = await checkRepo(sub.repo, sub.branch, sub.types, sub.groups, merge);
        if (merge && result) return result;
      } catch (e) {
        pluginState.log("error", `轮询 ${sub.repo} 失败: ${e}`);
      }
      return null;
    });
    const repoSettled = await Promise.all(repoPromises);
    for (const r of repoSettled) { if (r) repoResults.push(r); }

    const userResults: UserCollected[] = [];
    const userPromises = activeUsers.map(async (userSub) => {
      try {
        const result = await checkUser(userSub.username, userSub.groups, merge);
        if (merge && result) return result;
      } catch (e) {
        pluginState.log("error", `轮询用户 ${userSub.username} 失败: ${e}`);
      }
      return null;
    });
    const userSettled = await Promise.all(userPromises);
    for (const u of userSettled) { if (u) userResults.push(u); }

    if (merge) {
      if (repoResults.length) {
        const groupRepoMap = new Map<string, RepoCollected[]>();
        for (const r of repoResults) {
          for (const gid of r.groups) {
            if (!groupRepoMap.has(gid)) groupRepoMap.set(gid, []);
            groupRepoMap.get(gid)!.push(r);
          }
        }
        for (const [gid, repos] of groupRepoMap) {
          pluginState.log("info", `[合并推送] 仓库更新 ${repos.length} 个仓库 → 群 ${gid}`);
          const base64 = await renderMergedRepo(repos);
          const fallback = mergedRepoSummary(repos);
          await sendImage(gid, base64, fallback);
        }
      }

      if (userResults.length) {
        const groupUserMap = new Map<string, UserCollected[]>();
        for (const u of userResults) {
          for (const gid of u.groups) {
            if (!groupUserMap.has(gid)) groupUserMap.set(gid, []);
            groupUserMap.get(gid)!.push(u);
          }
        }
        for (const [gid, users] of groupUserMap) {
          pluginState.log("info", `[合并推送] 用户动态 ${users.length} 个用户 → 群 ${gid}`);
          const base64 = await renderMergedUsers(users);
          const fallback = mergedUsersSummary(users);
          await sendImage(gid, base64, fallback);
        }
      }
    }

    const ms = Date.now() - start;
    pluginState.debug(`[定时] 轮询完成，耗时 ${ms}ms`);
  } finally {
    polling = false;
  }
}

let startupTimer: ReturnType<typeof setTimeout> | null = null;

export function startPoller(): void {
  const sec = Math.max(pluginState.config.interval || 30, 5);
  const userCount = (pluginState.config.userSubscriptions || []).length;
  pluginState.log("info", `轮询已启动，间隔 ${sec} 秒，共 ${pluginState.config.subscriptions.length} 个仓库订阅，${userCount} 个用户监控`);
  if (startupTimer) clearTimeout(startupTimer);
  startupTimer = setTimeout(() => { startupTimer = null; poll().catch(() => {}); }, 2000);
  pluginState.setPollTimer(setInterval(() => poll().catch(() => {}), sec * 1000));
}

export function stopPoller(): void {
  if (startupTimer) { clearTimeout(startupTimer); startupTimer = null; }
  pluginState.clearPollTimer();
  pluginState.log("info", "轮询已停止");
}
