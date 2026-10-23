<script setup lang="ts">import { computed, ref } from 'vue'
import { MAC_FILTER_KEYS, macFilter } from '@/api'
import { useStations } from '@/composables/useStations'
import { usePageForm } from '@/composables/usePageForm'
import { normalizeMac, validateMac } from '@/utils/validators'
import PageForm from '@/layouts/PageForm.vue'
import Card from '@/components/Card.vue'
import Icon from '@/components/Icon.vue'
import { toast } from '@/components/toast'

interface Model {

  aclMode: string
  blackList: string[]
  blackNames: string[]
  whiteList: string[]
}

const MODES = [
  { value: '0', label: '关闭过滤', desc: '开放模式 · 任何知晓密码的设备均可连接', icon: 'shield' },
  { value: '2', label: '黑名单拦截', desc: '黑名单模式 · 列表中设备禁止连接，其余允许', icon: 'ban' },
  { value: '1', label: '白名单准入', desc: '高安全白名单 · 仅允许列表内设备连接', icon: 'lock' },
] as const

const splitList = (s: string): string[] =>
  (s ?? '')
    .split(/[,\s;]+/)
    .map((x) => x.trim().toUpperCase())
    .filter(Boolean)

function padNames(names: string[], len: number): string {
  const out = [...names]
  while (out.length < len) out.push('')
  return out.slice(0, len).join(';')
}

const { model, raw, loading, saving, error, dirty, load, save, reset } = usePageForm<Model>({
  keys: MAC_FILTER_KEYS,
  fromStatus: (s) => ({
    aclMode: s.ACL_mode || '0',
    blackList: splitList(s.wifi_mac_black_list || ''),
    blackNames: (s.wifi_hostname_black_list || '').split(';').map((x) => x.trim()),
    whiteList: splitList(s.wifi_mac_white_list || ''),
  }),
  validate: (m): Record<string, string> | null => {
    const active = m.aclMode === '2' ? m.blackList : m.aclMode === '1' ? m.whiteList : []
    for (const mac of active) {
      const err = validateMac(mac)
      if (err) return { list: `${mac}：${err}` }
    }
    return null
  },
  toPayload: (m) => {
    if (m.aclMode === '2') {
      return [
        macFilter({
          ACL_mode: '2',
          wifi_mac_black_list: m.blackList.join(';'),
          wifi_hostname_black_list: padNames(m.blackNames, m.blackList.length),
        }),
      ]
    }
    if (m.aclMode === '1') {
      return [macFilter({ ACL_mode: '1', wifi_mac_white_list: m.whiteList.join(';') })]
    }
    return [macFilter({ ACL_mode: '0' })]
  },
  confirmText: (m) => {
    if (m.aclMode === '1' && m.whiteList.length === 0) {
      return '当前白名单为空，启用白名单模式将拒绝所有设备连接 WiFi！确定继续吗？'
    }
    return null
  },
})

const currentList = computed(() => (model.value.aclMode === '2' ? model.value.blackList : model.value.whiteList))

const { stations: onlineDevices, refresh: refreshOnline } = useStations()

const _load = load
async function loadAll(): Promise<void> {
  await _load()
  await refreshOnline()
}
void loadAll()

const draft = ref('')

function addOnline(mac: string, name = ''): void {
  const norm = mac.toUpperCase()
  const list = currentList.value
  if (list.includes(norm)) {
    toast(`${norm} 已在列表中`, 'info')
    return
  }
  list.push(norm)
  if (model.value.aclMode === '2') {
    model.value.blackNames.push(name)
  }
  toast(`已添加 ${name || norm}`, 'success')
}

function addMac(): void {
  const norm = normalizeMac(draft.value)?.toUpperCase()
  if (!norm) {
    toast('请输入合法的 12 位十六进制 MAC 地址', 'error')
    return
  }
  const known = onlineDevices.value.find((d) => d.mac.toUpperCase() === norm)
  addOnline(norm, known?.hostname ?? '')
  draft.value = ''
}

function removeMac(mac: string): void {
  const list = currentList.value
  const i = list.indexOf(mac)
  if (i >= 0) {
    list.splice(i, 1)
    if (model.value.aclMode === '2') model.value.blackNames.splice(i, 1)
  }
}

function getHostnameForMac(mac: string): string {
  if (model.value.aclMode === '2') {
    const idx = model.value.blackList.indexOf(mac)
    if (idx >= 0 && model.value.blackNames[idx]) return model.value.blackNames[idx]
  }
  const found = onlineDevices.value.find((d) => d.mac.toUpperCase() === mac.toUpperCase())
  return found?.hostname || ''
}

const currentClientMac = computed(() => (raw.value.client_mac_address || '').toUpperCase())

const isSelfMacLockedOut = computed(() => {
  if (model.value.aclMode !== '1') return false
  if (!currentClientMac.value) return false
  return !model.value.whiteList.includes(currentClientMac.value)
})

function addSelfToWhitelist(): void {
  if (!currentClientMac.value) return
  addOnline(currentClientMac.value, '当前操作本机')
}

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
    toast(`已复制: ${text}`, 'success')
  } catch {
    toast(`复制失败: ${text}`, 'info')
  }
}
</script>

<template>
  <PageForm
    title="MAC 接入过滤"
    :loading="loading"
    :saving="saving"
    :error="error"
    :dirty="dirty"
    @save="save()"
    @reset="reset()"
  >

    <Card>
      <div class="filter-hero">
        <div class="filter-hero-left">
          <div class="filter-hero-icon" :class="`mode-${model.aclMode}`">
            <Icon
              :name="model.aclMode === '2' ? 'ban' : model.aclMode === '1' ? 'lock' : 'shield'"
              :size="22"
            />
          </div>
          <div class="filter-hero-meta">
            <div class="filter-hero-title">
              <span class="filter-name">
                {{ model.aclMode === '2' ? '黑名单拒绝模式' : model.aclMode === '1' ? '白名单准入模式' : '接入过滤已关闭' }}
              </span>
              <span class="mode-badge" :class="`badge-${model.aclMode}`">
                {{ model.aclMode === '2' ? '拦截指定设备' : model.aclMode === '1' ? '仅允许列表' : '开放接入' }}
              </span>
            </div>
            <span class="t-cap">
              {{ model.aclMode === '2' ? '自动踢出并拒绝黑名单设备连接' : model.aclMode === '1' ? '未登记的设备均无法连接无线网络' : '所有终端仅需正确密码即可接入' }}
            </span>
          </div>
        </div>
      </div>
    </Card>

    <Card title="过滤控制模式">
      <div class="mode-grid">
        <button
          v-for="m in MODES"
          :key="m.value"
          type="button"
          class="mode-card"
          :class="{ 'is-selected': model.aclMode === m.value }"
          @click="model.aclMode = m.value"
        >
          <div class="mode-card-head">
            <span class="mode-label">{{ m.label }}</span>
            <Icon v-if="model.aclMode === m.value" name="check" :size="16" class="check-ic" />
          </div>
          <span class="t-cap mode-desc">{{ m.desc }}</span>
        </button>
      </div>
    </Card>

    <Card v-if="isSelfMacLockedOut" class="lockout-card">
      <div class="lockout-box">
        <div class="lockout-text">
          <p class="lockout-title">⚠️ 防失联警告：白名单未包含本机</p>
          <p class="t-cap">
            若直接保存白名单，当前设备 ({{ currentClientMac }}) 将被断开且无法再进入路由器管理后台！
          </p>
        </div>
        <button type="button" class="btn-add-self" @click="addSelfToWhitelist">
          <Icon name="plus" :size="14" />
          <span>一键加入本机</span>
        </button>
      </div>
    </Card>

    <Card v-if="model.aclMode !== '0'" :title="model.aclMode === '2' ? `黑名单设备 (${currentList.length})` : `白名单设备 (${currentList.length})`">

      <div class="add-bar">
        <input
          v-model="draft"
          class="add-input num"
          type="text"
          placeholder="输入 MAC 地址，如 AA:BB:CC:DD:EE:FF"
          autocapitalize="characters"
          spellcheck="false"
          @keyup.enter="addMac"
        />
        <button type="button" class="btn-add" @click="addMac">
          <Icon name="plus" :size="14" />
          <span>添加</span>
        </button>
      </div>

      <div v-if="onlineDevices.length" class="quick-devices">
        <span class="quick-title t-cap">在线连接设备快捷添加：</span>
        <div class="quick-chips">
          <button
            v-for="d in onlineDevices"
            :key="d.mac"
            type="button"
            class="dev-chip"
            :class="{ 'is-added': currentList.includes(d.mac.toUpperCase()) }"
            :disabled="currentList.includes(d.mac.toUpperCase())"
            @click="addOnline(d.mac, d.hostname)"
          >
            <span class="chip-name">{{ d.hostname || '未命名' }}</span>
            <span class="chip-mac num">{{ d.mac }}</span>
            <span v-if="currentList.includes(d.mac.toUpperCase())" class="chip-status">已添加</span>
            <Icon v-else name="plus" :size="12" />
          </button>
        </div>
      </div>

      <div v-if="currentList.length" class="entry-list">
        <div v-for="mac in currentList" :key="mac" class="entry-item">
          <div class="entry-meta">
            <span class="entry-name">{{ getHostnameForMac(mac) || (mac === currentClientMac ? '本机终端' : '未知设备') }}</span>
            <span class="entry-mac num" @click="copyText(mac)">
              {{ mac }}
              <Icon name="copy" :size="11" class="copy-ic" />
            </span>
          </div>
          <button type="button" class="btn-del" title="移出列表" @click="removeMac(mac)">
            <Icon name="trash" :size="15" />
          </button>
        </div>
      </div>

      <div v-else class="empty-list">
        <p class="empty-text">当前暂未添加任何条目</p>
        <p class="t-cap">请在上方手动输入 MAC 或直接从在线设备中快捷添加</p>
      </div>
    </Card>
  </PageForm>
</template>

<style scoped>
.filter-hero { display: flex; align-items: center; justify-content: space-between; }
.filter-hero-left { display: flex; align-items: center; gap: var(--sp-3); min-width: 0; }
.filter-hero-icon { width: 44px; height: 44px; border-radius: var(--r-md); display: flex; align-items: center; justify-content: center; flex: none; }
.filter-hero-icon.mode-0 { background: var(--c-surface-2); color: var(--c-text-3); }
.filter-hero-icon.mode-2 { background: var(--c-danger-bg); color: var(--c-danger); }
.filter-hero-icon.mode-1 { background: var(--c-primary-50); color: var(--c-primary-400); }
[data-theme='dark'] .filter-hero-icon.mode-1 { background: var(--c-primary-100); color: var(--c-primary-600); }
.filter-hero-meta { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.filter-hero-title { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.filter-name { font-size: var(--fs-h2); font-weight: 700; color: var(--c-text-1); }
.mode-badge { font-size: 11px; font-weight: 600; padding: 1px 7px; border-radius: var(--r-sm); }
.badge-0 { background: var(--c-surface-2); color: var(--c-text-3); }
.badge-2 { background: var(--c-danger-bg); color: var(--c-danger); }
.badge-1 { background: var(--c-primary-50); color: var(--c-primary-600); }
[data-theme='dark'] .badge-1 { background: rgba(34, 181, 134, 0.2); color: var(--c-primary-400); }

.mode-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--sp-2); }
@media (max-width: 600px) { .mode-grid { grid-template-columns: 1fr; } }
.mode-card { display: flex; flex-direction: column; gap: 4px; padding: 10px var(--sp-3); border-radius: var(--r-sm); border: 1px solid var(--c-line); background: var(--c-surface); text-align: left; cursor: pointer; }
.mode-card:hover { border-color: var(--c-primary-400); }
.mode-card.is-selected { border-color: var(--c-primary-400); background: var(--c-primary-50); box-shadow: 0 0 0 1px var(--c-primary-400); }
[data-theme='dark'] .mode-card.is-selected { background: rgba(34, 181, 134, 0.15); }
.mode-card-head { display: flex; align-items: center; justify-content: space-between; }
.mode-label { font-size: 13px; font-weight: 700; color: var(--c-text-1); }
.check-ic { color: var(--c-primary-400); }
.mode-desc { font-size: 11px; }

.lockout-card { border: 1px solid #f59e0b !important; background: rgba(245, 158, 11, 0.08) !important; }
.lockout-box { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-3); }
.lockout-text { display: flex; flex-direction: column; gap: 2px; }
.lockout-title { font-size: 13px; font-weight: 700; color: #b45309; }
[data-theme='dark'] .lockout-title { color: #fbbf24; }
.btn-add-self { display: inline-flex; align-items: center; gap: 4px; padding: 6px 12px; border-radius: var(--r-sm); background: #f59e0b; color: #fff; border: none; font-size: 12px; font-weight: 600; cursor: pointer; flex: none; }

.add-bar { display: flex; gap: var(--sp-2); margin-bottom: var(--sp-3); }
.add-input { flex: 1; height: 38px; padding: 0 var(--sp-3); background: var(--c-surface-2); border: 1px solid var(--c-line); border-radius: var(--r-sm); color: var(--c-text-1); font-size: 13px; outline: none; }
.add-input:focus { border-color: var(--c-primary-400); }
.btn-add { display: inline-flex; align-items: center; gap: 4px; padding: 0 16px; border-radius: var(--r-sm); background: var(--c-primary-400); color: #fff; border: none; font-size: 13px; font-weight: 600; cursor: pointer; }

.quick-devices { margin-bottom: var(--sp-3); padding: var(--sp-2) var(--sp-3); border-radius: var(--r-sm); background: var(--c-surface-2); }
.quick-title { font-size: 11px; display: block; margin-bottom: 6px; }
.quick-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.dev-chip { display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; border-radius: var(--r-sm); background: var(--c-surface); border: 1px solid var(--c-line); color: var(--c-text-2); font-size: 11px; cursor: pointer; }
.dev-chip:hover:not(:disabled) { border-color: var(--c-primary-400); color: var(--c-text-1); }
.dev-chip.is-added { opacity: 0.5; cursor: default; }
.chip-name { font-weight: 600; }
.chip-mac { font-size: 10px; opacity: 0.8; }
.chip-status { font-size: 9px; color: var(--c-text-3); }

.entry-list { display: flex; flex-direction: column; gap: var(--sp-2); }
.entry-item { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border-radius: var(--r-sm); background: var(--c-surface); border: 1px solid var(--c-line); }
.entry-meta { display: flex; align-items: baseline; gap: 8px; min-width: 0; }
.entry-name { font-size: 13px; font-weight: 600; color: var(--c-text-1); }
.entry-mac { font-size: 12px; color: var(--c-text-2); cursor: pointer; display: inline-flex; align-items: center; gap: 3px; }
.entry-mac:hover { color: var(--c-primary-400); }
.copy-ic { opacity: 0.6; }
.btn-del { display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border: none; background: transparent; color: var(--c-text-3); border-radius: var(--r-sm); cursor: pointer; }
.btn-del:hover { background: var(--c-danger-bg); color: var(--c-danger); }
.empty-list { text-align: center; padding: var(--sp-4) 0; }
.empty-text { font-size: 13px; font-weight: 600; color: var(--c-text-2); margin-bottom: 2px; }
</style>
