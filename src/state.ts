import { existsSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { PluginConfig, EventCache, LogEntry } from "./types.js";
import { githubStore } from "./store.js";
import { PKG_VERSION } from "./version.js";

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

  /** 存储各群的 sendGroupMsg 回调，key 为 "botId:groupId"，由 index.ts 在收到群消息时注册 */
  private groupSenders = new Map<string, (message: unknown) => Promise<void>>();

  log(level: "info" | "warn" | "error", msg: string): void {
    console.log(`[GitHub Sub] [${level}] ${msg}`);
    this.pushLog(level, msg);
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
      writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), "utf-8");
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

  /** 注册群消息发送回调（bot 级别） */
  registerGroupSender(botId: string, groupId: string, sender: (message: unknown) => Promise<void>): void {
    this.groupSenders.set(`${botId}:${groupId}`, sender);
  }

  /** 向指定群发送消息（按 botId 路由） */
  async sendGroupMsg(groupId: string, message: unknown, botId?: string): Promise<void> {
    const key = botId ? `${botId}:${groupId}` : null;
    const sender = (key && this.groupSenders.get(key)) || this.groupSenders.get(`:${groupId}`);
    if (sender) {
      await sender(message);
    }
  }
}

export const pluginState = new PluginState();
