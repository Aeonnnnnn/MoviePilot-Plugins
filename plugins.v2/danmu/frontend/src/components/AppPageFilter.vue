<template>
  <VContainer fluid class="pa-4 app-page-filter">
    <VRow>
      <VCol cols="12">
        <VCard>
          <VCardItem>
            <template #prepend>
              <VIcon icon="mdi-filter-variant" color="primary" size="32" />
            </template>
            <VCardTitle>弹幕过滤管理</VCardTitle>
            <VCardSubtitle>pluginId: {{ pluginId }} · navKey: {{ navKey }}</VCardSubtitle>
          </VCardItem>

          <VAlert v-if="error" type="error" variant="tonal" closable class="mx-4 mb-2">
            {{ error }}
          </VAlert>

          <VAlert v-if="actionResult" :type="actionResult.type" variant="tonal" closable class="mx-4 mb-2">
            {{ actionResult.message }}
          </VAlert>

          <!-- 过滤总览 -->
          <VCardText>
            <VRow>
              <VCol cols="12" sm="6" md="3">
                <VCard variant="tonal" color="primary" class="pa-3 text-center">
                  <div class="text-caption text-medium-emphasis">分类总数</div>
                  <div class="text-h5 font-weight-bold mt-1">{{ categories.length }}</div>
                </VCard>
              </VCol>
              <VCol cols="12" sm="6" md="3">
                <VCard variant="tonal" color="success" class="pa-3 text-center">
                  <div class="text-caption text-medium-emphasis">已启用分类</div>
                  <div class="text-h5 font-weight-bold mt-1">{{ categories.filter(c => c.enabled).length }}</div>
                </VCard>
              </VCol>
              <VCol cols="12" sm="6" md="3">
                <VCard variant="tonal" color="warning" class="pa-3 text-center">
                  <div class="text-caption text-medium-emphasis">关键词总数</div>
                  <div class="text-h5 font-weight-bold mt-1">{{ totalKeywords }}</div>
                </VCard>
              </VCol>
              <VCol cols="12" sm="6" md="3">
                <VCard variant="tonal" color="error" class="pa-3 text-center">
                  <div class="text-caption text-medium-emphasis">屏蔽用户</div>
                  <div class="text-h5 font-weight-bold mt-1">{{ blockedUsers.length }}</div>
                </VCard>
              </VCol>
            </VRow>
          </VCardText>

          <VDivider />

          <!-- 过滤分类管理 -->
          <VCardText>
            <div class="d-flex align-center justify-space-between mb-3">
              <div class="text-subtitle-2 font-weight-bold">过滤分类</div>
              <VBtn
                color="primary"
                size="small"
                variant="tonal"
                prepend-icon="mdi-plus"
                @click="showAddCategoryDialog = true"
              >
                添加分类
              </VBtn>
            </div>

            <VExpansionPanels v-if="categories.length > 0" variant="accordion">
              <VExpansionPanel v-for="cat in categories" :key="cat.name">
                <VExpansionPanelTitle>
                  <div class="d-flex align-center justify-space-between w-100">
                    <div class="d-flex align-center">
                      <VIcon :icon="cat.enabled ? 'mdi-check-circle' : 'mdi-close-circle'" :color="cat.enabled ? 'success' : 'grey'" size="20" class="mr-2" />
                      <span class="text-body-1">{{ cat.name }}</span>
                      <VChip size="x-small" class="ml-2" color="primary" variant="tonal">{{ cat.keywords?.length || 0 }} 个关键词</VChip>
                    </div>
                    <div class="d-flex align-center" @click.stop>
                      <VSwitch
                        :model-value="cat.enabled"
                        color="success"
                        hide-details
                        density="compact"
                        @click.stop
                        @update:model-value="(v) => toggleCategory(cat.name, v)"
                      />
                      <VBtn
                        icon="mdi-delete"
                        size="small"
                        variant="text"
                        color="error"
                        class="ml-2"
                        @click.stop="confirmRemoveCategory(cat.name)"
                      />
                    </div>
                  </div>
                </VExpansionPanelTitle>
                <VExpansionPanelText>
                  <!-- 关键词列表 -->
                  <div class="mb-3">
                    <div class="d-flex align-center justify-space-between mb-2">
                      <span class="text-caption text-medium-emphasis">关键词列表</span>
                      <VBtn
                        size="x-small"
                        variant="text"
                        color="primary"
                        prepend-icon="mdi-plus"
                        @click="openAddKeyword(cat.name)"
                      >
                        添加
                      </VBtn>
                    </div>
                    <VChipGroup v-if="cat.keywords?.length > 0">
                      <VChip
                        v-for="kw in cat.keywords"
                        :key="kw"
                        size="small"
                        variant="tonal"
                        closable
                        @click:close="removeKeyword(cat.name, kw)"
                      >
                        {{ kw }}
                      </VChip>
                    </VChipGroup>
                    <div v-else class="text-caption text-disabled">暂无关键词</div>
                  </div>
                </VExpansionPanelText>
              </VExpansionPanel>
            </VExpansionPanels>

            <VAlert v-else type="info" variant="tonal" class="mt-2">
              暂无过滤分类，点击"添加分类"创建
            </VAlert>
          </VCardText>

          <VDivider />

          <!-- 屏蔽用户列表 -->
          <VCardText>
            <div class="text-subtitle-2 font-weight-bold mb-3">
              屏蔽/警告用户
              <VChip size="small" class="ml-2" color="error" variant="tonal">{{ blockedUsers.length }}</VChip>
            </div>

            <VTable v-if="blockedUsers.length > 0" density="compact">
              <thead>
                <tr>
                  <th>用户ID</th>
                  <th>信用分</th>
                  <th>原因</th>
                  <th>时间</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="user in blockedUsers" :key="user.user_id">
                  <td class="text-body-2">{{ user.user_id }}</td>
                  <td>
                    <VChip
                      :color="user.credit_score < 30 ? 'error' : user.credit_score < 60 ? 'warning' : 'success'"
                      size="small"
                      variant="tonal"
                    >
                      {{ user.credit_score }}
                    </VChip>
                  </td>
                  <td class="text-body-2">{{ user.block_reason || '--' }}</td>
                  <td class="text-caption">{{ user.blocked_at || '--' }}</td>
                </tr>
              </tbody>
            </VTable>

            <VAlert v-else type="info" variant="tonal" class="mt-2">
              暂无屏蔽或警告用户
            </VAlert>
          </VCardText>

          <VDivider />

          <VCardActions class="pa-4">
            <VSpacer />
            <VBtn
              variant="tonal"
              color="primary"
              prepend-icon="mdi-refresh"
              :loading="loading"
              @click="refreshData"
            >
              刷新
            </VBtn>
          </VCardActions>
        </VCard>
      </VCol>
    </VRow>

    <!-- 添加分类对话框 -->
    <VDialog v-model="showAddCategoryDialog" max-width="400">
      <VCard>
        <VCardItem><VCardTitle>添加过滤分类</VCardTitle></VCardItem>
        <VCardText>
          <VTextField
            v-model="newCategoryName"
            label="分类名称"
            variant="outlined"
            placeholder="如：广告、剧透、刷屏"
            @keyup.enter="addCategory"
          />
        </VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn variant="text" @click="showAddCategoryDialog = false">取消</VBtn>
          <VBtn color="primary" variant="tonal" @click="addCategory">添加</VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- 添加关键词对话框 -->
    <VDialog v-model="showAddKeywordDialog" max-width="400">
      <VCard>
        <VCardItem><VCardTitle>添加关键词到「{{ addingToCategory }}」</VCardTitle></VCardItem>
        <VCardText>
          <VTextField
            v-model="newKeyword"
            label="关键词"
            variant="outlined"
            placeholder="输入要屏蔽的关键词"
            @keyup.enter="addKeyword"
          />
        </VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn variant="text" @click="showAddKeywordDialog = false">取消</VBtn>
          <VBtn color="primary" variant="tonal" @click="addKeyword">添加</VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- 确认删除对话框 -->
    <VDialog v-model="showConfirmDelete" max-width="400">
      <VCard>
        <VCardItem><VCardTitle>确认删除</VCardTitle></VCardItem>
        <VCardText>
          确定要删除分类「{{ deletingCategory }}」吗？此操作不可撤销。
        </VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn variant="text" @click="showConfirmDelete = false">取消</VBtn>
          <VBtn color="error" variant="tonal" @click="removeCategory">删除</VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </VContainer>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { mdiFilterVariant, mdiCheckCircle, mdiCloseCircle, mdiPlus, mdiDelete, mdiRefresh } from '@mdi/js'
import axios from 'axios'

const { pluginId, navKey } = defineProps(['pluginId', 'config', 'eventBus', 'navKey'])

const loading = ref(false)
const error = ref('')
const actionResult = ref(null)
const categories = ref([])
const blockedUsers = ref([])

// 对话框
const showAddCategoryDialog = ref(false)
const newCategoryName = ref('')
const showAddKeywordDialog = ref(false)
const addingToCategory = ref('')
const newKeyword = ref('')
const showConfirmDelete = ref(false)
const deletingCategory = ref('')

const totalKeywords = computed(() => {
  return categories.value.reduce((sum, cat) => sum + (cat.keywords?.length || 0), 0)
})

const getApiBase = () => `/api/v1/plugin/${pluginId}`

// 刷新数据
const refreshData = async () => {
  loading.value = true
  error.value = ''
  try {
    const [catRes, userRes] = await Promise.all([
      axios.get(`${getApiBase()}/filter/categories`),
      axios.get(`${getApiBase()}/filter/blocked_users`),
    ])
    if (catRes.data?.success) {
      categories.value = catRes.data.data || []
    }
    if (userRes.data?.success) {
      blockedUsers.value = userRes.data.data || []
    }
  } catch (err) {
    error.value = `获取数据失败: ${err.message}`
  } finally {
    loading.value = false
  }
}

// 添加分类
const addCategory = async () => {
  if (!newCategoryName.value.trim()) return
  try {
    const res = await axios.post(`${getApiBase()}/filter/category/add`, {
      category: newCategoryName.value.trim(),
    })
    if (res.data?.success) {
      actionResult.value = { type: 'success', message: '分类已添加' }
      newCategoryName.value = ''
      showAddCategoryDialog.value = false
      await refreshData()
    } else {
      actionResult.value = { type: 'error', message: res.data?.message || '添加失败' }
    }
  } catch (err) {
    actionResult.value = { type: 'error', message: `添加失败: ${err.message}` }
  }
}

// 确认删除分类
const confirmRemoveCategory = (name) => {
  deletingCategory.value = name
  showConfirmDelete.value = true
}

// 删除分类
const removeCategory = async () => {
  try {
    const res = await axios.post(`${getApiBase()}/filter/category/remove`, {
      category: deletingCategory.value,
    })
    if (res.data?.success) {
      actionResult.value = { type: 'success', message: '分类已删除' }
    } else {
      actionResult.value = { type: 'error', message: res.data?.message || '删除失败' }
    }
  } catch (err) {
    actionResult.value = { type: 'error', message: `删除失败: ${err.message}` }
  } finally {
    showConfirmDelete.value = false
    deletingCategory.value = ''
    await refreshData()
  }
}

// 切换分类启用状态
const toggleCategory = async (name, enabled) => {
  try {
    const res = await axios.post(`${getApiBase()}/filter/category/enable`, {
      category: name,
      enabled,
    })
    if (res.data?.success) {
      const cat = categories.value.find(c => c.name === name)
      if (cat) cat.enabled = enabled
    }
  } catch (err) {
    error.value = `切换状态失败: ${err.message}`
  }
}

// 打开添加关键词
const openAddKeyword = (catName) => {
  addingToCategory.value = catName
  newKeyword.value = ''
  showAddKeywordDialog.value = true
}

// 添加关键词
const addKeyword = async () => {
  if (!newKeyword.value.trim() || !addingToCategory.value) return
  try {
    const res = await axios.post(`${getApiBase()}/filter/keywords/add`, {
      category: addingToCategory.value,
      keyword: newKeyword.value.trim(),
    })
    if (res.data?.success) {
      actionResult.value = { type: 'success', message: '关键词已添加' }
      newKeyword.value = ''
      showAddKeywordDialog.value = false
      await refreshData()
    } else {
      actionResult.value = { type: 'error', message: res.data?.message || '添加失败' }
    }
  } catch (err) {
    actionResult.value = { type: 'error', message: `添加失败: ${err.message}` }
  }
}

// 删除关键词
const removeKeyword = async (catName, keyword) => {
  try {
    const res = await axios.post(`${getApiBase()}/filter/keywords/remove`, {
      category: catName,
      keyword,
    })
    if (res.data?.success) {
      actionResult.value = { type: 'success', message: '关键词已删除' }
      await refreshData()
    } else {
      actionResult.value = { type: 'error', message: res.data?.message || '删除失败' }
    }
  } catch (err) {
    actionResult.value = { type: 'error', message: `删除失败: ${err.message}` }
  }
}

onMounted(() => {
  refreshData()
})
</script>

<style scoped>
.app-page-filter {
  max-width: 1200px;
}
</style>
