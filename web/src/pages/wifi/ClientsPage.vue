<script setup lang="ts">import { computed, onUnmounted, ref } from 'vue'
import {
  MAC_FILTER_KEYS,
  editHostname,
  getStatus,
  macFilter,
  post,
  qosDelShell,
  qosSetShell,
} from '@/api'
import { useStations } from '@/composables/useStations'
import { execSystem } from '@/api'
import { parseQosState, type Station } from '@/utils/parse'
import { toast } from '@/components/toast'
import { withLoading } from '@/components/loading'
import { confirm } from '@/components/confirm'
import { usePolling } from '@/composables/usePolling'
import PageForm from '@/layouts/PageForm.vue'
import Card from '@/components/Card.vue'
import Icon from '@/components/Icon.vue'

const raw = ref<Record<string, string>>({})
const loading = ref(true)
const error = ref('')
const busy = ref(false)
const qosState = ref<Record<string, { down: string; up: string }>>({})
const editingMac = ref<string | null>(null)
const editName = ref('')
const editQos = ref({ down: '', up: '' })

const { stations, refresh: refreshStations } = useStations()

async function load(): Promise<void> {
  try {
    raw.value = (await getStatus([
      ...MAC_FILTER_KEYS,
      'user_ip_addr',
      'client_mac_address',
      'wifi_band',
      'MAX_Access_num',
      'MAX_Access_num_5g',
    ])) as Record<string, string>
    error.value = ''
  } catch (e) {
    error.value = e instanceof Error ? e.message : '读取失败'
  } finally {
    loading.value = false
  }
  await refreshStations()
}

async function loadQos(): Promise<void> {
  try {
    const res = await fetch(`./qos_state.txt?r=${Date.now()}`)
    if (!res.ok) return
    const text = await res.text()
    const parsed = parseQosState(text)
    const map: Record<string, { down: string; up: string }> = {}
    for (const [mac, rule] of Object.entries(parsed)) {
      if ((Number(rule.down) || 0) > 0 || (Number(rule.up) || 0) > 0) {
        map[mac] = { down: rule.down, up: rule.up }
      }
    }
    qosState.value = map
  } catch {

  }
}

async function refreshAll(): Promise<void> {
  await Promise.all([load(), loadQos()])
}
void refreshAll()

const poll = usePolling(() => load(), 5000)
void poll

onUnmounted(() => {

})

const blackSet = computed(
  () =>
    new Set(
      (raw.value.wifi_mac_black_list ?? '')
        .split(/[,\s;]+/)
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean),
    ),
)

const blackPairs = computed(() => {
  const macs = (raw.value.wifi_mac_black_list ?? '')
    .split(/[,\s;]+/)
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
  const names = (raw.value.wifi_hostname_black_list ?? '').split(';').map((s) => s.trim())
  return macs.map((mac, i) => ({ mac, hostName: names[i] ?? '' }))
})

function isCurrentClient(s: Station): boolean {
  if (s.ip && raw.value.user_ip_addr && s.ip === raw.value.user_ip_addr) return true
  if (raw.value.client_mac_address && s.mac.toUpperCase() === raw.value.client_mac_address.toUpperCase()) return true
  return false
}

async function copyText(text: string, label: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
    toast(`已复制 ${label}: ${text}`, 'success')
  } catch {
    toast(`复制失败: ${text}`, 'info')
  }
}

function getDeviceIcon(s: Station): 'smartphone' | 'monitor' {
  const name = (s.hostname || '').toLowerCase()
  if (name.includes('pc') || name.includes('mac') || name.includes('laptop') || name.includes('desktop') || name.includes('win')) {
    return 'monitor'
  }
  return 'smartphone'
}

async function run(body: Record<string, string>, label: string): Promise<void> {
  busy.value = true
  try {
    await withLoading(async () => {
      const res = await post(body)
      if (res.result !== 'success') throw new Error(res.result || '设备返回失败')
    }, label)
    await refreshAll()
  } catch (e) {
    toast(e instanceof Error ? e.message : '操作失败', 'error')
  } finally {
    busy.value = false
  }
}

async function toggleBlacklist(s: Station): Promise<void> {
  const isBlack = blackSet.value.has(s.mac)
  if (!isBlack) {
    if (isCurrentClient(s)) {
      toast('无法拉黑当前操作设备（本机），否则将断开管理控制台', 'error')
      return
    }
    const ok = await confirm({
      title: '加入黑名单',
      message: `${s.hostname || s.mac} 将被断开并禁止连接本机 WiFi。`,
      danger: true,
    })
    if (!ok) return
  }

  const next = blackPairs.value.filter((x) => x.mac !== s.mac)
  if (!isBlack) next.push({ mac: s.mac, hostName: s.hostname })
  const macList = next.map((x) => x.mac).join(';')
  const nameList = next.map((x) => x.hostName).join(';')

  const bodies: Record<string, string>[] = macList
    ? [macFilter({ ACL_mode: '2', wifi_mac_black_list: macList, wifi_hostname_black_list: nameList })]
    : [
        macFilter({ ACL_mode: '2', wifi_mac_black_list: '', wifi_hostname_black_list: '' }),
        macFilter({ ACL_mode: '0' }),
      ]

  busy.value = true
  try {
    await withLoading(async () => {
      for (const body of bodies) {
        const res = await post(body)
        if (res.result !== 'success') throw new Error(res.result || '设备返回失败')
      }
    }, isBlack ? '正在移出黑名单…' : '正在加入黑名单…')
    toast(isBlack ? '已移出黑名单' : '已加入黑名单', 'success')
    await refreshAll()
  } catch (e) {
    toast(e instanceof Error ? e.message : '操作失败', 'error')
  } finally {
    busy.value = false
  }
}

async function removeBlackMac(mac: string, name = ''): Promise<void> {
  const ok = await confirm({
    title: '移出黑名单',
    message: `允许 ${name || mac} 重新连接本机 WiFi？`,
  })
  if (!ok) return

  const next = blackPairs.value.filter((x) => x.mac !== mac)
  const macList = next.map((x) => x.mac).join(';')
  const nameList = next.map((x) => x.hostName).join(';')

  const bodies: Record<string, string>[] = macList
    ? [macFilter({ ACL_mode: '2', wifi_mac_black_list: macList, wifi_hostname_black_list: nameList })]
    : [
        macFilter({ ACL_mode: '2', wifi_mac_black_list: '', wifi_hostname_black_list: '' }),
        macFilter({ ACL_mode: '0' }),
      ]

  busy.value = true
  try {
    await withLoading(async () => {
      for (const body of bodies) {
        const res = await post(body)
        if (res.result !== 'success') throw new Error(res.result || '设备返回失败')
      }
    }, '正在移出黑名单…')
    toast('已移出黑名单', 'success')
    await refreshAll()
  } catch (e) {
    toast(e instanceof Error ? e.message : '操作失败', 'error')
  } finally {
    busy.value = false
  }
}

function startEdit(s: Station): void {
  if (editingMac.value === s.mac) {
    editingMac.value = null
    return
  }
  editingMac.value = s.mac
  editName.value = s.hostname
  const q = qosState.value[s.mac]
  editQos.value = { down: q?.down && q.down !== '0' ? q.down : '', up: q?.up && q.up !== '0' ? q.up : '' }
}

async function saveEdit(s: Station): Promise<void> {
  if (editName.value.trim() && editName.value !== s.hostname) {
    await run(editHostname(s.mac, editName.value.trim()), '正在保存名称…')
  }
  const d = Number(editQos.value.down) || 0
  const u = Number(editQos.value.up) || 0
  try {
    if (d > 0 || u > 0) {
      await withLoading(
        () => execSystem(qosSetShell(s.mac, d, u, editName.value || s.hostname)),
        '正在应用限速…',
      )
    } else if (qosState.value[s.mac]) {
      await withLoading(() => execSystem(qosDelShell(s.mac)), '正在取消限速…')
    }
    toast('已保存设备设置', 'success')
    editingMac.value = null
    await refreshAll()
  } catch (e) {
    toast(e instanceof Error ? e.message : '限速设置失败', 'error')
  }
}

async function removeQos(s: Station): Promise<void> {
  try {
    await withLoading(() => execSystem(qosDelShell(s.mac)), '正在取消限速…')
    toast('已取消限速', 'success')
    await refreshAll()
  } catch (e) {
    toast(e instanceof Error ? e.message : '取消失败', 'error')
  }
}

const qosLabel = (mac: string): string => {
  const q = qosState.value[mac]
  if (!q) return ''
  const d = q.down === '0' || !q.down ? '不限' : `${q.down} kbps`
  const u = q.up === '0' || !q.up ? '不限' : `${q.up} kbps`
  return `↓${d} · ↑${u}`
}

const qosActiveCount = computed(() => Object.keys(qosState.value).length)
</script>

<template>
  <PageForm title="已连设备与限速" :loading="loading" :error="error" :savable="false">

    <Card>
      <div class="client-hero">
        <div class="client-hero-left">
          <div class="client-hero-icon">
            <Icon name="users" :size="22" />
          </div>
          <div class="client-hero-meta">
            <div class="client-hero-title">
              <span class="hero-num">{{ stations.length }}</span>
              <span class="hero-max">
                / {{ (raw.wifi_band === 'a' ? raw.MAX_Access_num_5g || raw.MAX_Access_num : raw.MAX_Access_num) || '8' }} 台在线终端
              </span>
            </div>
            <div class="client-tags">
              <span v-if="qosActiveCount > 0" class="c-tag tag-blue">已限速 {{ qosActiveCount }} 台</span>
              <span v-if="blackPairs.length > 0" class="c-tag tag-danger">黑名单 {{ blackPairs.length }} 台</span>
              <span v-if="qosActiveCount === 0 && blackPairs.length === 0" class="t-cap">网络畅通无限制</span>
            </div>
          </div>
        </div>
        <button
          type="button"
          class="btn-refresh"
          title="刷新已连终端"
          :disabled="busy"
          @click="refreshAll"
        >
          <Icon name="refresh" :size="15" />
          <span>刷新</span>
        </button>
      </div>
    </Card>

    <Card title="在线连接设备">
      <div v-if="stations.length" class="station-list">
        <div v-for="s in stations" :key="s.mac" class="dev-card">
          <div class="dev-row">
            <div class="dev-avatar" :class="{ 'is-self': isCurrentClient(s) }">
              <Icon :name="getDeviceIcon(s)" :size="20" />
            </div>

            <div class="dev-info">
              <div class="dev-title-line">
                <span class="dev-hostname">{{ s.hostname || '未命名终端' }}</span>
                <span v-if="isCurrentClient(s)" class="badge-self">本机 (当前)</span>
                <span v-if="qosState[s.mac]" class="badge-qos">已限速</span>
              </div>

              <div class="dev-network-line">
                <span v-if="s.ip" class="chip num" @click="copyText(s.ip, 'IP 地址')">
                  {{ s.ip }}
                  <Icon name="copy" :size="11" class="copy-ic" />
                </span>
                <span class="chip num" @click="copyText(s.mac, 'MAC 地址')">
                  {{ s.mac }}
                  <Icon name="copy" :size="11" class="copy-ic" />
                </span>
              </div>

              <div v-if="qosLabel(s.mac)" class="dev-qos-tag t-cap num">
                <Icon name="speed" :size="12" />
                <span>{{ qosLabel(s.mac) }}</span>
              </div>
            </div>

            <div class="dev-action-btns">
              <button
                type="button"
                class="btn-manage"
                :class="{ 'is-editing': editingMac === s.mac }"
                :disabled="busy"
                @click="startEdit(s)"
              >
                <Icon name="edit" :size="14" />
                <span>{{ editingMac === s.mac ? '收起' : '管理' }}</span>
              </button>
              <button
                type="button"
                class="btn-ban"
                :disabled="busy || isCurrentClient(s)"
                :title="isCurrentClient(s) ? '不能拉黑本机' : '加入黑名单'"
                @click="toggleBlacklist(s)"
              >
                <Icon name="ban" :size="14" />
              </button>
            </div>
          </div>

          <div v-if="editingMac === s.mac" class="dev-drawer">
            <div class="drawer-inner">
              <div class="drawer-field">
                <span class="field-title t-cap">设备备注名</span>
                <input
                  v-model="editName"
                  type="text"
                  maxlength="32"
                  placeholder="输入便于识别的设备名称"
                  autocomplete="off"
                />
              </div>

              <div class="drawer-qos-grid">
                <div class="drawer-field">
                  <span class="field-title t-cap">下载限速 (kbps)</span>
                  <input
                    v-model="editQos.down"
                    type="number"
                    min="0"
                    inputmode="numeric"
                    placeholder="0 表示不限速"
                  />
                </div>
                <div class="drawer-field">
                  <span class="field-title t-cap">上传限速 (kbps)</span>
                  <input
                    v-model="editQos.up"
                    type="number"
                    min="0"
                    inputmode="numeric"
                    placeholder="0 表示不限速"
                  />
                </div>
              </div>

              <div class="drawer-foot">
                <button
                  v-if="qosState[s.mac]"
                  type="button"
                  class="btn-clear-qos"
                  :disabled="busy"
                  @click="removeQos(s)"
                >
                  取消限速
                </button>
                <div class="drawer-right-actions">
                  <button
                    type="button"
                    class="btn-drawer-cancel"
                    @click="editingMac = null"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    class="btn-drawer-save"
                    :disabled="busy"
                    @click="saveEdit(s)"
                  >
                    保存设置
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="empty-box">
        <Icon name="wifi" :size="32" class="empty-ic" />
        <p class="empty-title">当前暂无外部无线终端接入</p>
        <p class="t-cap">周围设备连接您的 Wi-Fi 后将即时在此显示</p>
      </div>
    </Card>

    <Card v-if="blackPairs.length" :title="`黑名单拦截设备 (${blackPairs.length})`">
      <div class="black-list">
        <div v-for="b in blackPairs" :key="b.mac" class="black-item">
          <div class="black-left">
            <div class="black-icon">
              <Icon name="ban" :size="16" />
            </div>
            <div class="black-info">
              <span class="black-name">{{ b.hostName || '未知终端' }}</span>
              <span class="chip num">{{ b.mac }}</span>
            </div>
          </div>
          <button
            type="button"
            class="btn-unban"
            :disabled="busy"
            @click="removeBlackMac(b.mac, b.hostName)"
          >
            移出黑名单
          </button>
        </div>
      </div>
    </Card>
  </PageForm>
</template>

<style scoped>
.client-hero { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-3); }
.client-hero-left { display: flex; align-items: center; gap: var(--sp-3); min-width: 0; }
.client-hero-icon { width: 44px; height: 44px; border-radius: var(--r-md); background: var(--c-primary-50); color: var(--c-primary-400); display: flex; align-items: center; justify-content: center; flex: none; }
[data-theme='dark'] .client-hero-icon { background: var(--c-primary-100); color: var(--c-primary-600); }
.client-hero-meta { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.client-hero-title { display: flex; align-items: baseline; gap: 6px; }
.hero-num { font-size: 20px; font-weight: 700; color: var(--c-text-1); }
.hero-max { font-size: var(--fs-cap); color: var(--c-text-2); }
.client-tags { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.c-tag { font-size: 11px; font-weight: 600; padding: 1px 7px; border-radius: var(--r-sm); }
.tag-blue { background: #e0f2fe; color: #0284c7; }
[data-theme='dark'] .tag-blue { background: rgba(2, 132, 199, 0.2); color: #38bdf8; }
.tag-danger { background: var(--c-danger-bg); color: var(--c-danger); }
.btn-refresh { display: flex; align-items: center; gap: 4px; padding: 6px 12px; border-radius: var(--r-sm); background: var(--c-surface-2); color: var(--c-text-2); font-size: 12px; font-weight: 500; border: none; cursor: pointer; flex: none; }
.btn-refresh:hover:not(:disabled) { color: var(--c-text-1); }

.station-list, .black-list { display: flex; flex-direction: column; gap: var(--sp-2); }
.dev-card, .black-item { border-radius: var(--r-sm); border: 1px solid var(--c-line); background: var(--c-surface); overflow: hidden; }
.dev-card:hover { border-color: var(--c-primary-400); }
.dev-row { display: flex; align-items: center; gap: var(--sp-3); padding: var(--sp-3); }
.dev-avatar { width: 40px; height: 40px; border-radius: var(--r-md); background: var(--c-surface-2); color: var(--c-text-2); display: flex; align-items: center; justify-content: center; flex: none; }
.dev-avatar.is-self { background: var(--c-primary-50); color: var(--c-primary-400); }
[data-theme='dark'] .dev-avatar.is-self { background: var(--c-primary-100); color: var(--c-primary-600); }
.dev-info { display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 0; }
.dev-title-line { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.dev-hostname { font-size: 14px; font-weight: 600; color: var(--c-text-1); }
.badge-self { font-size: 10px; font-weight: 600; padding: 1px 6px; border-radius: var(--r-sm); background: var(--c-primary-50); color: var(--c-primary-400); }
[data-theme='dark'] .badge-self { background: var(--c-primary-100); color: var(--c-primary-600); }
.badge-qos { font-size: 10px; font-weight: 600; padding: 1px 6px; border-radius: var(--r-sm); background: #e0f2fe; color: #0284c7; }
[data-theme='dark'] .badge-qos { background: rgba(2, 132, 199, 0.2); color: #38bdf8; }
.dev-network-line { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.chip { display: inline-flex; align-items: center; gap: 3px; font-size: 11px; padding: 2px 6px; border-radius: var(--r-sm); background: var(--c-surface-2); color: var(--c-text-2); cursor: pointer; }
.chip:hover { color: var(--c-text-1); background: var(--c-line); }
.copy-ic { opacity: 0.6; }
.dev-qos-tag { display: flex; align-items: center; gap: 4px; color: #0284c7; font-size: 11px; }
.dev-action-btns { display: flex; align-items: center; gap: 6px; flex: none; }
.btn-manage { display: flex; align-items: center; gap: 4px; padding: 6px 10px; border-radius: var(--r-sm); background: var(--c-surface-2); color: var(--c-text-2); font-size: 12px; border: none; cursor: pointer; }
.btn-manage.is-editing { background: var(--c-primary-50); color: var(--c-primary-400); }
[data-theme='dark'] .btn-manage.is-editing { background: var(--c-primary-100); color: var(--c-primary-600); }
.btn-ban { display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: var(--r-sm); background: var(--c-danger-bg); color: var(--c-danger); border: none; cursor: pointer; }
.btn-ban:disabled { opacity: 0.35; cursor: not-allowed; }

.dev-drawer { background: var(--c-surface-2); border-top: 1px solid var(--c-line); padding: var(--sp-3); }
.drawer-inner { display: flex; flex-direction: column; gap: var(--sp-2); }
.drawer-field { display: flex; flex-direction: column; gap: 4px; }
.field-title { font-size: 11px; color: var(--c-text-3); }
.drawer-field input { height: 36px; padding: 0 10px; border-radius: var(--r-sm); border: 1px solid var(--c-line); background: var(--c-surface); color: var(--c-text-1); font-size: 13px; outline: none; }
.drawer-field input:focus { border-color: var(--c-primary-400); }
.drawer-qos-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-2); }
.drawer-foot { display: flex; align-items: center; justify-content: space-between; margin-top: 4px; gap: var(--sp-2); }
.drawer-right-actions { display: flex; align-items: center; gap: 6px; margin-left: auto; }
.btn-clear-qos { font-size: 12px; color: var(--c-danger); background: none; border: none; cursor: pointer; padding: 4px 8px; }
.btn-drawer-cancel { padding: 6px 12px; border-radius: var(--r-sm); background: var(--c-surface); color: var(--c-text-2); border: 1px solid var(--c-line); font-size: 12px; cursor: pointer; }
.btn-drawer-save { padding: 6px 14px; border-radius: var(--r-sm); background: var(--c-primary-400); color: #fff; border: none; font-size: 12px; font-weight: 600; cursor: pointer; }

.empty-box { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: var(--sp-5) 0; text-align: center; }
.empty-ic { color: var(--c-text-3); margin-bottom: var(--sp-2); opacity: 0.5; }
.empty-title { font-size: 14px; font-weight: 600; color: var(--c-text-2); margin-bottom: 2px; }

.black-item { display: flex; align-items: center; justify-content: space-between; padding: 10px var(--sp-3); }
.black-left { display: flex; align-items: center; gap: var(--sp-3); min-width: 0; }
.black-icon { width: 32px; height: 32px; border-radius: var(--r-sm); background: var(--c-danger-bg); color: var(--c-danger); display: flex; align-items: center; justify-content: center; flex: none; }
.black-info { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.black-name { font-size: 13px; font-weight: 600; color: var(--c-text-1); }
.btn-unban { padding: 5px 10px; border-radius: var(--r-sm); background: var(--c-surface-2); color: var(--c-text-2); border: 1px solid var(--c-line); font-size: 12px; cursor: pointer; flex: none; }
</style>
