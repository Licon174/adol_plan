<script setup lang="ts">import Icon from './Icon.vue'
import type { IconName } from './icons'

defineProps<{
  icon?: IconName
  label: string
  desc?: string
  value?: string
  to?: string
  danger?: boolean
}>()

defineEmits<{ (e: 'click'): void }>()
</script>

<template>
  <component
    :is="to ? 'router-link' : 'button'"
    :to="to"
    :type="to ? undefined : 'button'"
    class="cell"
    :class="{ 'is-danger': danger }"
    @click="$emit('click')"
  >
    <span v-if="icon" class="cell-icon">
      <Icon :name="icon" :size="17" :stroke="2.2" />
    </span>
    <span class="cell-main">
      <span class="cell-label">{{ label }}</span>
      <span v-if="desc" class="cell-desc">{{ desc }}</span>
    </span>
    <span v-if="value" class="cell-value num">{{ value }}</span>
    <slot name="right" />
    <span v-if="to" class="cell-arrow">
      <Icon name="chevron-right" :size="15" />
    </span>
  </component>
</template>

<style scoped>
.cell {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 48px;
  padding: 8px 6px;
  text-align: left;
  color: var(--c-text-1);
  background: none;
  border: 0;
  border-radius: var(--r-sm);
  cursor: pointer;
  text-decoration: none;
  transition: all 0.14s ease;
}

.cell:hover {
  background: rgba(0, 0, 0, 0.02);
}
[data-theme='dark'] .cell:hover {
  background: rgba(255, 255, 255, 0.03);
}

.cell:active {
  transform: scale(0.988);
  opacity: 0.85;
}

.cell + .cell {
  border-top: 1px solid var(--c-line);
}

.cell-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 9px;
  background: linear-gradient(135deg, var(--c-surface-2) 0%, var(--c-surface) 100%);
  border: 1px solid var(--c-line);
  color: var(--c-primary-500);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  flex: none;
  transition: all 0.15s ease;
}
.cell:hover .cell-icon {
  border-color: var(--c-primary-400);
  color: var(--c-primary-600);
}

[data-theme='dark'] .cell-icon {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%);
  border-color: rgba(255, 255, 255, 0.08);
  color: var(--c-primary-400);
}

.cell-main {
  display: flex;
  flex-direction: column;
  gap: 1px;
  flex: 1;
  min-width: 0;
}

.cell-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--c-text-1);
}

.cell-desc {
  font-size: 11px;
  color: var(--c-text-3);
  line-height: 1.3;
}

.cell-value {
  font-size: 12px;
  font-weight: 600;
  color: var(--c-text-2);
  max-width: 45%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cell-arrow {
  color: var(--c-text-3);
  transition: transform 0.15s ease;
  display: flex;
  align-items: center;
}

.cell:active .cell-arrow {
  transform: translateX(2px);
}

.is-danger .cell-label {
  color: var(--c-danger);
}

.is-danger .cell-icon {
  background: var(--c-danger-bg);
  border-color: rgba(211, 47, 47, 0.2);
  color: var(--c-danger);
}
</style>
