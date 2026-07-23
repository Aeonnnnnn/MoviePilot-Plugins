<template>
  <VSheet class="pa-4">
    <div class="d-flex align-center mb-4">
      <VIcon icon="mdi-filter-variant" color="primary" size="28" class="mr-3" />
      <div>
        <div class="text-h5">弹幕过滤管理</div>
        <div class="text-subtitle-2 text-medium-emphasis">分类屏蔽词库 · 关键词维护 · 用户管理</div>
      </div>
    </div>
    <VDivider class="mb-4" />
    <FilterManager :plugin-id="API_PLUGIN_ID" :api="api" />
  </VSheet>
</template>

<script setup>
import FilterManager from './FilterManager.vue'

const { api } = defineProps(['pluginId', 'config', 'eventBus', 'navKey', 'api'])
const API_PLUGIN_ID = 'DanmuCustom'
</script>
