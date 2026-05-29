export type EventType = "commits" | "issues" | "pulls" | "actions"
export type ThemeMode = "light" | "dark" | "custom"

export interface Subscription {
  repo: string
  branch: string
  types: EventType[]
  groups: string[]
  enabled: boolean
  createdAt: string
}

export interface UserSubscription {
  username: string
  groups: string[]
  enabled: boolean
  createdAt: string
}

export interface Config {
  token: string
  tokens: string[]
  tokenCount: number
  command: string
  reply: string
  muteCommand: string
  muteDuration: number
  apiBase: string
  interval: number
  debug: boolean
  owners: string[]
  allowMemberSub: boolean
  autoDetectRepo: boolean
  mergeNotify: boolean
  puppeteerPlugin: string
  webuiPort: number
  theme: ThemeMode
  customTheme: Record<string, string> | null
  customHTML: { commits?: string; issues?: string; pulls?: string; comments?: string; actions?: string } | null
}

export interface ConfigResponse {
  success: boolean
  version: string
  config: Config
  subscriptions: Subscription[]
  userSubscriptions: UserSubscription[]
  customCommands: CustomCommand[]
}

export interface StatusResponse {
  startTime: number
  uptime: number
  version: string
  repoSubscriptions: number
  userSubscriptions: number
  config: { apiBase: string; interval: number; debug: boolean; theme: string }
}

export interface BranchInfo {
  name: string
  isDefault: boolean
}

export interface LogEntry {
  time: number
  level: string
  msg: string
}

export interface GroupInfo {
  group_id: number | string
  group_name: string
}

export interface CustomCommand {
  id: string
  alias: string
  command: string
  enabled: boolean
}

export interface AdminConfig {
  superAdmins: string[]
  admins: string[]
}
