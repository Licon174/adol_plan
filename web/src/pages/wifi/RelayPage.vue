<script setup lang="ts">import { computed, onUnmounted, ref } from 'vue'
import {
  PAGE_KEYS,
  getStatus,
  post,
  relayConnect,
  relayDisconnect,
  relayProfileUpdate,
  relayRefresh,
  setStationControl,
} from '@/api'
import { parseRelayProfiles, parseRelayScan, type RelayAp, type RelayProfile } from '@/utils/parse'
import { toast } from '@/components/toast'
import { withLoading } from '@/components/loading'
import { confirm } from '@/components/confirm'
import { validateSsid, validateWifiPassword } from '@/utils/validators'
import PageForm from '@/layouts/PageForm.vue'
import Card from '@/components/Card.vue'
import FormField from '@/components/FormField.vue'
import Icon from '@/components/Icon.vue'
import Toggle from '@/components/Toggle.vue'

const raw = ref<Record<string, string>>({})
const loading = ref(true)
const error = ref('')
const busy = ref(false)
const scanning = ref(false)
const aps = ref<RelayAp[]>([])
const showConnect = ref(false)
const showPwd = ref(false)
const form = ref({
  ssid: '',
  password: '',
  authMode: 'WPA2PSK',
  encryptType: '',
  mac: '',
  profileName: '',
})
const formErrors = ref<Record<string, string>>({})

const selectedSignal = ref('')

let pollTimer: ReturnType<typeof setTimeout> | undefined
onUnmounted(() => {
  if (pollTimer) clearTimeout(pollTimer)
})

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    raw.value = (await getStatus(PAGE_KEYS.wifiRelay)) as Record<string, string>

    if (!scanning.value) aps.value = parseRelayScan(raw.value)
  } catch (e) {
    error.value = e instanceof Error ? e.message : '读取失败'
  } finally {
    loading.value = false
  }
}
void load()

const staOn = computed(() => (raw.value.wifi_sta_connection ?? '0') === '1')

const profileCount = computed(() => Number.parseInt(raw.value.wifi_profile_num ?? '0', 10) || 0)
const profiles = computed<RelayProfile[]>(() => parseRelayProfiles(raw.value, 10))

const connected = computed(() => {
  const s = raw.value.sta_ip_status ?? ''
  return s === 'connect' || s === 'connected'
})

const wanIp = computed(() => (connected.value ? (raw.value.wan_ipaddr ?? '') : ''))

async function run(body: Record<string, string>, label: string): Promise<boolean> {
  busy.value = true
  try {
    await withLoading(async () => {
      const res = await post(body)

      if (res.result !== 'success' && res.result !== 'processing') {
        throw new Error(res.result || '设备返回失败')
      }
    }, label)
    return true
  } catch (e) {
    toast(e instanceof Error ? e.message : '操作失败', 'error')
    return false
  } finally {
    busy.value = false
  }
}

async function toggleSta(v: boolean): Promise<void> {
  if (await run(setStationControl(v ? '1' : '0'), v ? '正在开启…' : '正在关闭…')) {
    await load()
    if (!v) aps.value = []
    toast(v ? '中继模式已开启' : '中继模式已关闭', 'success')
  }
}

const SCAN_MAX_MS = 25_000

const scanSec = ref(0)

let scanAbort = false
let pollResolve: (() => void) | null = null

function sleepScan(ms: number): Promise<void> {
  return new Promise((r) => {
    pollResolve = () => {
      pollResolve = null
      r()
    }
    pollTimer = setTimeout(() => {
      if (pollResolve) pollResolve()
    }, ms)
  })
}

async function scan(): Promise<void> {

  if (scanning.value) {
    scanAbort = true
    if (pollTimer) clearTimeout(pollTimer)
    if (pollResolve) pollResolve()
    return
  }
  if (!staOn.value) {
    await toggleSta(true)
    if (!staOn.value) return
    await sleepScan(3000)
  }
  scanning.value = true
  scanAbort = false
  scanSec.value = 0
  aps.value = []
  const deadline = Date.now() + SCAN_MAX_MS
  const t0 = Date.now()
  let aborted = false
  try {
    for (let attempt = 0; attempt < 2 && !aps.value.length && !scanAbort; attempt++) {
      if (attempt > 0) {
        await sleepScan(2000)
        if (scanAbort) break
      }
      const ok = await run(relayRefresh(), '正在搜索…')
      if (!ok) break
      for (let i = 0; i < 20; i++) {
        await sleepScan(2000)
        scanSec.value = Math.round((Date.now() - t0) / 1000)
        if (scanAbort || Date.now() > deadline) break
        try {
          raw.value = (await getStatus(PAGE_KEYS.wifiRelay)) as Record<string, string>
        } catch {
          break
        }
        const f = raw.value.scan_finish

        if ((f === '1' || f === '2') && i >= 1) break
      }
      if (scanAbort) break
      aps.value = parseRelayScan(raw.value)
    }
  } finally {

    scanning.value = false
    aborted = scanAbort
    scanAbort = false
  }
  if (aborted) {
    toast('已停止搜索', 'info')
    return
  }
  if (!aps.value.length) {
    toast(Date.now() > deadline ? '搜索超时，未找到热点' : '没有搜到可用的热点', 'error')
  }
}

function startConnect(ap?: RelayAp | RelayProfile): void {

  if (ap && 'channel' in ap) {
    const a = ap as RelayAp
    selectedSignal.value = a.signal ?? ''
    form.value = {
      ssid: a.ssid,
      password: '',
      authMode: a.authMode || 'WPA2PSK',
      encryptType: a.encryptType || '',
      mac: a.mac,
      profileName: '',
    }
  } else if (ap) {
    const p = ap as RelayProfile
    selectedSignal.value = p.signal ?? ''
    form.value = {
      ssid: p.ssid,
      password: p.password,
      authMode: p.authMode || 'WPA2PSK',
      encryptType: p.encryptType || '',
      mac: p.mac,
      profileName: p.profileName,
    }
  } else {
    selectedSignal.value = ''
    form.value = {
      ssid: '',
      password: '',
      authMode: 'WPA2PSK',
      encryptType: '',
      mac: '',
      profileName: '',
    }
  }
  formErrors.value = {}
  showConnect.value = true
}

async function connect(): Promise<void> {
  const errs: Record<string, string> = {}
  const se = validateSsid(form.value.ssid)
  if (se) errs.ssid = se
  if (form.value.authMode !== 'OPEN') {
    const pe = validateWifiPassword(form.value.password, form.value.authMode)
    if (pe) errs.password = pe
  }
  formErrors.value = errs
  if (Object.keys(errs).length) return

  const pwd = form.value.password
  const encryptType = form.value.encryptType || (form.value.authMode === 'OPEN' ? 'NONE' : 'TKIPCCMP')
  let profileName = form.value.profileName

  if (!profileName) {
    profileName = String(Date.now()).replace(/\D/g, '').slice(-10).padStart(10, '0')
    const item = [
      profileName,
      '0',
      '0',
      selectedSignal.value,
      form.value.ssid,
      form.value.authMode,
      encryptType,
      pwd || '0',
      '1',
      form.value.mac,
    ].join(',')

    const buckets: string[][] = Array.from({ length: 10 }, () => [])
    profiles.value.forEach((p, i) => buckets[i % 10].push(p.raw))
    buckets[profiles.value.length % 10].push(item)
    const groups: Record<string, string> = {}
    for (let i = 0; i < 10; i++) {
      groups[i === 0 ? 'wifi_profile' : `wifi_profile${i}`] = buckets[i].join(';')
    }
    const saved = await run(
      relayProfileUpdate({
        wifiProfileNum: String(profiles.value.length + 1),
        wifiUpdateProfile: item,
        action: 'add',
        groups,
      }),
      '正在保存热点…',
    )
    if (!saved) return
    await load()
  }

  const ok = await run(
    relayConnect({
      EX_SSID1: form.value.ssid,
      EX_AuthMode: form.value.authMode,
      EX_EncrypType: encryptType,
      EX_DefaultKeyID: '1',
      EX_WEPKEY: pwd,
      EX_WPAPSK1: pwd,
      EX_wifi_profile: profileName,
      EX_mac: form.value.mac,
    }),
    '正在连接…',
  )
  if (ok) {
    showConnect.value = false
    await load()
    toast('已下发连接请求，稍后查看状态', 'success')
  }
}

async function disconnect(): Promise<void> {
  const okc = await confirm({
    title: '断开中继',
    message: '断开后本机将失去上网通道。确认？',
    danger: true,
  })
  if (!okc) return
  if (await run(relayDisconnect(), '正在断开…')) {
    await load()
    toast('已断开', 'success')
  }
}

async function removeProfile(p: RelayProfile): Promise<void> {
  const okc = await confirm({
    title: '删除热点',
    message: `删除保存的「${p.ssid || '未命名'}」？`,
    danger: true,
  })
  if (!okc) return

  const groups: Record<string, string> = {}
  let removed = 0
  for (let i = 0; i < 10; i++) {
    const key = i === 0 ? 'wifi_profile' : `wifi_profile${i}`
    const src = (raw.value[key] ?? '').split(';').filter(Boolean)
    const kept = src.filter((s) => s !== p.raw)
    removed += src.length - kept.length
    groups[key] = kept.join(';')
  }
  if (!removed) {
    toast('没找到这条记录，已刷新', 'error')
    void load()
    return
  }
  const okr = await run(
    relayProfileUpdate({
      wifiProfileNum: String(Math.max(0, profileCount.value - removed)),
      wifiUpdateProfile: p.raw,
      action: 'delete',
      groups,
    }),
    '正在删除…',
  )
  if (okr) {
    await load()
    toast('已删除', 'success')
  }
}
</script>

<template>
  <PageForm title="无线中继" :loading="loading" :error="error" :savable="false">

    <Card>
      <div class="relay-hero">
        <div class="relay-hero-left">
          <div class="relay-hero-icon" :class="{ 'is-active': staOn }">
            <Icon name="repeat" :size="20" />
          </div>
          <div class="relay-hero-meta">
            <div class="relay-title-row">
              <span class="relay-name">无线中继 (STA)</span>
              <span class="status-pill" :class="connected ? 'pill-green' : staOn ? 'pill-blue' : 'pill-off'">
                {{ connected ? '已连接' : staOn ? (scanning ? '扫描中' : '未连接') : '关闭' }}
              </span>
            </div>
            <span class="t-cap">
              {{ connected ? `上游 IP: ${wanIp || '已就绪'}` : '连接外部已有 Wi-Fi 网络上网' }}
            </span>
          </div>
        </div>
        <Toggle
          :model-value="staOn"
          :disabled="busy"
          label="中继开关"
          @update:model-value="toggleSta"
        />
      </div>

      <div v-if="staOn" class="topo-rail">
        <div class="topo-node" :class="{ 'node-active': connected }">
          <Icon name="wifi" :size="15" />
          <span>上游热点</span>
        </div>
        <div class="topo-line" :class="{ 'line-flow': connected }">
          <span class="flow-dot"></span>
        </div>
        <div class="topo-node node-active">
          <Icon name="router" :size="15" />
          <span>本机</span>
        </div>
        <div class="topo-line line-flow">
          <span class="flow-dot"></span>
        </div>
        <div class="topo-node node-active">
          <Icon name="smartphone" :size="15" />
          <span>终端</span>
        </div>
      </div>

      <div v-if="connected" class="disconnect-row">
        <button type="button" class="btn-disconnect" :disabled="busy" @click="disconnect">
          断开连接
        </button>
      </div>
    </Card>

    <Card title="周边热点">
      <template v-if="!staOn">
        <div class="dormant-box">
          <p class="t-cap">中继已关闭</p>
          <button type="button" class="btn-enable-inline" :disabled="busy" @click="toggleSta(true)">
            开启中继
          </button>
        </div>
      </template>
      <template v-else>
        <div class="search-toolbar">
          <button
            type="button"
            class="btn-scan"
            :class="{ 'is-scanning': scanning }"
            :disabled="busy"
            @click="scan"
          >
            <Icon name="refresh" :size="14" :class="{ 'spin-ic': scanning }" />
            <span>{{ scanning ? `停止 (${scanSec}s)` : '搜索周边' }}</span>
          </button>
          <button
            type="button"
            class="btn-manual"
            :disabled="busy || scanning"
            @click="startConnect()"
          >
            <Icon name="plus" :size="14" />
            <span>手动添加</span>
          </button>
        </div>

        <div v-if="scanning" class="radar-box">
          <div class="radar-circle"></div>
          <p class="radar-text">扫描信道中… {{ scanSec }}s</p>
        </div>

        <div v-else-if="aps.length" class="ap-list">
          <div v-for="ap in aps" :key="ap.mac + ap.ssid" class="ap-card">
            <div class="ap-left">
              <div class="ap-signal-icon">
                <Icon name="wifi" :size="16" />
              </div>
              <div class="ap-info">
                <span class="ap-ssid">{{ ap.ssid || '(隐藏网络)' }}</span>
                <div class="ap-tags">
                  <span class="ap-auth-tag">{{ ap.authMode || '开放' }}</span>
                  <span v-if="ap.channel" class="ap-meta-tag num">CH{{ ap.channel }}</span>
                  <span v-if="ap.signal" class="ap-meta-tag num">信噪 {{ ap.signal }}</span>
                </div>
              </div>
            </div>
            <button type="button" class="btn-ap-con" :disabled="busy" @click="startConnect(ap)">
              连接
            </button>
          </div>
        </div>

        <div v-else class="empty-aps">
          <Icon name="wifi" :size="28" class="empty-ic" />
          <p class="empty-title">暂未扫描到周围热点</p>
          <p class="t-cap">点击上方「搜索周边 WiFi」开始雷达扫描</p>
        </div>
      </template>
    </Card>

    <Card v-if="showConnect && staOn" title="连接无线热点">
      <FormField label="热点名称 (SSID)" required :error="formErrors.ssid">
        <input v-model="form.ssid" type="text" autocomplete="off" spellcheck="false" placeholder="输入上游 Wi-Fi 名称" />
      </FormField>

      <FormField label="安全加密方式">
        <select v-model="form.authMode">
          <option value="WPA2PSK">WPA2-PSK (常用推荐)</option>
          <option value="WPAPSKWPA2PSK">WPA-PSK / WPA2-PSK 混合</option>
          <option value="WPAPSK">WPA-PSK</option>
          <option value="OPEN">不加密 (OPEN)</option>
        </select>
      </FormField>

      <FormField
        v-if="form.authMode !== 'OPEN'"
        label="Wi-Fi 访问密码"
        required
        :error="formErrors.password"
      >
        <div class="pwd-input-wrap">
          <input
            v-model="form.password"
            :type="showPwd ? 'text' : 'password'"
            autocomplete="off"
            spellcheck="false"
            placeholder="输入上游 Wi-Fi 密码"
          />
          <button
            type="button"
            class="eye-btn"
            :title="showPwd ? '隐藏密码' : '显示密码'"
            @click="showPwd = !showPwd"
          >
            <Icon :name="showPwd ? 'eye-off' : 'eye'" :size="15" />
          </button>
        </div>
      </FormField>

      <div class="con-dialog-actions">
        <button type="button" class="btn-cancel" :disabled="busy" @click="showConnect = false">
          取消
        </button>
        <button type="button" class="btn-submit" :disabled="busy" @click="connect">
          确认连接
        </button>
      </div>
    </Card>

    <Card title="已记住的 Wi-Fi 网络">
      <div v-if="profiles.length" class="profile-list">
        <div v-for="p in profiles" :key="p.profileName + p.ssid" class="profile-item">
          <div class="profile-left">
            <Icon name="wifi" :size="16" class="profile-ic" />
            <div class="profile-info">
              <span class="profile-ssid">{{ p.ssid || '未命名网络' }}</span>
              <span class="profile-sub t-cap num">{{ p.authMode || '已加密' }} · {{ p.mac || '自动 MAC' }}</span>
            </div>
          </div>
          <div class="profile-actions">
            <button
              type="button"
              class="btn-prof-con"
              :disabled="busy || !staOn"
              @click="startConnect(p)"
            >
              连接
            </button>
            <button
              type="button"
              class="btn-prof-del"
              :disabled="busy || !staOn"
              title="删除记录"
              @click="removeProfile(p)"
            >
              <Icon name="trash" :size="14" />
            </button>
          </div>
        </div>
      </div>
      <p v-else class="empty-prof t-cap">暂无记住的历史网络，成功连接过的热点将自动保存在此</p>
    </Card>
  </PageForm>
</template>

<style scoped>
.relay-hero { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-3); }
.relay-hero-left { display: flex; align-items: center; gap: var(--sp-3); min-width: 0; }
.relay-hero-icon { width: 44px; height: 44px; border-radius: var(--r-md); background: var(--c-surface-2); color: var(--c-text-3); display: flex; align-items: center; justify-content: center; flex: none; }
.relay-hero-icon.is-active { background: var(--c-primary-50); color: var(--c-primary-400); }
[data-theme='dark'] .relay-hero-icon.is-active { background: var(--c-primary-100); color: var(--c-primary-600); }
.relay-hero-meta { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.relay-title-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.relay-name { font-size: var(--fs-h2); font-weight: 700; color: var(--c-text-1); }
.status-pill { font-size: 11px; font-weight: 600; padding: 1px 7px; border-radius: var(--r-sm); }
.pill-green { background: var(--c-primary-50); color: var(--c-primary-600); }
[data-theme='dark'] .pill-green { background: rgba(34, 181, 134, 0.2); color: var(--c-primary-400); }
.pill-blue { background: #e0f2fe; color: #0284c7; }
[data-theme='dark'] .pill-blue { background: rgba(2, 132, 199, 0.2); color: #38bdf8; }
.pill-off { background: var(--c-surface-2); color: var(--c-text-3); }

.topo-rail { display: flex; align-items: center; justify-content: space-between; margin-top: var(--sp-4); padding: var(--sp-3) var(--sp-4); background: var(--c-surface-2); border-radius: var(--r-md); gap: var(--sp-2); }
.topo-node { display: flex; flex-direction: column; align-items: center; gap: 4px; font-size: 11px; color: var(--c-text-3); flex: none; }
.topo-node.node-active { color: var(--c-primary-400); font-weight: 600; }
.topo-line { flex: 1; height: 2px; background: var(--c-line); position: relative; overflow: hidden; }
.topo-line.line-flow { background: var(--c-primary-400); }
.flow-dot { position: absolute; top: -2px; left: 0; width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.disconnect-row { margin-top: var(--sp-3); display: flex; justify-content: flex-end; }
.btn-disconnect { padding: 6px 14px; border-radius: var(--r-sm); background: var(--c-danger-bg); color: var(--c-danger); border: none; font-size: 12px; cursor: pointer; }

.search-toolbar { display: flex; gap: var(--sp-2); margin-bottom: var(--sp-3); }
.btn-scan { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: var(--r-sm); background: var(--c-primary-400); color: #fff; border: none; font-size: 13px; font-weight: 600; cursor: pointer; }
.btn-scan.is-scanning { background: #f59e0b; }
.btn-manual { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: var(--r-sm); background: var(--c-surface-2); color: var(--c-text-2); border: 1px solid var(--c-line); font-size: 13px; cursor: pointer; }
.spin-ic { animation: spin 1s linear infinite; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

.radar-box { display: flex; flex-direction: column; align-items: center; padding: var(--sp-5) 0; gap: var(--sp-3); }
.radar-circle { width: 48px; height: 48px; border-radius: 50%; border: 2px solid var(--c-primary-400); opacity: 0.8; animation: pulse 1.5s ease-out infinite; }
@keyframes pulse { 0% { transform: scale(0.6); opacity: 1; } 100% { transform: scale(1.4); opacity: 0; } }
.radar-text { font-size: 13px; color: var(--c-text-2); }

.ap-list, .profile-list { display: flex; flex-direction: column; gap: var(--sp-2); }
.ap-card, .profile-item { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; border-radius: var(--r-sm); background: var(--c-surface); border: 1px solid var(--c-line); }
.ap-left, .profile-left { display: flex; align-items: center; gap: var(--sp-3); min-width: 0; }
.ap-signal-icon { width: 34px; height: 34px; border-radius: var(--r-sm); background: var(--c-surface-2); color: var(--c-primary-400); display: flex; align-items: center; justify-content: center; flex: none; }
.ap-info, .profile-info { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.ap-ssid, .profile-ssid { font-size: 13px; font-weight: 600; color: var(--c-text-1); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ap-tags { display: flex; align-items: center; gap: 6px; font-size: 11px; }
.ap-auth-tag { color: var(--c-text-2); }
.ap-meta-tag { color: var(--c-text-3); }
.btn-ap-con { padding: 6px 14px; border-radius: var(--r-sm); background: var(--c-primary-50); color: var(--c-primary-600); border: none; font-size: 12px; font-weight: 600; cursor: pointer; flex: none; }
[data-theme='dark'] .btn-ap-con { background: var(--c-primary-100); color: var(--c-primary-400); }

.pwd-input-wrap { position: relative; display: flex; align-items: center; }
.pwd-input-wrap input { padding-right: 40px !important; }
.eye-btn { position: absolute; right: 6px; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; background: none; border: none; color: var(--c-text-3); cursor: pointer; }
.con-dialog-actions { display: flex; justify-content: flex-end; gap: var(--sp-2); margin-top: var(--sp-3); }
.btn-cancel { padding: 6px 14px; border-radius: var(--r-sm); background: var(--c-surface-2); color: var(--c-text-2); border: 1px solid var(--c-line); font-size: 12px; cursor: pointer; }
.btn-submit { padding: 6px 18px; border-radius: var(--r-sm); background: var(--c-primary-400); color: #fff; border: none; font-size: 12px; font-weight: 600; cursor: pointer; }

.profile-ic { color: var(--c-text-3); flex: none; }
.profile-actions { display: flex; align-items: center; gap: 6px; flex: none; }
.btn-prof-con { padding: 5px 12px; border-radius: var(--r-sm); background: var(--c-surface-2); color: var(--c-text-2); border: 1px solid var(--c-line); font-size: 12px; cursor: pointer; }
.btn-prof-del { width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border-radius: var(--r-sm); background: transparent; color: var(--c-text-3); border: none; cursor: pointer; }
.btn-prof-del:hover { background: var(--c-danger-bg); color: var(--c-danger); }
.dormant-box, .empty-aps, .empty-prof { text-align: center; padding: var(--sp-4) 0; }
.btn-enable-inline { margin-top: var(--sp-3); padding: 8px 18px; border-radius: var(--r-sm); background: var(--c-primary-400); color: #fff; border: none; font-size: 13px; font-weight: 600; cursor: pointer; }
.empty-ic { color: var(--c-text-3); opacity: 0.5; margin-bottom: var(--sp-2); }
.empty-title { font-size: 13px; font-weight: 600; color: var(--c-text-2); margin-bottom: 2px; }
</style>
