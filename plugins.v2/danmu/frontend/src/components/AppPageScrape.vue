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
            {{ actionResult.message }}
          </VAlert>

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
              v-if="scrapeProgress.total > 0 && scrapeProgress.running"
              :model-value="scrapeProgress.total > 0 ? ((scrapeProgress.success + scrapeProgress.failed) / scrapeProgress.total * 100) : 0"
              color="primary"
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
            <div class="text-subtitle-2 font-weight-bold mb-3">刮削操作</div>
            <VRow>
              <VCol cols="12" sm="6" md="3">
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
              <VCol cols="12" sm="6" md="3">
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
              <VCol cols="12" sm="6" md="3">
                <VBtn
                  block
                  color="info"
                  variant="tonal"
                  size="large"
                  prepend-icon="mdi-magnify"
                  @click="showSearchDialog = true"
                >
                  手动匹配
                </VBtn>
              </VCol>
              <VCol cols="12" sm="6" md="3">
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
            </VRow>
          </VCardText>

          <!-- 刮削历史 -->
          <VDivider />
          <VCardText>
            <div class="text-subtitle-2 font-weight-bold mb-3">
              刮削历史
              <VChip size="small" class="ml-2" color="primary" variant="tonal">{{ scrapeHistory.length }}</VChip>
            </div>

            <VTable v-if="scrapeHistory.length > 0" density="compact">
              <thead>
                <tr>
                  <th>文件</th>
                  <th>弹幕数</th>
                  <th>时间</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(item, i) in scrapeHistory" :key="i">
                  <td class="text-body-2" style="max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    {{ item.file_name || item.file_path }}
                  </td>
                  <td>{{ item.danmu_count || '--' }}</td>
                  <td class="text-caption">{{ item.time || '--' }}</td>
                  <td>
                    <VChip :color="item.status === 'success' ? 'success' : 'error'" size="small" variant="tonal">
                      {{ item.status === 'success' ? '成功' : '失败' }}
                    </VChip>
                  </td>
                </tr>
              </tbody>
            </VTable>

            <VAlert v-else type="info" variant="tonal" class="mt-2">
              暂无刮削记录，点击上方按钮开始刮削
            </VAlert>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

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
          <VAlert v-else-if="searchKeyword && searchDone" type="info" variant="tonal" class="mt-2">
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
  </VContainer>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import {
  mdiMovieOpenStar,
  mdiPlayCircle,
  mdiFolderSearch,
  mdiMagnify,
  mdiRefresh,
  mdiFileVideo,
  mdiPlay,
  mdiStopCircle,
  mdiCheckCircle,
  mdiAlertCircle,
} from '@mdi/js'
import axios from 'axios'

const { pluginId, navKey } = defineProps(['pluginId', 'config', 'eventBus', 'navKey'])

const loading = ref(false)
const error = ref('')
const actionLoading = ref(null)
const actionResult = ref(null)

// 刮削进度
const scrapeProgress = reactive({
  running: false,
  total: 0,
  current: 0,
  current_file: '',
  success: 0,
  failed: 0,
  duration: 0,
})

const scrapeHistory = ref([])

// 统计卡片
const statsCards = computed(() => [
  {
    title: '刮削状态',
    value: scrapeProgress.running ? '运行中' : '空闲',
    icon: scrapeProgress.running ? mdiPlay : mdiStopCircle,
    color: scrapeProgress.running ? 'success' : 'grey',
  },
  {
    title: '总任务',
    value: scrapeProgress.total || 0,
    icon: 'mdi-numeric',
    color: 'info',
  },
  {
    title: '成功',
    value: scrapeProgress.success || 0,
    icon: mdiCheckCircle,
    color: 'success',
  },
  {
    title: '失败',
    value: scrapeProgress.failed || 0,
    icon: mdiAlertCircle,
    color: 'error',
  },
])

// 目录刮削
const showDirectoryDialog = ref(false)
const directoryPath = ref('')
const batchMode = ref(false)

// 手动匹配
const showSearchDialog = ref(false)
const searchKeyword = ref('')
const searchResults = ref([])
const searchDone = ref(false)
const selectedAnime = ref(null)
const episodeOffset = ref(0)
const matchFilePath = ref('')

const getApiBase = () => `/api/v1/plugin/${pluginId}`

// 刷新状态
const refreshStatus = async () => {
  loading.value = true
  error.value = ''
  try {
    const res = await axios.get(`${getApiBase()}/status`)
    if (res.data?.success) {
      Object.assign(scrapeProgress, res.data.data || {})
    }
    // 获取历史
    const historyRes = await axios.get(`${getApiBase()}/history`)
    if (historyRes.data?.success) {
      scrapeHistory.value = historyRes.data.data || []
    }
  } catch (err) {
    error.value = `获取状态失败: ${err.message}`
  } finally {
    loading.value = false
  }
}

// 全局刮削
const startGlobalScrape = async () => {
  actionLoading.value = 'global'
  actionResult.value = null
  try {
    const res = await axios.get(`${getApiBase()}/generate_danmu_with_path`)
    actionResult.value = {
      type: res.data?.success ? 'success' : 'error',
      message: res.data?.message || '刮削已启动',
    }
    setTimeout(refreshStatus, 2000)
  } catch (err) {
    actionResult.value = { type: 'error', message: `请求失败: ${err.message}` }
  } finally {
    actionLoading.value = null
  }
}

// 目录刮削
const startDirectoryScrape = async () => {
  if (!directoryPath.value.trim()) {
    actionResult.value = { type: 'error', message: '请输入目录路径' }
    return
  }
  actionLoading.value = 'dir'
  actionResult.value = null
  try {
    const endpoint = batchMode.value ? 'batch_season_scrape' : 'scrape_directory'
    const res = await axios.get(`${getApiBase()}/${endpoint}`, {
      params: { directory_path: directoryPath.value }
    })
    actionResult.value = {
      type: res.data?.success ? 'success' : 'error',
      message: res.data?.message || '刮削已启动',
    }
    showDirectoryDialog.value = false
    setTimeout(refreshStatus, 2000)
  } catch (err) {
    actionResult.value = { type: 'error', message: `请求失败: ${err.message}` }
  } finally {
    actionLoading.value = null
  }
}

// 搜索番剧
const searchAnime = async () => {
  if (!searchKeyword.value.trim()) return
  try {
    const res = await axios.get(`${getApiBase()}/search_anime`, {
      params: { keyword: searchKeyword.value }
    })
    searchResults.value = res.data?.data || []
    searchDone.value = true
  } catch (err) {
    actionResult.value = { type: 'error', message: `搜索失败: ${err.message}` }
  }
}

// 选择番剧
const selectAnime = (anime) => {
  selectedAnime.value = anime
}

// 保存匹配
const saveMatch = async () => {
  if (!selectedAnime.value || !matchFilePath.value.trim()) return
  actionLoading.value = 'match'
  try {
    const res = await axios.post(`${getApiBase()}/manual_match`, {
      anime_id: selectedAnime.value.anime_id || selectedAnime.value.id,
      anime_title: selectedAnime.value.anime_title || selectedAnime.value.title,
      file_path: matchFilePath.value,
      episode_offset: episodeOffset.value,
    })
    actionResult.value = {
      type: res.data?.success ? 'success' : 'error',
      message: res.data?.message || '匹配已保存',
    }
    if (res.data?.success) {
      showSearchDialog.value = false
      selectedAnime.value = null
      searchKeyword.value = ''
      searchResults.value = []
      searchDone.value = false
      matchFilePath.value = ''
      episodeOffset.value = 0
    }
  } catch (err) {
    actionResult.value = { type: 'error', message: `保存失败: ${err.message}` }
  } finally {
    actionLoading.value = null
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
