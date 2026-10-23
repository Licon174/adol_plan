<script setup lang="ts">import { useRouter } from 'vue-router'
import Icon from '@/components/Icon.vue'

defineProps<{ title: string }>()

const router = useRouter()

function back() {
  if (window.history.state?.back) router.back()
  else void router.replace('/home')
}
</script>

<template>
  <div class="page">
    <header class="navbar">
      <button type="button" class="nav-btn" aria-label="返回" @click="back">
        <Icon name="arrow-left" :size="22" />
      </button>
      <h1 class="nav-title">{{ title }}</h1>
      <span class="nav-right"><slot name="right" /></span>
    </header>
    <div class="content">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - var(--tabbar-h) - var(--safe-b) - var(--safe-t));
  min-height: calc(100dvh - var(--tabbar-h) - var(--safe-b) - var(--safe-t));
}

.navbar {
  position: sticky;
  top: 0;
  z-index: var(--z-nav);
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  height: var(--navbar-h);
  padding: 0 var(--sp-3);
  background: var(--glass-bg, var(--c-surface));
  backdrop-filter: var(--card-backdrop);
  -webkit-backdrop-filter: var(--card-backdrop);
  border-bottom: 1px solid var(--card-border, var(--c-line));
  box-shadow: 0 4px 16px -4px rgba(15, 23, 42, 0.06);
}

.nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: var(--r-sm);
  color: var(--c-text-1);
}

.nav-btn:active {
  background: var(--c-surface-2);
}

.nav-title {
  flex: 1;
  font-size: var(--fs-h2);
  font-weight: 500;
  text-align: center;
}

.nav-right {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  min-width: 40px;
}

.content {
  flex: 1;
  width: 100%;
  max-width: var(--content-max);
  margin: 0 auto;
  padding: 0 var(--sp-4) var(--sp-6);
}
</style>
