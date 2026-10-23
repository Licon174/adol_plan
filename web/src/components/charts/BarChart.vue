<script setup lang="ts">import { computed } from 'vue'

const props = withDefaults(
  defineProps<{

    data: number[]

    labels?: string[]
    height?: number

    activeIndex?: number
  }>(),
  { labels: () => [], height: 120, activeIndex: -1 },
)

const PAD_L = 6
const PAD_R = 6
const PAD_T = 10
const PAD_B = 20
const VIEW_W = 320

const max = computed(() => Math.max(1, ...props.data))

const bars = computed(() => {
  const n = props.data.length
  if (n === 0) return []
  const innerW = VIEW_W - PAD_L - PAD_R
  const slot = innerW / n
  const barW = Math.max(2, Math.min(18, slot * 0.62))
  const innerH = props.height - PAD_T - PAD_B
  return props.data.map((v, i) => {
    const h = (v / max.value) * innerH
    return {
      x: PAD_L + slot * i + (slot - barW) / 2,
      y: PAD_T + innerH - h,
      w: barW,
      h: Math.max(v > 0 ? 2 : 0, h),
      label: props.labels[i] ?? '',
      labelX: PAD_L + slot * i + slot / 2,
      active: i === props.activeIndex,
    }
  })
})

const baselineY = computed(() => props.height - PAD_B)
</script>

<template>
  <svg
    :viewBox="`0 0 ${VIEW_W} ${height}`"
    width="100%"
    :height="height"
    role="img"
    aria-label="柱状图"
  >
    <line
      :x1="PAD_L"
      :y1="baselineY"
      :x2="VIEW_W - PAD_R"
      :y2="baselineY"
      stroke-width="1"
      :style="{ stroke: 'var(--c-line)' }"
    />
    <rect
      v-for="(b, i) in bars"
      :key="i"
      :x="b.x"
      :y="b.y"
      :width="b.w"
      :height="b.h"
      rx="2"
      :style="{ fill: b.active ? 'var(--c-primary-600)' : 'var(--c-primary-200)' }"
    />
    <text
      v-for="(b, i) in bars"
      :key="'t' + i"
      :x="b.labelX"
      :y="height - 6"
      text-anchor="middle"
      font-size="10"
      :style="{ fill: 'var(--c-text-3)' }"
    >
      {{ b.label }}
    </text>
  </svg>
</template>
