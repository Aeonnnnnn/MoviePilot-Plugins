<template>
  <VContainer fluid class="pa-4 app-page-scrape">
    <VRow>
      <VCol cols="12">
        <VCard>
          <VCardItem>
            <template #prepend>
              <VIcon icon="mdi-movie-open-star" color="primary" size="32" />
            </template>
            <VCardTitle>弹幕刮削管理</VCardTitle>
            <VCardSubtitle>pluginId: {{ pluginId }} · navKey: {{ navKey }}</VCardSubtitle>
          </VCardItem>

          <VAlert v-if="error" type="error" variant="tonal" closable class="mx-4 mb-2">
            {{ error }}
          </VAlert>

          <VAlert v-if="actionResult" :type="actionResult.type" variant="tonal" closable class="mx-4 mb-2">
            <div class="d-flex align-center flex-wrap" style="gap: 8px">
              <span>{{ actionResult.message }}</span>
              <VChip
                v-if="actionResult.preMatch && actionResult.preMatch.total > 0"
                :color="actionResult.preMatch.matched > 0 ? 'success' : 'warning'"
                size="small"
                variant="elevated"
                prepend-icon="mdi-rocket-launch"
              >
                预匹配 {{ actionResult.preMatch.matched }}/{{ actionResult.preMatch.total }}
                <span class="ml-1 text-caption">({{ actionResult.preMatch.elapsed }}s{{ actionResult.preMatch.source ? ' · ' + actionResult.preMatch.source : '' }})</span>
              </VChip>
            </div>
          </VAlert>

          <!-- 任务控制栏（暂停/继续/取消） -->
          <VCardText v-if="scrapeProgress.running || scrapeProgress.paused" class="pb-0">
            <VRow class="align-center">
              <VCol>
                <VAlert density="compact" :type="scrapeProgress.paused ? 'warning' : 'info'" variant="tonal" class="mb-0">
                  <VIcon :icon="scrapeProgress.paused ? 'mdi-pause-circle' : 'mdi-play-circle'" size="18" class="mr-1" />
                  {{ scrapeProgress.paused ? '任务已暂停，点击「继续」恢复刮削' : '任务运行中… 可暂停后继续' }}
                </VAlert>
              </VCol>
              <VCol cols="auto">
                <VBtn
                  v-if="!scrapeProgress.paused"
                  color="warning"
                  variant="tonal"
                  size="small"
                  prepend-icon="mdi-pause"
                  :loading="taskActionLoading === 'pause'"
                  @click="taskPause"
                  class="mr-2"
                >
                  暂停
                </VBtn>
                <VBtn
                  v-else
                  color="success"
                  variant="tonal"
                  size="small"
                  prepend-icon="mdi-play"
                  :loading="taskActionLoading === 'resume'"
                  @click="taskResume"
                  class="mr-2"
                >
                  继续
                </VBtn>
                <VBtn
                  color="error"
                  variant="tonal"
                  size="small"
                  prepend-icon="mdi-stop"
                  :loading="taskActionLoading === 'cancel'"
                  @click="taskCancel"
                >
                  取消
                </VBtn>
              </VCol>
            </VRow>
          </VCardText>

          <!-- 状态概览 -->
          <VCardText>
            <VRow>
              <VCol cols="12" sm="6" md="3" v-for="stat in statsCards" :key="stat.title">
                <VCard variant="tonal" :color="stat.color" class="pa-3 text-center">
                  <div class="text-caption text-medium-emphasis">{{ stat.title }}</div>
                  <div class="text-h5 font-weight-bold mt-1">
                    <VIcon :icon="stat.icon" size="24" class="mr-1" />
                    {{ stat.value }}
                  </div>
                </VCard>
              </VCol>
            </VRow>

            <VProgressLinear
              v-if="scrapeProgress.total > 0 && (scrapeProgress.running || scrapeProgress.paused)"
              :model-value="scrapeProgress.total > 0 ? ((scrapeProgress.success + scrapeProgress.failed) / scrapeProgress.total * 100) : 0"
              :color="scrapeProgress.paused ? 'warning' : 'primary'"
              height="8"
              class="mt-4"
              rounded
              striped
            />

            <div v-if="scrapeProgress.current_file" class="mt-2 text-body-2 text-medium-emphasis">
              <VIcon icon="mdi-file-video" size="16" class="mr-1" />
              {{ scrapeProgress.current_file }}
            </div>
          </VCardText>

          <VDivider />

          <!-- 操作区 -->
          <VCardText>
            <div class="text-subtitle-2 font-weight-bold mb-3">快速操作</div>
            <VRow>
              <VCol cols="12" sm="6" md="4" lg="2">
                <VBtn
                  block
                  color="primary"
                  variant="tonal"
                  size="large"
                  prepend-icon="mdi-play-circle"
                  :loading="actionLoading === 'global'"
                  @click="startGlobalScrape"
                >
                  全局刮削
                </VBtn>
              </VCol>
              <VCol cols="12" sm="6" md="4" lg="2">
                <VBtn
                  block
                  color="secondary"
                  variant="tonal"
                  size="large"
                  prepend-icon="mdi-folder-search"
                  @click="showDirectoryDialog = true"
                >
                  目录刮削
                </VBtn>
              </VCol>
              <VCol cols="12" sm="6" md="4" lg="3">
                <VBtn
                  block
                  color="success"
                  variant="tonal"
                  size="large"
                  prepend-icon="mdi-refresh"
                  :loading="loading"
                  @click="refreshStatus"
                >
                  刷新状态
                </VBtn>
              </VCol>
              <VCol cols="12" sm="6" md="4" lg="3">
                <VBtn
                  block
                  variant="outlined"
                  size="large"
                  prepend-icon="mdi-folder-multiple"
                  @click="showFileBrowser = true"
                >
                  文件浏览
                </VBtn>
              </VCol>
              <VCol cols="12" sm="6" md="4" lg="3">
                <VBtn
                  block
                  variant="outlined"
                  size="large"
                  prepend-icon="mdi-history"
                  @click="showHistoryDialog = true"
                >
                  刮削历史
                </VBtn>
              </VCol>
            </VRow>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <VDialog v-model="showFileBrowser" max-width="1100" scrollable>
      <VCard max-height="80vh">
        <VCardItem class="d-flex align-center">
          <VCardTitle>文件浏览</VCardTitle>
          <VSpacer />
          <VBtn icon="mdi-close" variant="text" @click="showFileBrowser = false" />
        </VCardItem>
        <VDivider />
        <VCardText style="overflow-y: auto; max-height: 65vh;">
          <FileBrowser :plugin-id="pluginId" :api="api" />
        </VCardText>
      </VCard>
    </VDialog>

    <!-- 刮削历史对话框 -->
    <VDialog v-model="showHistoryDialog" max-width="1000">
      <VCard>
        <VCardItem class="d-flex align-center">
          <VCardTitle>刮削历史</VCardTitle>
          <VChip size="small" class="ml-2" color="primary" variant="tonal">{{ historyTotal }}</VChip>
          <VSpacer />
          <VSelect
            v-model="historyStatusFilter"
            :items="historyStatusOptions"
            label="状态"
            density="compact"
            variant="outlined"
            hide-details
            style="max-width: 100px"
            @update:model-value="loadHistory(1)"
          />
          <VBtn icon="mdi-close" variant="text" @click="showHistoryDialog = false" />
        </VCardItem>
        <VDivider />

        <VCardText style="overflow-x: auto;">
          <VAlert v-if="historyError" type="error" variant="tonal" class="mb-3">
            {{ historyError }}
          </VAlert>

          <VTable v-if="scrapeHistory.length > 0" density="compact" style="min-width: 780px;">
            <thead>
              <tr>
                <th>文件</th>
                <th>状态</th>
                <th>耗时</th>
                <th>完成时间</th>
                <th>接收</th>
                <th>屏蔽</th>
                <th>实际</th>
                <th>输出</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, i) in scrapeHistory" :key="i">
                <td class="text-body-2" style="max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                  {{ item.file_name || item.file_path }}
                </td>
                <td>
                  <VChip :color="statusColor(item.status)" size="small" variant="tonal">
                    {{ statusText(item.status) }}
                  </VChip>
                </td>
                <td class="text-caption">
                  {{ item.duration_ms != null ? (item.duration_ms / 1000).toFixed(1) + 's' : '--' }}
                </td>
                <td class="text-caption">{{ item.finished_at || '--' }}</td>
                <td class="text-caption text-center">{{ item.danmu_counts?.received != null ? item.danmu_counts.received : '--' }}</td>
                <td class="text-caption text-center">{{ item.danmu_counts?.blocked != null ? item.danmu_counts.blocked : '--' }}</td>
                <td class="text-caption text-center">{{ item.danmu_counts?.actual != null ? item.danmu_counts.actual : '--' }}</td>
                <td class="text-caption">
                  <span v-if="item.output_ass_path" class="text-success">已生成</span>
                  <span v-else class="text-error">无</span>
                </td>
              </tr>
            </tbody>
          </VTable>
          <VAlert v-else-if="!historyError" type="info" variant="tonal" class="mt-2">
            暂无刮削记录
          </VAlert>

          <div class="d-flex justify-center mt-3">
            <VSelect
              v-model="historyPageSize"
              :items="[10, 15, 20, 30, 50]"
              label="每页"
              density="compact"
              variant="outlined"
              hide-details
              style="max-width: 80px;"
              class="mr-4"
              @update:model-value="loadHistory(1)"
            />
            <VPagination
              v-if="historyTotalPages > 1"
              v-model="historyPage"
              :length="historyTotalPages"
              :total-visible="7"
              density="compact"
              @update:model-value="loadHistory"
            />
          </div>
        </VCardText>
      </VCard>
    </VDialog>

    <!-- 目录刮削对话框 -->
    <VDialog v-model="showDirectoryDialog" max-width="500">
      <VCard>
        <VCardItem><VCardTitle>目录刮削</VCardTitle></VCardItem>
        <VCardText>
          <VTextField
            v-model="directoryPath"
            label="目标目录路径"
            placeholder="/path/to/videos"
            variant="outlined"
            hint="输入要刮削的目录完整路径"
            persistent-hint
          />
          <VCheckbox v-model="batchMode" label="分季批量刮削" color="primary" hint="每个子文件夹独立匹配" persistent-hint />
        </VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn variant="text" @click="showDirectoryDialog = false">取消</VBtn>
          <VBtn color="primary" variant="tonal" :loading="actionLoading === 'dir'" @click="startDirectoryScrape">开始刮削</VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

  </VContainer>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import {
  mdiMovieOpenStar,
  mdiPlayCircle,
  mdiPauseCircle,
  mdiFolderSearch,
  mdiRefresh,
  mdiFileVideo,
  mdiPlay,
  mdiStopCircle,
  mdiCheckCircle,
  mdiAlertCircle,
  mdiFolderMultiple,
  mdiHistory,
} from '@mdi/js'
import axios from 'axios'
import FileBrowser from './FileBrowser.vue'

const { pluginId, navKey, api } = defineProps(['pluginId', 'config', 'eventBus', 'navKey', 'api'])

const API_PLUGIN_ID = 'DanmuCustom'

const requestGet = async (path, options = {}) => {
  if (api?.get) {
    return await api.get(`plugin/${API_PLUGIN_ID}${path}`, options)
  }
  const res = await axios.get(`/api/v1/plugin/${API_PLUGIN_ID}${path}`, options)
  return res.data
}

const requestPost = async (path, data = {}, options = {}) => {
  if (api?.post) {
    return await api.post(`plugin/${API_PLUGIN_ID}${path}`, data, options)
  }
  const res = await axios.post(`/api/v1/plugin/${API_PLUGIN_ID}${path}`, data, options)
  return res.data
}

const unwrapResponse = (res) => {
  const data = res?.data ?? res
  if (data && typeof data === 'object' && 'success' in data && data.success && data.data) {
    return data.data
  }
  return data
}

const loading = ref(false)
const error = ref('')
const actionLoading = ref(null)
const actionResult = ref(null)
const taskActionLoading = ref(null)

const scrapeProgress = reactive({
  running: false,
  paused: false,
  total: 0,
  current: 0,
  current_file: '',
  success: 0,
  failed: 0,
  duration: 0,
})

const scrapeHistory = ref([])
const historyTotal = ref(0)
const historyPage = ref(1)
const historyPageSize = ref(15)
const historyTotalPages = ref(0)
const historyError = ref('')
const historyStatusFilter = ref('all')
const historyStatusOptions = [
  { title: '全部', value: 'all' },
  { title: '成功', value: 'success' },
  { title: '失败', value: 'failed' },
  { title: '跳过', value: 'skipped' },
  { title: '中断', value: 'interrupted' },
  { title: '等待', value: 'pending' },
]

const statusColor = (s) => {
  switch (s) {
    case 'success': return 'success'
    case 'failed': return 'error'
    case 'skipped': return 'info'
    case 'interrupted': return 'warning'
    case 'running': return 'primary'
    case 'pending': return 'grey'
    default: return 'grey'
  }
}
const statusText = (s) => {
  switch (s) {
    case 'success': return '成功'
    case 'failed': return '失败'
    case 'skipped': return '跳过'
    case 'interrupted': return '中断'
    case 'running': return '运行中'
    case 'pending': return '等待'
    default: return s || '未知'
  }
}

const loadHistory = async (page = historyPage.value) => {
  historyPage.value = page
  historyError.value = ''
  try {
    const params = `?page=${page}&page_size=${historyPageSize.value}`
    const filter = historyStatusFilter.value !== 'all' ? `&status=${historyStatusFilter.value}` : ''
    const res = await requestGet(`/history${params}${filter}`)
    const body = unwrapResponse(res)
    if (body && typeof body === 'object' && 'items' in body) {
      scrapeHistory.value = body.items || []
      historyTotal.value = body.total || 0
      historyTotalPages.value = body.total_pages || 0
    } else {
      historyError.value = '返回数据格式异常'
      scrapeHistory.value = []
    }
  } catch (err) {
    historyError.value = err?.message || String(err)
    scrapeHistory.value = []
  }
}

const statsCards = computed(() => {
  let statusText = '空闲'
  let statusColor = 'grey'
  let statusIcon = mdiStopCircle
  if (scrapeProgress.paused) {
    statusText = '已暂停'
    statusColor = 'warning'
    statusIcon = mdiPauseCircle
  } else if (scrapeProgress.running) {
    statusText = '运行中'
    statusColor = 'success'
    statusIcon = mdiPlay
  }
  const skipped = scrapeProgress.skipped || 0
  return [
    {
      title: '刮削状态',
      value: statusText,
      icon: statusIcon,
      color: statusColor,
    },
    {
      title: '总任务',
      value: scrapeProgress.total || 0,
      icon: 'mdi-numeric',
      color: 'info',
    },
    {
      title: '成功 / 跳过',
      value: `${scrapeProgress.success || 0} / ${skipped}`,
      icon: mdiCheckCircle,
      color: 'success',
    },
    {
      title: '失败',
      value: scrapeProgress.failed || 0,
      icon: mdiAlertCircle,
      color: 'error',
    },
  ]
})

// 对话框
const showDirectoryDialog = ref(false)
const showFileBrowser = ref(false)
const showHistoryDialog = ref(false)
const directoryPath = ref('')
const batchMode = ref(false)

// 轮询定时器
let pollingTimer = null

const startPolling = () => {
  stopPolling()
  pollingTimer = setInterval(refreshStatus, 3000)
}

const stopPolling = () => {
  if (pollingTimer) {
    clearInterval(pollingTimer)
    pollingTimer = null
  }
}

const refreshStatus = async () => {
  try {
    const res = await requestGet('/task/status')
    const statusData = unwrapResponse(res) || {}
    const st = statusData?.status || 'idle'
    scrapeProgress.running = st === 'running'
    scrapeProgress.paused = st === 'paused'
    scrapeProgress.total = statusData?.total || 0
    scrapeProgress.success = statusData?.success || 0
    scrapeProgress.failed = statusData?.failed || 0
    scrapeProgress.skipped = statusData?.skipped || 0
    scrapeProgress.current_file = statusData?.current_file || ''
    // 如果任务结束（非 running / paused），停止轮询
    if (!scrapeProgress.running && !scrapeProgress.paused) {
      stopPolling()
    }
  } catch (err) {
    if (err?.response?.status === 404 || err?.status === 404) {
      error.value = '插件未启用或后端 API 未注册，请先在插件配置中启用插件并保存。'
    } else {
      error.value = `获取状态失败: ${err.message}`
    }
  } finally {
    loading.value = false
  }
}

const startGlobalScrape = async () => {
  actionLoading.value = 'global'
  actionResult.value = null
  try {
    const res = await requestGet('/generate_danmu_with_path')
    const body = unwrapResponse(res) || {}
    actionResult.value = {
      type: res?.success ? 'success' : 'error',
      message: res?.message || '刮削已启动',
      preMatch: body?.pre_match,
    }
    startPolling()
    setTimeout(refreshStatus, 2000)
  } catch (err) {
    actionResult.value = { type: 'error', message: err?.response?.status === 404 || err?.status === 404 ? '插件未启用，请先在插件配置中启用插件并保存。' : `请求失败: ${err.message}` }
  } finally {
    actionLoading.value = null
  }
}

const startDirectoryScrape = async () => {
  if (!directoryPath.value.trim()) {
    actionResult.value = { type: 'error', message: '请输入目录路径' }
    return
  }
  actionLoading.value = 'dir'
  actionResult.value = null
  try {
    const endpoint = batchMode.value ? 'batch_season_scrape' : 'scrape_directory'
    const res = await requestGet(`/${endpoint}`, {
      params: { directory_path: directoryPath.value }
    })
    const body = unwrapResponse(res) || {}
    actionResult.value = {
      type: res?.success ? 'success' : 'error',
      message: res?.message || '刮削已启动',
      preMatch: body?.pre_match,
    }
    startPolling()
    showDirectoryDialog.value = false
    setTimeout(refreshStatus, 2000)
  } catch (err) {
    actionResult.value = { type: 'error', message: err?.response?.status === 404 || err?.status === 404 ? '插件未启用，请先在插件配置中启用插件并保存。' : `请求失败: ${err.message}` }
  } finally {
    actionLoading.value = null
  }
}

// --- 任务控制 ---
const taskPause = async () => {
  if (!confirm('确定要暂停当前刮削任务吗？暂停后可继续。')) return
  taskActionLoading.value = 'pause'
  actionResult.value = null
  try {
    const res = await requestGet('/task/pause')
    if (res?.success) {
      scrapeProgress.paused = true
      scrapeProgress.running = false
      actionResult.value = { type: 'success', message: res.message || '任务已暂停' }
    } else {
      actionResult.value = { type: 'error', message: res?.message || '暂停失败' }
    }
  } catch (err) {
    actionResult.value = { type: 'error', message: `暂停失败：${err?.message || err}` }
  } finally {
    taskActionLoading.value = null
  }
}

const taskResume = async () => {
  taskActionLoading.value = 'resume'
  actionResult.value = null
  try {
    const res = await requestGet('/task/resume')
    if (res?.success) {
      scrapeProgress.paused = false
      scrapeProgress.running = true
      actionResult.value = { type: 'success', message: res.message || '任务已恢复' }
      startPolling()
    } else {
      actionResult.value = { type: 'error', message: res?.message || '恢复失败' }
    }
  } catch (err) {
    actionResult.value = { type: 'error', message: `恢复失败：${err?.message || err}` }
  } finally {
    taskActionLoading.value = null
  }
}

const taskCancel = async () => {
  if (!confirm('确定要取消当前刮削任务吗？已完成的文件不会丢失，未完成的可重新提交。')) return
  taskActionLoading.value = 'cancel'
  actionResult.value = null
  try {
    await requestGet('/task/clear')
    const res = await requestGet('/task/cancel')
    if (res?.success) {
      scrapeProgress.running = false
      scrapeProgress.paused = false
      actionResult.value = { type: 'success', message: res.message || '任务已取消' }
      stopPolling()
    } else {
      actionResult.value = { type: 'error', message: res?.message || '取消失败' }
    }
  } catch (err) {
    actionResult.value = { type: 'error', message: `取消失败：${err?.message || err}` }
  } finally {
    taskActionLoading.value = null
  }
}

onMounted(() => {
  refreshStatus()
})
</script>

<style scoped>
.app-page-scrape {
  max-width: 1200px;
}
</style>
