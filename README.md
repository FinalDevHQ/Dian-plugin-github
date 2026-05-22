# Dian 插件开发手册

> 适用版本：Dian `0.1.x` · plugin-runtime `0.1.x`

Dian 插件系统基于 TypeScript 装饰器，支持**消息处理、HTTP 路由、指令注册、Web UI**四大能力，插件以 ZIP 包形式安装，事件 Handler 热加载生效。

---

## 目录

1. [环境准备](#1-环境准备)
2. [项目结构](#2-项目结构)
3. [插件声明 @Plugin](#3-插件声明-plugin)
4. [消息 Handler @Handler](#4-消息-handler-handler)
5. [拦截器 @Interceptor](#5-拦截器-interceptor)
6. [onSetup — 高级注册](#6-onsetup--高级注册)
   - [6.1 HTTP API 路由](#61-http-api-路由)
   - [6.2 命令式指令](#62-命令式指令)
   - [6.3 Web UI](#63-web-ui)
   - [6.4 插件数据源（datasource）](#64-插件数据源datasource)
7. [EventContext API](#7-eventcontext-api)
   - [7.1 sendAction — 调用底层 Bot API](#71-sendaction--调用底层-bot-api)
   - [7.2 PluginStore — 插件专属数据库](#72-pluginstore--插件专属数据库)
   - [7.3 内置帮助菜单](#73-内置帮助菜单)
8. [BotEvent 数据结构](#8-botevent-数据结构)
9. [Bot 作用域（白名单）](#9-bot-作用域白名单)
10. [构建 & 打包](#10-构建--打包)
11. [打包策略：bundle vs external（重要）](#11-打包策略bundle-vs-external重要)
12. [安装方式](#12-安装方式)
13. [发布到官方插件市场](#13-发布到官方插件市场)
14. [热重载说明](#14-热重载说明)
15. [完整示例](#15-完整示例)

---

## 1. 环境准备

```bash
# 在 Dian 项目根目录先执行一次全量构建
npm run build

# 进入模板目录安装依赖
cd plugin-template
npm install
```

修改以下两处，设置你的插件 ID（全局唯一）：

**`package.json`**
```json
{ "name": "my-plugin" }
```

**`src/index.ts`** 中的 `@Plugin`
```ts
@Plugin({ name: "my-plugin", ... })
```

> **注意**：`package.json` 的 `name` 与 `@Plugin` 的 `name` 必须一致，否则打包和 URL 路由会对不上。

---

## 2. 项目结构

```
plugin-template/
├── src/
│   ├── index.ts          ← 插件主入口（唯一必须的文件）
│   └── public/           ← Web UI 静态文件目录（可选）
│       └── index.html
├── scripts/
│   └── pack.mjs          ← 打包脚本（基于 fflate，跨平台纯 JS）
├── package.json
├── tsconfig.json
└── tsup.config.ts        ← 打包配置（默认把 runtime bundle 为单文件，见第 10 节）
```

构建产物（`dist/`）会被打包进 ZIP：

```
dist/
├── index.js      ← 插件逻辑（已 bundle，含 decorators）
└── public/       ← Web UI（由 tsup onSuccess 复制）
    └── index.html
```

---

## 3. 插件声明 @Plugin

每个插件的**默认导出类**必须标注 `@Plugin`，提供插件元信息。

```ts
import "reflect-metadata";
import { Plugin } from "@myfinal/plugin-runtime";

@Plugin({
  name: "my-plugin",          // 必填，全局唯一 ID
  description: "插件描述",    // 可选，显示在管理界面
  version: "1.0.0",           // 可选
  author: "your-name",        // 可选
  icon: "🔌",                 // 可选，emoji 或图片 URL
})
export default class MyPlugin {
  // ...
}
```

---

## 4. 消息 Handler @Handler

`@Handler` 标注的方法会在消息文本匹配时被调用，支持**精确字符串**或**正则表达式**匹配。

```ts
import { Handler, type EventContext } from "@myfinal/plugin-runtime";

// 精确匹配 "!ping"（区分大小写）
@Handler("!ping")
async onPing(ctx: EventContext): Promise<void> {
  console.log("收到 ping，发送者：", ctx.event.payload.senderName);
}

// 正则匹配，支持捕获组
@Handler(/^!echo\s+(.+)$/)
async onEcho(ctx: EventContext): Promise<void> {
  const text = ctx.event.payload.text ?? "";
  const [, content] = text.match(/^!echo\s+(.+)$/) ?? [];
  console.log("echo:", content);
}
```

**匹配规则**：
- 字符串 → 与 `event.payload.text` 完全相等
- 正则 → `regex.test(event.payload.text ?? "")`
- 多个 `@Handler` 可以标注在同一个类的不同方法上
- 若拦截器调用了 `ctx.stopPropagation()`，本 Handler 将不被执行

---

## 5. 拦截器 @Interceptor

拦截器在所有 Handler **之前**执行，可用于日志、鉴权、消息过滤等。

```ts
import { Interceptor, type EventContext } from "@myfinal/plugin-runtime";

@Interceptor(50)   // 数字为优先级，越小越先执行，默认 100
async filter(ctx: EventContext): Promise<void> {
  // 屏蔽特定群的所有消息
  if (ctx.event.payload.groupId === "blocked_group_id") {
    ctx.stopPropagation();   // 阻止后续所有 Handler
    return;
  }

  // 日志记录（不阻止，继续执行后续 Handler）
  console.log(`[${ctx.event.botId}] ${ctx.event.payload.text}`);
}
```

---

## 6. onSetup — 高级注册

在类中定义 `onSetup(ctx: PluginSetupContext)` 方法，Dian 在加载插件时会调用它，用于注册 HTTP 路由、指令和 UI。

```ts
import { type PluginSetupContext } from "@myfinal/plugin-runtime";

onSetup(ctx: PluginSetupContext): void {
  // 见下文各小节
}
```

### 6.1 HTTP API 路由

```ts
ctx.route(method, path, handler);
```

- **访问地址**：`/plugins/<name>/api<path>`
- `method`：`"GET"` `"POST"` `"PUT"` `"DELETE"` `"PATCH"`
- `handler`：Fastify 路由处理函数 `(request, reply) => void`

```ts
// GET /plugins/my-plugin/api/status
ctx.route("GET", "/status", (_req, reply) => {
  reply.send({ ok: true, ts: Date.now() });
});

// POST /plugins/my-plugin/api/config
ctx.route("POST", "/config", (req, reply) => {
  const body = req.body as { key: string; value: string };
  // ... 保存配置
  reply.send({ saved: true });
});
```

> **注意**：HTTP 路由在**服务器启动时**注册，安装后需**重启 Dian 服务**才能生效。事件 Handler 和指令支持热加载，无需重启。

### 6.2 命令式指令

等同于 `@Handler`，但额外携带 `name` 和 `description` 用于在管理界面展示。支持 `category`（分类名）和 `children`（子命令）用于帮助菜单树状展示。

```ts
ctx.command({
  name: "!ping",             // 显示名
  pattern: "!ping",          // 匹配字符串，也可传 RegExp 或 () => RegExp|string
  description: "回复 pong",  // 可选，管理界面展示
  category: "趣味",          // 可选，分类名，帮助菜单中按此分组
  children: [                // 可选，子命令列表，用于树状菜单
    { name: "!ping stats", pattern: "!ping stats", description: "查看统计" },
  ],
  async handler(c: EventContext) {
    await c.reply("Hello!");
  },
});
```

> `pattern` 也可以传**函数** `() => this.config.command`，每次匹配时实时求值，实现"配置即改即生效"，无需重启服务。

### 6.3 Web UI

将静态文件放到 `src/public/`，声明后 Dian 自动 serve：

```ts
ctx.ui({
  staticDir: "./public",   // 相对于 dist/index.js 的目录
  entry: "index.html",     // 入口文件，默认 index.html
});
```

- **访问地址**：`/plugins/<name>/ui/`
- 管理界面的「插件界面」区域会以 **iframe** 嵌入此地址
- 页面内可以用相对路径调用插件自己的 API：

```js
// 在 public/index.html 内
fetch("/plugins/my-plugin/api/status")
  .then(r => r.json())
  .then(data => console.log(data));
```

### 6.4 插件数据源（datasource）

注册插件专属的 SQLite 数据库，框架会自动将其注册到 DatabaseExplorer，在数据库查看器中以独立数据源展示。

```ts
import { resolve } from "node:path";

onSetup(ctx: PluginSetupContext): void {
  // 声明插件专属 SQLite 文件
  ctx.datasource(
    "my-plugin",                                    // 数据源名称
    resolve(process.cwd(), "data", "my-plugin.db"), // SQLite 文件绝对路径
  );
}
```

---

## 7. EventContext API

```ts
interface EventContext {
  /** 当前事件 */
  readonly event: BotEvent;

  /**
   * 阻止当前事件继续向后续 Handler 传递。
   * 调用后，优先级更低的拦截器和所有 Handler 不再执行。
   */
  stopPropagation(): void;

  /**
   * 向事件来源（群/私聊）发送文本回复。
   * 与 sendAction("send_msg", ...) 等价，但更简洁。
   */
  reply(text: string): Promise<void>;

  /**
   * 调用底层平台 API（OneBot/飞书等）。
   * 可执行 send_group_msg、set_group_ban、get_group_info 等操作。
   * @param action  action 名称，如 "send_group_msg"、"set_group_ban"
   * @param params  action 参数
   * @returns       ActionResult
   */
  sendAction(action: string, params?: Record<string, unknown>): Promise<ActionResult>;

  /** 插件存储接口，用于创建和操作插件专属的 SQLite 表 */
  store?: PluginStore;
}
```

### 7.1 sendAction — 调用底层 Bot API

`sendAction` 让你的插件可以直接调用 Bot 协议 API（如 OneBot），实现**禁言、踢人、取群成员列表**等高级操作。

```ts
@Handler("!mute")
async onMute(ctx: EventContext): Promise<void> {
  if (!ctx.event.payload.groupId) {
    await ctx.reply("此指令只能在群聊中使用");
    return;
  }

  // 调用 OneBot 的 set_group_ban API
  const result = await ctx.sendAction("set_group_ban", {
    group_id: Number(ctx.event.payload.groupId),
    user_id:  123456789,
    duration: 60, // 秒
  });

  if (result.ok) {
    await ctx.reply("已禁言 60 秒");
  } else {
    await ctx.reply(`操作失败: ${result.message ?? "未知错误"}`);
  }
}
```

> `sendAction` 的返回值类型为 `ActionResult`：`{ ok: boolean; status: "ok" | "failed" | "timeout"; retcode?: number; message?: string; data?: T }`。

### 7.2 PluginStore — 插件专属数据库

`PluginStore` 提供简单的 SQLite 操作接口，无需额外配置，即可创建表和写入/查询数据。

```ts
interface PluginStore {
  /** 创建插件专属表 */
  createTable(tableName: string, columns: string[]): Promise<void>;

  /** 插入数据 */
  insert(tableName: string, data: Record<string, unknown>): Promise<void>;

  /** 查询数据，支持条件筛选、排序和分页 */
  query(tableName: string, params?: Record<string, unknown>, options?: {
    limit?: number;
    orderBy?: string;
    order?: "ASC" | "DESC";
  }): Promise<Record<string, unknown>[]>;

  /** 删除数据 */
  delete(tableName: string, params?: Record<string, unknown>): Promise<number>;
}
```

使用示例：

```ts
export default class MyPlugin {
  onSetup(ctx: PluginSetupContext): void {
    ctx.command({
      name: "!record",
      pattern: /^!record\s+(.+)$/,
      description: "记录一条数据到插件数据库",
      handler: async (c: EventContext) => {
        if (!c.store) return;

        const text = c.event.payload.text ?? "";
        const [, content] = text.match(/^!record\s+(.+)$/) ?? [];

        // 创建表（幂等操作）
        await c.store.createTable("my_notes", [
          "id INTEGER PRIMARY KEY AUTOINCREMENT",
          "content TEXT",
          "user_id TEXT",
          "created_at INTEGER",
        ]);

        // 插入数据
        await c.store.insert("my_notes", {
          content: content ?? "",
          user_id: c.event.payload.userId ?? "",
          created_at: Date.now(),
        });

        await c.reply("已记录！");
      },
    });
  }
}
```

### 7.3 内置帮助菜单

框架内置了帮助菜单功能：当用户在群里输入 `菜单`、`help` 或 `帮助` 时，会自动触发已注册指令的树状展示。

输出的帮助菜单会根据 `command.category` 进行分组：

```
📋 可用命令：
├─ 趣味
│  ├ !hello - 回复 "Hello World!"
│  └ !joke - 讲个笑话
├─ 管理
│  └ !mute - 禁言用户（需管理员权限）
└ !help - 显示帮助
```

---

## 8. BotEvent 数据结构

```ts
interface BotEvent {
  eventId:   string;                              // 唯一事件 ID（格式：{botId}:{message_id}）
  botId:     string;                              // 触发事件的 Bot ID
  platform:  "onebot";                            // 来源平台
  type:      "message" | "message_sent" | "notice" | "request" | "meta_event"; // 事件大类
  subtype:   string;                              // 事件子类型（如 message.group / notice.group_increase）
  timestamp: number;                              // 事件时间戳（**秒级**，与 OneBot 协议一致）
  payload: EventPayload;
  raw: unknown;                                   // OneBot 协议原始数据（可强转为具体类型）
}
```

### EventPayload

```ts
interface EventPayload {
  text?:        string;   // 消息文本（message 事件可用）
  userId?:      string;   // 发送者 QQ 号
  groupId?:     string;   // 群号（私聊时为空）
  channelId?:   string;   // 频道 ID（频道消息可用）
  messageId?:   string;   // 消息 ID
  senderName?:  string;   // 发送者昵称 / 群名片
  [key: string]: unknown; // 其余扩展字段
}
```

---

## 9. Bot 作用域（白名单）

Dian 支持为每个插件设置允许响哪些 Bot 的消息。默认空列表 = **拒绝所有 Bot**，插件不会处理任何消息/事件。

在管理界面（插件列表 → 点击插件 → Bot 作用域）可以配置插件生效的 Bot 实例。配置后框架自动持久化，重启不丢失。

通过 API 设置：

```http
PUT /plugins/:name/bots
Content-Type: application/json

{ "bots": ["bot_qq_1", "bot_qq_2"] }
```

---

## 10. 构建 & 打包

```bash
# 开发时监听变动
npm run dev

# 一次性构建
npm run build

# 构建 + 打包为 ZIP（跨平台，纯 JS，使用 fflate）
npm run pack
```

`npm run pack` 生成 `<name>.zip`，ZIP 内容即为 `dist/` 目录的平铺结构：

```
my-plugin.zip/
├── index.js
└── public/
    └── index.html
```

---

## 11. 打包策略：bundle vs external（重要）

这是新手最容易踩、也是最隐蔽的坑——**你的插件是否需要访问 runtime 单例？**

### 默认行为

模板默认把 `@myfinal/plugin-runtime` **打包进** `dist/index.js`（`tsup.config.ts` 中的 `noExternal`）。这让插件成为**单文件可移植**的产物，可以拷贝到任意 Dian 实例运行。

这种设置对**绝大多数业务插件**都是正确的：

- `@Plugin` / `@Handler` / `@Interceptor` 装饰器只往类上写元数据，元数据 key 是 `Symbol.for("dian:plugin")`，**跨 bundle 共享**。即便每个插件都内联一份 decorators 实现，宿主进程依然能读到你写入的元信息。
- `EventContext` `PluginSetupContext` `BotEvent` 等都是 TypeScript 类型，编译后被擦除，无运行时副作用。
- `ctx.command()` `ctx.route()` `ctx.ui()` 是宿主在 `onSetup` 时**通过参数注入的回调**，不依赖单例。

### 什么时候必须改为 external？

**当且仅当**你的插件 `import` 了 `pluginManager`（或将来类似的全局单例）：

```ts
import { pluginManager } from "@myfinal/plugin-runtime";

// ❌ 默认 noExternal 配置下，这里读到的是 bundle 里的另一份**空**单例
pluginManager.listPluginsMeta();
```

**原因**：模块级 JS 对象（`pluginManager` 是 `new PluginManager()` 的导出实例）跟元数据 Symbol 不同，**不会跨 bundle 共享**。每个 bundle 里的 `pluginManager` 都是独立的对象，所以你拿到的永远是自己 bundle 里的、空的那份。

**修复**：改 `tsup.config.ts`，把 `@myfinal/plugin-runtime` 从 `noExternal` 移到 `external`：

```ts
export default defineConfig({
  // ...
  external:   ["@myfinal/plugin-runtime"],   // ← 由宿主提供，运行时共享单例
  noExternal: ["reflect-metadata"],        // 幂等 polyfill，保留打包无妨
});
```

外置后，Node 在加载 `plugins/<name>/index.js` 时，会沿着目录向上查找 `node_modules/@myfinal/plugin-runtime`，解析到宿主进程使用的同一份模块，从而共享 `pluginManager` 单例。

### 速查表

| 你的插件用到了哪些 API | 推荐配置 |
|---|---|
| 仅用 `@Plugin` / `@Handler` / `@Interceptor` | 默认 `noExternal`（单文件可移植） |
| `onSetup` + `ctx.command/route/ui` | 默认 `noExternal` |
| `import { pluginManager }` 调用其方法 | **必须** `external: ["@myfinal/plugin-runtime"]` |

> **判断诀窍**：搜索你 src 里有没有 `pluginManager`。有 → external；没有 → 默认即可。

---

## 12. 安装方式

### 方式一：管理界面上传（推荐）

1. 打开 Dian 管理界面 → **插件模块**
2. 点击左上角 **⬆ 上传**图标
3. 拖入或选择 `<name>.zip`
4. 点击 **安装**，等待成功提示
5. 点击刷新，插件出现在列表中

### 方式二：手动解压

将 ZIP 解压到 `plugins/<name>/` 目录：

```
Dian/
└── plugins/
    └── my-plugin/         ← 解压到此处
        ├── index.js
        └── public/
            └── index.html
```

---

## 13. 发布到官方插件市场

打完包之后，你可以让自己的插件出现在 Dian 客户端「插件市场」页里，让所有用户一键安装。流程基于 PR：

### 12.1 准备 ZIP 直链

最常见、推荐的做法是借助 GitHub Release：

1. 把插件代码推到自己的 GitHub 仓库（推荐**直接 fork 本模板**：[`FinalDevHQ/Dian-plugin-template`](https://github.com/FinalDevHQ/Dian-plugin-template)）。
2. 修改 `package.json` 的 `name` / `version` / `description` / `author` 等字段。
3. 推送 tag（如 `v1.0.0`），本模板自带的 `.github/workflows/release.yml` 会自动 `npm run pack` 并把 ZIP 上传到 GitHub Release。
4. 复制 Release 页面里 ZIP 的下载直链，形如：

   ```
   https://github.com/<user>/<repo>/releases/download/v1.0.0/<plugin-name>.zip
   ```

> 不用 GitHub 也可以——只要 `downloadUrl` 是公网可访问的、稳定的 ZIP 直链即可。

### 12.2 向索引库提 PR

Dian 客户端的插件市场从 [`FinalDevHQ/Dian-plugins`](https://github.com/FinalDevHQ/Dian-plugins) 仓库的 `index.json` 拉取列表。提交流程：

1. **Fork** [`FinalDevHQ/Dian-plugins`](https://github.com/FinalDevHQ/Dian-plugins)。
2. 在 `index.json` 的 `plugins` 数组**末尾追加**一项：

   ```jsonc
   {
     "name":              "your-plugin",      // 与 @Plugin.name 完全一致，kebab-case
     "displayName":       "Your Plugin",      // 市场展示名
     "description":       "一行简介（≤60 字）",
     "version":           "1.0.0",
     "author":            "your-name",
     "icon":              "🔌",                // 单个 emoji 或图片 URL
     "tags":              ["工具"],            // 1-3 个
     "hasUI":             false,
     "minRuntimeVersion": "0.1.0",
     "homepage":          "https://github.com/<user>/<repo>",
     "downloadUrl":       "https://github.com/<user>/<repo>/releases/download/v1.0.0/your-plugin.zip",
     "changelog": [
       { "version": "1.0.0", "date": "2026-01-01", "notes": "初始版本" }
     ]
   }
   ```

   完整字段定义见 [`schema.json`](https://github.com/FinalDevHQ/Dian-plugins/blob/main/schema.json)，IDE 会基于 `$schema` 自动补全。

3. 把 `index.json` 顶部的 `updatedAt` 改成当天日期。
4. 在 `README.md` 的插件列表表格 + 详情区追加你的插件条目。
5. 提 PR，标题约定：

   ```
   feat: add plugin <name> v<version>
   ```

合并后客户端会在下一次刷新时自动看到你的插件。

### 12.3 发布新版本

只需在同一份 PR 流程里**改对应条目**即可，无需新建条目：

1. 在自己的仓库推新 tag（`v1.1.0` 等），等待 release.yml 上传新 ZIP。
2. 向 `Dian-plugins` 再提一个 PR，更新对应条目的：
   - `version`
   - `downloadUrl`（指向新版本的 zip）
   - `changelog` 数组**前置插入**一项新的版本说明
   - 顶部 `updatedAt`
3. PR 标题：`chore: bump <name> to v<version>`。

### 12.4 本地调试

不发布到索引库也能跑：直接把 ZIP 拖到 Dian Web 面板 → 插件模块 → 上传插件，就能本地安装调试。索引库 PR 是为了让**别人**也能在他们的客户端里发现并安装你的插件。

---

## 14. 热重载说明

Dian 使用 chokidar 监听 `plugins/` 目录，文件变化时自动重载：

| 功能 | 热加载 | 说明 |
|---|---|---|
| `@Handler` 消息处理 | ✅ 即时生效 | 无需任何操作 |
| `@Interceptor` 拦截器 | ✅ 即时生效 | 无需任何操作 |
| `ctx.command` 指令 | ✅ 即时生效 | 无需任何操作 |
| `ctx.route` HTTP 路由 | ❌ 需重启 | Fastify 不支持运行时动态注册 |
| `ctx.ui` Web UI | ❌ 需重启 | 静态 serve 在启动时注册 |

> **调试建议**：修改 Handler/拦截器逻辑时，`npm run dev` + 保存即可生效；新增/修改路由时，重新 pack → 上传 → 重启服务。

---

## 15. 完整示例

```ts
import "reflect-metadata";
import {
  Plugin,
  Handler,
  Interceptor,
  type EventContext,
  type PluginSetupContext,
} from "@myfinal/plugin-runtime";

@Plugin({
  name: "my-plugin",
  description: "示例插件",
  version: "1.0.0",
  author: "your-name",
  icon: "🔌",
})
export default class MyPlugin {
  // ── 拦截器（最先执行） ────────────────────────────────────────────────────
  @Interceptor(10)
  async log(ctx: EventContext): Promise<void> {
    const { type, payload, platform } = ctx.event;
    if (type === "message") {
      console.log(`[my-plugin] [${platform}] <${payload.senderName}> ${payload.text}`);
    }
  }

  // ── 消息 Handler ──────────────────────────────────────────────────────────
  @Handler("!ping")
  async onPing(ctx: EventContext): Promise<void> {
    await ctx.reply("Hello!");
  }

  @Handler(/^!repeat\s+(.+)$/)
  async onRepeat(ctx: EventContext): Promise<void> {
    const [, content] = (ctx.event.payload.text ?? "").match(/^!repeat\s+(.+)$/) ?? [];
    await ctx.reply(content);
  }

  // ── sendAction 示例：调用 Bot API ────────────────────────────────────────
  @Handler("!mute")
  async onMute(ctx: EventContext): Promise<void> {
    if (!ctx.event.payload.groupId) {
      await ctx.reply("此指令只能在群聊中使用");
      return;
    }
    const result = await ctx.sendAction("set_group_ban", {
      group_id: Number(ctx.event.payload.groupId),
      user_id: Number(ctx.event.payload.userId),
      duration: 60,
    });
    await ctx.reply(result.ok ? "已禁言 60 秒" : `操作失败: ${result.message ?? ""}`);
  }

  // ── HTTP 路由 / 指令 / 数据源 / UI ──────────────────────────────────────
  onSetup(ctx: PluginSetupContext): void {
    ctx.route("GET", "/status", (_req, reply) => {
      reply.send({ ok: true, plugin: "my-plugin" });
    });

    ctx.command({
      name: "!help",
      pattern: "!help",
      description: "显示帮助",
      category: "工具",
      async handler(c) {
        await c.reply("可用指令：!ping, !repeat <内容>, !mute");
      },
    });

    ctx.datasource("my-plugin", "/path/to/my-plugin.db");

    ctx.ui({ staticDir: "./public", entry: "index.html" });
  }
}
```
