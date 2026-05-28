import type { PluginStore } from "@myfinal/plugin-runtime";
import type { Subscription, UserSubscription, EventCache, LogEntry } from "./types.js";
import type { PluginConfig } from "./types.js";
import { encrypt, decrypt } from "./crypto.js";

const TABLES = {
  SUBSCRIPTIONS: "github_subscriptions",
  USER_SUBSCRIPTIONS: "github_user_subscriptions",
  CACHE: "github_cache",
  LOGS: "github_logs",
  TOKENS: "github_tokens",
} as const;

export class GitHubStore {
  private db: PluginStore | null = null;

  async init(store: PluginStore, config: PluginConfig): Promise<void> {
    this.db = store;

    await this.db.createTable(TABLES.SUBSCRIPTIONS, [
      "bot_id TEXT",
      "repo TEXT NOT NULL",
      "branch TEXT NOT NULL",
      "types TEXT NOT NULL",
      "groups TEXT NOT NULL",
      "enabled INTEGER NOT NULL DEFAULT 1",
    ]);

    await this.db.createTable(TABLES.USER_SUBSCRIPTIONS, [
      "bot_id TEXT",
      "username TEXT NOT NULL",
      "groups TEXT NOT NULL",
      "enabled INTEGER NOT NULL DEFAULT 1",
    ]);

    await this.db.createTable(TABLES.CACHE, [
      "key TEXT NOT NULL",
      "bot_id TEXT DEFAULT ''",
      "value TEXT NOT NULL",
    ]);

    await this.db.createTable(TABLES.LOGS, [
      "time INTEGER NOT NULL",
      "level TEXT NOT NULL",
      "msg TEXT NOT NULL",
    ]);

    await this.db.createTable(TABLES.TOKENS, [
      "encrypted TEXT NOT NULL",
      "position INTEGER NOT NULL DEFAULT 0",
    ]);

    await this.migrateFromConfigFile(config);
  }

  private async migrateFromConfigFile(config: PluginConfig): Promise<void> {
    if (!this.db) return;

    const existingSubs = await this.db.query(TABLES.SUBSCRIPTIONS);
    if (existingSubs.length > 0) return; // already migrated

    const hasConfigSubs = (config.subscriptions && config.subscriptions.length > 0) ||
      (config.userSubscriptions && config.userSubscriptions.length > 0);
    if (!hasConfigSubs) return;

    console.log("[GitHub Sub] 迁移配置文件订阅到数据库...");

    for (const sub of config.subscriptions) {
      await this.db.insert(TABLES.SUBSCRIPTIONS, {
        bot_id: sub.botId || "",
        repo: sub.repo,
        branch: sub.branch,
        types: JSON.stringify(sub.types),
        groups: JSON.stringify(sub.groups),
        enabled: sub.enabled ? 1 : 0,
        created_at: sub.createdAt || new Date().toISOString(),
      });
    }

    for (const u of (config.userSubscriptions || [])) {
      await this.db.insert(TABLES.USER_SUBSCRIPTIONS, {
        bot_id: u.botId || "",
        username: u.username,
        groups: JSON.stringify(u.groups),
        enabled: u.enabled ? 1 : 0,
        created_at: u.createdAt || new Date().toISOString(),
      });
    }

    // 不清空 config.subscriptions，保留作为兜底数据
    // 由 initDB() 在 DB 加载完成后接管内存数据

    const totalMigrated = (config.subscriptions?.length || 0) + (config.userSubscriptions?.length || 0);
    console.log(`[GitHub Sub] 迁移完成: ${totalMigrated} 条订阅已写入数据库`);

    // 迁移 config.json 中的明文 token 到数据库（加密存储）
    const allTokens = [...(config.tokens || [])];
    if (config.token && !allTokens.includes(config.token)) {
      allTokens.push(config.token);
    }
    const validTokens = allTokens.filter((t) => t && t.trim());
    if (validTokens.length) {
      console.log(`[GitHub Sub] 迁移 ${validTokens.length} 个 token 到数据库（加密存储）...`);
      for (let i = 0; i < validTokens.length; i++) {
        await this.db.insert(TABLES.TOKENS, {
          encrypted: encrypt(validTokens[i]),
          position: i,
        });
      }
      console.log("[GitHub Sub] token 迁移完成，建议删除 config.json 中的 token/tokens 字段");
    }
  }

  // ---- Tokens (encrypted) ----

  async loadTokens(): Promise<string[]> {
    if (!this.db) return [];
    const rows = await this.db.query(TABLES.TOKENS, undefined, {
      orderBy: "position",
      order: "ASC",
    });
    const tokens: string[] = [];
    for (const r of rows) {
      try {
        tokens.push(decrypt(r.encrypted as string));
      } catch {
        console.warn("[GitHub Sub] token 解密失败，跳过");
      }
    }
    return tokens;
  }

  async saveTokens(tokens: string[]): Promise<void> {
    if (!this.db) return;
    await this.db.delete(TABLES.TOKENS);
    const valid = tokens.filter((t) => t && t.trim());
    for (let i = 0; i < valid.length; i++) {
      await this.db.insert(TABLES.TOKENS, {
        encrypted: encrypt(valid[i]),
        position: i,
      });
    }
  }

  // ---- Subscriptions ----

  async loadSubscriptions(): Promise<Subscription[]> {
    if (!this.db) return [];
    const rows = await this.db.query(TABLES.SUBSCRIPTIONS);
    return rows.map((r) => ({
      botId: (r.bot_id as string) || undefined,
      repo: r.repo as string,
      branch: r.branch as string,
      types: JSON.parse(r.types as string),
      groups: JSON.parse(r.groups as string),
      enabled: Boolean(r.enabled),
      createdAt: (r.created_at as string) || "",
    }));
  }

  async saveSubscriptions(subs: Subscription[]): Promise<void> {
    if (!this.db) return;
    await this.db.delete(TABLES.SUBSCRIPTIONS);
    for (const sub of subs) {
      await this.db.insert(TABLES.SUBSCRIPTIONS, {
        bot_id: sub.botId || "",
        repo: sub.repo,
        branch: sub.branch,
        types: JSON.stringify(sub.types),
        groups: JSON.stringify(sub.groups),
        enabled: sub.enabled ? 1 : 0,
        created_at: sub.createdAt || new Date().toISOString(),
      });
    }
  }

  // ---- User Subscriptions ----

  async loadUserSubscriptions(): Promise<UserSubscription[]> {
    if (!this.db) return [];
    const rows = await this.db.query(TABLES.USER_SUBSCRIPTIONS);
    return rows.map((r) => ({
      botId: (r.bot_id as string) || undefined,
      username: r.username as string,
      groups: JSON.parse(r.groups as string),
      enabled: Boolean(r.enabled),
      createdAt: (r.created_at as string) || "",
    }));
  }

  async saveUserSubscriptions(subs: UserSubscription[]): Promise<void> {
    if (!this.db) return;
    await this.db.delete(TABLES.USER_SUBSCRIPTIONS);
    for (const sub of subs) {
      await this.db.insert(TABLES.USER_SUBSCRIPTIONS, {
        bot_id: sub.botId || "",
        username: sub.username,
        groups: JSON.stringify(sub.groups),
        enabled: sub.enabled ? 1 : 0,
        created_at: sub.createdAt || new Date().toISOString(),
      });
    }
  }

  // ---- Cache ----

  async loadCache(): Promise<EventCache> {
    if (!this.db) return {};
    const rows = await this.db.query(TABLES.CACHE);
    const cache: EventCache = {};
    for (const r of rows) {
      cache[r.key as string] = r.value as string;
    }
    return cache;
  }

  async saveCacheValue(key: string, value: string): Promise<void> {
    if (!this.db) return;
    await this.db.delete(TABLES.CACHE, { key });
    await this.db.insert(TABLES.CACHE, { key, value });
  }

  async saveCacheBatch(entries: Record<string, string>): Promise<void> {
    if (!this.db) return;
    for (const [key, value] of Object.entries(entries)) {
      await this.db.delete(TABLES.CACHE, { key });
      await this.db.insert(TABLES.CACHE, { key, value });
    }
  }

  // ---- Logs ----

  async loadLogs(): Promise<LogEntry[]> {
    if (!this.db) return [];
    const rows = await this.db.query(TABLES.LOGS, undefined, {
      orderBy: "id",
      order: "DESC",
      limit: 500,
    });
    return rows.reverse().map((r) => ({
      time: r.time as number,
      level: r.level as string,
      msg: r.msg as string,
    }));
  }

  async saveLogs(entries: LogEntry[]): Promise<void> {
    if (!this.db) return;
    await this.db.delete(TABLES.LOGS);
    for (const e of entries.slice(-500)) {
      await this.db.insert(TABLES.LOGS, { time: e.time, level: e.level, msg: e.msg });
    }
  }

  async clearLogs(): Promise<void> {
    if (!this.db) return;
    await this.db.delete(TABLES.LOGS);
  }
}

export const githubStore = new GitHubStore();
