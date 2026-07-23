<template>
  <VCard variant="outlined" class="mt-4">
    <VCardItem class="pb-0">
      <template #prepend>
        <VIcon icon="mdi-folder-multiple" color="primary" size="28" />
      </template>
      <VCardTitle>文件浏览</VCardTitle>
      <template #append>
        <VBtn icon="mdi-refresh" size="small" variant="text" :loading="loading" @click="loadRoot" />
      </template>
    </VCardItem>

    <!-- 面包屑导航 -->
    <VCardText v-if="breadcrumbs.length > 0" class="pb-0">
      <VBreadcrumbs density="compact" divider="›">
        <VBreadcrumbsItem v-for="(item, i) in breadcrumbs" :key="i" @click="navigateTo(i)">
          {{ item.name }}
        </VBreadcrumbsItem>
      </VBreadcrumbs>
    </VCardText>

    <!-- 错误提示 -->
    <VAlert v-if="error" type="error" variant="tonal" closable class="mx-4 mt-2" @click:close="error = ''">
      {{ error }}
    </VAlert>

    <!-- 操作提示 -->
    <VAlert v-if="actionMsg" :type="actionMsg.type" variant="tonal" closable class="mx-4 mt-2" @click:close="actionMsg = null">
      {{ actionMsg.text }}
    </VAlert>

    <VCardText>
      <!-- 加载中 -->
      <div v-if="loading" class="text-center pa-6">
        <VProgressCircular indeterminate color="primary" />
        <div class="text-caption mt-2 text-medium-emphasis">扫描目录中…</div>
      </div>

      <!-- 空状态 -->
      <VAlert v-else-if="!currentData || (!currentData.children?.length && !currentData.children?.length && currentData.type !== 'media')" type="info" variant="tonal">
        当前目录为空。请确认「基本设置」中的刮削路径是否正确。
      </VAlert>

      <!-- 目录文件列表 -->
      <VList v-else density="compact" class="file-browser-list">
        <template v-for="(item, i) in currentData.children || []" :key="i">
          <!-- 子目录 -->
          <VListItem
            v-if="item.type === 'directory'"
            @click="enterDirectory(item)"
            :title="item.name"
            class="file-item file-item-dir"
          >
            <template #prepend>
              <VIcon icon="mdi-folder" color="warning" size="20" />
            </template>
            <template #append>
              <VChip
                v-if="item.manual_match"
                size="x-small"
                color="success"
                variant="tonal"
                class="mr-1"
              >
                {{ item.manual_match.anime_title || '已匹配' }}
              </VChip>
              <VBtn
                size="x-small"
                color="primary"
                variant="tonal"
                class="mr-1"
                @click.stop="scrapeDirectory(item)"
                :loading="scrapingItem === item.path"
              >
                刮削
              </VBtn>
              <VBtn
                size="x-small"
                color="info"
                variant="text"
                @click.stop="openManualMatch(item)"
              >
                匹配
              </VBtn>
            </template>
          </VListItem>

          <!-- 媒体文件 -->
          <VListItem
            v-else-if="item.type === 'media'"
            :title="item.name"
            class="file-item file-item-media"
          >
            <template #prepend>
              <VIcon icon="mdi-file-video" color="secondary" size="20" />
            </template>
            <template #subtitle>
              <span v-if="item.danmu_count" class="text-caption text-success mr-2">
                🎯 弹幕: {{ item.danmu_count }}
              </span>
              <VChip
                v-if="item.manual_match"
                size="x-small"
                :color="item.danmu_count ? 'success' : 'warning'"
                variant="tonal"
              >
                {{ item.manual_match.anime_title || '已匹配' }}
              </VChip>
            </template>
            <template #append>
              <VChip v-if="item.danmu_count" size="x-small" color="success" variant="tonal" class="mr-1">
                ✓ 已生成
              </VChip>
              <VBtn
                size="x-small"
                color="primary"
                variant="tonal"
                class="mr-1"
                @click.stop="scrapeFile(item)"
                :loading="scrapingItem === item.path"
              >
                刮削
              </VBtn>
              <VBtn
                size="x-small"
                color="info"
                variant="text"
                class="mr-1"
                @click.stop="openFileManualMatch(item)"
              >
                匹配
              </VBtn>
              <VBtn
                size="x-small"
                color="orange"
                variant="text"
                @click.stop="matchByTmdb(item)"
                :loading="tmdbMatchingItem === item.path"
              >
                TMDB
              </VBtn>
            </template>
          </VListItem>
        </template>
      </VList>
    </VCardText>
  </VCard>

  <!-- 手动匹配弹窗 -->
  <VDialog v-model="showMatchDialog" max-width="600">
    <VCard>
      <VCardItem>
        <VCardTitle>手动匹配番剧</VCardTitle>
        <VCardSubtitle>{{ matchTarget?.name }}</VCardSubtitle>
      </VCardItem>
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
        <VList v-if="searchResults.length" density="compact" class="mt-2">
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
          <div class="text-subtitle-2 mb-2">
            已选择: {{ selectedAnime.anime_title || selectedAnime.title }}
          </div>
          <VTextField
            v-model="episodeOffset"
            label="集数偏移"
            type="number"
            variant="outlined"
            hint="正数=后移，负数=前移"
            persistent-hint
          />
        </template>
      </VCardText>
      <VCardActions>
        <VSpacer />
        <VBtn variant="text" @click="showMatchDialog = false">取消</VBtn>
        <VBtn
          v-if="selectedAnime"
          color="primary"
          variant="tonal"
          :loading="savingMatch"
          @click="saveMatch"
        >
          保存匹配
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>

  <!-- TMDB 匹配结果弹窗 -->
  <VDialog v-model="showTmdbDialog" max-width="650">
    <VCard>
      <VCardItem>
        <template #prepend>
          <VIcon icon="mdi-database-search" color="orange" size="28" />
        </template>
        <VCardTitle>TMDB匹配结果</VCardTitle>
        <VCardSubtitle>{{ tmdbTargetName }}</VCardSubtitle>
      </VCardItem>
      <VCardText>
        <!-- 加载中 -->
        <div v-if="tmdbLoading" class="text-center pa-6">
          <VProgressCircular indeterminate color="orange" />
          <div class="text-caption mt-2 text-medium-emphasis">
            文件名 → TMDB 搜索 → 弹弹Play 匹配…
          </div>
        </div>

        <!-- 失败 -->
        <VAlert
          v-else-if="!tmdbResult?.success"
          type="warning"
          variant="tonal"
          :text="tmdbResult?.message || 'TMDB匹配失败'"
        />

        <!-- 成功 -->
        <template v-else>
          <!-- TMDB 识别信息 -->
          <VAlert type="success" variant="tonal" class="mb-3">
            <template #text>
              <div>TMDB ID: <b>{{ tmdbResult.tmdb_id }}</b></div>
              <div>类型: {{ tmdbResult.tmdb_type_label }}</div>
              <div>识别: {{ tmdbResult.tmdb_title }}</div>
            </template>
          </VAlert>

          <!-- 弹弹Play 匹配结果 -->
          <div class="text-subtitle-1 mb-2">
            弹弹Play 匹配到的番剧 ({{ (tmdbResult.matches || []).length }} 部):
          </div>
          <VList v-if="tmdbResult.matches?.length" density="compact" class="bg-grey-lighten-4">
            <VListItem
              v-for="anime in tmdbResult.matches"
              :key="anime.animeId"
            >
              <template #prepend>
                <VIcon icon="mdi-play-box" color="primary" size="20" />
              </template>
              <VListItemTitle>{{ anime.animeTitle }}</VListItemTitle>
              <VListItemSubtitle>
                ID: {{ anime.animeId }} | 类型: {{ anime.typeDescription || anime.type }}
                <span v-if="anime.episodes?.length">
                  | 集数: {{ anime.episodes.map(e => e.episodeTitle || e.episodeId).join(', ') }}
                </span>
              </VListItemSubtitle>
              <template #append>
                <VBtn
                  size="small"
                  color="success"
                  variant="tonal"
                  @click="applyTmdbMatch(anime)"
                >
                  使用此匹配
                </VBtn>
              </template>
            </VListItem>
          </VList>
          <VAlert v-else type="info" variant="tonal">
            弹弹Play 未收录该 TMDB ID 的弹幕数据
          </VAlert>
        </template>
      </VCardText>
      <VCardActions>
        <VSpacer />
        <VBtn variant="text" @click="showTmdbDialog = false">关闭</VBtn>
        <VBtn
          v-if="tmdbResult?.success && tmdbResult?.matches?.length"
          color="primary"
          variant="tonal"
          @click="scrapeTargetAfterTmdb"
        >
          直接刮削
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>

<script setup>
import { ref, reactive, onMounted, nextTick } from 'vue'
import axios from 'axios'

const { pluginId, api } = defineProps(['pluginId', 'api'])

// API 插件 ID
const API_PLUGIN_ID = 'DanmuCustom'

const requestGet = async (path, options = {}) => {
  if (api?.get) {
    return await api.get(`plugin/${API_PLUGIN_ID}${path}`, options)
  }
  return await axios.get(`/api/v1/plugin/${API_PLUGIN_ID}${path}`, options)
}

const requestPost = async (path, data = {}, options = {}) => {
  if (api?.post) {
    return await api.post(`plugin/${API_PLUGIN_ID}${path}`, data, options)
  }
  return await axios.post(`/api/v1/plugin/${API_PLUGIN_ID}${path}`, data, options)
}

// 解析响应
const unwrap = (res) => {
  const d = res?.data ?? res
  if (d && typeof d === 'object' && 'success' in d) {
    return d.success ? (d.data ?? d) : d
  }
  return d
}

const loading = ref(false)
const error = ref('')
const actionMsg = ref(null)
const currentData = ref(null)
const scrapingItem = ref(null)

// 面包屑
const breadcrumbs = reactive([])

// 手动匹配
const showMatchDialog = ref(false)
const matchTarget = ref(null)
const searchKeyword = ref('')
const searchResults = ref([])
const searchDone = ref(false)
const selectedAnime = ref(null)
const episodeOffset = ref(0)
const savingMatch = ref(false)

// TMDB 匹配
const tmdbMatchingItem = ref(null)
const showTmdbDialog = ref(false)
const tmdbTarget = ref(null)
const tmdbTargetName = ref('')
const tmdbResult = ref(null)
const tmdbLoading = ref(false)

// 加载根目录
const loadRoot = async () => {
  loading.value = true
  error.value = ''
  try {
    const res = await requestGet('/scan_path')
    const data = unwrap(res)
    if (data?.message && !data?.success) {
      error.value = data.message
      return
    }
    currentData.value = data
    breadcrumbs.length = 0
    if (data?.name) {
      breadcrumbs.push({ name: data.name, path: data.path, data: data })
    }
  } catch (err) {
    error.value = err?.response?.data?.message || `扫描失败: ${err.message}`
  } finally {
    loading.value = false
  }
}

// 进入子目录
const enterDirectory = async (item) => {
  loading.value = true
  error.value = ''
  try {
    const res = await requestGet('/scan_subfolder', { params: { subfolder_path: item.path } })
    const data = unwrap(res)
    if (data?.message && !data?.success) {
      error.value = data.message
      return
    }
    currentData.value = data
    breadcrumbs.push({ name: item.name, path: item.path, data })
  } catch (err) {
    error.value = `进入目录失败: ${err.message}`
  } finally {
    loading.value = false
  }
}

// 面包屑导航
const navigateTo = (index) => {
  if (index === 0) {
    loadRoot()
    return
  }
  breadcrumbs.splice(index + 1)
  currentData.value = breadcrumbs[index].data
}

// 刮削目录
const scrapeDirectory = async (item) => {
  scrapingItem.value = item.path
  actionMsg.value = null
  try {
    const res = await requestGet('/scrape_directory', { params: { directory_path: item.path } })
    const d = unwrap(res)
    actionMsg.value = {
      type: d?.success !== false ? 'success' : 'error',
      text: d?.message || '目录刮削已启动',
    }
  } catch (err) {
    actionMsg.value = { type: 'error', text: `请求失败: ${err.message}` }
  } finally {
    scrapingItem.value = null
  }
}

// 刮削单个文件
const scrapeFile = async (item) => {
  scrapingItem.value = item.path
  actionMsg.value = null
  try {
    const res = await requestGet('/generate_danmu', { params: { file_path: item.path } })
    const d = unwrap(res)
    actionMsg.value = {
      type: d?.success !== false ? 'success' : 'error',
      text: d?.message || `弹幕生成完成`,
    }
    // 刷新当前目录
    if (d?.success !== false) {
      setTimeout(refreshCurrent, 1500)
    }
  } catch (err) {
    actionMsg.value = { type: 'error', text: `请求失败: ${err.message}` }
  } finally {
    scrapingItem.value = null
  }
}

// 刷新当前目录
const refreshCurrent = async () => {
  const last = breadcrumbs[breadcrumbs.length - 1]
  if (!last) {
    await loadRoot()
    return
  }
  loading.value = true
  try {
    const path = last.path
    let res
    if (breadcrumbs.length === 1) {
      res = await requestGet('/scan_path')
    } else {
      res = await requestGet('/scan_subfolder', { params: { subfolder_path: path } })
    }
    const data = unwrap(res)
    if (data && !data.message) {
      currentData.value = data
      breadcrumbs[breadcrumbs.length - 1].data = data
    }
  } catch (err) {
    // ignore
  } finally {
    loading.value = false
  }
}

// 从路径中提取可能的番剧名
const extractAnimeName = (path) => {
  // 获取最后一级目录名或文件名
  const parts = path.replace(/\\/g, '/').split('/').filter(Boolean)
  let name = parts[parts.length - 1] || ''
  // 去掉文件扩展名
  name = name.replace(/\.[^.]*$/, '')
  // 去掉常见标记
  name = name
    .replace(/[Ss]\d{1,2}[Ee]\d{1,2}(?:[+&][Ee]\d{1,2})*/g, '') // S01E02, S01E02+E03
    .replace(/[Ee][Pp]?\d{1,3}(?:[+&]E?\d{1,3})*/g, '')           // E01, EP01, E01+02
    .replace(/第\d+[集话期]|[#＃]\d{1,3}/g, '')                      // 第01集, #01
    .replace(/\[\d{2,}\]/g, '')                                     // [01], [1080P]
    .replace(/\d{3,4}[PpXx]?(?:\d+)?(?:[Hh]265|[Hh]264|[Hh]evc)?/g, '') // 1080P, 4K, 265
    .replace(/[\[\(〈【](?:BD|WEB|TV|DVD|BDRip|HDR|AT-X|OVA|SP|NC)[^\]\)〉】]*[\]\)〉】]/gi, '') // [BD], (WEB) etc
    .replace(/[\[\(〈【][^\]\)〉】]*[\]\)〉】]/g, '')                   // 剩余括号
    .replace(/[-_\.~]/g, ' ')                                       // 分隔符转空格
    .replace(/\s+/g, ' ')                                           // 合并空格
    .trim()
  return name.length >= 2 ? name : ''
}

// 目录手动匹配
const openManualMatch = (item) => {
  matchTarget.value = item
  const guessedName = extractAnimeName(item.path || item.name)
  searchKeyword.value = guessedName
  searchResults.value = []
  searchDone.value = false
  selectedAnime.value = null
  episodeOffset.value = 0
  showMatchDialog.value = true
  if (guessedName) {
    // 自动搜索提取的名称
    nextTick(() => { searchAnime() })
  }
}

// 文件手动匹配
const openFileManualMatch = (item) => {
  matchTarget.value = item
  const guessedName = extractAnimeName(item.path || item.name)
  searchKeyword.value = guessedName
  searchResults.value = []
  searchDone.value = false
  selectedAnime.value = null
  episodeOffset.value = 0
  showMatchDialog.value = true
  if (guessedName) {
    nextTick(() => { searchAnime() })
  }
}

// 搜索番剧
const searchAnime = async () => {
  if (!searchKeyword.value.trim()) return
  try {
    const res = await requestGet('/search_anime', { params: { keyword: searchKeyword.value } })
    const d = unwrap(res)
    // 后端已规范化返回 animes 数组，同时兼容旧版 {data: [...], animes: [...]} 格式
    searchResults.value = Array.isArray(d) ? d : (d?.animes || d?.data || [])
    searchDone.value = true
  } catch (err) {
    actionMsg.value = { type: 'error', text: `搜索失败: ${err.message}` }
  }
}

// 选择番剧
const selectAnime = (anime) => {
  selectedAnime.value = anime
}

// 保存匹配
const saveMatch = async () => {
  if (!selectedAnime.value || !matchTarget.value) return
  savingMatch.value = true
  try {
    const res = await requestPost('/manual_match', {
      anime_id: selectedAnime.value.anime_id || selectedAnime.value.id,
      anime_title: selectedAnime.value.anime_title || selectedAnime.value.title,
      file_path: matchTarget.value.path,
      episode_offset: episodeOffset.value || 0,
    })
    const d = unwrap(res)
    actionMsg.value = {
      type: d?.success !== false ? 'success' : 'error',
      text: d?.message || '匹配已保存',
    }
    if (d?.success !== false) {
      showMatchDialog.value = false
      selectedAnime.value = null
      searchKeyword.value = ''
      searchResults.value = []
      searchDone.value = false
      episodeOffset.value = 0
      setTimeout(refreshCurrent, 500)
    }
  } catch (err) {
    actionMsg.value = { type: 'error', text: `保存失败: ${err.message}` }
  } finally {
    savingMatch.value = false
  }
}

// TMDB 匹配文件
const matchByTmdb = async (item) => {
  tmdbMatchingItem.value = item.path
  tmdbTarget.value = item
  tmdbTargetName.value = item.path || item.name
  tmdbResult.value = null
  tmdbLoading.value = true
  showTmdbDialog.value = true

  try {
    const res = await requestGet('/tmdb_match', { params: { file_path: item.path } })
    const d = unwrap(res)
    tmdbResult.value = d
  } catch (err) {
    tmdbResult.value = { success: false, message: `TMDB匹配请求失败: ${err.message}` }
  } finally {
    tmdbMatchingItem.value = null
    tmdbLoading.value = false
  }
}

// 应用 TMDB 匹配结果
const applyTmdbMatch = async (anime) => {
  if (!tmdbTarget.value || !anime) return
  savingMatch.value = true
  try {
    const res = await requestPost('/manual_match', {
      anime_id: anime.animeId,
      anime_title: anime.animeTitle,
      file_path: tmdbTarget.value.path,
      episode_offset: 0,
    })
    const d = unwrap(res)
    actionMsg.value = {
      type: d?.success !== false ? 'success' : 'error',
      text: d?.message || `TMDB匹配已保存: ${anime.animeTitle}`,
    }
    if (d?.success !== false) {
      showTmdbDialog.value = false
      setTimeout(refreshCurrent, 500)
    }
  } catch (err) {
    actionMsg.value = { type: 'error', text: `保存TMDB匹配失败: ${err.message}` }
  } finally {
    savingMatch.value = false
  }
}

// TMDB匹配后直接刮削
const scrapeTargetAfterTmdb = async () => {
  if (!tmdbTarget.value) return
  showTmdbDialog.value = false
  scrapingItem.value = tmdbTarget.value.path
  actionMsg.value = null
  try {
    const res = await requestGet('/generate_danmu', { params: { file_path: tmdbTarget.value.path } })
    const d = unwrap(res)
    actionMsg.value = {
      type: d?.success !== false ? 'success' : 'error',
      text: d?.message || '弹幕生成完成',
    }
    if (d?.success !== false) {
      setTimeout(refreshCurrent, 1500)
    }
  } catch (err) {
    actionMsg.value = { type: 'error', text: `请求失败: ${err.message}` }
  } finally {
    scrapingItem.value = null
  }
}

onMounted(() => {
  loadRoot()
})
</script>

<style scoped>
.file-browser-list {
  max-height: 600px;
  overflow-y: auto;
}
.file-item {
  border-bottom: 1px solid rgba(var(--v-border-color), 0.12);
}
.file-item-dir:hover {
  background-color: rgba(var(--v-theme-warning), 0.05);
  cursor: pointer;
}
.file-item-media:hover {
  background-color: rgba(var(--v-theme-secondary), 0.05);
}
</style>
