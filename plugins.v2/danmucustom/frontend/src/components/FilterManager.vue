<template>
  <div>
    <!-- 操作结果提示 -->
    <VAlert v-if="actionResult" :type="actionResult.type" variant="tonal" closable class="mb-3" @click:close="actionResult = null">
      {{ actionResult.message }}
    </VAlert>

    <!-- 错误提示 -->
    <VAlert v-if="error" type="error" variant="tonal" closable class="mb-3" @click:close="error = ''">
      {{ error }}
    </VAlert>

    <VRow>
      <!-- 分类屏蔽词库 -->
      <VCol :cols="compact ? 12 : 12" md="6">
        <VCard :variant="compact ? 'tonal' : 'elevated'">
          <VCardTitle class="d-flex align-center">
            <VIcon start>mdi-book-open-variant</VIcon>
            分类屏蔽词库
            <VChip size="small" class="ml-2" color="primary" variant="tonal">{{ totalKeywords }}</VChip>
            <VSpacer />
            <VBtn size="small" color="primary" variant="tonal" prepend-icon="mdi-plus" @click="openAddCategoryDialog">
              添加分类
            </VBtn>
          </VCardTitle>

          <VCardText>
            <!-- 分类列表 -->
            <VList v-if="categories.length > 0" density="compact" lines="two">
              <VListGroup v-for="cat in categories" :key="cat.name" :value="cat.name">
                <template #activator="{ props: activatorProps }">
                  <VListItem v-bind="activatorProps" :prepend-icon="cat.enabled ? 'mdi-check-circle' : 'mdi-close-circle'" :title="cat.name">
                    <template #subtitle>
                      {{ cat.desc || '无描述' }} · {{ cat.keywords?.length || 0 }} 个关键词
                    </template>
                    <template #append>
                      <VSwitch
                        :model-value="cat.enabled"
                        density="compact"
                        hide-details
                        color="success"
                        @click.stop
                        @update:model-value="toggleCategory(cat.name, $event)"
                      />
                      <VBtn
                        icon="mdi-delete"
                        size="x-small"
                        variant="text"
                        color="error"
                        class="ml-1"
                        @click.stop="confirmDeleteCategory(cat.name)"
                      />
                    </template>
                  </VListItem>
                </template>

                <!-- 关键词列表 -->
                <div class="ml-8 mb-2">
                  <div class="d-flex align-center mb-1">
                    <VTextField
                      v-model="newKeywords[cat.name]"
                      label="添加关键词"
                      density="compact"
                      variant="outlined"
                      size="small"
                      hide-details
                      class="mr-2"
                      @keyup.enter="addKeyword(cat.name)"
                    >
                      <template #append-inner>
                        <VTooltip text="命中即整条弹幕被屏蔽的精确词/短语，例如「打卡」「签到」「哈哈哈哈」。回车可快速添加，已添加的标签可点 × 删除。" location="bottom">
                          <template #activator="{ props }">
                            <VIcon v-bind="props" icon="mdi-help-circle-outline" size="small" color="medium-emphasis" />
                          </template>
                        </VTooltip>
                      </template>
                    </VTextField>
                    <VBtn size="small" color="primary" variant="tonal" icon="mdi-plus" @click="addKeyword(cat.name)" />
                  </div>
                  <VChipGroup v-if="cat.keywords?.length > 0" column>
                    <VChip
                      v-for="kw in cat.keywords"
                      :key="kw"
                      size="small"
                      closable
                      label
                      @click:close="removeKeyword(cat.name, kw)"
                    >
                      {{ kw }}
                    </VChip>
                  </VChipGroup>
                  <div v-else class="text-caption text-medium-emphasis mt-1">暂无关键词，请在上方添加</div>
                </div>

                <!-- 组合规则 -->
                <div class="ml-8 mb-2">
                  <div class="text-caption font-weight-bold mb-1">组合规则（关键词 + 长度上限）</div>
                  <div class="text-caption text-medium-emphasis mb-1">含指定关键词且长度不超过上限的弹幕将被屏蔽，适合屏蔽带变化前缀的长文本（如「xx打卡」）。</div>
                  <div class="d-flex align-center mb-1">
                    <VTextField
                      v-model="newCombos[cat.name].keyword"
                      label="关键词"
                      density="compact"
                      variant="outlined"
                      hide-details
                      class="mr-2"
                      @keyup.enter="addCombo(cat.name)"
                    >
                      <template #append-inner>
                        <VTooltip text="代表弹幕『主题』的核心词，配合『长度≤』判定：含此词且长度不超过上限的弹幕会被屏蔽。用于屏蔽「xx打卡」「xx签到」这类带变化前缀的长文本。" location="bottom">
                          <template #activator="{ props }">
                            <VIcon v-bind="props" icon="mdi-help-circle-outline" size="small" color="medium-emphasis" />
                          </template>
                        </VTooltip>
                      </template>
                    </VTextField>
                    <VTextField
                      v-model.number="newCombos[cat.name].max_len"
                      label="长度≤"
                      type="number"
                      density="compact"
                      variant="outlined"
                      hide-details
                      style="max-width: 90px"
                      class="mr-2"
                    >
                      <template #append-inner>
                        <VTooltip text="弹幕字符数上限。含『关键词』且长度 ≤ 此值才屏蔽；填 0 表示不限制长度（只要含关键词即屏蔽）。" location="bottom">
                          <template #activator="{ props }">
                            <VIcon v-bind="props" icon="mdi-help-circle-outline" size="small" color="medium-emphasis" />
                          </template>
                        </VTooltip>
                      </template>
                    </VTextField>
                    <VBtn size="small" color="primary" variant="tonal" icon="mdi-plus" @click="addCombo(cat.name)" />
                  </div>
                  <VChipGroup v-if="cat.combos?.length > 0" column>
                    <VChip
                      v-for="r in cat.combos"
                      :key="r[0]"
                      size="small"
                      closable
                      label
                      @click:close="removeCombo(cat.name, r[0])"
                    >
                      {{ r[0] }} (≤{{ r[1] }}字)
                    </VChip>
                  </VChipGroup>
                  <div v-else class="text-caption text-medium-emphasis mt-1">暂无组合规则</div>
                </div>

                <!-- 正则规则 -->
                <div class="ml-8 mb-2">
                  <div class="text-caption font-weight-bold mb-1">正则规则</div>
                  <div class="text-caption text-medium-emphasis mb-1">用正则表达式匹配弹幕内容，适合屏蔽有规律的变体（如纯数字串、超短弹幕）。</div>
                  <div class="d-flex align-center mb-1">
                    <VTextField
                      v-model="newRegexes[cat.name].pattern"
                      label="正则表达式"
                      density="compact"
                      variant="outlined"
                      hide-details
                      class="mr-2"
                      @keyup.enter="addRegex(cat.name)"
                    >
                      <template #append-inner>
                        <VTooltip text="用正则匹配弹幕内容（默认区分大小写，可在正则开头加 (?i) 忽略）。例：^.{1,3}$ 屏蔽超短弹幕；\d{6,} 屏蔽长数字串。语法错误会导致匹配异常，请确认后再添加。" location="bottom">
                          <template #activator="{ props }">
                            <VIcon v-bind="props" icon="mdi-help-circle-outline" size="small" color="medium-emphasis" />
                          </template>
                        </VTooltip>
                      </template>
                    </VTextField>
                    <VSelect
                      v-model.number="newRegexes[cat.name].level"
                      :items="[1, 2, 3]"
                      label="等级"
                      density="compact"
                      variant="outlined"
                      hide-details
                      style="max-width: 90px"
                      class="mr-2"
                    >
                      <template #append-inner>
                        <VTooltip text="匹配命中后的处理等级：1=弱（仅标记）；2=普通屏蔽（默认）；3=强屏蔽（优先处理，可覆盖白名单）。一般填 2。" location="bottom">
                          <template #activator="{ props }">
                            <VIcon v-bind="props" icon="mdi-help-circle-outline" size="small" color="medium-emphasis" />
                          </template>
                        </VTooltip>
                      </template>
                    </VSelect>
                    <VBtn size="small" color="primary" variant="tonal" icon="mdi-plus" @click="addRegex(cat.name)" />
                  </div>
                  <VChipGroup v-if="cat.regexes?.length > 0" column>
                    <VChip
                      v-for="r in cat.regexes"
                      :key="r[0]"
                      size="small"
                      closable
                      label
                      @click:close="removeRegex(cat.name, r[0])"
                    >
                      {{ r[0] }} (等级{{ r[1] }})
                    </VChip>
                  </VChipGroup>
                  <div v-else class="text-caption text-medium-emphasis mt-1">暂无正则规则</div>
                </div>
              </VListGroup>
            </VList>

            <VAlert v-else type="info" variant="tonal">
              暂无分类，请点击「添加分类」创建屏蔽词库
            </VAlert>
          </VCardText>
        </VCard>
      </VCol>

      <!-- 封禁/警告用户 -->
      <VCol :cols="compact ? 12 : 12" md="6">
        <VCard :variant="compact ? 'tonal' : 'elevated'">
          <VCardTitle class="d-flex align-center">
            <VIcon start>mdi-account-cancel</VIcon>
            用户管理
            <VChip size="small" class="ml-2" color="error" variant="tonal">{{ blockedUsers.length }}</VChip>
            <VChip v-if="warnedUsers.length" size="small" class="ml-1" color="warning" variant="tonal">{{ warnedUsers.length }}</VChip>
          </VCardTitle>

          <VCardText>
            <!-- 封禁用户 -->
            <div class="text-subtitle-2 font-weight-bold mb-2">已封禁用户</div>
            <div v-if="blockedUsers.length > 0" class="mb-3">
              <div
                v-for="user in blockedUsers"
                :key="user.user_id"
                class="d-flex align-center py-1 px-2 rounded bg-error-lighten-5 mb-1"
              >
                <div class="flex-grow-1">
                  <div class="text-body-2 font-weight-medium">{{ user.user_id }}</div>
                  <div class="text-caption text-medium-emphasis">
                    信用分: {{ user.credit_score }} · {{ user.block_reason || '--' }}
                  </div>
                </div>
                <VBtn
                  size="x-small"
                  color="success"
                  variant="tonal"
                  prepend-icon="mdi-lock-open"
                  :loading="unblockLoading === user.user_id"
                  @click="handleUnblock(user.user_id)"
                >
                  解封
                </VBtn>
              </div>
            </div>
            <div v-else class="text-caption text-medium-emphasis mb-3">
              暂无封禁用户
            </div>

            <!-- 警告用户 -->
            <div v-if="warnedUsers.length > 0">
              <div class="text-subtitle-2 font-weight-bold mb-2">警告用户（信用分 ≤ 50）</div>
              <div
                v-for="user in warnedUsers"
                :key="user.user_id"
                class="d-flex align-center py-1 px-2 rounded bg-warning-lighten-5 mb-1"
              >
                <div class="flex-grow-1">
                  <div class="text-body-2 font-weight-medium">{{ user.user_id }}</div>
                  <div class="text-caption text-medium-emphasis">
                    信用分: {{ user.credit_score }} · 发送: {{ user.total_sent || 0 }} 次
                  </div>
                </div>
                <VBtn
                  size="x-small"
                  color="primary"
                  variant="tonal"
                  prepend-icon="mdi-refresh"
                  :loading="resetLoading === user.user_id"
                  @click="handleReset(user.user_id)"
                >
                  重置
                </VBtn>
              </div>
            </div>

            <VAlert v-if="!blockedUsers.length && !warnedUsers.length" type="info" variant="tonal">
              暂无用户数据（请先执行弹幕刮削后方可看到用户信息）
            </VAlert>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- 添加分类对话框 -->
    <VDialog v-model="showAddCategoryDialog" max-width="400">
      <VCard>
        <VCardTitle>添加分类</VCardTitle>
        <VCardText>
          <VTextField v-model="newCategoryName" label="分类名称" density="compact" variant="outlined" autofocus>
            <template #append-inner>
              <VTooltip text="自定义一个分类名（如「番剧专有屏蔽」「直播间水军」）。内置分类不可改名，自定义分类可删除。名称会作为该分类下所有词/规则的归属标识。" location="bottom">
                <template #activator="{ props }">
                  <VIcon v-bind="props" icon="mdi-help-circle-outline" size="small" color="medium-emphasis" />
                </template>
              </VTooltip>
            </template>
          </VTextField>
          <VTextField v-model="newCategoryDesc" label="描述（可选）" density="compact" variant="outlined" class="mt-2">
            <template #append-inner>
              <VTooltip text="说明这个分类屏蔽什么，便于日后维护时快速理解，可不填。" location="bottom">
                <template #activator="{ props }">
                  <VIcon v-bind="props" icon="mdi-help-circle-outline" size="small" color="medium-emphasis" />
                </template>
              </VTooltip>
            </template>
          </VTextField>
        </VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn variant="text" @click="showAddCategoryDialog = false">取消</VBtn>
          <VBtn color="primary" :loading="actionLoading === 'add-category'" @click="addCategory">确定</VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- 删除分类确认 -->
    <VDialog v-model="showDeleteCategoryDialog" max-width="400">
      <VCard>
        <VCardTitle>确认删除</VCardTitle>
        <VCardText>
          确定删除分类「{{ deletingCategory }}」吗？该分类下的所有关键词将被同时删除，此操作不可恢复。
        </VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn variant="text" @click="showDeleteCategoryDialog = false">取消</VBtn>
          <VBtn color="error" :loading="actionLoading === 'delete-category'" @click="deleteCategory">确认删除</VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- 底部刷新按钮 -->
    <div class="d-flex justify-end mt-3">
      <VBtn
        color="secondary"
        variant="tonal"
        prepend-icon="mdi-refresh"
        :loading="loading"
        @click="refreshData"
      >
        刷新数据
      </VBtn>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'

const props = defineProps({
  pluginId: { type: String, required: true },
  api: { type: Object, default: null },
  compact: { type: Boolean, default: false },
})

const API_PLUGIN_ID = props.pluginId || 'DanmuCustom'

// --- API 封装 ---
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

const unwrapResponse = (res) => {
  const data = res?.data ?? res
  if (data && typeof data === 'object' && 'success' in data && data.data) {
    return data.data
  }
  return data
}

// --- 状态 ---
const loading = ref(false)
const error = ref('')
const actionResult = ref(null)
const actionLoading = ref(null)
const categories = ref([])
const blockedUsers = ref([])
const warnedUsers = ref([])
const unblockLoading = ref(null)
const resetLoading = ref(null)

// 新增关键词输入
const newKeywords = ref({})
// 组合规则 / 正则规则输入缓存
const newCombos = ref({})
const newRegexes = ref({})

// 为分类初始化组合/正则输入缓存，避免模板 v-model 访问 undefined 报错
const ensureInputs = (cats) => {
  (cats || []).forEach((c) => {
    if (!newCombos.value[c.name]) newCombos.value[c.name] = { keyword: '', max_len: 0 }
    if (!newRegexes.value[c.name]) newRegexes.value[c.name] = { pattern: '', level: 2 }
  })
}

// 对话框
const showAddCategoryDialog = ref(false)
const newCategoryName = ref('')
const newCategoryDesc = ref('')
const showDeleteCategoryDialog = ref(false)
const deletingCategory = ref('')

const totalKeywords = computed(() => {
  return categories.value.reduce((sum, cat) => sum + (cat.keywords?.length || 0), 0)
})

// --- 数据刷新 ---
const refreshData = async () => {
  loading.value = true
  error.value = ''
  try {
    // 并发请求：分类 + 用户数据（使用 allSettled，单个接口失败不拖垮整个页面）
    const [catResult, userResult] = await Promise.allSettled([
      requestGet('/filter/categories'),
      requestGet('/filter/blocked_users'),
    ])

    if (catResult.status === 'fulfilled') {
      const catRes = catResult.value
      const payload = catRes?.data ?? catRes

      if (payload?.success || Array.isArray(payload)) {
        const data = payload.success ? (payload.data || []) : payload
        if (Array.isArray(data)) {
          categories.value = data
          ensureInputs(categories.value)
        } else if (data.categories && typeof data.categories === 'object') {
          categories.value = Object.entries(data.categories).map(([name, item]) => ({
            name,
            ...(item || {}),
            keywords: item?.keywords || [],
            combos: item?.combos || [],
            regexes: item?.regexes || [],
          }))
          ensureInputs(categories.value)
        } else {
          categories.value = []
        }
      } else {
        error.value = payload?.message || '获取分类失败'
      }
    } else {
      error.value = `获取分类失败: ${catResult.reason?.message || catResult.reason}`
    }

    if (userResult.status === 'fulfilled') {
      const userRes = userResult.value
      const payload = userRes?.data ?? userRes

      if (payload?.success) {
        const userData = payload.data || {}
        blockedUsers.value = userData.blocked_users || []
        warnedUsers.value = userData.warned_users || []
      } else if (payload && typeof payload === 'object') {
        blockedUsers.value = payload.blocked_users || []
        warnedUsers.value = payload.warned_users || []
      }
    } else {
      // 用户数据不是核心数据，失败时不要阻断分类词库页面
      blockedUsers.value = []
      warnedUsers.value = []
    }
  } catch (err) {
    if (err?.response?.status === 404 || err?.status === 404) {
      error.value = '插件未启用或后端 API 未注册，请先在插件配置中启用插件并保存。'
    } else {
      error.value = `获取数据失败: ${err.message}`
    }
  } finally {
    loading.value = false
  }
}

// --- 分类操作 ---
const openAddCategoryDialog = () => {
  newCategoryName.value = ''
  newCategoryDesc.value = ''
  showAddCategoryDialog.value = true
}

const addCategory = async () => {
  const name = newCategoryName.value.trim()
  if (!name) return
  actionLoading.value = 'add-category'
  try {
    const res = await requestPost('/filter/category/add', { name, desc: newCategoryDesc.value.trim() })
    const data = res?.data ?? res
    if (data?.success) {
      actionResult.value = { type: 'success', message: `已添加分类「${name}」` }
      showAddCategoryDialog.value = false
      await refreshData()
    } else {
      actionResult.value = { type: 'error', message: data?.message || '添加分类失败' }
    }
  } catch (err) {
    actionResult.value = { type: 'error', message: `添加失败: ${err.message}` }
  } finally {
    actionLoading.value = null
  }
}

const confirmDeleteCategory = (name) => {
  deletingCategory.value = name
  showDeleteCategoryDialog.value = true
}

const deleteCategory = async () => {
  const name = deletingCategory.value
  if (!name) return
  actionLoading.value = 'delete-category'
  try {
    const res = await requestPost('/filter/category/remove', { name })
    const data = res?.data ?? res
    if (data?.success) {
      actionResult.value = { type: 'success', message: `已删除分类「${name}」` }
      showDeleteCategoryDialog.value = false
      await refreshData()
    } else {
      actionResult.value = { type: 'error', message: data?.message || '删除分类失败' }
    }
  } catch (err) {
    actionResult.value = { type: 'error', message: `删除失败: ${err.message}` }
  } finally {
    actionLoading.value = null
  }
}

const toggleCategory = async (name, enabled) => {
  try {
    const res = await requestPost('/filter/category/enable', { name, enabled })
    const data = res?.data ?? res
    if (data?.success) {
      const cat = categories.value.find(c => c.name === name)
      if (cat) cat.enabled = enabled
    }
  } catch (err) {
    // 静默恢复
    categories.value = [...categories.value]
  }
}

// --- 关键词操作 ---
const addKeyword = async (categoryName) => {
  const kw = (newKeywords.value[categoryName] || '').trim()
  if (!kw) return
  try {
    const res = await requestPost('/filter/keywords/add', { category: categoryName, keyword: kw })
    const data = res?.data ?? res
    if (data?.success) {
      const cat = categories.value.find(c => c.name === categoryName)
      if (cat) {
        if (!cat.keywords) cat.keywords = []
        if (!cat.keywords.includes(kw)) cat.keywords.push(kw)
      }
      newKeywords.value[categoryName] = ''
      actionResult.value = { type: 'success', message: `已添加关键词「${kw}」` }
    } else {
      actionResult.value = { type: 'error', message: data?.message || '添加关键词失败' }
    }
  } catch (err) {
    actionResult.value = { type: 'error', message: `添加失败: ${err.message}` }
  }
}

const removeKeyword = async (categoryName, keyword) => {
  try {
    const res = await requestPost('/filter/keywords/remove', { category: categoryName, keyword })
    const data = res?.data ?? res
    if (data?.success) {
      const cat = categories.value.find(c => c.name === categoryName)
      if (cat && cat.keywords) {
        cat.keywords = cat.keywords.filter(k => k !== keyword)
      }
      actionResult.value = { type: 'success', message: `已删除关键词「${keyword}」` }
    }
  } catch (err) {
    actionResult.value = { type: 'error', message: `删除失败: ${err.message}` }
  }
}

// --- 组合规则操作 ---
const addCombo = async (categoryName) => {
  const inp = newCombos.value[categoryName]
  const kw = (inp?.keyword || '').trim()
  const maxLen = Number(inp?.max_len) || 0
  if (!kw) return
  try {
    const res = await requestPost('/filter/combo/add', { category: categoryName, keyword: kw, max_len: maxLen })
    const data = res?.data ?? res
    if (data?.success) {
      const cat = categories.value.find(c => c.name === categoryName)
      if (cat) {
        if (!cat.combos) cat.combos = []
        if (!cat.combos.find(r => r[0] === kw)) cat.combos.push([kw, maxLen])
      }
      inp.keyword = ''
      inp.max_len = 0
      actionResult.value = { type: 'success', message: `已添加组合规则「${kw}」` }
    } else {
      actionResult.value = { type: 'error', message: data?.message || '添加组合规则失败' }
    }
  } catch (err) {
    actionResult.value = { type: 'error', message: `添加失败: ${err.message}` }
  }
}

const removeCombo = async (categoryName, keyword) => {
  try {
    const res = await requestPost('/filter/combo/remove', { category: categoryName, keyword })
    const data = res?.data ?? res
    if (data?.success) {
      const cat = categories.value.find(c => c.name === categoryName)
      if (cat && cat.combos) cat.combos = cat.combos.filter(r => r[0] !== keyword)
      actionResult.value = { type: 'success', message: `已删除组合规则「${keyword}」` }
    } else {
      actionResult.value = { type: 'error', message: data?.message || '删除组合规则失败' }
    }
  } catch (err) {
    actionResult.value = { type: 'error', message: `删除失败: ${err.message}` }
  }
}

// --- 正则规则操作 ---
const addRegex = async (categoryName) => {
  const inp = newRegexes.value[categoryName]
  const pat = (inp?.pattern || '').trim()
  const level = Number(inp?.level) || 2
  if (!pat) return
  try {
    const res = await requestPost('/filter/regex/add', { category: categoryName, pattern: pat, level })
    const data = res?.data ?? res
    if (data?.success) {
      const cat = categories.value.find(c => c.name === categoryName)
      if (cat) {
        if (!cat.regexes) cat.regexes = []
        if (!cat.regexes.find(r => r[0] === pat)) cat.regexes.push([pat, level])
      }
      inp.pattern = ''
      inp.level = 2
      actionResult.value = { type: 'success', message: `已添加正则规则「${pat}」` }
    } else {
      actionResult.value = { type: 'error', message: data?.message || '添加正则规则失败' }
    }
  } catch (err) {
    actionResult.value = { type: 'error', message: `添加失败: ${err.message}` }
  }
}

const removeRegex = async (categoryName, pattern) => {
  try {
    const res = await requestPost('/filter/regex/remove', { category: categoryName, pattern })
    const data = res?.data ?? res
    if (data?.success) {
      const cat = categories.value.find(c => c.name === categoryName)
      if (cat && cat.regexes) cat.regexes = cat.regexes.filter(r => r[0] !== pattern)
      actionResult.value = { type: 'success', message: `已删除正则规则「${pattern}」` }
    } else {
      actionResult.value = { type: 'error', message: data?.message || '删除正则规则失败' }
    }
  } catch (err) {
    actionResult.value = { type: 'error', message: `删除失败: ${err.message}` }
  }
}

// --- 用户操作 ---
const handleUnblock = async (userId) => {
  if (!confirm(`确定解除封禁用户 ${userId} 吗？解除后将恢复默认信用分。`)) return
  unblockLoading.value = userId
  try {
    const res = await requestPost('/filter/users/unblock', { mid_hash: userId })
    const data = res?.data ?? res
    if (data?.success) {
      actionResult.value = { type: 'success', message: `已解除封禁用户 ${userId}` }
    } else {
      actionResult.value = { type: 'error', message: data?.message || '解除封禁失败' }
    }
    await refreshData()
  } catch (err) {
    actionResult.value = { type: 'error', message: `解除封禁失败: ${err.message}` }
  } finally {
    unblockLoading.value = null
  }
}

const handleReset = async (userId) => {
  if (!confirm(`确定重置用户 ${userId} 的信用分吗？将恢复到默认值并解除封禁状态。`)) return
  resetLoading.value = userId
  try {
    const res = await requestPost('/filter/users/reset', { mid_hash: userId })
    const data = res?.data ?? res
    if (data?.success) {
      actionResult.value = { type: 'success', message: `已重置用户 ${userId} 的信用分` }
    } else {
      actionResult.value = { type: 'error', message: data?.message || '重置失败' }
    }
    await refreshData()
  } catch (err) {
    actionResult.value = { type: 'error', message: `重置失败: ${err.message}` }
  } finally {
    resetLoading.value = null
  }
}

onMounted(() => {
  refreshData()
})
</script>
