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

      <VProgressLinear
        v-if="scrapeProgress.total > 0"
        :model-value="scrapeProgress.total > 0 ? ((scrapeProgress.success + scrapeProgress.failed) / scrapeProgress.total * 100) : 0"
        :color="scrapeProgress.running ? 'primary' : 'success'"
        height="8"
        class="mt-4"
        rounded
      />

      <div v-if="scrapeProgress.current_file" class="mt-2 text-body-2 text-medium-emphasis">
        当前处理: {{ scrapeProgress.current_file }}
      </div>

      <div v-if="scrapeProgress.duration" class="mt-1 text-caption text-disabled">
        已运行: {{ formatDuration(scrapeProgress.duration) }}
      </div>
    </VCardText>

    <!-- 快速操作 -->
    <VDivider />
    <VCardText class="pb-2">
      <div class="text-subtitle-2 font-weight-bold mb-2">快速操作</div>
      <VRow>
        <VCol cols="12" sm="6" md="4" lg="3">
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
        <VCol cols="12" sm="6" md="4" lg="3">
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
        <VCol cols="12" sm="6" md="4" lg="3">
          <VBtn
            block
            color="info"
            variant="tonal"
            prepend-icon="mdi-magnify"
            @click="showSearchDialog = true"
          >
            手动匹配
          </VBtn>
        </VCol>
        <VCol cols="12" sm="6" md="4" lg="3">
          <VBtn
            block
            color="success"
            variant="tonal"
            prepend-icon="mdi-refresh"
            :loading="loading"
            @click="refreshData"
          >
            刷新状态
          </VBtn>
        </VCol>
        <VCol cols="12" sm="6" md="4" lg="3">
          <VBtn
            block
            variant="outlined"
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
            prepend-icon="mdi-history"
            @click="showHistoryDialog = true"
          >
            刮削历史
          </VBtn>
        </VCol>
        <VCol cols="12" sm="6" md="4" lg="3">
          <VBtn
            block
            variant="outlined"
            color="warning"
            prepend-icon="mdi-cog"
            @click="emit('switch')"
          >
            配置
          </VBtn>
        </VCol>
      </VRow>
    </VCardText>

    <!-- 文件浏览对话框 -->
    <VDialog v-model="showFileBrowser" fullscreen>
      <VCard>
        <VCardItem class="d-flex align-center">
          <VCardTitle>文件浏览</VCardTitle>
          <VSpacer />
          <VBtn icon="mdi-close" variant="text" @click="showFileBrowser = false" />
        </VCardItem>
        <VDivider />
        <VCardText style="min-height: 60vh;">
          <FileBrowser :plugin-id="pluginId" :api="api" />
        </VCardText>
      </VCard>
    </VDialog>

    <!-- 刮削历史对话框 -->
    <VDialog v-model="showHistoryDialog" max-width="900">
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
        <VCardText>
          <VAlert v-if="historyError" type="error" variant="tonal" class="mb-3">
            {{ historyError }}
          </VAlert>
          <VTable v-if="scrapeHistory.length > 0" density="compact">
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
          <VCheckbox v-model="batchMode" label="分季批量刮削" hint="每个子文件夹独立匹配" persistent-hint />
        </VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn variant="text" @click="showDirectoryDialog = false">取消</VBtn>
          <VBtn color="primary" variant="tonal" :loading="actionLoading === 'dir'" @click="startDirectoryScrape">开始刮削</VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- 手动匹配对话框 -->
    <VDialog v-model="showSearchDialog" max-width="600">
      <VCard>
        <VCardItem><VCardTitle>手动匹配番剧</VCardTitle></VCardItem>
        <VCardText>
          <VTextField
            v-model="searchKeyword"
            label="番剧名称"
            placeholder="输入关键词搜索"
            variant="outlined"
            append-inner-icon="mdi-magnify"
            @keyup.enter="searchAnime"
            @click:append-inner="searchAnime"
          />
          <VAlert v-if="searchError" type="warning" variant="tonal" class="mt-2">
            {{ searchError }}
          </VAlert>
          <VList v-if="searchResults.length > 0" class="mt-2" density="compact">
            <VListItem
              v-for="anime in searchResults"
              :key="anime.anime_id || anime.id"
              :title="anime.anime_title || anime.title"
              :subtitle="`ID: ${anime.anime_id || anime.id}`"
              @click="selectAnime(anime)"
            >
              <template #append>
                <VBtn icon="mdi-check" size="small" variant="text" color="primary" />
              </template>
            </VListItem>
          </VList>
          <VAlert v-else-if="searchKeyword && searchDone && !searchError" type="info" variant="tonal" class="mt-2">
            未找到匹配的番剧
          </VAlert>
          <template v-if="selectedAnime">
            <VDivider class="my-3" />
            <div class="text-subtitle-2 mb-2">已选择: {{ selectedAnime.anime_title || selectedAnime.title }}</div>
            <VTextField
              v-model="episodeOffset"
              label="集数偏移"
              type="number"
              variant="outlined"
              hint="正数=后移，负数=前移"
              persistent-hint
            />
            <VTextField
              v-model="matchFilePath"
              label="视频文件路径"
              variant="outlined"
              hint="要匹配的视频文件路径"
              persistent-hint
            />
          </template>
        </VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn variant="text" @click="showSearchDialog = false">取消</VBtn>
          <VBtn
            v-if="selectedAnime"
            color="primary"
            variant="tonal"
            :loading="actionLoading === 'match'"
            @click="saveMatch"
          >
            保存匹配
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
  mdiMagnify,
  mdiRefresh,
  mdiCog,
  mdiFolderMultiple,
  mdiHistory,
} from '@mdi/js'
import axios from 'axios'
import FileBrowser from './FileBrowser.vue'

const { pluginId, config, eventBus, api } = defineProps(['pluginId', 'config', 'eventBus', 'api'])
const emit = defineEmits(['switch', 'close', 'action'])

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
const status = ref('空闲')
const lastUpdated = ref('--')
const actionLoading = ref(null)
const showDirectoryDialog = ref(false)
const showFileBrowser = ref(false)
const showHistoryDialog = ref(false)
const directoryPath = ref('')
const batchMode = ref(false)
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

const scrapeProgress = reactive({
  running: false,
  total: 0,
  current: 0,
  current_file: '',
  success: 0,
  failed: 0,
  duration: 0,
})

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

const formatDuration = (seconds) => {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${h > 0 ? h + '时' : ''}${m > 0 ? m + '分' : ''}${s}秒`
}

const refreshData = async () => {
  loading.value = true
  error.value = ''
  try {
    const res = await requestGet('/status')
    const data = unwrapResponse(res)
    status.value = data.running ? '运行中' : '空闲'
    Object.assign(scrapeProgress, data)
    lastUpdated.value = new Date().toLocaleTimeString()
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

const startGlobalScrape = async () => {
  actionLoading.value = 'scrape'
  error.value = ''
  try {
    const res = await requestGet('/generate_danmu_with_path')
    if (res?.success) {
      await refreshData()
    } else {
      error.value = res?.message || '刮削启动失败'
    }
  } catch (err) {
    if (err?.response?.status === 404 || err?.status === 404) {
      error.value = '插件未启用，请先在插件配置中启用插件并保存。'
    } else {
      error.value = `刮削请求失败: ${err.message}`
    }
  } finally {
    actionLoading.value = null
  }
}

const startDirectoryScrape = async () => {
  if (!directoryPath.value.trim()) {
    error.value = '请输入目标目录路径'
    return
  }
  actionLoading.value = 'dir'
  error.value = ''
  try {
    const endpoint = batchMode.value ? 'batch_season_scrape' : 'scrape_directory'
    const res = await requestGet(`/${endpoint}`, {
      params: { directory_path: directoryPath.value }
    })
    if (res?.success) {
      showDirectoryDialog.value = false
      await refreshData()
    } else {
      error.value = res?.message || '刮削启动失败'
    }
  } catch (err) {
    if (err?.response?.status === 404 || err?.status === 404) {
      error.value = '插件未启用，请先在插件配置中启用插件并保存。'
    } else {
      error.value = `刮削请求失败: ${err.message}`
    }
  } finally {
    actionLoading.value = null
  }
}

// 搜索番剧（带错误展示）
const showSearchDialog = ref(false)
const searchKeyword = ref('')
const searchResults = ref([])
const searchDone = ref(false)
const searchError = ref('')
const selectedAnime = ref(null)
const episodeOffset = ref(0)
const matchFilePath = ref('')

const searchAnime = async () => {
  if (!searchKeyword.value.trim()) return
  searchError.value = ''
  searchResults.value = []
  searchDone.value = false
  try {
    const res = await requestGet('/search_anime', {
      params: { keyword: searchKeyword.value }
    })
    if (res?.success) {
      searchResults.value = Array.isArray(res?.data) ? res.data : []
    } else {
      searchError.value = res?.message || '搜索失败'
    }
    searchDone.value = true
  } catch (err) {
    searchError.value = err?.response?.data?.message || err?.message || '网络请求失败'
    searchDone.value = true
  }
}

const selectAnime = (anime) => {
  selectedAnime.value = anime
}

const saveMatch = async () => {
  if (!selectedAnime.value || !matchFilePath.value.trim()) return
  actionLoading.value = 'match'
  try {
    const res = await requestPost('/manual_match', {
      anime_id: selectedAnime.value.anime_id || selectedAnime.value.id,
      anime_title: selectedAnime.value.anime_title || selectedAnime.value.title,
      file_path: matchFilePath.value,
      episode_offset: episodeOffset.value,
    })
    if (res?.success) {
      showSearchDialog.value = false
      selectedAnime.value = null
      searchKeyword.value = ''
      searchResults.value = []
      searchDone.value = false
      searchError.value = ''
      matchFilePath.value = ''
      episodeOffset.value = 0
      await refreshData()
    } else {
      error.value = res?.message || '保存失败'
    }
  } catch (err) {
    error.value = `保存失败: ${err.message}`
  } finally {
    actionLoading.value = null
  }
}

onMounted(() => {
  refreshData()
})
</script>

<style scoped>
.page-component {
  min-height: 300px;
}
</style>
