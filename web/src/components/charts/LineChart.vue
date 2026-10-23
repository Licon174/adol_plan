<script setup lang="ts">import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    data: number[]
    labels?: string[]
    height?: number
  }>(),
  { labels: () => [], height: 120 },
)

const PAD_L = 8
const PAD_R = 8
const PAD_T = 10
const PAD_B = 20
const VIEW_W = 320

const max = computed(() => Math.max(1, ...props.data))

const points = computed(() => {
  const n = props.data.length
  if (n === 0) return ''
  const innerW = VIEW_W - PAD_L - PAD_R
  const innerH = props.height - PAD_T - PAD_B
  const step = n > 1 ? innerW / (n - 1) : 0
  return props.data
    .map((v, i) => {
      const x = PAD_L + step * i
      const y = PAD_T + innerH - (v / max.value) * innerH
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
})

const areaPoints = computed(() => {
  const parts = points.value.split(' ').filter(Boolean)
  if (parts.length === 0) return ''
  const first = parts[0]!.split(',')[0]
  const last = parts[parts.length - 1]!.split(',')[0]
  const base = props.height - PAD_B
  return `${first},${base} ${points.value} ${last},${base}`
})

const shownLabels = computed(() => {
  const n = props.labels.length
  if (n === 0) return []
  const stride = Math.ceil(n / 6)
  const innerW = VIEW_W - PAD_L - PAD_R
  const step = n > 1 ? innerW / (n - 1) : 0
  return props.labels
    .map((l, i) => ({ l, x: PAD_L + step * i, i }))
    .filter((o) => o.i % stride === 0 || o.i === n - 1)
})
</script>

<template>
  <svg
    :viewBox="`0 0 ${VIEW_W} ${height}`"
    width="100%"
    :height="height"
    role="img"
    aria-label="折线图"
  >
    <polygon :points="areaPoints" :style="{ fill: 'var(--c-primary-50)' }" />
    <polyline
      :points="points"
      fill="none"
      stroke-width="2"
      stroke-linejoin="round"
      stroke-linecap="round"
      :style="{ stroke: 'var(--c-primary-400)' }"
    />
    <text
      v-for="o in shownLabels"
      :key="o.i"
      :x="o.x"
      :y="height - 6"
      text-anchor="middle"
      font-size="10"
      :style="{ fill: 'var(--c-text-3)' }"
    >
      {{ o.l }}
    </text>
  </svg>
</template>
