<script setup lang="ts">import { useRouter } from 'vue-router'
import Icon from '@/components/Icon.vue'

withDefaults(
  defineProps<{
    title: string
    dirty?: boolean
    saving?: boolean
    loading?: boolean
    error?: string
    saveText?: string

    savable?: boolean
  }>(),
  { dirty: false, saving: false, loading: false, error: '', saveText: '保存', savable: true },
)

defineEmits<{ (e: 'save'): void; (e: 'reset'): void }>()

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

    <div class="content" :class="{ 'has-savebar': savable && dirty && !loading }">
      <p v-if="error" class="banner banner-err">
        <Icon name="alert" :size="16" />
        <span>{{ error }}</span>
      </p>

      <div v-if="loading" class="skeleton">
        <div class="sk-card" />
        <div class="sk-card" />
      </div>

      <slot v-else />
    </div>

    <Transition name="slide-up">
      <div v-if="savable && dirty && !loading" class="savebar">
        <button type="button" class="btn btn-ghost" :disabled="saving" @click="$emit('reset')">
          放弃
        </button>
        <button type="button" class="btn btn-primary" :disabled="saving" @click="$emit('save')">
          {{ saving ? '保存中…' : saveText }}
        </button>
      </div>
    </Transition>
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
  width: 36px;
  height: 36px;
  border-radius: var(--r-full);
  color: var(--c-text-1);
  background: var(--icon-dome, var(--c-surface));
  border: 1px solid var(--card-border, var(--c-line));
  box-shadow: var(--icon-dome-shadow);
  transition: transform var(--dur-fast) var(--ease-spring), background-color var(--dur-fast) ease;
}

.nav-btn:active {
  transform: scale(0.88);
  background: var(--c-surface-2);
}

.nav-title {
  flex: 1;
  font-size: var(--fs-h2);
  font-weight: 600;
  text-align: center;
  letter-spacing: -0.01em;
}

.nav-right {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  min-width: 36px;
}

.content {
  flex: 1;
  width: 100%;
  max-width: var(--content-max);
  margin: 0 auto;
  padding: var(--sp-4) var(--sp-4) var(--sp-6);
}

.content.has-savebar {
  padding-bottom: 88px;
}

.banner {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: var(--sp-3);
  padding: 10px var(--sp-3);
  border-radius: var(--r-md);
  font-size: var(--fs-sub);
}

.banner-err {
  color: var(--c-danger);
  background: var(--c-danger-bg);
}

.skeleton {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}

.sk-card {
  height: 96px;
  border-radius: var(--r-lg);
  background: var(--glass-bg, var(--c-surface));
  backdrop-filter: blur(12px);
  border: 1px solid var(--glass-border, var(--c-line));
  opacity: 0.7;
}

.savebar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: calc(var(--tabbar-h) + var(--safe-b));
  z-index: var(--z-nav);
  display: flex;
  gap: var(--sp-3);
  width: 100%;
  max-width: var(--content-max);
  margin: 0 auto;
  padding: var(--sp-3) var(--sp-4);
  background: var(--card-bg, var(--c-surface));
  backdrop-filter: var(--card-backdrop);
  -webkit-backdrop-filter: var(--card-backdrop);
  border-top: 1px solid var(--card-border, var(--c-line));
  box-shadow: var(--shadow-md);
}

.savebar .btn {
  flex: 1;
}

.savebar .btn-ghost {
  flex: 0 0 96px;
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}

.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translateY(12px);
}
</style>
