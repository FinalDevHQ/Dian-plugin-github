import "reflect-metadata";
import {
  Plugin,
  Handler,
  Interceptor,
  type EventContext,
  type PluginSetupContext,
} from "@myfinal/plugin-runtime";

import { PKG_VERSION } from "./version.js";
import { type Config, loadConfig, saveConfig } from "./config.js";

@Plugin({
  name: "hello-world",
  description: "Dian 插件模板 — Hello World",
  version: PKG_VERSION,
  author: "your-name",
  icon: "👋",
})
export default class PingPongPlugin {
  /** 插件加载时间（服务端时间戳，毫秒） */
  private readonly startTime = Date.now();

  /** 运行时配置（可通过 Web UI 修改 reply，修改 command 需重启） */
  private config = loadConfig();

  /** 收到指令的累计次数 */
  private pingCount = 0;

  /** 最近触发记录（最多保留 50 条） */
  private recentPings: Array<{
    sender: string;
    userId?: string;
    group?: string;
    platform?: string;
    time: number;
  }> = [];

  // ── 事件处理器示例（@Handler，静态 pattern 匹配消息文本） ────────────────
  // @Handler 接收 string（精确匹配）、RegExp 或返回它们的函数（动态 pattern）。
  // 与 ctx.command() 的区别：pattern 在类加载时即确定，不支持运行时热更新；
  // 若需要"改配置立即生效"的动态指令，请用 onSetup 里的 ctx.command()。
  @Handler(/^#?help$/i)
  async onHelp(ctx: EventContext): Promise<void> {
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);
    await ctx.reply(
      `📖 Hello World 插件\n` +
      `触发词：${this.config.command}  →  ${this.config.reply}\n` +
      `已运行：${uptime} 秒 | 累计触发：${this.pingCount} 次`
    );
  }

  // ── 拦截器示例（最先执行，可用于日志、鉴权、过滤） ─────────────────────
  @Interceptor(10)
  async logInterceptor(ctx: EventContext): Promise<void> {
    if (ctx.event.type === "message") {
      console.log(
        `[hello-world] <${ctx.event.platform}> ${ctx.event.payload.senderName ?? "?"}: ${ctx.event.payload.text ?? ""}`
      );
    }
  }

  onSetup(ctx: PluginSetupContext): void {
    // ── 注册指令（带分类，用于帮助菜单分组展示） ───────────────────────────
    ctx.command({
      name: this.config.command,
      pattern: () => this.config.command,
      description: `回复 "${this.config.reply}"`,
      category: "趣味",  // 分类名，帮助菜单中按分类分组
      handler: async (c: EventContext) => {
        this.pingCount++;
        this.recentPings.unshift({
          sender: c.event.payload.senderName ?? "unknown",
          userId: c.event.payload.userId,
          group: c.event.payload.groupId,
          platform: c.event.platform,
          time: c.event.timestamp,
        });
        if (this.recentPings.length > 50) this.recentPings.pop();

        console.log(
          `[hello-world] ${c.event.payload.senderName ?? "?"} ` +
          `→ "${this.config.reply}"`
        );
        await c.reply(this.config.reply);
      },
    });

    // ── sendAction 示例：调用底层 Bot API ───────────────────────────────────
    // sendAction 用于调用底层平台 API（如 OneBot 的 send_group_msg、set_group_ban 等）。
    // 这里注册一个 !mute 指令作为示例（需要 Bot 有管理员权限）。
    ctx.command({
      name: "mute",
      pattern: () => this.config.muteCommand,
      description: `禁言发送者 ${this.config.muteDuration} 秒（示例，需 Bot 有管理员权限）`,
      category: "管理",
      handler: async (c: EventContext) => {
        if (!c.event.payload.groupId) {
          await c.reply("此指令只能在群聊中使用");
          return;
        }
        // 调用 OneBot API 执行禁言
        const result = await c.sendAction("set_group_ban", {
          group_id: Number(c.event.payload.groupId),
          user_id: Number(c.event.payload.userId),
          duration: this.config.muteDuration,
        });
        if (result.ok) {
          await c.reply(`已禁言 ${this.config.muteDuration} 秒`);
        } else {
          await c.reply(`操作失败: ${result.message ?? "未知错误"}`);
        }
      },
    });

    // ── GET /plugins/hello-world/api/status ────────────────────────────────────
    ctx.route("GET", "/status", (_req, reply) => {
      reply.send({
        startTime: this.startTime,
        pingCount: this.pingCount,
        config: this.config,
        recentPings: this.recentPings.slice(0, 10),
      });
    });

    // ── POST /plugins/hello-world/api/config ───────────────────────────────────
    ctx.route("POST", "/config", (req, reply) => {
      const body = req.body as Partial<Config>;
      if (typeof body.reply === "string" && body.reply.trim()) {
        this.config.reply = body.reply.trim();
      }
      if (typeof body.command === "string" && body.command.trim()) {
        this.config.command = body.command.trim();
      }
      if (typeof body.muteCommand === "string" && body.muteCommand.trim()) {
        this.config.muteCommand = body.muteCommand.trim();
      }
      if (typeof body.muteDuration === "number" && body.muteDuration > 0) {
        this.config.muteDuration = Math.floor(body.muteDuration);
      }
      saveConfig(this.config);
      reply.send({ ok: true, config: this.config });
    });

    // ── Web UI ───────────────────────────────────────────────────────────────
    ctx.ui({ staticDir: "./public", entry: "index.html" });
  }
}
