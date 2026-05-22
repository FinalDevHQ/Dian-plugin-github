import "reflect-metadata";
import {
  Plugin,
  Handler,
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

  @Handler(/^#?help$/i)
  async onHelp(ctx: EventContext): Promise<void> {
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);
    await ctx.reply(
      `🐙 GitHub 订阅插件 v${PKG_VERSION}\n` +
      `已运行: ${uptime} 秒\n` +
      `订阅仓库: ${this.config.subscriptions.length} 个\n` +
      `关注用户: ${this.config.userSubscriptions.length} 个\n` +
      `指令前缀: gh\n` +
      `输入 gh 帮助 查看所有指令`
    );
  }

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
      // 自定义指令别名映射
      text = this.resolveCommandAlias(text);
      if (/^gh\b/i.test(text)) {
        await handleCommand(ctx, text, this.config, () => this.syncConfig());
        ctx.stopPropagation();
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
    saveConfig(this.config);
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
    pluginState.config = this.config;
    pluginState.configPath = (ctx as any).configPath ?? "";
    pluginState.dataPath = (ctx as any).dataPath ?? "";
    pluginState.loadCache();
    pluginState.loadLogs();

    if (this.config.subscriptions.length || (this.config.userSubscriptions || []).length) {
      startPoller();
    }

    setupRoutes(ctx, this.config, () => this.syncConfig(), this.startTime);

    // ── 注册指令（供框架 UI 展示） ──
    const mkCmd = (name: string, pattern: RegExp, desc: string, handler: (ctx: EventContext) => Promise<void>) =>
      ctx.command({ name, pattern, description: desc, category: "GitHub 订阅", handler });

    mkCmd("gh 帮助", /^gh\s*帮助$/i, "查看所有指令", (ctx) => cmdHelp(ctx));
    mkCmd("gh 订阅", /^gh\s+订阅\s+.+/, "订阅仓库  gh 订阅 <owner/repo> [branch]", (ctx) => this.handleRegisteredCmd(ctx, "订阅"));
    mkCmd("gh 取消", /^gh\s+取消\s+.+/, "取消订阅  gh 取消 <owner/repo> [branch]", (ctx) => this.handleRegisteredCmd(ctx, "取消"));
    mkCmd("gh 列表", /^gh\s*列表$/i, "查看当前群订阅", (ctx) => this.handleRegisteredCmd(ctx, "列表"));
    mkCmd("gh 全部", /^gh\s*全部$/i, "查看所有订阅", (ctx) => this.handleRegisteredCmd(ctx, "全部"));
    mkCmd("gh 开启", /^gh\s+开启\s+.+/, "启用订阅  gh 开启 <owner/repo> [branch]", (ctx) => this.handleRegisteredCmd(ctx, "开启"));
    mkCmd("gh 关闭", /^gh\s+关闭\s+.+/, "禁用订阅  gh 关闭 <owner/repo> [branch]", (ctx) => this.handleRegisteredCmd(ctx, "关闭"));
    mkCmd("gh 关注", /^gh\s+关注\s+.+/, "关注用户  gh 关注 <username>", (ctx) => this.handleRegisteredCmd(ctx, "关注"));
    mkCmd("gh 取关", /^gh\s+取关\s+.+/, "取消关注  gh 取关 <username>", (ctx) => this.handleRegisteredCmd(ctx, "取关"));
    mkCmd("gh 关注列表", /^gh\s*关注列表$/i, "查看关注列表", (ctx) => this.handleRegisteredCmd(ctx, "关注列表"));
  }
}
