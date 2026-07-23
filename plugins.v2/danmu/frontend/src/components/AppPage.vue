<template>
  <AppPageScrape :plugin-id="pluginId" :config="config" :event-bus="eventBus" :nav-key="navKey" />
</template>

<script setup>
import AppPageScrape from './AppPageScrape.vue'

defineProps(['pluginId', 'config', 'eventBus', 'navKey'])
</script>
