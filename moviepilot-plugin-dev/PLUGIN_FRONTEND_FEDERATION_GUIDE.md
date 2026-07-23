# MoviePilot Vue 联邦组件开发指南

> 适用：插件自带 Vue 前端（详情页/设置弹窗/侧栏页面）。
> 来源：DanmuCustom 实战 + MP 联邦插件协议 + 10 插件研读（仅 BrushFlow 含 `get_render_mode`，其余为后端插件）。

---

## 1. 什么是联邦组件（Module Federation）

MP 前端是主应用，插件前端是远程模块。插件通过 `vite` 的 `ModuleFederation` 把组件打包成 `dist/assets/remoteEntry.js`，MP 主应用按需加载：

```
插件前端 build 产物
└── dist/
    └── assets/
        ├── remoteEntry.js      # 联邦入口，声明暴露的组件
        ├── Page-xxxx.js        # 各组件 chunk
        └── ...
```

MP 通过 `remoteEntry.js` 里的 `exposes` 找到 `./Config`、`./Page` 等组件并渲染。

---

## 2. 必须暴露的组件

```js
// frontend/vite.config.js
export default defineConfig({
  plugins: [vue(), ...],
  build: {
    rollupOptions: {
      external: ['vue', 'vuetify', 'axios'],
    },
  },
  server: { port: 5173 },
})
```

```js
// 通过 vite-plugin-federation
federation({
  name: 'danmucustom',
  filename: 'remoteEntry.js',
  exposes: {
    './Config': './src/components/Config.vue',
    './Page': './src/components/Page.vue',
    './AppPage': './src/components/AppPage.vue',
    // 多页面插件还要暴露：
    './AppPageFilter': './src/components/AppPageFilter.vue',
    './AppPageScrape': './src/components/AppPageScrape.vue',
    './Dashboard': './src/components/Dashboard.vue',
  },
  shared: ['vue', 'vuetify', 'axios'],
})
```

**关键**：`exposes` 的 key 必须与后端 `get_render_mode`、前端 `main.js` 的 `loadComponent` 完全一致。
新增页面（如 `./AppPageFilter`）必须加进 `exposes`，否则 `remoteEntry.js` 不含该组件 → 加载失败。

---

## 3. 后端声明渲染模式

```python
@staticmethod
def get_render_mode() -> Tuple[str, Optional[str]]:
    """声明 Vue 联邦渲染模式。"""
    return "vue", "dist/assets"

def get_page(self) -> List[dict]:
    """侧栏/详情页入口；返回组件名需与 exposes 一致。"""
    if not self.get_state():
        return []
    return [
        {"name": "弹幕刮削", "component": "AppPage"},
        {"name": "弹幕过滤", "component": "AppPageFilter"},
    ]
```

> `get_page` 返回空数组 `[]` 时，页面入口不会出现——这是 DanmuCustom 早期问题之一。
> 想显示 Vue 页面，必须返回 `{"component": "AppPageFilter"}` 等，且对应 `./AppPageFilter` 已 expose。

---

## 4. 前端组件入口（main.js）

```js
import { createApp } from 'vue'
import App from './App.vue'

// MP 通过 loadComponent 注入不同组件；main.js 仅作为本地开发/兜底
createApp(App).mount('#app')
```

本地开发用 `npm run dev`；交付用 `npm run build` 生成 `dist/`。

---

## 5. 组件接收的 props（MP 注入）

MP 向联邦组件注入：

| prop | 说明 |
|------|------|
| `pluginId` | 插件 ID（如 `DanmuCustom`） |
| `config` / `initialConfig` | 插件配置 |
| `eventBus` | 事件总线 |
| `navKey` | 侧栏导航 key（多页面时区分 scrape/filter） |
| `api` | **MP 注入的鉴权请求对象**（优先用它发请求） |

父组件必须透传 `api` 给子组件：

```vue
<!-- AppPage.vue -->
<template>
  <AppPageScrape v-if="navKey === 'scrape' || !navKey"
    :plugin-id="pluginId" :config="config" :event-bus="eventBus"
    :nav-key="navKey" :api="api" />
  <AppPageFilter v-else
    :plugin-id="pluginId" :config="config" :event-bus="eventBus"
    :nav-key="navKey" :api="api" />
</template>
<script setup>
import AppPageScrape from './AppPageScrape.vue'
import AppPageFilter from './AppPageFilter.vue'
defineProps(['pluginId', 'config', 'eventBus', 'navKey', 'api'])
</script>
```

---

## 6. 请求封装：优先 props.api，fallback axios

```js
import axios from 'axios'

const API_PLUGIN_ID = 'DanmuCustom'

const requestGet = async (path, options = {}) => {
  if (props.api?.get) {
    return await props.api.get(`plugin/${API_PLUGIN_ID}${path}`, options)
  }
  const res = await axios.get(`/api/v1/plugin/${API_PLUGIN_ID}${path}`, options)
  return res.data
}

const requestPost = async (path, data = {}, options = {}) => {
  if (props.api?.post) {
    return await props.api.post(`plugin/${API_PLUGIN_ID}${path}`, data, options)
  }
  const res = await axios.post(`/api/v1/plugin/${API_PLUGIN_ID}${path}`, data, options)
  return res.data
}

// 防御不同返回结构
const unwrap = (res) => res?.data ?? res
```

> 注意：插件**未启用**时，自定义 API 可能还没注册。配置初始化优先用 `props.initialConfig` / `props.config`，不要强依赖自定义 `/config` 接口。

---

## 7. 事件规范：配置按钮用 switch

```vue
<script setup>
const emit = defineEmits(['switch', 'close', 'action'])
</script>

<VBtn prepend-icon="mdi-cog" @click="emit('switch')">配置</VBtn>
```

- `emit('switch')`：详情页 ↔ 配置弹窗切换（MP 标准事件）。
- **不要**用 `@click="$emit('open-config')"`——MP 不识别，点了没反应（DanmuCustom 实测）。
- 配置保存：`emit('save', {...form})`，由 MP 统一写回，避免插件未启用时 API 未注册。

---

## 8. 并发请求：不要被非核心接口拖垮

```js
const [catResult, userResult] = await Promise.allSettled([
  requestGet('/filter/categories'),
  requestGet('/filter/blocked_users'),
])

if (catResult.status === 'fulfilled') {
  const payload = catResult.value?.data ?? catResult.value
  if (payload?.success) categories.value = payload.data || []
} else {
  error.value = `获取分类失败: ${catResult.reason?.message || catResult.reason}`
}

if (userResult.status === 'fulfilled') {
  const payload = userResult.value?.data ?? userResult.value
  if (payload?.success) {
    blockedUsers.value = payload.data?.blocked_users || []
  }
} else {
  blockedUsers.value = []   // 非核心数据失败，只置空，不阻断主页面
}
```

---

## 9. 缓存与版本：交付三大陷阱

1. **只改 Vue 不构建** → `remoteEntry.js` 还是旧的 → 页面无变化。
   → 每次改 `.vue` 必须 `npm install && npm run build`。
2. **只构建不递增版本** → MP/浏览器继续加载旧 `remoteEntry.js`（强缓存）。
   → 每次交付递增 `plugin_version` 与 `package.v2.json` 的 `version`。
3. **只改 package.v2.json 不同步 Python 里的 plugin_version** → 元数据与代码不一致。
   → 两处必须同步。

交付提醒文案（给用户）：
> 重新安装/更新插件 → 重载插件 → 浏览器硬刷新（Cmd+Shift+R / Ctrl+F5）。

---

## 10. 构建后自检

```bash
cd plugins.v2/<plugin>/frontend
npm install
npm run build

ls -la ../dist/assets/remoteEntry.js
# 确认暴露组件齐全
grep -o '"\./[^"]*"' ../dist/assets/remoteEntry.js | sort -u
# 期望：./AppPage ./AppPageFilter ./AppPageScrape ./Config ./Dashboard ./Page
```
