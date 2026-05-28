import { existsSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { PluginConfig, EventCache, LogEntry } from "./types.js";
import { githubStore } from "./store.js";
import { PKG_VERSION } from "./version.js";

type SendActionFn = (action: string, params?: Record<string, unknown>) => Promise<unknown>;

class PluginState {
  version = PKG_VERSION;
  config: PluginConfig = { ...{} as PluginConfig };
  configPath = "";
  dataPath = "";
  cache: EventCache = {};
  logBuffer: LogEntry[] = [];
  private readonly maxLogEntries = 500;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private logSaveTimer: ReturnType<typeof setTimeout> | null = null;

  /** 框架层 sendAction 回调，首次事件时由 interceptor 注入 */
  sendAction: SendActionFn | null = null;

  log(level: "info" | "warn" | "error", msg: string): void {
    if (level !== "info" || this.config.debug) {
      console.log(`[GitHub Sub] [${level}] ${msg}`);
    }
    // warn/error 始终持久化，info 仅在 debug 模式下持久化
    if (level !== "info" || this.config.debug) {
      this.pushLog(level, msg);
    }
  }

  debug(msg: string): void {
    if (this.config.debug) {
      this.pushLog("debug", msg);
    }
  }

  clearLogs(): void {
    this.logBuffer = [];
    githubStore.clearLogs().catch(() => {});
    this.saveLogs();
  }

  private pushLog(level: string, msg: string): void {
    this.logBuffer.push({ time: Date.now(), level, msg });
    if (this.logBuffer.length > this.maxLogEntries) {
      this.logBuffer.splice(0, this.logBuffer.length - this.maxLogEntries);
    }
    if (this.logSaveTimer) clearTimeout(this.logSaveTimer);
    this.logSaveTimer = setTimeout(() => this.saveLogs(), 500);
  }

  saveLogs(): void {
    githubStore.saveLogs(this.logBuffer).catch(() => {});
  }

  async loadLogs(): Promise<void> {
    try {
      const logs = await githubStore.loadLogs();
      if (logs.length) this.logBuffer = logs;
    } catch { /* ignore */ }
  }

  saveConfig(): void {
    if (!this.configPath) return;
    try {
      const dir = dirname(this.configPath);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      // 写入配置时排除 token 字段，token 统一加密存储在数据库中
      const { token, tokens, ...safeConfig } = this.config as unknown as Record<string, unknown>;
      void token; void tokens;
      writeFileSync(this.configPath, JSON.stringify(safeConfig, null, 2), "utf-8");
    } catch (e) {
      this.log("error", `保存配置失败: ${e}`);
    }
  }

  async saveCache(): Promise<void> {
    await githubStore.saveCacheBatch(this.cache);
  }

  async loadCache(): Promise<void> {
    try {
      this.cache = await githubStore.loadCache();
    } catch (e) {
      this.log("warn", `缓存加载失败，已重置: ${e}`);
    }
  }

  setPollTimer(timer: ReturnType<typeof setInterval>): void {
    this.pollTimer = timer;
  }

  clearPollTimer(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  /** 向指定群发送消息 */
  async sendGroupMsg(groupId: string, message: unknown): Promise<void> {
    if (!this.sendAction) {
      this.log("error", `[sendGroupMsg] sendAction 未初始化，无法发送到群 ${groupId}`);
      return;
    }
    try {
      await this.sendAction("send_group_msg", { group_id: groupId, message });
    } catch (e) {
      this.log("error", `[sendGroupMsg] 发送失败: 群 ${groupId}, ${e}`);
    }
  }
}

export const pluginState = new PluginState();
