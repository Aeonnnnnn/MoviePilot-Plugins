<template>
  <VCard class="dashboard-component" :loading="loading">
    <VCardItem>
      <template #prepend>
        <VIcon icon="mdi-monitor-dashboard" color="primary" size="32" />
      </template>
      <VCardTitle>{{ config?.attrs?.title || '弹幕刮削仪表板' }}</VCardTitle>
      <VCardSubtitle v-if="config?.attrs?.subtitle">{{ config.attrs.subtitle }}</VCardSubtitle>
    </VCardItem>

    <VCardText>
      <VRow>
        <VCol v-for="(item, index) in dashboardData" :key="index" cols="12" sm="6" md="4" lg="3">
          <VCard :color="item.color || getStatusColor(item.status)" variant="tonal" class="px-4 py-3">
            <div class="d-flex align-center justify-space-between">
              <div>
                <div class="text-caption text-medium-emphasis">{{ item.label }}</div>
                <div class="text-h6 font-weight-bold mt-1">
                  <VIcon :icon="getStatusIcon(item.status)" size="20" class="mr-1" />
                  {{ item.value }}
                </div>
              </div>
              <VProgressCircular
                v-if="item.progress !== undefined"
                :model-value="item.progress"
                :color="item.color || 'primary'"
                size="56"
                width="4"
              >
                <span class="text-caption">{{ item.progress }}%</span>
              </VProgressCircular>
            </div>
          </VCard>
        </VCol>
      </VRow>

      <!-- 最近刮削记录 -->
      <div v-if="recentRecords.length > 0" class="mt-4">
        <div class="text-subtitle-2 font-weight-bold mb-2">最近记录</div>
        <VList density="compact" lines="one">
          <VListItem v-for="(item, index) in recentRecords" :key="index">
            <template #prepend>
              <VIcon :icon="getItemIcon(item.type)" size="20" :color="item.status === 'success' ? 'success' : 'error'" />
            </template>
            <VListItemTitle class="text-body-2">{{ item.title }}</VListItemTitle>
            <VListItemSubtitle class="text-caption">{{ item.time }}</VListItemSubtitle>
          </VListItem>
        </VList>
      </div>
    </VCardText>

    <VCardActions v-if="config?.attrs?.showRefresh !== false">
      <VSpacer />
      <VBtn variant="text" :loading="loading" @click="refreshData">
        <VIcon icon="mdi-refresh" start />
        刷新
      </VBtn>
    </VCardActions>
  </VCard>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import {
  mdiMonitorDashboard,
  mdiRefresh,
  mdiCheckCircle,
  mdiAlertCircle,
  mdiInformation,
  mdiAlert,
  mdiPlayCircle,
  mdiStopCircle,
  mdiFileVideo,
} from '@mdi/js'
import axios from 'axios'

const { pluginId, config, eventBus, api } = defineProps(['pluginId', 'config', 'eventBus', 'api'])

// 后端 API 注册的插件 ID（大小写敏感，必须与后端 class 名一致）
const API_PLUGIN_ID = 'DanmuCustom'

// 统一封装 API 请求，优先使用 MoviePilot 注入的 api 对象
const requestGet = async (path, options = {}) => {
  if (api?.get) {
    return await api.get(`plugin/${API_PLUGIN_ID}${path}`, options)
  }
  const res = await axios.get(`/api/v1/plugin/${API_PLUGIN_ID}${path}`, options)
  return res.data
}

// 解析响应体：兼容 schemas.Response 包装和普通 dict
const unwrapResponse = (res) => {
  const data = res?.data ?? res
  if (data && typeof data === 'object' && 'success' in data && data.success && data.data) {
    return data.data
  }
  return data
}

const loading = ref(false)
const error = ref('')
const dashboardData = ref([])
const recentRecords = ref([])

const getStatusIcon = (status) => {
  const icons = {
    success: mdiCheckCircle,
    warning: mdiAlert,
    error: mdiAlertCircle,
    info: mdiInformation,
  }
  return icons[status] || mdiInformation
}

const getStatusColor = (status) => {
  const colors = {
    success: 'success',
    warning: 'warning',
    error: 'error',
    info: 'info',
  }
  return colors[status] || 'primary'
}

const getItemIcon = (type) => {
  const icons = {
    scrape: mdiPlayCircle,
    filter: 'mdi-filter-variant',
    match: mdiFileVideo,
  }
  return icons[type] || mdiInformation
}

const refreshData = async () => {
  loading.value = true
  try {
    // 获取刮削状态（/status 返回普通 dict，非 schemas.Response 包装）
    const statusRes = await requestGet('/status')
    const statusData = unwrapResponse(statusRes) || {}

    // 获取过滤统计
    const filterRes = await requestGet('/filter/stats').catch(() => ({}))
    const filterData = unwrapResponse(filterRes) || {}

    dashboardData.value = [
      {
        label: '刮削状态',
        value: statusData.running ? '运行中' : '空闲',
        status: statusData.running ? 'success' : 'info',
        progress: statusData.total > 0
          ? Math.round((statusData.success + statusData.failed) / statusData.total * 100)
          : undefined,
      },
      {
        label: '总任务数',
        value: statusData.total || 0,
        status: 'info',
      },
      {
        label: '成功/失败',
        value: `${statusData.success || 0} / ${statusData.failed || 0}`,
        status: (statusData.failed || 0) > 0 ? 'warning' : 'success',
      },
      {
        label: '过滤分类',
        value: filterData.category_count || 0,
        status: 'info',
      },
      {
        label: '屏蔽关键词',
        value: filterData.keyword_count || 0,
        status: 'warning',
      },
      {
        label: '屏蔽用户',
        value: filterData.blocked_count || 0,
        status: filterData.blocked_count > 0 ? 'error' : 'success',
      },
      {
        label: '插件状态',
        value: statusData.enabled ? '已启用' : '已禁用',
        status: statusData.enabled ? 'success' : 'warning',
      },
    ]

    // 最近记录
    if (statusData.current_file) {
      recentRecords.value = [
        {
          title: `正在刮削: ${statusData.current_file}`,
          time: new Date().toLocaleTimeString(),
          type: 'scrape',
          status: 'success',
        },
      ]
    }
  } catch (err) {
    if (err?.response?.status === 404 || err?.status === 404) {
      error.value = '插件未启用或后端 API 未注册，请先在插件配置中启用插件并保存。'
    } else {
      error.value = `获取仪表板数据失败: ${err.message}`
    }
    console.error('获取仪表板数据失败:', err)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  refreshData()
})
</script>

<style scoped>
.dashboard-component {
  min-height: 200px;
}
</style>
