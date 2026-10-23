<script setup lang="ts">import { computed } from 'vue'

const props = withDefaults(defineProps<{ bars: number; total?: number; size?: 'sm' | 'lg' }>(), {
  total: 5,
  size: 'sm',
})

const items = computed(() =>
  Array.from({ length: props.total }, (_, i) => ({
    active: i < props.bars,
    height: 6 + i * 4,
  })),
)
</script>

<template>
  <span class="bars" :class="`is-${size}`" role="img" :aria-label="`信号 ${bars} 格`">
    <i
      v-for="(it, i) in items"
      :key="i"
      :style="{ height: it.height + 'px' }"
      :class="{ on: it.active }"
    />
  </span>
</template>

<style scoped>
.bars {
  display: inline-flex;
  align-items: flex-end;
  gap: 3px;
  height: 22px;
}

.bars i {
  display: block;
  width: 4px;
  border-radius: 2px;
  background: var(--c-line-strong);
}

.bars i.on {
  background: var(--c-primary-400);
}

.is-lg {
  height: 26px;
}

.is-lg i {
  width: 5px;
}
</style>
