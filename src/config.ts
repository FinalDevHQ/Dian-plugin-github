import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { PluginConfig } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_CONFIG_PATH = resolve(__dirname, "config.json");

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

export function loadConfig(configPath?: string): PluginConfig {
  const fp = configPath || DEFAULT_CONFIG_PATH;
  try {
    if (existsSync(fp)) {
      return { ...DEFAULT_CONFIG, ...JSON.parse(readFileSync(fp, "utf8")) as Partial<PluginConfig> };
    }
  } catch { /* 读取失败时使用默认值 */ }
  return { ...DEFAULT_CONFIG };
}

export function saveConfig(cfg: PluginConfig, configPath?: string): void {
  const fp = configPath || DEFAULT_CONFIG_PATH;
  try {
    const dir = dirname(fp);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(fp, JSON.stringify(cfg, null, 2), "utf-8");
  } catch { /* ignore */ }
}
