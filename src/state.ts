import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { PluginConfig, EventCache, LogEntry } from "./types.js";
import { DEFAULT_CONFIG } from "./config.js";
import { PKG_VERSION } from "./version.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

class PluginState {
  version = PKG_VERSION;
  config: PluginConfig = { ...DEFAULT_CONFIG };
  configPath = "";
  dataPath = "";
  cache: EventCache = {};
  logBuffer: LogEntry[] = [];
  private readonly maxLogEntries = 500;
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  /** 存储各群的 sendGroupMsg 回调，由 index.ts 在收到群消息时注册 */
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
  }

  private pushLog(level: string, msg: string): void {
    this.logBuffer.push({ time: Date.now(), level, msg });
    if (this.logBuffer.length > this.maxLogEntries) {
      this.logBuffer.splice(0, this.logBuffer.length - this.maxLogEntries);
    }
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

  saveCache(): void {
    if (!this.dataPath) return;
    try {
      const fp = join(this.dataPath, "cache.json");
      if (!existsSync(this.dataPath)) mkdirSync(this.dataPath, { recursive: true });
      writeFileSync(fp, JSON.stringify(this.cache, null, 2), "utf-8");
    } catch { /* ignore */ }
  }

  loadCache(): void {
    try {
      const fp = join(this.dataPath, "cache.json");
      if (existsSync(fp)) this.cache = JSON.parse(readFileSync(fp, "utf-8"));
    } catch { /* ignore */ }
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

  /** 注册群消息发送回调 */
  registerGroupSender(groupId: string, sender: (message: unknown) => Promise<void>): void {
    this.groupSenders.set(groupId, sender);
  }

  /** 向指定群发送消息 */
  async sendGroupMsg(groupId: string, message: unknown): Promise<void> {
    const sender = this.groupSenders.get(groupId);
    if (sender) {
      await sender(message);
    }
  }
}

export const pluginState = new PluginState();
