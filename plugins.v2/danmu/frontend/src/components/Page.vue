<template>
  <VCard class="page-component" :loading="loading">
    <!-- 头部 -->
    <VCardItem>
      <template #prepend>
        <VIcon icon="mdi-movie-open-star" color="primary" size="32" />
      </template>
      <VCardTitle>{{ config?.attrs?.title || '弹幕刮削' }}</VCardTitle>
      <VCardSubtitle>状态: {{ status }} | 最后更新: {{ lastUpdated }}</VCardSubtitle>
    </VCardItem>

    <!-- 错误信息 -->
    <VAlert v-if="error" type="error" variant="tonal" closable class="mx-4 mb-2">
      {{ error }}
    </VAlert>

    <!-- 刮削状态卡片 -->
    <VCardText>
      <VRow>
        <VCol cols="12" sm="6" md="3">
          <VCard variant="tonal" :color="scrapeProgress.running ? 'success' : 'grey'" class="pa-3 text-center">
            <div class="text-caption text-medium-emphasis">刮削状态</div>
            <div class="text-h5 font-weight-bold mt-1">
              <VIcon :icon="scrapeProgress.running ? 'mdi-play-circle' : 'mdi-stop-circle'" size="24" class="mr-1" />
              {{ scrapeProgress.running ? '运行中' : '空闲' }}
            </div>
          </VCard>
        </VCol>
        <VCol cols="12" sm="6" md="3">
          <VCard variant="tonal" color="info" class="pa-3 text-center">
            <div class="text-caption text-medium-emphasis">总任务</div>
            <div class="text-h5 font-weight-bold mt-1">{{ scrapeProgress.total || 0 }}</div>
          </VCard>
        </VCol>
        <VCol cols="12" sm="6" md="3">
          <VCard variant="tonal" color="success" class="pa-3 text-center">
            <div class="text-caption text-medium-emphasis">成功</div>
            <div class="text-h5 font-weight-bold mt-1">{{ scrapeProgress.success || 0 }}</div>
          </VCard>
        </VCol>
        <VCol cols="12" sm="6" md="3">
          <VCard variant="tonal" color="error" class="pa-3 text-center">
            <div class="text-caption text-medium-emphasis">失败</div>
            <div class="text-h5 font-weight-bold mt-1">{{ scrapeProgress.failed || 0 }}</div>
          </VCard>
        </VCol>
      </VRow>

      <!-- 进度条 -->
      <VProgressLinear
        v-if="scrapeProgress.total > 0"
        :model-value="scrapeProgress.total > 0 ? ((scrapeProgress.success + scrapeProgress.failed) / scrapeProgress.total * 100) : 0"
        :color="scrapeProgress.running ? 'primary' : 'success'"
        height="8"
        class="mt-4"
        rounded
      />

      <!-- 当前处理文件 -->
      <div v-if="scrapeProgress.current_file" class="mt-2 text-body-2 text-medium-emphasis">
        当前处理: {{ scrapeProgress.current_file }}
      </div>

      <!-- 耗时 -->
      <div v-if="scrapeProgress.duration" class="mt-1 text-caption text-disabled">
        已运行: {{ formatDuration(scrapeProgress.duration) }}
      </div>
    </VCardText>

    <!-- 快速操作 -->
    <VDivider />
    <VCardText class="pb-2">
      <div class="text-subtitle-2 font-weight-bold mb-2">快速操作</div>
      <VRow>
        <VCol cols="12" sm="6" md="3">
          <VBtn
            block
            color="primary"
            variant="tonal"
            prepend-icon="mdi-play"
            :loading="actionLoading === 'scrape'"
            :disabled="scrapeProgress.running"
            @click="startGlobalScrape"
          >
            全局刮削
          </VBtn>
        </VCol>
        <VCol cols="12" sm="6" md="3">
          <VBtn
            block
            color="secondary"
            variant="tonal"
            prepend-icon="mdi-folder-search"
            :loading="actionLoading === 'dir'"
            :disabled="scrapeProgress.running"
            @click="showDirectoryDialog = true"
          >
            目录刮削
          </VBtn>
        </VCol>
        <VCol cols="12" sm="6" md="3">
          <VBtn
            block
            color="info"
            variant="tonal"
            prepend-icon="mdi-refresh"
            :loading="loading"
            @click="refreshData"
          >
            刷新状态
          </VBtn>
        </VCol>
        <VCol cols="12" sm="6" md="3">
          <VBtn
            block
            color="warning"
            variant="tonal"
            prepend-icon="mdi-cog"
            @click="$emit('open-config')"
          >
            配置
          </VBtn>
        </VCol>
      </VRow>
    </VCardText>

    <!-- 目录刮削对话框 -->
    <VDialog v-model="showDirectoryDialog" max-width="500">
      <VCard>
        <VCardItem>
          <VCardTitle>目录刮削</VCardTitle>
        </VCardItem>
        <VCardText>
          <VTextField
            v-model="directoryPath"
            label="目标目录路径"
            placeholder="/path/to/videos"
            variant="outlined"
            hint="输入要刮削的目录完整路径"
            persistent-hint
          />
          <VCheckbox v-model="batchMode" label="分季批量刮削" hint="每个子文件夹独立匹配" persistent-hint />
        </VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn variant="text" @click="showDirectoryDialog = false">取消</VBtn>
          <VBtn
            color="primary"
            variant="tonal"
            :loading="actionLoading === 'dir'"
            @click="startDirectoryScrape"
          >
            开始刮削
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </VCard>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import {
  mdiMovieOpenStar,
  mdiPlayCircle,
  mdiStopCircle,
  mdiPlay,
  mdiFolderSearch,
  mdiRefresh,
  mdiCog,
} from '@mdi/js'
import axios from 'axios'

// 插件上下文注入
const { pluginId, config, eventBus } = defineProps(['pluginId', 'config', 'eventBus'])

// 响应式数据
const loading = ref(false)
const error = ref('')
const status = ref('空闲')
const lastUpdated = ref('--')
const actionLoading = ref(null)
const showDirectoryDialog = ref(false)
const directoryPath = ref('')
const batchMode = ref(false)

const scrapeProgress = reactive({
  running: false,
  total: 0,
  current: 0,
  current_file: '',
  success: 0,
  failed: 0,
  duration: 0,
})

// 格式化时长
const formatDuration = (seconds) => {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${h > 0 ? h + '时' : ''}${m > 0 ? m + '分' : ''}${s}秒`
}

// 获取 API 基础路径
const getApiBase = () => `/api/v1/plugin/${pluginId}`

// 刷新数据
const refreshData = async () => {
  loading.value = true
  error.value = ''
  try {
    const res = await axios.get(`${getApiBase()}/status`)
    if (res.data?.success) {
      const data = res.data.data
      status.value = data.running ? '运行中' : '空闲'
      Object.assign(scrapeProgress, data)
      lastUpdated.value = new Date().toLocaleTimeString()
    }
  } catch (err) {
    error.value = `获取状态失败: ${err.message}`
  } finally {
    loading.value = false
  }
}

// 全局刮削
const startGlobalScrape = async () => {
  actionLoading.value = 'scrape'
  error.value = ''
  try {
    const res = await axios.get(`${getApiBase()}/generate_danmu_with_path`)
    if (res.data?.success) {
      await refreshData()
    } else {
      error.value = res.data?.message || '刮削启动失败'
    }
  } catch (err) {
    error.value = `刮削请求失败: ${err.message}`
  } finally {
    actionLoading.value = null
  }
}

// 目录刮削
const startDirectoryScrape = async () => {
  if (!directoryPath.value.trim()) {
    error.value = '请输入目标目录路径'
    return
  }
  actionLoading.value = 'dir'
  error.value = ''
  try {
    const endpoint = batchMode.value ? 'batch_season_scrape' : 'scrape_directory'
    const res = await axios.get(`${getApiBase()}/${endpoint}`, {
      params: { directory_path: directoryPath.value }
    })
    if (res.data?.success) {
      showDirectoryDialog.value = false
      await refreshData()
    } else {
      error.value = res.data?.message || '刮削启动失败'
    }
  } catch (err) {
    error.value = `刮削请求失败: ${err.message}`
  } finally {
    actionLoading.value = null
  }
}

// 初始化
onMounted(() => {
  refreshData()
})
</script>

<style scoped>
.page-component {
  min-height: 300px;
}
</style>
