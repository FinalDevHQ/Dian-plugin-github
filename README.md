# github-sub

GitHub 仓库/用户订阅推送插件，监控 Commits、Issues、Pull Requests、Comments、Actions，渲染为图片推送到 QQ 群。

> 适用版本：Dian `0.1.x` · plugin-runtime `0.2.x`

---

## 功能特性

- **仓库订阅** — 监控指定仓库的 Commits / Issues / Pull Requests / Comments / Actions
- **用户关注** — 监控指定 GitHub 用户的公开动态（Push、Issue、PR、Fork、Release 等）
- **图片渲染** — 通过 Dian Puppeteer 插件将通知渲染为精美卡片图片推送
- **自动识别** — 群内发送 GitHub 仓库链接时自动识别并展示仓库信息卡片
- **自定义模板** — 支持为每种事件类型编写自定义 HTML 模板
- **主题系统** — 内置亮色 / 暗色主题，支持自定义主题色
- **多 Token 轮换** — 配置多个 GitHub Token 自动轮换，提升 API 速率限制
- **合并通知** — 可将同一仓库的多种更新合并为一张图片推送
- **分支订阅** — 支持订阅多个分支，独立管理
- **Web UI** — 完整的管理面板，包含仪表盘、配置、订阅管理、调试日志

---

## 安装

### 方式一：插件市场安装

在 Dian 管理界面的插件市场中搜索 `github-sub` 并安装。

### 方式二：手动安装

1. 下载最新版本的 ZIP 文件
2. 在 Dian 管理界面 → 插件模块 → 上传插件
3. 等待安装成功提示

### 方式三：开发模式

```bash
cd my-plugin/Dian-plugin-github
npm install
npm run build
```

构建产物在 `dist/` 目录，打包后上传：

```bash
npm run pack
```

---

## 依赖

本插件的图片渲染依赖 [dian-plugin-puppeteer](../Dian-plugin-puppeteer)。请确保 Puppeteer 插件已安装并启动浏览器。

在「基础配置」页面可以设置：

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| Dian Web 端口 | Dian 后端 HTTP 端口 | `3000` |
| Puppeteer 插件名 | Puppeteer 插件的路由名 | `puppeteer` |

---

## 群指令

在群内发送以下指令（前缀 `gh`）：

| 指令 | 说明 | 示例 |
|------|------|------|
| `gh 帮助` | 显示所有指令 | `gh 帮助` |
| `gh 订阅 <仓库> [分支]` | 订阅仓库 | `gh 订阅 owner/repo main` |
| `gh 取消 <仓库> [分支]` | 取消订阅 | `gh 取消 owner/repo` |
| `gh 列表` | 查看当前群订阅 | `gh 列表` |
| `gh 全部` | 查看所有订阅 | `gh 全部` |
| `gh 开启 <仓库> [分支]` | 启用订阅 | `gh 开启 owner/repo` |
| `gh 关闭 <仓库> [分支]` | 禁用订阅 | `gh 关闭 owner/repo` |
| `gh 关注 <用户名>` | 关注 GitHub 用户 | `gh 关注 octocat` |
| `gh 取关 <用户名>` | 取消关注 | `gh 取关 octocat` |
| `gh 关注列表` | 查看关注列表 | `gh 关注列表` |

---

## Web UI

访问 `/plugins/github-sub/ui/` 打开管理面板，包含以下页面：

- **仪表盘** — 订阅统计概览、系统信息
- **基础配置** — Token、轮询间隔、主题、Puppeteer 服务设置
- **订阅管理** — 查看/编辑/删除仓库订阅和用户关注
- **添加订阅** — 添加仓库订阅或用户关注
- **调试日志** — 查看实时日志输出

---

## 基础配置

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| API Base URL | GitHub API 地址（可填 GitHub Enterprise 地址） | `https://api.github.com` |
| Token | GitHub Personal Access Token（可选） | 空 |
| 轮询间隔 | 检查更新的时间间隔（秒） | `30` |
| 允许成员订阅 | 非管理员是否可以使用 `gh 订阅` 指令 | `true` |
| 自动识别仓库链接 | 群内发送 GitHub 链接时自动识别 | `true` |
| 合并通知模式 | 将同一仓库的多种更新合并为一张图 | `false` |
| 渲染主题 | 亮色 / 暗色 / 自定义 | `light` |

### 多 Token

在 Web UI 的「基础配置」页面中可以添加多个 GitHub Token。插件会自动轮换使用，提升 API 速率限制。

---

## 自定义模板

在 Web UI 的「基础配置」页面可以为每种事件类型编写自定义 HTML 模板。

### 支持的模板类型

- `commits` — Commit 推送
- `issues` — Issue 更新
- `pulls` — Pull Request 更新
- `comments` — 评论更新
- `actions` — GitHub Actions 运行结果

### 可用变量

所有模板均可使用以下变量：

| 变量 | 说明 |
|------|------|
| `{{repo}}` | 仓库名（如 `owner/repo`） |
| `{{count}}` | 更新数量 |
| `{{type}}` | 类型名（如 `Commits`、`Issues`） |
| `{{time}}` | 当前时间 |
| `{{items}}` | JSON 数组，包含具体事件数据 |

### items 字段说明

**Commits：**
```json
[
  {
    "sha": "abc123...",
    "sha7": "abc1234",
    "message": "commit message",
    "author": "username",
    "date": "2026-01-01T00:00:00Z",
    "url": "https://github.com/...",
    "files": [
      {
        "filename": "src/index.ts",
        "status": "modified",
        "additions": 10,
        "deletions": 3,
        "patch": "@@ -1,3 +1,10 @@\n+added line\n-removed line"
      }
    ]
  }
]
```

**Issues / Pull Requests：**
```json
[
  {
    "number": 1,
    "title": "Issue title",
    "state": "open",
    "action": "opened",
    "author": "username",
    "created_at": "2026-01-01T00:00:00Z",
    "url": "https://github.com/...",
    "labels": [{ "name": "bug", "color": "d73a4a" }]
  }
]
```

**Comments：**
```json
[
  {
    "number": 12,
    "title": "Issue/PR title",
    "body": "comment body",
    "author": "username",
    "created_at": "2026-01-01T00:00:00Z",
    "url": "https://github.com/...",
    "source": "issue"
  }
]
```

**Actions：**
```json
[
  {
    "id": 1,
    "name": "CI",
    "run_number": 42,
    "status": "completed",
    "conclusion": "success",
    "actor": "username",
    "event": "push",
    "head_branch": "main",
    "created_at": "2026-01-01T00:00:00Z",
    "url": "https://github.com/..."
  }
]
```

---

## HTTP API

所有 API 路径前缀：`/plugins/github-sub/api`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/config` | 获取配置 |
| POST | `/config` | 更新配置 |
| GET | `/status` | 获取插件状态 |
| GET | `/groups` | 获取 Bot 群列表 |
| GET | `/puppeteer` | 检测 Puppeteer 渲染服务状态 |
| GET | `/ping` | 测试 GitHub API 连通性 |
| GET | `/logs` | 获取调试日志 |
| POST | `/logs/clear` | 清空日志 |
| POST | `/repo/branches` | 获取仓库分支列表 |
| POST | `/sub/add` | 添加仓库订阅 |
| POST | `/sub/update` | 更新订阅配置 |
| POST | `/sub/delete` | 删除订阅 |
| POST | `/sub/toggle` | 切换订阅开关 |
| POST | `/user/add` | 添加用户关注 |
| POST | `/user/update` | 更新用户关注 |
| POST | `/user/delete` | 删除用户关注 |
| POST | `/user/toggle` | 切换用户关注开关 |

---

## 项目结构

```
Dian-plugin-github/
├── src/
│   ├── index.ts        ← 插件主入口（装饰器、路由、指令）
│   ├── config.ts       ← 默认配置 & 配置读写
│   ├── types.ts        ← TypeScript 类型定义
│   ├── state.ts        ← 运行时状态管理
│   ├── github.ts       ← GitHub API 请求封装
│   ├── render.ts       ← 图片模板渲染（Puppeteer）
│   ├── poller.ts       ← 定时轮询引擎
│   └── version.ts      ← 版本号
├── ui/
│   ├── App.tsx         ← React 主应用（路由）
│   ├── api.ts          ← API 请求封装
│   ├── main.tsx        ← 入口
│   ├── index.css       ← 全局样式
│   ├── types.ts        ← 前端类型
│   ├── components.tsx  ← 通用组件
│   ├── components/
│   │   ├── Toast.tsx       ← Toast 提示
│   │   └── GroupPicker.tsx ← 群选择器
│   └── pages/
│       ├── Dashboard.tsx     ← 仪表盘
│       ├── Config.tsx        ← 基础配置
│       ├── Subscriptions.tsx ← 订阅管理
│       ├── AddSub.tsx        ← 添加订阅
│       └── Logs.tsx          ← 调试日志
├── scripts/
│   ├── pack.mjs        ← ZIP 打包脚本
│   └── dev-sync.mjs    ← 远程开发同步脚本
├── package.json
├── tsconfig.json
├── tsup.config.ts      ← 后端构建配置
└── tsconfig.json
```

---

## 开发

```bash
# 安装依赖
npm install

# 构建（后端 tsup + 前端 vite）
npm run build

# 后端开发模式（监听变动）
npm run dev:plugin

# 前端开发模式（Vite dev server，需配合代理）
npm run dev:ui

# 远程开发同步
npm run dev:sync

# 打包 ZIP
npm run pack
```

前端开发时，Vite 会将 `/plugins/*` 请求代理到 `http://127.0.0.1:3000`（Dian 后端）。确保 Dian 服务正在运行。

---

## 许可证

MIT
