<template>
  <Page :plugin-id="pluginId" :config="config" :event-bus="eventBus" :api="api" />
</template>

<script setup>
import Page from './Page.vue'

defineProps(['pluginId', 'config', 'eventBus', 'navKey', 'api'])
</script>
