<script setup lang="ts">import { useToasts } from './toast'
import Icon from './Icon.vue'

const items = useToasts()
</script>

<template>
  <div class="toast-host" aria-live="polite">
    <TransitionGroup name="toast">
      <div v-for="t in items" :key="t.id" class="toast" :class="`is-${t.type}`">
        <Icon
          v-if="t.type !== 'info'"
          :name="t.type === 'success' ? 'check' : 'alert'"
          :size="18"
        />
        <span>{{ t.text }}</span>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-host {
  position: fixed;
  top: calc(var(--safe-t) + 12px);
  left: 0;
  right: 0;
  z-index: var(--z-toast);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--sp-2);
  pointer-events: none;
  padding: 0 var(--sp-4);
}

.toast {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  max-width: var(--content-max);
  padding: 10px var(--sp-4);
  border-radius: var(--r-full);
  font-size: var(--fs-sub);
  font-weight: 600;
  color: #ffffff;
  background: rgba(15, 23, 42, 0.92);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
}

.toast.is-success {
  background: #059669;
}

.toast.is-error {
  background: #dc2626;
}

.toast-enter-active,
.toast-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
