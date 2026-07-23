<template>
  <VCard title="演示配置">
    <VCardText>
      <VTextField v-model="form.message" label="消息" />
      <VAlert v-if="error" type="error" class="mt-2">{{ error }}</VAlert>
    </VCardText>
    <VCardActions>
      <VBtn color="primary" :loading="saving" @click="save">保存</VBtn>
    </VCardActions>
  </VCard>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import axios from 'axios'

const props = defineProps(['pluginId', 'config', 'initialConfig', 'api'])
const emit = defineEmits(['save', 'close', 'switch'])

const API_PLUGIN_ID = props.pluginId || 'DemoFrontend'
const form = reactive({ message: '' })
const saving = ref(false)
const error = ref('')

// 请求封装：props.api 优先，axios fallback
const requestGet = async (path, options = {}) => {
  if (props.api?.get) return await props.api.get(`plugin/${API_PLUGIN_ID}${path}`, options)
  return (await axios.get(`/api/v1/plugin/${API_PLUGIN_ID}${path}`, options)).data
}
const requestPost = async (path, data = {}, options = {}) => {
  if (props.api?.post) return await props.api.post(`plugin/${API_PLUGIN_ID}${path}`, data, options)
  return (await axios.post(`/api/v1/plugin/${API_PLUGIN_ID}${path}`, data, options)).data
}

onMounted(() => {
  // 优先用注入配置，不依赖自定义 /config（插件未启用时可能未注册）
  const cfg = props.initialConfig || props.config || {}
  form.message = cfg.message || ''
})

const save = async () => {
  saving.value = true
  error.value = ''
  try {
    // 推荐走标准事件，由 MP 统一写回
    emit('save', { ...form })
  } catch (e) {
    error.value = `保存失败: ${e.message || e}`
  } finally {
    saving.value = false
  }
}
</script>
