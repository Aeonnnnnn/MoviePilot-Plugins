/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

// MoviePilot 插件组件 Props 类型
export interface PluginComponent {
  pluginId: string
  config: PluginConfig
  eventBus: EventBus
}

export interface PluginConfig {
  attrs?: Record<string, any>
  data?: Record<string, any>
}

export interface EventBus {
  emit(event: string, ...args: any[]): Promise<any>
  on(event: string, callback: (...args: any[]) => void): void
  off(event: string, callback: (...args: any[]) => void): void
}

// 弹幕刮削状态
export interface ScrapeProgress {
  running: boolean
  total: number
  current: number
  current_file: string
  success: number
  failed: number
  duration?: number
}

// 弹幕过滤关键词
export interface FilterKeyword {
  keyword: string
  category: string
}

// 弹幕过滤分类
export interface FilterCategory {
  name: string
  enabled: boolean
  keywords: string[]
}

// 屏蔽用户
export interface BlockedUser {
  user_id: string
  credit_score: number
  block_reason: string
  blocked_at: string
}

// 匹配信息
export interface MatchInfo {
  file_path: string
  anime_id: number
  anime_title: string
  episode_offset: number
}
