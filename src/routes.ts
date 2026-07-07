import type { PluginSetupContext, PluginStore } from "@myfinal/plugin-runtime";
import type { PluginConfig, EventType, UserSubscription, Subscription } from "./types.js";
import { pluginState } from "./state.js";
import { PKG_VERSION } from "./version.js";
import { fetchDefaultBranch, fetchBranches } from "./github.js";
import { ProxyAgent } from "undici";

function proxyDispatcher(proxy?: string): ProxyAgent | undefined {
  return proxy ? new ProxyAgent(proxy) : undefined;
}

interface RateLimitResource {
  limit: number;
  used: number;
  remaining: number;
  reset: number;
}

interface RateLimitResponse {
  resources?: Record<string, RateLimitResource>;
  rate?: RateLimitResource;
}

export function setupRoutes(
  ctx: PluginSetupContext,
  config: PluginConfig,
  syncConfig: () => Promise<void>,
  startTime: number,
  ensureStore?: (store: PluginStore) => Promise<void>,
): void {
  const withStore = <TReq extends { pluginStore?: PluginStore }, TReply>(
    handler: (req: TReq, reply: TReply) => unknown | Promise<unknown>,
  ) => async (req: TReq, reply: TReply) => {
    if (ensureStore && req.pluginStore) {
      await ensureStore(req.pluginStore);
    }
    return handler(req, reply);
  };

  // ── GET /config ──
  ctx.route("GET", "/config", withStore((_req, reply) => {
    reply.send({
      success: true,
      version: PKG_VERSION,
      config: {
        token: config.token ? "***" : "",
        tokens: (config.tokens || []).map((t) => (t ? "***" : "")),
        tokenCount:
          (config.tokens || []).filter((t) => t.trim()).length +
          (config.token ? 1 : 0),
        command: config.command,
        reply: config.reply,
        muteCommand: config.muteCommand,
        muteDuration: config.muteDuration,
        apiBase: config.apiBase,
        interval: config.interval,
        debug: config.debug,
        owners: config.owners || [],
        allowMemberSub: config.allowMemberSub ?? true,
        autoDetectRepo: config.autoDetectRepo !== false,
        enablePreReply: (config as any).enablePreReply !== false,
        preReplyEmojiId: (config as any).preReplyEmojiId || "178",
        successEmojiId: (config as any).successEmojiId || "277",
        failEmojiId: (config as any).failEmojiId || "14",
        mergeNotify: config.mergeNotify ?? false,
        puppeteerPlugin: config.puppeteerPlugin || "puppeteer",
        webuiPort: (config as any).webuiPort || 3000,
        proxy: config.proxy || "",
        theme: config.theme || "light",
        customTheme: config.customTheme || null,
        customHTML: config.customHTML || null,
        customCommands: config.customCommands || [],
        adminConfig: config.adminConfig || { superAdmins: [], admins: [] },
      },
      subscriptions: config.subscriptions,
      userSubscriptions: config.userSubscriptions || [],
    });
  }));

  // ── POST /config ──
  ctx.route("POST", "/config", withStore(async (req, reply) => {
    const body = req.body as Record<string, unknown>;
    if (typeof body.command === "string" && body.command.trim()) {
      config.command = body.command.trim();
    }
    if (typeof body.reply === "string" && body.reply.trim()) {
      config.reply = body.reply.trim();
    }
    if (typeof body.muteCommand === "string" && body.muteCommand.trim()) {
      config.muteCommand = body.muteCommand.trim();
    }
    if (typeof body.muteDuration === "number" && body.muteDuration > 0) {
      config.muteDuration = Math.floor(body.muteDuration);
    }
    if (body.token !== undefined && body.token !== "***") {
      config.token = String(body.token);
    }
    if (body.tokens !== undefined) {
      if (body.tokens === null) {
        // UI 发送 null 表示用户明确删除了所有 token
        config.tokens = [];
      } else if (Array.isArray(body.tokens)) {
        // 过滤掉脱敏占位符 "***"；如果过滤后为空但原数组非空，说明 UI 没有修改 token，保持原值
        const cleaned = (body.tokens as string[]).filter(
          (t) => t && t !== "***",
        ).map(String);
        if (cleaned.length > 0 || (config.tokens || []).length === 0) {
          config.tokens = cleaned;
        }
      }
    }
    if (body.apiBase !== undefined) config.apiBase = String(body.apiBase);
    if (body.interval !== undefined) {
      const n = Number(body.interval);
      if (n >= 5) config.interval = n;
    }
    if (body.debug !== undefined) config.debug = Boolean(body.debug);
    if (body.owners !== undefined && Array.isArray(body.owners)) {
      config.owners = (body.owners as string[]).map(String).filter((s) => s.trim());
    }
    if (body.allowMemberSub !== undefined) {
      config.allowMemberSub = Boolean(body.allowMemberSub);
    }
    if (body.autoDetectRepo !== undefined) {
      config.autoDetectRepo = Boolean(body.autoDetectRepo);
    }
    if (body.enablePreReply !== undefined) {
      (config as any).enablePreReply = Boolean(body.enablePreReply);
    }
    if (body.preReplyEmojiId !== undefined) {
      (config as any).preReplyEmojiId = String(body.preReplyEmojiId).trim() || "178";
    }
    if (body.successEmojiId !== undefined) {
      (config as any).successEmojiId = String(body.successEmojiId).trim() || "277";
    }
    if (body.failEmojiId !== undefined) {
      (config as any).failEmojiId = String(body.failEmojiId).trim() || "14";
    }
    if (body.mergeNotify !== undefined) {
      config.mergeNotify = Boolean(body.mergeNotify);
    }
    if (body.puppeteerPlugin !== undefined) {
      const name = String(body.puppeteerPlugin).trim();
      config.puppeteerPlugin = name || "puppeteer";
    }
    if (body.webuiPort !== undefined) {
      const port = Number(body.webuiPort);
      if (Number.isFinite(port) && port > 0 && port <= 65535) {
        (config as any).webuiPort = Math.floor(port);
      }
    }
    if (body.proxy !== undefined) {
      const p = String(body.proxy).trim();
      (config as any).proxy = p || "";
    }
    if (body.theme !== undefined && ["light", "dark", "custom"].includes(String(body.theme))) {
      config.theme = String(body.theme) as "light" | "dark" | "custom";
    }
    if (body.customTheme !== undefined && typeof body.customTheme === "object" && body.customTheme !== null) {
      config.customTheme = body.customTheme as any;
    }
    if (body.customHTML !== undefined && typeof body.customHTML === "object" && body.customHTML !== null) {
      config.customHTML = body.customHTML as any;
    }
    if (body.customCommands !== undefined && Array.isArray(body.customCommands)) {
      config.customCommands = body.customCommands as any;
    }
    await syncConfig();
    const safeConfig = {
      ...config,
      token: config.token ? "***" : "",
      tokens: (config.tokens || []).map((t) => (t ? "***" : "")),
    };
    reply.send({ ok: true, config: safeConfig });
  }));

  // ── GET /status ──
  ctx.route("GET", "/status", (_req, reply) => {
    const uptime = Math.floor((Date.now() - startTime) / 1000);
    reply.send({
      startTime,
      uptime,
      version: PKG_VERSION,
      repoSubscriptions: config.subscriptions.length,
      userSubscriptions: config.userSubscriptions.length,
      config: {
        apiBase: config.apiBase,
        interval: config.interval,
        debug: config.debug,
        theme: config.theme,
      },
    });
  });

  // ── POST /repo/branches ──
  ctx.route("POST", "/repo/branches", async (req, reply) => {
    const repo = ((req.body as any)?.repo as string || "").trim().toLowerCase();
    if (!repo || !repo.includes("/")) {
      reply.send({ success: false, error: "仓库格式错误" });
      return;
    }
    try {
      const branches = await fetchBranches(repo);
      if (!branches.length) {
        reply.send({ success: false, error: "未找到分支，请检查仓库名是否正确" });
        return;
      }
      reply.send({ success: true, data: branches });
    } catch (e) {
      reply.send({ success: false, error: String(e) });
    }
  });

  // ── GET /groups ──
  ctx.route("GET", "/groups", async (req, reply) => {
    const botService = (req as unknown as Record<string, unknown>).botService as
      | { getBot?: () => { sendAction: (request: { action: string; params?: Record<string, unknown> }) => Promise<{ status?: string; ok?: boolean; data?: unknown }> } | undefined }
      | undefined;
    const bot = botService?.getBot?.();
    if (!bot) {
      reply.send({ success: true, data: [], message: "当前没有在线 Bot" });
      return;
    }

    const groups = new Map<string, { group_id: string | number; group_name: string }>();
    const result = await bot.sendAction({ action: "get_group_list", params: {} });
    if (result.ok && Array.isArray(result.data)) {
      for (const item of result.data as Array<Record<string, unknown>>) {
        const groupId = item.group_id ?? item.groupId;
        if (groupId === undefined || groupId === null) continue;
        const key = String(groupId);
        const groupName = String(item.group_name ?? item.groupName ?? groupId);
        groups.set(key, { group_id: groupId as string | number, group_name: groupName });
      }
    }

    reply.send({ success: true, data: [...groups.values()] });
  });

  // ── POST /sub/add ──
  ctx.route("POST", "/sub/add", withStore(async (req, reply) => {
    const { repo: rawRepo, types, groups, branch: specifiedBranch, branches: specifiedBranches } = req.body as {
      repo?: string; types?: string[]; groups?: string[];
      branch?: string; branches?: string[];
    };
    const repo = rawRepo?.trim().toLowerCase();
    if (!repo || !repo.includes("/")) {
      reply.send({ success: false, error: "仓库格式错误，请使用 owner/repo" });
      return;
    }

    const validTypes: EventType[] = (types || ["commits", "issues", "pulls"]).filter((t) =>
      ["commits", "issues", "pulls", "actions"].includes(t),
    ) as EventType[];

    let branchList: string[] = [];
    if (specifiedBranches && Array.isArray(specifiedBranches) && specifiedBranches.length) {
      branchList = specifiedBranches.map((b) => b.trim()).filter(Boolean);
    } else if (specifiedBranch?.trim()) {
      branchList = [specifiedBranch.trim()];
    }
    if (!branchList.length) {
      try {
        branchList = [await fetchDefaultBranch(repo)];
      } catch {
        branchList = ["main"];
      }
    }

    const skipped: string[] = [];
    const toAdd: string[] = [];
    for (const b of branchList) {
      if (config.subscriptions.some((s) => s.repo.toLowerCase() === repo && s.branch === b)) {
        skipped.push(b);
      } else {
        toAdd.push(b);
      }
    }
    if (!toAdd.length) {
      reply.send({ success: false, error: `所选分支均已订阅: ${skipped.join(", ")}` });
      return;
    }

    const added: Subscription[] = [];
    for (const branch of toAdd) {
      const sub: Subscription = {
        repo, branch, types: validTypes,
        groups: groups || [],
        enabled: true,
        createdAt: new Date().toISOString(),
      };
      config.subscriptions.push(sub);
      added.push(sub);
    }
    await syncConfig();
    const msg = skipped.length ? `已添加 ${toAdd.join(", ")}，跳过已订阅: ${skipped.join(", ")}` : undefined;
    reply.send({ success: true, data: added.length === 1 ? added[0] : added, message: msg });
  }));

  // ── POST /sub/update ──
  ctx.route("POST", "/sub/update", withStore(async (req, reply) => {
    const body = req.body as Record<string, any>;
    const repo = body.repo as string;
    const oldBranch = body.oldBranch as string | undefined;
    const newBranch = body.branch as string | undefined;
    const types = body.types as EventType[] | undefined;
    const groups = body.groups as string[] | undefined;
    const enabled = body.enabled as boolean | undefined;

    const matchBranch = oldBranch || newBranch;
    const sub = config.subscriptions.find(
      (s) => s.repo === repo && (!matchBranch || s.branch === matchBranch),
    );
    if (!sub) {
      reply.send({ success: false, error: "未找到该订阅" });
      return;
    }
    if (types) sub.types = types;
    if (groups) sub.groups = groups;
    if (enabled !== undefined) sub.enabled = enabled;
    if (newBranch) sub.branch = newBranch;
    await syncConfig();
    reply.send({ success: true, data: sub });
  }));

  // ── POST /sub/delete ──
  ctx.route("POST", "/sub/delete", withStore(async (req, reply) => {
    const { repo, branch } = req.body as { repo?: string; branch?: string };
    const idx = config.subscriptions.findIndex(
      (s) => s.repo === repo && (!branch || s.branch === branch),
    );
    if (idx === -1) {
      reply.send({ success: false, error: "未找到该订阅" });
      return;
    }
    config.subscriptions.splice(idx, 1);
    await syncConfig();
    reply.send({ success: true });
  }));

  // ── POST /sub/toggle ──
  ctx.route("POST", "/sub/toggle", withStore(async (req, reply) => {
    const { repo, branch } = req.body as { repo?: string; branch?: string };
    const sub = config.subscriptions.find(
      (s) => s.repo === repo && (!branch || s.branch === branch),
    );
    if (!sub) {
      reply.send({ success: false, error: "未找到该订阅" });
      return;
    }
    sub.enabled = !sub.enabled;
    await syncConfig();
    reply.send({ success: true, enabled: sub.enabled });
  }));

  // ── POST /user/add ──
  ctx.route("POST", "/user/add", withStore(async (req, reply) => {
    const { username, groups } = req.body as { username?: string; groups?: string[] };
    const name = username?.trim();
    if (!name) {
      reply.send({ success: false, error: "用户名不能为空" });
      return;
    }
    if (!config.userSubscriptions) config.userSubscriptions = [];
    const existing = config.userSubscriptions.find(
      (u) => u.username.toLowerCase() === name.toLowerCase(),
    );
    if (existing) {
      reply.send({ success: false, error: "该用户已在监控列表" });
      return;
    }
    const userSub: UserSubscription = {
      username: name,
      groups: groups || [],
      enabled: true,
      createdAt: new Date().toISOString(),
    };
    config.userSubscriptions.push(userSub);
    await syncConfig();
    reply.send({ success: true, data: userSub });
  }));

  // ── POST /user/update ──
  ctx.route("POST", "/user/update", withStore(async (req, reply) => {
    const { username, groups, enabled } = req.body as Partial<UserSubscription> & { username: string };
    if (!config.userSubscriptions) config.userSubscriptions = [];
    const sub = config.userSubscriptions.find((u) => u.username === username);
    if (!sub) {
      reply.send({ success: false, error: "未找到该用户监控" });
      return;
    }
    if (groups) sub.groups = groups;
    if (enabled !== undefined) sub.enabled = enabled;
    await syncConfig();
    reply.send({ success: true, data: sub });
  }));

  // ── POST /user/delete ──
  ctx.route("POST", "/user/delete", withStore(async (req, reply) => {
    const { username } = req.body as { username?: string };
    if (!config.userSubscriptions) config.userSubscriptions = [];
    const idx = config.userSubscriptions.findIndex((u) => u.username === username);
    if (idx === -1) {
      reply.send({ success: false, error: "未找到该用户监控" });
      return;
    }
    config.userSubscriptions.splice(idx, 1);
    await syncConfig();
    reply.send({ success: true });
  }));

  // ── POST /user/toggle ──
  ctx.route("POST", "/user/toggle", withStore(async (req, reply) => {
    const { username } = req.body as { username?: string };
    if (!config.userSubscriptions) config.userSubscriptions = [];
    const sub = config.userSubscriptions.find((u) => u.username === username);
    if (!sub) {
      reply.send({ success: false, error: "未找到该用户监控" });
      return;
    }
    sub.enabled = !sub.enabled;
    await syncConfig();
    reply.send({ success: true, enabled: sub.enabled });
  }));

  // ── GET /ping ──
  ctx.route("GET", "/ping", async (_req, reply) => {
    const base = config.apiBase || "https://api.github.com";
    const start = Date.now();
    try {
      const headers: Record<string, string> = { "User-Agent": "dian-plugin-github" };
      const allTokens = [...(config.tokens || [])];
      if (config.token && !allTokens.includes(config.token)) {
        allTokens.push(config.token);
      }
      const firstToken = allTokens.find((t) => t.trim());
      if (firstToken) headers["Authorization"] = `Bearer ${firstToken}`;
      const hasToken = !!firstToken;
      const r = await fetch(`${base}/zen`, {
        headers,
        signal: AbortSignal.timeout(10000),
        dispatcher: proxyDispatcher(config.proxy),
      });
      const ms = Date.now() - start;
      if (r.ok) {
        reply.send({ success: true, ms, status: r.status, authenticated: hasToken });
      } else {
        reply.send({ success: false, ms, status: r.status, error: `HTTP ${r.status}` });
      }
    } catch (e) {
      const ms = Date.now() - start;
      reply.send({ success: false, ms, error: String(e) });
    }
  });

  // ── GET /rate-limit ──
  ctx.route("GET", "/rate-limit", async (_req, reply) => {
    const base = config.apiBase || "https://api.github.com";
    const tokens = getConfiguredTokens(config);
    if (!tokens.length) {
      reply.send({ success: true, data: [] });
      return;
    }

    const data = await Promise.all(tokens.map(async (token, index) => {
      const start = Date.now();
      try {
        const res = await fetch(`${base}/rate_limit`, {
          headers: {
            "User-Agent": "dian-plugin-github",
            Authorization: `Bearer ${token}`,
          },
          signal: AbortSignal.timeout(10000),
          dispatcher: proxyDispatcher(config.proxy),
        });
        const ms = Date.now() - start;
        if (!res.ok) {
          return { index, name: tokenLabel(token, index), ok: false, status: res.status, ms, error: `HTTP ${res.status}` };
        }
        const body = await res.json() as RateLimitResponse;
        return { index, name: tokenLabel(token, index), ok: true, status: res.status, ms, rate: body.rate, resources: body.resources || {} };
      } catch (e) {
        return { index, name: tokenLabel(token, index), ok: false, ms: Date.now() - start, error: String(e) };
      }
    }));

    reply.send({ success: true, data });
  });

  // ── GET /puppeteer ──
  ctx.route("GET", "/puppeteer", async (_req, reply) => {
    const plugin = config.puppeteerPlugin || "puppeteer";
    const port = (config as any).webuiPort || 3000;
    try {
      const res = await fetch(`http://127.0.0.1:${port}/plugins/${encodeURIComponent(plugin)}/api/status`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) {
        reply.send({ success: true, connected: false, status: res.status, error: `HTTP ${res.status}` });
        return;
      }
      const data = await res.json() as { code?: number; data?: unknown; message?: string };
      reply.send({ success: true, connected: data.code === 0, data: data.data, error: data.message });
    } catch (e) {
      reply.send({ success: true, connected: false, error: String(e) });
    }
  });

  // ── GET /admin ──
  ctx.route("GET", "/admin", (_req, reply) => {
    reply.send({
      success: true,
      data: {
        superAdmins: config.adminConfig?.superAdmins || [],
        admins: config.adminConfig?.admins || [],
      },
    });
  });

  // ── POST /admin/super ──
  ctx.route("POST", "/admin/super", withStore(async (req, reply) => {
    const { superAdmins } = req.body as { superAdmins?: string[] };
    if (!Array.isArray(superAdmins)) {
      reply.send({ success: false, error: "参数错误" });
      return;
    }
    if (!config.adminConfig) {
      config.adminConfig = { superAdmins: [], admins: [] };
    }
    config.adminConfig.superAdmins = superAdmins.map(String).filter(s => s.trim());
    await syncConfig();
    reply.send({ success: true, data: config.adminConfig.superAdmins });
  }));

  // ── POST /admin/add ──
  ctx.route("POST", "/admin/add", withStore(async (req, reply) => {
    const { userId } = req.body as { userId?: string };
    if (!userId?.trim()) {
      reply.send({ success: false, error: "用户ID不能为空" });
      return;
    }
    if (!config.adminConfig) {
      config.adminConfig = { superAdmins: [], admins: [] };
    }
    if (!config.adminConfig.admins) {
      config.adminConfig.admins = [];
    }
    const id = userId.trim();
    if (config.adminConfig.admins.includes(id)) {
      reply.send({ success: false, error: "该用户已是管理员" });
      return;
    }
    config.adminConfig.admins.push(id);
    await syncConfig();
    reply.send({ success: true, data: config.adminConfig.admins });
  }));

  // ── POST /admin/remove ──
  ctx.route("POST", "/admin/remove", withStore(async (req, reply) => {
    const { userId } = req.body as { userId?: string };
    if (!userId?.trim()) {
      reply.send({ success: false, error: "用户ID不能为空" });
      return;
    }
    if (!config.adminConfig?.admins) {
      reply.send({ success: false, error: "管理员列表为空" });
      return;
    }
    const id = userId.trim();
    const idx = config.adminConfig.admins.indexOf(id);
    if (idx === -1) {
      reply.send({ success: false, error: "该用户不是管理员" });
      return;
    }
    config.adminConfig.admins.splice(idx, 1);
    await syncConfig();
    reply.send({ success: true, data: config.adminConfig.admins });
  }));

  // ── GET /logs ──
  ctx.route("GET", "/logs", (_req, reply) => {
    reply.send({ success: true, data: pluginState.logBuffer });
  });

  // ── POST /logs/clear ──
  ctx.route("POST", "/logs/clear", (_req, reply) => {
    pluginState.clearLogs();
    reply.send({ success: true });
  });

  // ── Web UI ──
  ctx.ui({ staticDir: "./public", entry: "index.html" });
}

function getConfiguredTokens(config: PluginConfig): string[] {
  const seen = new Set<string>();
  const tokens: string[] = [];
  for (const token of [...(config.tokens || []), config.token]) {
    const value = token?.trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    tokens.push(value);
  }
  return tokens;
}

function tokenLabel(token: string, index: number): string {
  return `Token ${index + 1} (...${token.slice(-4)})`;
}
