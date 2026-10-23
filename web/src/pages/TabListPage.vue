<script setup lang="ts">import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { logout } from '@/api'
import { confirm } from '@/components/confirm'
import { toast } from '@/components/toast'
import { findTab, type PageDef } from '@/router/pages'
import Icon from '@/components/Icon.vue'

const props = defineProps<{ tabKey: string }>()
const router = useRouter()

const tab = computed(() => findTab(props.tabKey))

const tabMeta = computed(() => {
  switch (props.tabKey) {
    case 'network':
      return {
        tag: 'CELLULAR SUITE',
        desc: '射频信道调度 · 流量配额守候 · 选网控制',
        tone: 'emerald',
      }
    case 'wifi':
      return {
        tag: 'WIRELESS FABRIC',
        desc: '双频 AP 拓扑 · 访客隔离区 · 链路中继',
        tone: 'cyan',
      }
    case 'settings':
      return {
        tag: 'CORE SYSTEM',
        desc: '硬件底座 · 防火墙规则 · 视觉与持久化',
        tone: 'indigo',
      }
    default:
      return {
        tag: 'CONSOLE',
        desc: '模块配置列表',
        tone: 'emerald',
      }
  }
})

function groupTone(groupName: string): string {
  switch (groupName) {
    case '无线':
    case '高级':
      return 'tone-cyan'
    case '设备':
      return 'tone-indigo'
    case '安全':
      return 'tone-amber'
    case '关于':
      return 'tone-violet'
    default:
      return props.tabKey === 'wifi' ? 'tone-cyan' : 'tone-emerald'
  }
}

const groups = computed(() => {
  const t = tab.value
  if (!t) return []
  const out: { name: string; tone: string; pages: PageDef[] }[] = []
  for (const p of t.pages) {
    const g = p.group ?? ''
    let hit = out.find((x) => x.name === g)
    if (!hit) {
      hit = { name: g, tone: groupTone(g), pages: [] }
      out.push(hit)
    }
    hit.pages.push(p)
  }
  return out
})

const showGroupTitle = computed(() => groups.value.length > 1)

async function handleLogout(): Promise<void> {
  const ok = await confirm({
    title: '退出登录',
    message: '确定要退出当前管理会话吗？',
    danger: true,
  })
  if (!ok) return
  try {
    await logout()
    toast('已退出登录', 'info')
    await router.replace('/login')
  } catch (e) {
    toast(e instanceof Error ? e.message : '退出失败', 'error')
  }
}
</script>

<template>
  <div v-if="tab" class="mosaic-page" :class="`tab-theme-${tab.key}`">

    <header class="mosaic-banner" :class="`banner-${tabMeta.tone}`">
      <div class="banner-left">
        <div class="banner-emblem" :class="groupTone(tab.key === 'settings' ? '设备' : '')">
          <Icon :name="tab.icon" :size="22" :stroke="2.2" />
        </div>
        <div class="banner-meta">
          <div class="mosaic-brand">
            <span class="mosaic-title">{{ tab.name }}</span>
            <span class="mosaic-tag num">{{ tabMeta.tag }}</span>
          </div>
          <span class="mosaic-desc">{{ tabMeta.desc }}</span>
        </div>
      </div>
      <div class="banner-count num">
        <span class="count-num">{{ tab.pages.length }}</span>
        <span class="count-lbl">MODULES</span>
      </div>
    </header>

    <section v-for="g in groups" :key="g.name" class="mosaic-section">
      <div v-if="showGroupTitle && g.name" class="section-label-bar">
        <span class="section-dot" :class="g.tone" />
        <span class="section-pill">{{ g.name }}</span>
        <span class="section-line" />
      </div>

      <div class="mosaic-grid">
        <router-link
          v-for="p in g.pages"
          :key="p.path"
          :to="`${tab.path}/${p.path}`"
          class="mosaic-card"
        >
          <div class="card-icon-halo" :class="g.tone">
            <Icon :name="p.icon" :size="20" :stroke="2.2" />
          </div>

          <div class="card-content">
            <div class="card-title-row">
              <span class="card-label">{{ p.name }}</span>
              <Icon name="chevron-right" :size="14" class="card-arrow" />
            </div>
            <span v-if="p.desc" class="card-desc">{{ p.desc }}</span>
          </div>
        </router-link>
      </div>
    </section>

    <div v-if="tab.key === 'settings'" class="logout-wrap">
      <button type="button" class="btn-logout-cell" @click="handleLogout">
        <Icon name="log-out" :size="15" />
        <span>退出管理会话</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.mosaic-page {
  width: 100%;
  max-width: var(--content-max);
  margin: 0 auto;
  padding: 12px 14px 28px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.mosaic-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  border-radius: var(--r-lg);
}

.banner-left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  position: relative;
  z-index: 1;
}

.banner-emblem {
  width: 44px;
  height: 44px;
  border-radius: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  background: var(--icon-dome);
  box-shadow: var(--icon-dome-shadow);
  border: 1px solid rgba(255, 255, 255, 0.85);
  color: var(--c-primary-500);
}
[data-theme='dark'] .banner-emblem {
  border-color: rgba(255, 255, 255, 0.16);
  color: var(--c-primary-400);
}

.banner-meta {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.mosaic-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.mosaic-title {
  font-size: 18px;
  font-weight: 800;
  color: var(--c-text-1);
  letter-spacing: -0.01em;
}

.mosaic-tag {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 6px;
  background: var(--c-primary-50);
  color: var(--c-primary-600);
  border: 1px solid rgba(22, 163, 116, 0.22);
}
[data-theme='dark'] .mosaic-tag {
  color: var(--c-primary-400);
}

.mosaic-desc {
  font-size: 11px;
  color: var(--c-text-2);
}

.banner-count {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 5px 10px;
  border-radius: 10px;
  background: var(--c-surface-2);
  border: 1px solid var(--c-line);
  box-shadow: var(--well-shadow);
  flex: none;
}

.count-num {
  font-size: 15px;
  font-weight: 800;
  line-height: 1.1;
  color: var(--c-text-1);
}

.count-lbl {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--c-text-3);
}

.mosaic-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-label-bar {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 0 4px;
}

.section-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--c-primary-400);
}
.section-dot.tone-cyan { background: #0ea5e9; }
.section-dot.tone-indigo { background: #6366f1; }
.section-dot.tone-amber { background: #f59e0b; }
.section-dot.tone-violet { background: #8b5cf6; }

.section-pill {
  font-size: 11px;
  font-weight: 800;
  color: var(--c-text-2);
  letter-spacing: 0.04em;
}

.section-line {
  flex: 1;
  height: 1px;
  background: var(--c-line-strong);
}

.mosaic-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

@media (max-width: 380px) {
  .mosaic-grid {
    grid-template-columns: 1fr;
  }
}

.mosaic-card {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 13px 12px;
  border-radius: var(--r-md);
  text-decoration: none;
  color: inherit;
}

.mosaic-card:hover {
  border-color: var(--card-border-hover, var(--c-primary-400));
  box-shadow: var(--shadow-hover);
  transform: translateY(var(--lift-y, 0px));
}

.mosaic-card:active {
  transform: scale(var(--press-scale, 0.98));
}

.card-icon-halo {
  position: relative;
  z-index: 1;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: var(--icon-dome);
  box-shadow: var(--icon-dome-shadow);
  border: 1px solid rgba(255, 255, 255, 0.9);
  color: #10b981;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  transition: transform var(--dur-fast) var(--ease-spring),
              box-shadow var(--dur-fast) ease;
}

[data-theme='dark'] .card-icon-halo {
  border-color: rgba(255, 255, 255, 0.16);
}

.card-icon-halo.tone-cyan {
  color: #0284c7;
}
[data-theme='dark'] .card-icon-halo.tone-cyan {
  color: #38bdf8;
}

.card-icon-halo.tone-indigo {
  color: #4f46e5;
}
[data-theme='dark'] .card-icon-halo.tone-indigo {
  color: #818cf8;
}

.card-icon-halo.tone-amber {
  color: #d97706;
}
[data-theme='dark'] .card-icon-halo.tone-amber {
  color: #fbbf24;
}

.card-icon-halo.tone-violet {
  color: #7c3aed;
}
[data-theme='dark'] .card-icon-halo.tone-violet {
  color: #a78bfa;
}

.mosaic-card:hover .card-icon-halo {
  transform: scale(1.06);
}

.card-content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 3px;
  flex: 1;
  min-width: 0;
}

.card-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.card-label {
  font-size: 13.5px;
  font-weight: 700;
  color: var(--c-text-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-arrow {
  color: var(--c-text-3);
  opacity: 0.7;
  transition: transform var(--dur-fast) ease, opacity var(--dur-fast) ease;
}

.mosaic-card:hover .card-arrow {
  transform: translateX(2px);
  opacity: 1;
  color: var(--c-primary-500);
}

.card-desc {
  font-size: 11px;
  color: var(--c-text-2);
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.logout-wrap {
  margin-top: 4px;
}

.btn-logout-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  height: 44px;
  border-radius: var(--r-md);
  background: var(--card-bg, var(--c-surface));
  backdrop-filter: var(--card-backdrop);
  -webkit-backdrop-filter: var(--card-backdrop);
  border: 1px solid rgba(211, 47, 47, 0.35);
  box-shadow: var(--shadow-sm);
  color: var(--c-danger);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: transform var(--dur-fast) var(--ease-spring),
              background var(--dur-fast) ease,
              box-shadow var(--dur-fast) ease;
}

.btn-logout-cell:hover {
  background: var(--c-danger-bg);
  transform: translateY(var(--lift-y, 0px));
}

.btn-logout-cell:active {
  transform: scale(var(--press-scale, 0.98));
}
</style>
