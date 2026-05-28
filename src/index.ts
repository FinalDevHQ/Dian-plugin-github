import "reflect-metadata";
import {
  Plugin,
  Interceptor,
  type EventContext,
  type PluginSetupContext,
} from "@myfinal/plugin-runtime";

import { PKG_VERSION } from "./version.js";
import { loadConfig } from "./config.js";
import type { PluginConfig } from "./types.js";
import { pluginState } from "./state.js";
import { githubStore } from "./store.js";
import { startPoller, stopPoller } from "./poller.js";
import { extractMessageText, extractGitHubRepo, handleCommand, autoDetectRepoLink, cmdHelp } from "./commands.js";
import { setupRoutes } from "./routes.js";

@Plugin({
  name: "github-sub",
  description: "GitHub 仓库/用户订阅推送插件",
  version: PKG_VERSION,
  author: "Dian",
  icon: "🐙",
})
export default class GitHubSubPlugin {
  private readonly startTime = Date.now();
  private config: PluginConfig = loadConfig();
  private runtimeConfigPath = "";
  private dbInitialized = false;

  @Interceptor(10)
  async logInterceptor(ctx: EventContext): Promise<void> {
    if (ctx.event.type !== "message") return;
    // 忽略 bot 自身发出的消息（防止 OneBot 回传 message 事件导致重复触发）
    if (ctx.event.subtype === "message_sent" || ctx.event.subtype?.includes("sent")) return;

    // Lazy DB initialization on first event (PluginStore only available during event dispatch)
    if (!this.dbInitialized && ctx.store) {
      await this.initDB(ctx.store);
    }

    // 注入框架层 sendAction，供 poller 等非事件上下文使用
    if (!pluginState.sendAction) {
      pluginState.sendAction = ctx.sendAction;
    }

    let text = extractMessageText(ctx);
    // 自定义指令别名无法被静态 registry pattern 预知，命中时在这里转交兼容。
    const originalText = text;
    text = this.resolveCommandAlias(text);
    if (text !== originalText && /^gh\b/i.test(text)) {
      await handleCommand(ctx, text, this.config, () => this.syncConfig());
      ctx.stopPropagation();
      return;
    }
    if (/^gh\b/i.test(text)) {
      return;
    }
    if (this.config.autoDetectRepo) {
      const repo = extractGitHubRepo(text);
      if (repo) {
        await autoDetectRepoLink(ctx, text, this.config);
        ctx.stopPropagation();
      }
    }
  }

  /** 首次收到事件时初始化数据库存储，从 DB 加载订阅数据 */
  private async initDB(store: import("@myfinal/plugin-runtime").PluginStore): Promise<void> {
    this.dbInitialized = true;
    try {
      await githubStore.init(store, this.config);
      this.config.subscriptions = await githubStore.loadSubscriptions();
      this.config.userSubscriptions = await githubStore.loadUserSubscriptions();
      // 从数据库加载加密存储的 token
      const dbTokens = await githubStore.loadTokens();
      if (dbTokens.length) {
        this.config.tokens = dbTokens;
      }
      await pluginState.loadCache();
      await pluginState.loadLogs();
      // Restart poller with DB-backed subscriptions
      stopPoller();
      if (this.config.subscriptions.length || (this.config.userSubscriptions || []).length) {
        startPoller();
      }
    } catch (e) {
      console.error("[GitHub Sub] DB 初始化失败:", e);
    }
  }

  /** 将用户输入的别名映射为系统指令（如 "github帮助" → "gh 帮助"） */
  private resolveCommandAlias(text: string): string {
    const commands = this.config.customCommands || [];
    const lower = text.toLowerCase().trim();
    for (const cmd of commands) {
      if (!cmd.enabled || !cmd.alias) continue;
      if (lower === cmd.alias.toLowerCase()) {
        return cmd.command;
      }
    }
    return text;
  }

  private async syncConfig(): Promise<void> {
    pluginState.config = this.config;
    pluginState.saveConfig();
    if (this.dbInitialized) {
      await githubStore.saveSubscriptions(this.config.subscriptions);
      await githubStore.saveUserSubscriptions(this.config.userSubscriptions || []);
      await githubStore.saveTokens([...(this.config.tokens || []), ...(this.config.token ? [this.config.token] : [])]);
    }
    stopPoller();
    if (this.config.subscriptions.length || (this.config.userSubscriptions || []).length) {
      startPoller();
    }
  }

  /** 框架 ctx.command() 注册的指令回调，转交 handleCommand 处理 */
  private async handleRegisteredCmd(ctx: EventContext, sub: string): Promise<void> {
    const text = extractMessageText(ctx);
    const parts = text.trim().split(/\s+/);
    const fullCmd = `gh ${sub}${parts.length > 2 ? " " + parts.slice(2).join(" ") : ""}`;
    await handleCommand(ctx, fullCmd, this.config, () => this.syncConfig());
  }

  onSetup(ctx: PluginSetupContext): void {
    this.runtimeConfigPath = (ctx as any).configPath ?? "";
    if (this.runtimeConfigPath) {
      this.config = loadConfig(this.runtimeConfigPath);
    }
    pluginState.config = this.config;
    pluginState.configPath = this.runtimeConfigPath;
    pluginState.dataPath = (ctx as any).dataPath ?? "";

    // Start poller with file-based config (DB not yet available during setup)
    // Will be restarted with DB data on first event via initDB()
    if (this.config.subscriptions.length || (this.config.userSubscriptions || []).length) {
      startPoller();
    }

    setupRoutes(ctx, this.config, () => this.syncConfig(), this.startTime);

    ctx.command({
      name: "gh",
      aliases: ["github", "github-sub", "github订阅", "GitHub 订阅", "GitHub 仓库/用户订阅推送插件"],
      pattern: /^gh(?:\s+帮助)?$/i,
      description: "GitHub 订阅管理",
      category: "GitHub 订阅",
      order: 10,
      handler: (c) => cmdHelp(c),
      children: [
        {
          name: "帮助",
          aliases: ["help", "菜单"],
          pattern: /^gh\s*帮助$/i,
          description: "查看 GitHub 插件指令",
          order: 10,
          handler: (c) => cmdHelp(c),
        },
        {
          name: "仓库",
          aliases: ["repo", "repository", "repos", "仓库订阅"],
          description: "仓库订阅管理",
          order: 20,
          children: [
            {
              name: "订阅",
              aliases: ["subscribe", "sub", "add"],
              pattern: /^gh\s+订阅\s+.+/i,
              description: "订阅 GitHub 仓库更新",
              order: 10,
              handler: (c) => this.handleRegisteredCmd(c, "订阅"),
            },
            {
              name: "取消",
              aliases: ["unsubscribe", "unsub", "remove", "delete"],
              pattern: /^gh\s+取消\s+.+/i,
              description: "取消 GitHub 仓库订阅",
              order: 20,
              handler: (c) => this.handleRegisteredCmd(c, "取消"),
            },
            {
              name: "列表",
              aliases: ["list", "ls"],
              pattern: /^gh\s*列表$/i,
              description: "查看当前群订阅",
              order: 30,
              handler: (c) => this.handleRegisteredCmd(c, "列表"),
            },
            {
              name: "全部",
              aliases: ["all"],
              pattern: /^gh\s*全部$/i,
              description: "查看所有订阅",
              order: 40,
              handler: (c) => this.handleRegisteredCmd(c, "全部"),
            },
            {
              name: "开启",
              aliases: ["enable", "on"],
              pattern: /^gh\s+开启\s+.+/i,
              description: "启用已存在的仓库订阅",
              order: 50,
              handler: (c) => this.handleRegisteredCmd(c, "开启"),
            },
            {
              name: "关闭",
              aliases: ["disable", "off"],
              pattern: /^gh\s+关闭\s+.+/i,
              description: "禁用已存在的仓库订阅",
              order: 60,
              handler: (c) => this.handleRegisteredCmd(c, "关闭"),
            },
          ],
        },
        {
          name: "用户",
          aliases: ["user", "users", "follow", "用户关注"],
          description: "GitHub 用户关注管理",
          order: 30,
          children: [
            {
              name: "关注",
              aliases: ["follow", "watch"],
              pattern: /^gh\s+关注\s+.+/i,
              description: "关注 GitHub 用户动态",
              order: 10,
              handler: (c) => this.handleRegisteredCmd(c, "关注"),
            },
            {
              name: "取关",
              aliases: ["unfollow", "unwatch"],
              pattern: /^gh\s+取关\s+.+/i,
              description: "取消关注 GitHub 用户",
              order: 20,
              handler: (c) => this.handleRegisteredCmd(c, "取关"),
            },
            {
              name: "关注列表",
              aliases: ["following", "follow-list", "users"],
              pattern: /^gh\s*关注列表$/i,
              description: "查看关注列表",
              order: 30,
              handler: (c) => this.handleRegisteredCmd(c, "关注列表"),
            },
          ],
        },
      ],
    });
  }

  onStop(): void {
    stopPoller();
  }
}
