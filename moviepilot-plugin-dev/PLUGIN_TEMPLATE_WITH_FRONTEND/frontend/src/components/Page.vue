<template>
  <VCard title="演示主页">
    <VCardText>
      <VBtn prepend-icon="mdi-cog" variant="tonal" @click="emit('switch')">配置</VBtn>
      <VAlert v-if="error" type="error" class="mt-2">{{ error }}</VAlert>
      <div v-else class="mt-2">{{ msg }}</div>
    </VCardText>
  </VCard>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'

const props = defineProps(['pluginId', 'config', 'eventBus', 'api'])
const emit = defineEmits(['switch', 'close', 'action'])

const API_PLUGIN_ID = props.pluginId || 'DemoFrontend'
const msg = ref('')
const error = ref('')

const requestGet = async (path, options = {}) => {
  if (props.api?.get) return await props.api.get(`plugin/${API_PLUGIN_ID}${path}`, options)
  return (await axios.get(`/api/v1/plugin/${API_PLUGIN_ID}${path}`, options)).data
}

onMounted(async () => {
  try {
    const res = await requestGet('/message')
    const payload = res?.data ?? res
    if (payload?.success) msg.value = payload.data?.message || ''
    else error.value = payload?.message || '加载失败'
  } catch (e) {
    // 非阻断：页面主结构已渲染
    error.value = `加载失败: ${e.message || e}`
  }
})
</script>
