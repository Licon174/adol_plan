<script setup lang="ts">import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { TABS } from '@/router/pages'
import Icon from '@/components/Icon.vue'

const route = useRoute()
const activeKey = computed(() => (route.meta.tab as string) ?? 'home')
const activeIndex = computed(() => {
  const idx = TABS.findIndex((t) => t.key === activeKey.value)
  return idx >= 0 ? idx : 0
})
</script>

<template>
  <div class="shell">
    <main class="body">
      <RouterView v-slot="{ Component }">

        <component :is="Component" :key="route.fullPath" />
      </RouterView>
    </main>

    <nav class="tabbar" aria-label="主导航">
      <div class="tabbar-capsule">
        <div class="tabbar-track">

          <div
            class="tab-glider"
            :style="{ transform: `translate3d(${activeIndex * 100}%, 0, 0)` }"
            aria-hidden="true"
          />

          <RouterLink
            v-for="t in TABS"
            :key="t.key"
            class="tab-item"
            :class="{ 'is-active': activeKey === t.key }"
            :to="t.path"
          >
            <div class="tab-chip">
              <Icon
                :name="t.icon"
                :size="18"
                :stroke="activeKey === t.key ? 2.5 : 1.9"
                class="tab-ic"
              />
              <span class="tab-text">{{ t.name }}</span>
            </div>
          </RouterLink>
        </div>
      </div>
    </nav>
  </div>
</template>

<style scoped>
.shell {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  min-height: 100dvh;
}

.body {
  flex: 1;
  padding-top: var(--safe-t);
  padding-bottom: calc(var(--tabbar-h) + var(--safe-b) + 22px);
}

.tabbar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: var(--z-tabbar);
  display: flex;
  justify-content: center;
  padding: 0 14px calc(var(--safe-b) + 12px);
  pointer-events: none;
}

.tabbar-capsule {
  pointer-events: auto;
  position: relative;
  overflow: hidden;
  width: 100%;
  max-width: 400px;
  height: 58px;
  padding: 5px;
  border-radius: 30px;
  background: var(--card-bg, var(--glass-bg));
  backdrop-filter: var(--card-backdrop);
  -webkit-backdrop-filter: var(--card-backdrop);
  border: 1px solid var(--card-border, var(--glass-border));
  box-shadow: var(--shadow-md);
  transition: transform var(--dur-fast) var(--ease-spring),
              box-shadow var(--dur-fast) ease;
}

.tabbar-capsule::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(
    circle at 50% 0%,
    rgba(255, 255, 255, 0.55) 0%,
    rgba(255, 255, 255, 0) 65%
  );
  mix-blend-mode: overlay;
  pointer-events: none;
  z-index: 0;
}

.tabbar-capsule::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  padding: 1.5px;
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.92) 0%,
    rgba(255, 255, 255, 0.2) 38%,
    rgba(255, 255, 255, 0.15) 62%,
    rgba(255, 255, 255, 0.78) 100%
  );
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
  z-index: 2;
}

[data-theme='dark'] .tabbar-capsule::after {
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.55) 0%,
    rgba(255, 255, 255, 0.08) 40%,
    rgba(52, 211, 153, 0.16) 68%,
    rgba(255, 255, 255, 0.42) 100%
  );
}

[data-texture='off'] .tabbar-capsule::before,
[data-texture='off'] .tabbar-capsule::after {
  opacity: 0;
}

.tabbar-track {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  width: 100%;
  height: 100%;
}

.tab-glider {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 25%;
  border-radius: 24px;
  background: radial-gradient(
    120% 110% at 30% 0%,
    rgba(255, 255, 255, 0.82) 0%,
    rgba(16, 185, 129, 0.36) 55%,
    rgba(6, 182, 212, 0.34) 100%
  );
  border: 1px solid rgba(255, 255, 255, 0.95);
  box-shadow:
    0 6px 18px -3px rgba(16, 185, 129, 0.4),
    inset 2px 2px 1px 0 rgba(255, 255, 255, 0.95),
    inset -1px -1px 1px 0 rgba(255, 255, 255, 0.72),
    inset 0 0 14px -2px rgba(255, 255, 255, 0.65);
  transition: transform var(--dur-norm) var(--ease-spring),
              box-shadow var(--dur-fast) ease;
  pointer-events: none;
  z-index: 0;
}

[data-theme='dark'] .tab-glider {
  background: radial-gradient(
    120% 110% at 30% 0%,
    rgba(255, 255, 255, 0.34) 0%,
    rgba(16, 185, 129, 0.46) 55%,
    rgba(6, 182, 212, 0.4) 100%
  );
  border-color: rgba(255, 255, 255, 0.52);
  box-shadow:
    0 6px 20px -2px rgba(16, 185, 129, 0.48),
    inset 2px 2px 1px 0 rgba(255, 255, 255, 0.75),
    inset -1px -1px 1px 0 rgba(52, 211, 153, 0.45),
    inset 0 0 14px -2px rgba(52, 211, 153, 0.28);
}

[data-texture='off'] .tab-glider {
  background: var(--c-primary-400);
  border: 0;
  box-shadow: none;
}

.tab-item {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  text-decoration: none;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.tab-chip {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  width: 100%;
  height: 100%;
  border-radius: 24px;
  color: var(--c-text-2);
  transition: color var(--dur-fast) ease,
              transform var(--dur-fast) var(--ease-spring);
}

.tab-item:hover:not(.is-active) .tab-chip {
  color: var(--c-text-1);
}

.tab-ic {
  flex: none;
  transition: transform var(--dur-fast) var(--ease-spring);
}

.tab-text {
  font-size: 12px;
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.01em;
}

.tab-item.is-active .tab-chip {
  color: #054a34;
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.75);
}

[data-theme='dark'] .tab-item.is-active .tab-chip {
  color: #ffffff;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.45);
}

[data-texture='off'] .tab-item.is-active .tab-chip {
  color: #ffffff;
  text-shadow: none;
}

.tab-item.is-active .tab-ic {
  transform: scale(1.1);
}

.tab-item:active .tab-chip {
  transform: scale(var(--press-scale, 0.93));
}
</style>
