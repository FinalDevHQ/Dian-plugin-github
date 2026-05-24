import "reflect-metadata";
import {
  Plugin,
  Interceptor,
  type EventContext,
  type PluginSetupContext,
} from "@myfinal/plugin-runtime";

import { PKG_VERSION } from "./version.js";
import { loadConfig, saveConfig } from "./config.js";
import type { PluginConfig } from "./types.js";
import { pluginState } from "./state.js";
import { startPoller, stopPoller } from "./poller.js";
import { extractMessageText, handleCommand, autoDetectRepoLink, cmdHelp } from "./commands.js";
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

  @Interceptor(10)
  async logInterceptor(ctx: EventContext): Promise<void> {
    if (ctx.event.type === "message") {
      let text = extractMessageText(ctx);
      if (ctx.event.payload.groupId) {
        const groupId = String(ctx.event.payload.groupId);
        pluginState.registerGroupSender(ctx.event.payload.groupId, async (msg) => {
          if (Array.isArray(msg)) {
            await ctx.sendAction("send_group_msg", { group_id: groupId, message: msg as unknown[] });
          } else {
            await ctx.reply(String(msg));
          }
        });
      }
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
        await autoDetectRepoLink(ctx, text, this.config);
      }
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

  private syncConfig(): void {
    pluginState.config = this.config;
    saveConfig(this.config, this.runtimeConfigPath || undefined);
    stopPoller();
    if (this.config.subscriptions.length || (this.config.userSubscriptions || []).length) {
      startPoller();
    }
  }

  /** 框架 ctx.command() 注册的指令回调，转交 handleCommand 处理 */
  private async handleRegisteredCmd(ctx: EventContext, sub: string): Promise<void> {
    const text = extractMessageText(ctx);
    // 从原始消息中提取参数部分
    const parts = text.trim().split(/\s+/);
    // 重建完整命令文本给 handleCommand
    const fullCmd = `gh ${sub}${parts.length > 2 ? " " + parts.slice(2).join(" ") : ""}`;
    await handleCommand(ctx, fullCmd, this.config, () => this.syncConfig());
  }

  onSetup(ctx: PluginSetupContext): void {
    this.runtimeConfigPath = (ctx as any).configPath ?? "";
    // 使用运行时路径重新加载配置（如果存在）
    if (this.runtimeConfigPath) {
      this.config = loadConfig(this.runtimeConfigPath);
    }
    pluginState.config = this.config;
    pluginState.configPath = this.runtimeConfigPath;
    pluginState.dataPath = (ctx as any).dataPath ?? "";
    pluginState.loadCache();
    pluginState.loadLogs();

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
              usage: "gh 仓库 订阅 <owner/repo> [branch]",
              examples: ["gh 仓库 订阅 dian/dian main", "gh 订阅 dian/dian main"],
              order: 10,
              handler: (c) => this.handleRegisteredCmd(c, "订阅"),
            },
            {
              name: "取消",
              aliases: ["unsubscribe", "unsub", "remove", "delete"],
              pattern: /^gh\s+取消\s+.+/i,
              description: "取消 GitHub 仓库订阅",
              usage: "gh 仓库 取消 <owner/repo> [branch]",
              examples: ["gh 仓库 取消 dian/dian main", "gh 取消 dian/dian main"],
              order: 20,
              handler: (c) => this.handleRegisteredCmd(c, "取消"),
            },
            {
              name: "列表",
              aliases: ["list", "ls"],
              pattern: /^gh\s*列表$/i,
              description: "查看当前群订阅",
              usage: "gh 仓库 列表",
              examples: ["gh 仓库 列表", "gh 列表"],
              order: 30,
              handler: (c) => this.handleRegisteredCmd(c, "列表"),
            },
            {
              name: "全部",
              aliases: ["all"],
              pattern: /^gh\s*全部$/i,
              description: "查看所有订阅",
              usage: "gh 仓库 全部",
              examples: ["gh 仓库 全部", "gh 全部"],
              order: 40,
              handler: (c) => this.handleRegisteredCmd(c, "全部"),
            },
            {
              name: "开启",
              aliases: ["enable", "on"],
              pattern: /^gh\s+开启\s+.+/i,
              description: "启用已存在的仓库订阅",
              usage: "gh 仓库 开启 <owner/repo> [branch]",
              examples: ["gh 仓库 开启 dian/dian main", "gh 开启 dian/dian main"],
              order: 50,
              handler: (c) => this.handleRegisteredCmd(c, "开启"),
            },
            {
              name: "关闭",
              aliases: ["disable", "off"],
              pattern: /^gh\s+关闭\s+.+/i,
              description: "禁用已存在的仓库订阅",
              usage: "gh 仓库 关闭 <owner/repo> [branch]",
              examples: ["gh 仓库 关闭 dian/dian main", "gh 关闭 dian/dian main"],
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
              usage: "gh 用户 关注 <username>",
              examples: ["gh 用户 关注 torvalds", "gh 关注 torvalds"],
              order: 10,
              handler: (c) => this.handleRegisteredCmd(c, "关注"),
            },
            {
              name: "取关",
              aliases: ["unfollow", "unwatch"],
              pattern: /^gh\s+取关\s+.+/i,
              description: "取消关注 GitHub 用户",
              usage: "gh 用户 取关 <username>",
              examples: ["gh 用户 取关 torvalds", "gh 取关 torvalds"],
              order: 20,
              handler: (c) => this.handleRegisteredCmd(c, "取关"),
            },
            {
              name: "关注列表",
              aliases: ["following", "follow-list", "users"],
              pattern: /^gh\s*关注列表$/i,
              description: "查看关注列表",
              usage: "gh 用户 关注列表",
              examples: ["gh 用户 关注列表", "gh 关注列表"],
              order: 30,
              handler: (c) => this.handleRegisteredCmd(c, "关注列表"),
            },
          ],
        },
      ],
    });
  }
}
