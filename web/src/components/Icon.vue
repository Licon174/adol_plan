<script setup lang="ts">import { computed } from 'vue'
import { ICONS, type IconName } from './icons'

const props = withDefaults(defineProps<{ name: IconName; size?: number; stroke?: number }>(), {
  size: 22,
  stroke: 1.6,
})

const body = computed(() => ICONS[props.name] ?? '')
</script>

<template>
  <svg
    class="icon"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    :stroke-width="stroke"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    v-html="body"
  />
</template>

<style scoped>
.icon {
  display: block;
  flex: none;
}
</style>
