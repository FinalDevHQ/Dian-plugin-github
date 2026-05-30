import type { EventContext } from "@myfinal/plugin-runtime";
import type { PluginConfig, Subscription, UserSubscription } from "./types.js";
import { pluginState } from "./state.js";
import { fetchDefaultBranch, fetchRepoInfo, fetchReadme } from "./github.js";
import { renderRepoCard, repoSummary } from "./render/index.js";
import { cleanupUserEvents } from "./poller.js";

export function extractMessageText(ctx: EventContext): string {
  const payload = ctx.event.payload as Record<string, unknown>;
  if (typeof payload.text === "string") return payload.text;
  if (typeof payload.message === "string") return payload.message;
  if (Array.isArray(payload.message)) {
    return (payload.message as Array<{ type?: string; data?: { text?: string } }>)
      .filter((seg) => seg.type === "text")
      .map((seg) => seg.data?.text || "")
      .join("");
  }
  return "";
}

export function extractGitHubRepo(text: string): string | null {
  const match = text.match(/https?:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)(?:[\s/?#.)，。；,;!！]|$)/i);
  if (!match) return null;
  const owner = match[1];
  const repo = match[2].replace(/\.git$/i, "");
  if (!owner || !repo) return null;
  return `${owner}/${repo}`.toLowerCase();
}

async function setEmoji(ctx: EventContext, emojiId: string, set: boolean): Promise<void> {
  const messageId = ctx.event.payload.messageId;
  if (!messageId) return;
  await ctx.sendAction("set_msg_emoji_like", {
    message_id: Number(messageId),
    emoji_id: emojiId,
    set,
  }).catch(() => {});
}

export async function autoDetectRepoLink(ctx: EventContext, text: string, config: PluginConfig): Promise<void> {
  const repo = extractGitHubRepo(text);
  if (!repo) return;
  pluginState.debug(`[自动识别] 检测到 GitHub 仓库链接: ${repo}`);

  if (config.enablePreReply) {
    await setEmoji(ctx, config.preReplyEmojiId || "178", true);
  }

  const [info, readme] = await Promise.all([fetchRepoInfo(repo), fetchReadme(repo)]);
  if (!info) {
    pluginState.debug(`[自动识别] 获取仓库信息失败: ${repo}`);
    if (config.enablePreReply) {
      await setEmoji(ctx, config.failEmojiId || "14", true);
    }
    return;
  }
  const groupId = ctx.event.payload.groupId ? String(ctx.event.payload.groupId) : "";
  const already = config.subscriptions.some((s) => s.repo === repo && (!groupId || s.groups.includes(groupId)));
  const hint = already ? "当前群已在该仓库的推送列表中" : `发送 gh 订阅 ${repo} ${info.default_branch} 可订阅到当前群`;
  const fallback = `${repoSummary(info)}\n${hint}`;
  const base64 = await renderRepoCard(info, readme);

  if (config.enablePreReply) {
    await setEmoji(ctx, config.successEmojiId || "277", true);
  }

  if (base64) {
    const message = [
      { type: "image", data: { file: `base64://${base64}` } },
      { type: "text", data: { text: `\n${hint}` } },
    ];
    if (groupId) {
      await ctx.sendAction("send_group_msg", { group_id: groupId, message });
    } else if (ctx.event.payload.userId) {
      await ctx.sendAction("send_private_msg", { user_id: String(ctx.event.payload.userId), message });
    } else {
      await ctx.reply(fallback);
    }
    return;
  }
  await ctx.reply(fallback);
}

export async function handleCommand(
  ctx: EventContext,
  text: string,
  config: PluginConfig,
  syncConfig: () => void,
): Promise<void> {
  const parts = text.trim().split(/\s+/);
  const sub = parts[1];

  switch (sub) {
    case undefined:
    case "帮助":
      await cmdHelp(ctx);
      break;
    case "订阅":
      await cmdSubscribe(ctx, parts.slice(2), config, syncConfig);
      break;
    case "取消":
      await cmdUnsubscribe(ctx, parts.slice(2), config, syncConfig);
      break;
    case "列表":
      await cmdList(ctx, config);
      break;
    case "全部":
      await cmdListAll(ctx, config);
      break;
    case "开启":
      await cmdToggle(ctx, parts.slice(2), true, config, syncConfig);
      break;
    case "关闭":
      await cmdToggle(ctx, parts.slice(2), false, config, syncConfig);
      break;
    case "关注":
      await cmdFollow(ctx, parts.slice(2), config, syncConfig);
      break;
    case "取关":
      await cmdUnfollow(ctx, parts.slice(2), config, syncConfig);
      break;
    case "关注列表":
      await cmdFollowList(ctx, config);
      break;
    case "管理员":
      await handleAdminCommand(ctx, parts.slice(2), config, syncConfig);
      break;
    default:
      await ctx.reply(`未知指令: ${sub}\n输入 gh 帮助 查看所有指令`);
  }
}

export async function cmdHelp(ctx: EventContext): Promise<void> {
  await ctx.reply(
    `🐙 GitHub 订阅指令:\n` +
    `gh 订阅 <owner/repo> [branch] - 订阅仓库\n` +
    `gh 取消 <owner/repo> [branch] - 取消订阅（需管理员权限）\n` +
    `gh 列表 - 查看当前群订阅\n` +
    `gh 全部 - 查看所有订阅\n` +
    `gh 开启 <owner/repo> [branch] - 启用订阅\n` +
    `gh 关闭 <owner/repo> [branch] - 禁用订阅\n` +
    `gh 关注 <username> - 关注用户\n` +
    `gh 取关 <username> - 取消关注（需管理员权限）\n` +
    `gh 关注列表 - 查看关注列表\n` +
    `gh 管理员 帮助 - 查看管理员命令`
  );
}

async function cmdSubscribe(ctx: EventContext, args: string[], config: PluginConfig, syncConfig: () => void): Promise<void> {
  if (!args.length) {
    await ctx.reply("用法: gh 订阅 <owner/repo> [branch]");
    return;
  }
  const repo = args[0].toLowerCase();
  if (!repo.includes("/")) {
    await ctx.reply("仓库格式错误，请使用 owner/repo");
    return;
  }
  const groupId = ctx.event.payload.groupId || "";

  let branch = args[1];
  if (!branch) {
    try {
      branch = await fetchDefaultBranch(repo);
    } catch {
      branch = "main";
    }
  }

  const existing = config.subscriptions.find(
    (s) => s.repo === repo && s.branch === branch,
  );
  if (existing) {
    if (groupId && !existing.groups.includes(groupId)) {
      existing.groups.push(groupId);
      syncConfig();
      await ctx.reply(`已将 ${repo}(${branch}) 添加到当前群推送列表`);
    } else {
      await ctx.reply(`当前群已订阅 ${repo}(${branch})`);
    }
    return;
  }

  const sub: Subscription = {
    botId: ctx.event.botId,
    repo,
    branch,
    types: ["commits", "issues", "pulls"],
    groups: groupId ? [groupId] : [],
    enabled: true,
    createdAt: new Date().toISOString(),
  };
  config.subscriptions.push(sub);
  syncConfig();
  await ctx.reply(`✅ 已订阅 ${repo}(${branch})`);
}

async function cmdUnsubscribe(ctx: EventContext, args: string[], config: PluginConfig, syncConfig: () => void): Promise<void> {
  if (!args.length) {
    await ctx.reply("用法: gh 取消 <owner/repo> [branch]");
    return;
  }

  // 权限检查
  if (!(await hasUnsubPermission(ctx, config))) {
    await ctx.reply("❌ 权限不足，只有管理员才能取消订阅");
    return;
  }

  const repo = args[0].toLowerCase();
  const branch = args[1];
  const groupId = ctx.event.payload.groupId;

  const sub = config.subscriptions.find(
    (s) => s.repo === repo && (!branch || s.branch === branch),
  );
  if (!sub) {
    await ctx.reply("未找到该订阅");
    return;
  }

  if (groupId) {
    sub.groups = sub.groups.filter((g) => g !== groupId);
    if (sub.groups.length === 0) {
      config.subscriptions = config.subscriptions.filter(
        (s) => !(s.repo === repo && (!branch || s.branch === branch)),
      );
    }
  } else {
    config.subscriptions = config.subscriptions.filter(
      (s) => !(s.repo === repo && (!branch || s.branch === branch)),
    );
  }
  syncConfig();
  await ctx.reply(`✅ 已取消订阅 ${repo}${branch ? `(${branch})` : ""}`);
}

async function cmdList(ctx: EventContext, config: PluginConfig): Promise<void> {
  const groupId = ctx.event.payload.groupId;
  const subs = groupId
    ? config.subscriptions.filter((s) => s.groups.includes(groupId))
    : config.subscriptions;

  if (!subs.length) {
    await ctx.reply(groupId ? "当前群暂无订阅" : "暂无订阅");
    return;
  }

  const lines = subs.map((s) =>
    `${s.enabled ? "🟢" : "🔴"} ${s.repo} (${s.branch}) [${s.types.join(", ")}]`,
  );
  await ctx.reply(`📋 订阅列表:\n${lines.join("\n")}`);
}

async function cmdListAll(ctx: EventContext, config: PluginConfig): Promise<void> {
  const subs = config.subscriptions;
  const userSubs = config.userSubscriptions;

  if (!subs.length && !userSubs.length) {
    await ctx.reply("暂无订阅");
    return;
  }

  const lines: string[] = [];
  if (subs.length) {
    lines.push("📦 仓库订阅:");
    for (const s of subs) {
      lines.push(`  ${s.enabled ? "🟢" : "🔴"} ${s.repo} (${s.branch}) [${s.types.join(", ")}]`);
    }
  }
  if (userSubs.length) {
    lines.push("👤 用户关注:");
    for (const u of userSubs) {
      lines.push(`  ${u.enabled ? "🟢" : "🔴"} ${u.username}`);
    }
  }
  await ctx.reply(lines.join("\n"));
}

async function cmdToggle(ctx: EventContext, args: string[], enabled: boolean, config: PluginConfig, syncConfig: () => void): Promise<void> {
  if (!args.length) {
    await ctx.reply(`用法: gh ${enabled ? "开启" : "关闭"} <owner/repo> [branch]`);
    return;
  }
  const repo = args[0].toLowerCase();
  const branch = args[1];

  const sub = config.subscriptions.find(
    (s) => s.repo === repo && (!branch || s.branch === branch),
  );
  if (!sub) {
    await ctx.reply("未找到该订阅");
    return;
  }
  sub.enabled = enabled;
  syncConfig();
  await ctx.reply(`✅ 已${enabled ? "开启" : "关闭"} ${repo}${branch ? `(${branch})` : ""}`);
}

async function cmdFollow(ctx: EventContext, args: string[], config: PluginConfig, syncConfig: () => void): Promise<void> {
  if (!args.length) {
    await ctx.reply("用法: gh 关注 <username>");
    return;
  }
  const username = args[0];
  const groupId = ctx.event.payload.groupId || "";

  const existing = config.userSubscriptions.find(
    (u) => u.username.toLowerCase() === username.toLowerCase(),
  );
  if (existing) {
    if (groupId && !existing.groups.includes(groupId)) {
      existing.groups.push(groupId);
      syncConfig();
      await ctx.reply(`已将 ${username} 添加到当前群推送列表`);
    } else {
      await ctx.reply(`当前群已关注 ${username}`);
    }
    return;
  }

  const userSub: UserSubscription = {
    botId: ctx.event.botId,
    username,
    groups: groupId ? [groupId] : [],
    enabled: true,
    createdAt: new Date().toISOString(),
  };
  config.userSubscriptions.push(userSub);
  syncConfig();
  await ctx.reply(`✅ 已关注 ${username}`);
}

async function cmdUnfollow(ctx: EventContext, args: string[], config: PluginConfig, syncConfig: () => void): Promise<void> {
  if (!args.length) {
    await ctx.reply("用法: gh 取关 <username>");
    return;
  }

  // 权限检查
  if (!(await hasUnsubPermission(ctx, config))) {
    await ctx.reply("❌ 权限不足，只有管理员才能取消关注");
    return;
  }

  const username = args[0];
  const groupId = ctx.event.payload.groupId;

  const sub = config.userSubscriptions.find(
    (u) => u.username.toLowerCase() === username.toLowerCase(),
  );
  if (!sub) {
    await ctx.reply("未找到该关注");
    return;
  }

  if (groupId) {
    sub.groups = sub.groups.filter((g) => g !== groupId);
    if (sub.groups.length === 0) {
      config.userSubscriptions = config.userSubscriptions.filter(
        (u) => u.username.toLowerCase() !== username.toLowerCase(),
      );
      cleanupUserEvents(username);
    }
  } else {
    config.userSubscriptions = config.userSubscriptions.filter(
      (u) => u.username.toLowerCase() !== username.toLowerCase(),
    );
    cleanupUserEvents(username);
  }
  syncConfig();
  await ctx.reply(`✅ 已取消关注 ${username}`);
}

async function cmdFollowList(ctx: EventContext, config: PluginConfig): Promise<void> {
  const groupId = ctx.event.payload.groupId;
  const subs = groupId
    ? config.userSubscriptions.filter((u) => u.groups.includes(groupId))
    : config.userSubscriptions;

  if (!subs.length) {
    await ctx.reply(groupId ? "当前群暂无关注" : "暂无关注");
    return;
  }

  const lines = subs.map((u) => `${u.enabled ? "🟢" : "🔴"} ${u.username}`);
  await ctx.reply(`📋 关注列表:\n${lines.join("\n")}`);
}

// ── 权限检查函数 ──

async function getGroupMemberInfo(ctx: EventContext, groupId: string, userId: string): Promise<{ role: string } | null> {
  try {
    const result = await ctx.sendAction("get_group_member_info", {
      group_id: groupId,
      user_id: userId,
      no_cache: false,
    });
    if (result?.data) {
      return result.data as { role: string };
    }
  } catch {}
  return null;
}

export async function hasUnsubPermission(ctx: EventContext, config: PluginConfig): Promise<boolean> {
  const userId = String(ctx.event.payload.userId);
  const groupId = ctx.event.payload.groupId ? String(ctx.event.payload.groupId) : "";

  // 1. 大管理员 - 全局权限
  if (config.adminConfig?.superAdmins?.includes(userId)) {
    return true;
  }

  // 2. 普通管理员 - 全局权限
  if (config.adminConfig?.admins?.includes(userId)) {
    return true;
  }

  // 3. 群管理员 - 仅限本群
  if (groupId) {
    const memberInfo = await getGroupMemberInfo(ctx, groupId, userId);
    if (memberInfo && (memberInfo.role === 'owner' || memberInfo.role === 'admin')) {
      return true;
    }
  }

  return false;
}

// ── 管理员命令 ──

export async function handleAdminCommand(
  ctx: EventContext,
  args: string[],
  config: PluginConfig,
  syncConfig: () => void,
): Promise<void> {
  const sub = args[0];
  const targetUserId = args[1]?.replace(/[@]/g, "");

  switch (sub) {
    case "添加":
      await cmdAdminAdd(ctx, targetUserId, config, syncConfig);
      break;
    case "删除":
      await cmdAdminRemove(ctx, targetUserId, config, syncConfig);
      break;
    case "列表":
      await cmdAdminList(ctx, config);
      break;
    case "帮助":
    default:
      await cmdAdminHelp(ctx);
      break;
  }
}

async function cmdAdminAdd(ctx: EventContext, targetUserId: string, config: PluginConfig, syncConfig: () => void): Promise<void> {
  if (!targetUserId) {
    await ctx.reply("用法: gh 管理员 添加 @用户");
    return;
  }

  // 只有大管理员可以添加普通管理员
  const userId = String(ctx.event.payload.userId);
  if (!config.adminConfig?.superAdmins?.includes(userId)) {
    await ctx.reply("❌ 权限不足，只有大管理员才能添加普通管理员");
    return;
  }

  if (!config.adminConfig) {
    config.adminConfig = { superAdmins: [], admins: [] };
  }
  if (!config.adminConfig.admins) {
    config.adminConfig.admins = [];
  }

  if (config.adminConfig.admins.includes(targetUserId)) {
    await ctx.reply(`用户 ${targetUserId} 已经是管理员`);
    return;
  }

  config.adminConfig.admins.push(targetUserId);
  syncConfig();
  await ctx.reply(`✅ 已将 ${targetUserId} 添加为普通管理员`);
}

async function cmdAdminRemove(ctx: EventContext, targetUserId: string, config: PluginConfig, syncConfig: () => void): Promise<void> {
  if (!targetUserId) {
    await ctx.reply("用法: gh 管理员 删除 @用户");
    return;
  }

  // 只有大管理员可以删除普通管理员
  const userId = String(ctx.event.payload.userId);
  if (!config.adminConfig?.superAdmins?.includes(userId)) {
    await ctx.reply("❌ 权限不足，只有大管理员才能删除普通管理员");
    return;
  }

  if (!config.adminConfig?.admins?.includes(targetUserId)) {
    await ctx.reply(`用户 ${targetUserId} 不是管理员`);
    return;
  }

  config.adminConfig.admins = config.adminConfig.admins.filter(id => id !== targetUserId);
  syncConfig();
  await ctx.reply(`✅ 已将 ${targetUserId} 从管理员列表中移除`);
}

async function cmdAdminList(ctx: EventContext, config: PluginConfig): Promise<void> {
  const superAdmins = config.adminConfig?.superAdmins || [];
  const admins = config.adminConfig?.admins || [];

  let msg = "👑 管理员列表:\n\n";
  msg += "大管理员:\n";
  msg += superAdmins.length ? superAdmins.map(id => `  - ${id}`).join("\n") : "  (无)\n";
  msg += "\n普通管理员:\n";
  msg += admins.length ? admins.map(id => `  - ${id}`).join("\n") : "  (无)";

  await ctx.reply(msg);
}

async function cmdAdminHelp(ctx: EventContext): Promise<void> {
  await ctx.reply(
    "🔧 管理员命令:\n" +
    "gh 管理员 添加 @用户 - 添加普通管理员\n" +
    "gh 管理员 删除 @用户 - 删除普通管理员\n" +
    "gh 管理员 列表 - 查看管理员列表\n" +
    "gh 管理员 帮助 - 查看此帮助"
  );
}
