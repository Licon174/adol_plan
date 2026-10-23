<script setup lang="ts">import { computed } from 'vue'

const props = withDefaults(
  defineProps<{ percent: number; size?: number; stroke?: number; tone?: 'primary' | 'warning' | 'danger' }>(),
  { size: 96, stroke: 10, tone: 'primary' },
)

const radius = computed(() => (props.size - props.stroke) / 2)
const circumference = computed(() => 2 * Math.PI * radius.value)
const center = computed(() => props.size / 2)
const clamped = computed(() => Math.min(100, Math.max(0, props.percent)))
const dash = computed(
  () => `${(clamped.value / 100) * circumference.value} ${circumference.value}`,
)

const toneVar = computed(
  () =>
    ({
      primary: 'var(--c-primary-400)',
      warning: 'var(--c-warning)',
      danger: 'var(--c-danger)',
    })[props.tone],
)
</script>

<template>
  <svg
    :width="size"
    :height="size"
    :viewBox="`0 0 ${size} ${size}`"
    role="img"
    :aria-label="`已用 ${clamped}%`"
  >
    <circle
      :cx="center"
      :cy="center"
      :r="radius"
      fill="none"
      :stroke-width="stroke"
      :style="{ stroke: 'var(--c-surface-2)' }"
    />
    <circle
      :cx="center"
      :cy="center"
      :r="radius"
      fill="none"
      :stroke-width="stroke"
      stroke-linecap="round"
      :stroke-dasharray="dash"
      :transform="`rotate(-90 ${center} ${center})`"
      :style="{ stroke: toneVar, transition: 'stroke-dasharray .4s ease' }"
    />
  </svg>
</template>
