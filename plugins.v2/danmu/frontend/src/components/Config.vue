<template>
  <VCard class="config-component" :loading="loading">
    <VCardItem>
      <template #prepend>
        <VIcon icon="mdi-cog" color="primary" size="32" />
      </template>
      <VCardTitle>插件配置</VCardTitle>
      <VCardSubtitle>弹幕刮削参数设置</VCardSubtitle>
    </VCardItem>

    <VAlert v-if="error" type="error" variant="tonal" closable class="mx-4 mb-2">
      {{ error }}
    </VAlert>

    <VAlert v-if="saveSuccess" type="success" variant="tonal" closable class="mx-4 mb-2">
      配置已保存
    </VAlert>

    <VCardText>
      <VTabs v-model="configTab" color="primary">
        <VTab value="basic">基本设置</VTab>
        <VTab value="display">显示参数</VTab>
        <VTab value="filter">过滤设置</VTab>
        <VTab value="advanced">高级选项</VTab>
      </VTabs>

      <VDivider class="mb-4" />

      <VWindow v-model="configTab">
        <!-- 基本设置 -->
        <VWindowItem value="basic">
          <VRow>
            <VCol cols="12">
              <VSwitch
                v-model="form.enabled"
                label="启用插件"
                color="primary"
                hide-details
                class="mb-4"
              />
            </VCol>
            <VCol cols="12">
              <VTextarea
                v-model="form.path"
                label="刮削路径"
                placeholder="每行一个目录路径"
                variant="outlined"
                rows="3"
                hint="配置需要刮削弹幕的视频目录，支持多路径（每行一个）"
                persistent-hint
              />
            </VCol>
            <VCol cols="12">
              <VSwitch
                v-model="form.auto_scrape"
                label="自动刮削"
                color="primary"
                hint="文件传输完成后自动生成弹幕"
                persistent-hint
              />
            </VCol>
            <VCol cols="12">
              <VSwitch
                v-model="form.enable_retry_task"
                label="启用重试任务"
                color="primary"
                hint="每3小时自动重试弹幕数量不足的文件"
                persistent-hint
              />
            </VCol>
            <VCol cols="12">
              <VSwitch
                v-model="form.enable_strm"
                label="启用 .strm 文件刮削"
                color="primary"
                hint="对 .strm 流媒体文件也进行弹幕刮削"
                persistent-hint
              />
            </VCol>
          </VRow>
        </VWindowItem>

        <!-- 显示参数 -->
        <VWindowItem value="display">
          <VRow>
            <VCol cols="12" md="6">
              <VTextField
                v-model.number="form.width"
                label="宽度"
                type="number"
                variant="outlined"
                hint="弹幕分辨率宽度"
                persistent-hint
              />
            </VCol>
            <VCol cols="12" md="6">
              <VTextField
                v-model.number="form.height"
                label="高度"
                type="number"
                variant="outlined"
                hint="弹幕分辨率高度"
                persistent-hint
              />
            </VCol>
            <VCol cols="12" md="4">
              <VTextField
                v-model.number="form.fontsize"
                label="字号"
                type="number"
                variant="outlined"
                suffix="px"
              />
            </VCol>
            <VCol cols="12" md="4">
              <VTextField
                v-model.number="form.alpha"
                label="透明度"
                type="number"
                variant="outlined"
                hint="0.0 ~ 1.0"
                min="0"
                max="1"
                step="0.05"
                persistent-hint
              />
            </VCol>
            <VCol cols="12" md="4">
              <VTextField
                v-model.number="form.duration"
                label="持续时间"
                type="number"
                variant="outlined"
                suffix="秒"
              />
            </VCol>
            <VCol cols="12" md="6">
              <VSelect
                v-model="form.screen_area"
                label="屏幕区域"
                :items="screenAreaOptions"
                variant="outlined"
              />
            </VCol>
            <VCol cols="12" md="6">
              <VSwitch
                v-model="form.onlyFromBili"
                label="仅使用B站弹幕"
                color="primary"
                hint="只使用来自Bilibili的弹幕源"
                persistent-hint
              />
            </VCol>
            <VCol cols="12">
              <VSwitch
                v-model="form.useTmdbID"
                label="使用TMDB ID匹配"
                color="primary"
                hint="优先使用TMDB ID进行番剧匹配"
                persistent-hint
              />
            </VCol>
          </VRow>
        </VWindowItem>

        <!-- 过滤设置 -->
        <VWindowItem value="filter">
          <VRow>
            <VCol cols="12">
              <VSwitch
                v-model="form.filter_enabled"
                label="启用弹幕内容过滤"
                color="primary"
                class="mb-4"
              />
            </VCol>

            <template v-if="form.filter_enabled">
              <VCol cols="12">
                <div class="text-subtitle-2 font-weight-bold mb-2">屏蔽弹幕模式</div>
                <VCheckbox v-model="form.filter_blocked_modes" label="顶部弹幕" value="top" color="primary" />
                <VCheckbox v-model="form.filter_blocked_modes" label="底部弹幕" value="bottom" color="primary" />
                <VCheckbox v-model="form.filter_blocked_modes" label="滚动弹幕" value="scroll" color="primary" />
                <VCheckbox v-model="form.filter_blocked_modes" label="逆向弹幕" value="reverse" color="primary" />
                <VCheckbox v-model="form.filter_blocked_modes" label="精准定位" value="position" color="primary" />
                <VCheckbox v-model="form.filter_blocked_modes" label="高级弹幕" value="advanced" color="primary" />
                <VCheckbox v-model="form.filter_blocked_modes" label="代码弹幕" value="code" color="primary" />
              </VCol>

              <VDivider class="my-3" />

              <VCol cols="12">
                <div class="text-subtitle-2 font-weight-bold mb-2">相似弹幕过滤</div>
              </VCol>
              <VCol cols="12" md="6">
                <VSwitch
                  v-model="form.filter_similarity_enabled"
                  label="启用相似弹幕过滤"
                  color="primary"
                />
              </VCol>
              <VCol cols="12" md="6">
                <VTextField
                  v-model.number="form.filter_similarity_threshold"
                  label="相似度阈值"
                  type="number"
                  variant="outlined"
                  hint="0.0 ~ 1.0，值越低越严格"
                  min="0"
                  max="1"
                  step="0.05"
                  persistent-hint
                />
              </VCol>

              <VDivider class="my-3" />

              <VCol cols="12">
                <div class="text-subtitle-2 font-weight-bold mb-2">同屏密度控制</div>
              </VCol>
              <VCol cols="12" md="4">
                <VTextField
                  v-model.number="form.filter_screen_max"
                  label="同屏最大弹幕数"
                  type="number"
                  variant="outlined"
                />
              </VCol>
              <VCol cols="12" md="4">
                <VTextField
                  v-model.number="form.filter_screen_window"
                  label="同屏时间窗口"
                  type="number"
                  variant="outlined"
                  suffix="秒"
                />
              </VCol>
              <VCol cols="12" md="4">
                <VTextField
                  v-model.number="form.filter_freq_window"
                  label="用户频率窗口"
                  type="number"
                  variant="outlined"
                  suffix="秒"
                />
              </VCol>
              <VCol cols="12" md="4">
                <VTextField
                  v-model.number="form.filter_freq_max"
                  label="窗口内最大弹幕"
                  type="number"
                  variant="outlined"
                  hint="超过则降低信用分"
                  persistent-hint
                />
              </VCol>

              <VDivider class="my-3" />

              <VCol cols="12">
                <div class="text-subtitle-2 font-weight-bold mb-2">屏幕区域保留比例</div>
              </VCol>
              <VCol cols="12" md="4">
                <VTextField
                  v-model.number="form.filter_screen_top_ratio"
                  label="顶部保留比例"
                  type="number"
                  variant="outlined"
                  hint="0.0 ~ 1.0"
                  min="0"
                  max="1"
                  step="0.05"
                  persistent-hint
                />
              </VCol>
              <VCol cols="12" md="4">
                <VTextField
                  v-model.number="form.filter_screen_bottom_ratio"
                  label="底部保留比例"
                  type="number"
                  variant="outlined"
                  hint="0.0 ~ 1.0"
                  min="0"
                  max="1"
                  step="0.05"
                  persistent-hint
                />
              </VCol>
              <VCol cols="12" md="4">
                <VTextField
                  v-model.number="form.filter_screen_scroll_ratio"
                  label="滚动保留比例"
                  type="number"
                  variant="outlined"
                  hint="0.0 ~ 1.0"
                  min="0"
                  max="1"
                  step="0.05"
                  persistent-hint
                />
              </VCol>
            </template>
          </VRow>
        </VWindowItem>

        <!-- 高级选项 -->
        <VWindowItem value="advanced">
          <VRow>
            <VCol cols="12" md="6">
              <VTextField
                v-model.number="form.max_threads"
                label="最大线程数"
                type="number"
                variant="outlined"
                hint="同时刮削的任务数"
                persistent-hint
              />
            </VCol>
          </VRow>
        </VWindowItem>
      </VWindow>
    </VCardText>

    <VDivider />

    <VCardActions class="pa-4">
      <VBtn variant="tonal" color="grey" @click="resetConfig">
        <VIcon icon="mdi-restore" start />
        重置
      </VBtn>
      <VSpacer />
      <VBtn variant="tonal" color="primary" :loading="saving" @click="saveConfig">
        <VIcon icon="mdi-content-save" start />
        保存配置
      </VBtn>
    </VCardActions>
  </VCard>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { mdiCog, mdiRestore, mdiContentSave } from '@mdi/js'
import axios from 'axios'

const { pluginId } = defineProps(['pluginId', 'config', 'eventBus'])

const loading = ref(false)
const saving = ref(false)
const error = ref('')
const saveSuccess = ref(false)
const configTab = ref('basic')

const screenAreaOptions = [
  { title: '全屏', value: 'full' },
  { title: '半屏', value: 'half' },
  { title: '1/4 屏', value: 'quarter' },
]

const defaultForm = {
  enabled: false,
  path: '',
  width: 1920,
  height: 1080,
  fontsize: 50,
  alpha: 0.8,
  duration: 15,
  max_threads: 10,
  onlyFromBili: false,
  useTmdbID: true,
  auto_scrape: true,
  enable_retry_task: true,
  screen_area: 'full',
  enable_strm: true,
  filter_enabled: true,
  filter_blocked_modes: [],
  filter_similarity_threshold: 0.8,
  filter_similarity_enabled: true,
  filter_freq_window: 30.0,
  filter_freq_max: 10,
  filter_screen_max: 15,
  filter_screen_window: 5.0,
  filter_screen_top_ratio: 0.25,
  filter_screen_bottom_ratio: 0.10,
  filter_screen_scroll_ratio: 0.65,
}

const form = reactive({ ...defaultForm })

const getApiBase = () => `/api/v1/plugin/${pluginId}`

// 加载配置
const loadConfig = async () => {
  loading.value = true
  error.value = ''
  try {
    const res = await axios.get(`${getApiBase()}/config`)
    if (res.data?.success && res.data.data) {
      Object.assign(form, res.data.data)
    }
  } catch (err) {
    error.value = `加载配置失败: ${err.message}`
  } finally {
    loading.value = false
  }
}

// 保存配置
const saveConfig = async () => {
  saving.value = true
  error.value = ''
  saveSuccess.value = false
  try {
    const res = await axios.post(`${getApiBase()}/config`, form)
    if (res.data?.success) {
      saveSuccess.value = true
      setTimeout(() => { saveSuccess.value = false }, 3000)
    } else {
      error.value = res.data?.message || '保存失败'
    }
  } catch (err) {
    error.value = `保存配置失败: ${err.message}`
  } finally {
    saving.value = false
  }
}

// 重置
const resetConfig = () => {
  Object.assign(form, defaultForm)
}

onMounted(() => {
  loadConfig()
})
</script>

<style scoped>
.config-component {
  min-height: 400px;
}
</style>
