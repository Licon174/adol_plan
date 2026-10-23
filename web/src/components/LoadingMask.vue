<script setup lang="ts">import { loadingState, resetLoading } from './loading'
</script>

<template>
  <Transition name="fade">
    <div v-if="loadingState.visible" class="mask">
      <div class="spinner" />
      <p v-if="loadingState.text" class="text">{{ loadingState.text }}</p>

      <template v-if="loadingState.canCancel">
        <p class="text slow">已等待 {{ loadingState.elapsed }} 秒</p>
        <button type="button" class="cancel" @click="resetLoading">取消</button>
      </template>
    </div>
  </Transition>
</template>

<style scoped>
.mask {
  position: fixed;
  inset: 0;
  z-index: var(--z-mask);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--sp-3);
  background: var(--c-mask);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.spinner {
  width: 28px;
  height: 28px;
  border: 2.5px solid var(--c-primary-100);
  border-top-color: var(--c-primary-400);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

.text {
  font-size: var(--fs-sub);
  font-weight: 600;
  color: var(--c-text-1);
}

.text.slow {
  color: var(--c-text-3);
  font-size: var(--fs-cap);
}

.cancel {
  margin-top: var(--sp-2);
  padding: 8px 20px;
  border: 1px solid var(--c-line-strong);
  border-radius: var(--r-full);
  font-size: var(--fs-sub);
  color: var(--c-text-2);
  background: var(--c-surface);
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
