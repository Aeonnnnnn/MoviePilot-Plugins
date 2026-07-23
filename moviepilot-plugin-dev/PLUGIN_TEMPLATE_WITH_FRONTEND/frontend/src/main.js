import { createApp } from 'vue'
import App from './App.vue'

// 本地开发兜底入口；生产由 MP 通过 remoteEntry 加载 expose 的组件
createApp(App).mount('#app')
