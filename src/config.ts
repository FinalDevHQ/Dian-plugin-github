import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = resolve(__dirname, "config.json");

export interface Config {
  command: string;      // 触发指令，默认 !hello
  reply: string;        // 回复内容，默认 Hello World!
  muteCommand: string;  // !mute 触发指令，默认 !mute
  muteDuration: number; // !mute 禁言时长（秒），默认 60
}

export const DEFAULTS: Config = {
  command: "!hello",
  reply: "Hello World!",
  muteCommand: "!mute",
  muteDuration: 60,
};

export function loadConfig(): Config {
  try {
    if (existsSync(CONFIG_PATH)) {
      return { ...DEFAULTS, ...JSON.parse(readFileSync(CONFIG_PATH, "utf8")) as Config };
    }
  } catch { /* 读取失败时使用默认值 */ }
  return { ...DEFAULTS };
}

export function saveConfig(cfg: Config): void {
  writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
}
