<template>
  <AppPageScrape v-if="navKey === 'scrape' || !navKey" :plugin-id="pluginId" :config="config" :event-bus="eventBus" :nav-key="navKey" :api="api" />
  <AppPageFilter v-else :plugin-id="pluginId" :config="config" :event-bus="eventBus" :nav-key="navKey" :api="api" />
</template>

<script setup>
import AppPageScrape from './AppPageScrape.vue'
import AppPageFilter from './AppPageFilter.vue'

defineProps(['pluginId', 'config', 'eventBus', 'navKey', 'api'])
</script>
