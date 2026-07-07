export type EventType = 'commits' | 'issues' | 'pulls' | 'actions';

export interface Subscription {
  botId?: string;
  repo: string;
  branch: string;
  types: EventType[];
  groups: string[];
  enabled: boolean;
  createdAt: string;
}

export interface UserSubscription {
  botId?: string;
  username: string;
  groups: string[];
  enabled: boolean;
  createdAt: string;
}

export interface ThemeColors {
  bg: string;
  card: string;
  border: string;
  divider: string;
  text: string;
  textSub: string;
  textMuted: string;
  codeBg: string;
  codeHeader: string;
}

export type ThemeMode = 'light' | 'dark' | 'custom';

export interface PluginConfig {
  command: string;
  reply: string;
  muteCommand: string;
  muteDuration: number;
  token: string;
  tokens: string[];
  apiBase: string;
  interval: number;
  debug: boolean;
  owners: string[];
  allowMemberSub: boolean;
  theme: ThemeMode;
  customTheme?: ThemeColors;
  customHTML?: {
    commits?: string;
    issues?: string;
    pulls?: string;
    comments?: string;
    actions?: string;
  };
  autoDetectRepo: boolean;
  enablePreReply: boolean;
  preReplyEmojiId: string;
  successEmojiId: string;
  failEmojiId: string;
  mergeNotify: boolean;
  puppeteerPlugin: string;
  webuiPort?: number;
  proxy?: string;
  subscriptions: Subscription[];
  userSubscriptions: UserSubscription[];
  customCommands: CustomCommand[];
  adminConfig?: AdminConfig;
}

export interface EventCache {
  [key: string]: string;
}

export interface GitHubEvent {
  id: string;
  type: string;
  actor: { login: string; avatar_url: string };
  created_at: string;
  payload: Record<string, any>;
}

export interface CommitData {
  sha: string;
  commit: {
    message: string;
    author: { name: string; date: string };
    committer: { name: string; date: string };
  };
  author: { login: string; avatar_url: string } | null;
  html_url: string;
  files?: CommitFile[];
}

export interface CommitFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  patch?: string;
}

export interface IssueData {
  number: number;
  title: string;
  state: string;
  user: { login: string; avatar_url: string };
  created_at: string;
  updated_at: string;
  html_url: string;
  body: string | null;
  labels: { name: string; color: string }[];
  action?: string;
  pull_request?: unknown;
}

export interface CommentData {
  number: number;
  title: string;
  body: string;
  user: { login: string; avatar_url: string };
  created_at: string;
  html_url: string;
  source: 'issue' | 'pull_request';
}

export interface RepoInfo {
  full_name: string;
  description: string | null;
  html_url: string;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  language: string | null;
  license: { name: string } | null;
  owner: { login: string; avatar_url: string };
  created_at: string;
  updated_at: string;
  topics: string[];
  default_branch: string;
}

export interface ActionRunData {
  id: number;
  name: string;
  head_branch: string;
  head_sha: string;
  status: string;
  conclusion: string | null;
  html_url: string;
  created_at: string;
  updated_at: string;
  actor: { login: string; avatar_url: string };
  event: string;
  run_number: number;
}

export interface UserActivityItem {
  type: string;
  repo: string;
  desc: string;
  time: string;
  url: string;
}

export interface LogEntry {
  time: number;
  level: string;
  msg: string;
}

export interface CustomCommand {
  id: string;
  alias: string;
  command: string;
  enabled: boolean;
}

export interface AdminConfig {
  superAdmins: string[];      // 大管理员用户ID列表（WebUI配置）
  admins: string[];           // 普通管理员用户ID列表（命令添加）
}
