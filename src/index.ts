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
import { extractMessageText, handleCommand, autoDetectRepoLink } from "./commands.js";
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
      const text = extractMessageText(ctx);
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

  private syncConfig(): void {
    pluginState.config = this.config;
    saveConfig(this.config);
    stopPoller();
    if (this.config.subscriptions.length || (this.config.userSubscriptions || []).length) {
      startPoller();
    }
  }

  onSetup(ctx: PluginSetupContext): void {
    pluginState.config = this.config;
    pluginState.configPath = (ctx as any).configPath ?? "";
    pluginState.dataPath = (ctx as any).dataPath ?? "";
    pluginState.loadCache();

    if (this.config.subscriptions.length || (this.config.userSubscriptions || []).length) {
      startPoller();
    }

    setupRoutes(ctx, this.config, () => this.syncConfig(), this.startTime);
  }
}
