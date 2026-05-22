import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { PluginConfig } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = resolve(__dirname, "config.json");

export const DEFAULT_CONFIG: PluginConfig = {
  command: "!hello",
  reply: "Hello World!",
  muteCommand: "!mute",
  muteDuration: 60,
  token: "",
  tokens: [],
  apiBase: "https://api.github.com",
  interval: 30,
  debug: false,
  owners: [],
  allowMemberSub: true,
  theme: "light",
  autoDetectRepo: true,
  mergeNotify: false,
  puppeteerPlugin: "puppeteer",
  subscriptions: [],
  userSubscriptions: [],
  customCommands: [],
};

export function loadConfig(): PluginConfig {
  try {
    if (existsSync(CONFIG_PATH)) {
      return { ...DEFAULT_CONFIG, ...JSON.parse(readFileSync(CONFIG_PATH, "utf8")) as Partial<PluginConfig> };
    }
  } catch { /* 读取失败时使用默认值 */ }
  return { ...DEFAULT_CONFIG };
}

export function saveConfig(cfg: PluginConfig): void {
  writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
}
