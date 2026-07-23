<template>
  <VApp>
    <VMain>
      <VContainer fluid class="pa-4">
        <VRow>
          <VCol cols="12">
            <VCard class="mb-4">
              <VCardItem>
                <template #prepend>
                  <VIcon icon="mdi-movie-open-star" color="primary" size="32" />
                </template>
                <VCardTitle>弹幕刮削插件</VCardTitle>
                <VCardSubtitle>基于弹弹play平台的弹幕字幕生成工具</VCardSubtitle>
              </VCardItem>
              <VCardText>
                <VRow>
                  <VCol cols="12" md="6">
                    <VCard variant="tonal" color="primary" class="pa-3">
                      <div class="text-caption text-medium-emphasis">PAGE组件</div>
                      <Page :plugin-id="'danmu'" :config="mockConfig" :event-bus="mockEventBus" />
                    </VCard>
                  </VCol>
                  <VCol cols="12" md="6">
                    <VCard variant="tonal" color="secondary" class="pa-3">
                      <div class="text-caption text-medium-emphasis">CONFIG组件</div>
                      <Config :plugin-id="'danmu'" :config="mockConfig" :event-bus="mockEventBus" />
                    </VCard>
                  </VCol>
                </VRow>
                <VRow class="mt-4">
                  <VCol cols="12">
                    <VCard variant="tonal" color="info" class="pa-3">
                      <div class="text-caption text-medium-emphasis">DASHBOARD组件</div>
                      <Dashboard :plugin-id="'danmu'" :config="mockConfig" :event-bus="mockEventBus" />
                    </VCard>
                  </VCol>
                </VRow>
                <VRow class="mt-4">
                  <VCol cols="12" md="6">
                    <VCard variant="tonal" color="success" class="pa-3">
                      <div class="text-caption text-medium-emphasis">APPPAGE组件 - 刮削管理</div>
                      <AppPageScrape :plugin-id="'danmu'" :config="mockConfig" :event-bus="mockEventBus" />
                    </VCard>
                  </VCol>
                  <VCol cols="12" md="6">
                    <VCard variant="tonal" color="warning" class="pa-3">
                      <div class="text-caption text-medium-emphasis">APPPAGE组件 - 过滤管理</div>
                      <AppPageFilter :plugin-id="'danmu'" :config="mockConfig" :event-bus="mockEventBus" />
                    </VCard>
                  </VCol>
                </VRow>
              </VCardText>
            </VCard>
          </VCol>
        </VRow>
      </VContainer>
    </VMain>
    <VFooter app class="text-center text-caption">
      MoviePilot 弹幕刮削插件 - 模块联邦示例 ©{{ new Date().getFullYear() }}
    </VFooter>
  </VApp>
</template>

<script setup>
import Page from './components/Page.vue'
import Config from './components/Config.vue'
import Dashboard from './components/Dashboard.vue'
import AppPageScrape from './components/AppPageScrape.vue'
import AppPageFilter from './components/AppPageFilter.vue'

const mockConfig = {
  attrs: {
    title: '弹幕刮削',
    subtitle: '基于弹弹play平台',
  },
  data: {},
}

const mockEventBus = {
  emit: async () => [],
  on: () => {},
  off: () => {},
}
</script>
