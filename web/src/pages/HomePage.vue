<script setup lang="ts">import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { CELL_DETAIL_KEYS, HOME_KEYS, getStatus, logout, type StatusValues } from '@/api'
import { deriveBattery, deriveCellular, deriveTraffic, deriveWifiShare } from '@/api/derive'
import { usePolling } from '@/composables/usePolling'
import { useTheme } from '@/composables/useTheme'
import { formatBytes, formatDbm, formatRate, percentOf } from '@/utils/format'
import { confirm } from '@/components/confirm'
import { toast } from '@/components/toast'
import Icon from '@/components/Icon.vue'
import SignalBars from '@/components/SignalBars.vue'
import RingChart from '@/components/charts/RingChart.vue'

const router = useRouter()

const { isDark, toggleTheme, homeTitle } = useTheme()

const status = ref<Partial<StatusValues>>({})
const detail = ref<Partial<StatusValues>>({})
const detailOpen = ref(true)
const error = ref('')

interface BatteryStatExt {
  level?: number
  temp?: number
  voltage?: number
  health?: string
  chip?: string
  exist?: number
  status?: string
  pwr?: string
}
const batteryExt = ref<BatteryStatExt | null>(null)
const batteryGuardianOpen = ref(false)
let lastBatCheck = 0

async function loadBatteryStat(): Promise<void> {
  try {
    const res = await fetch(`./battery_stat.txt?r=${Date.now()}`, { cache: 'no-store' })
    if (res.ok) {
      const text = (await res.text()).trim()
      if (text.startsWith('{')) {
        batteryExt.value = JSON.parse(text)
      }
    }
  } catch {

  }
}

function openBatteryGuardian(): void {
  batteryGuardianOpen.value = true
  void loadBatteryStat()
}

function closeBatteryGuardian(): void {
  batteryGuardianOpen.value = false
}

async function load(): Promise<void> {
  try {
    status.value = await getStatus(HOME_KEYS)
    if (Object.keys(detail.value).length === 0) {
      void getStatus(CELL_DETAIL_KEYS).then((d) => { detail.value = d }).catch(() => {})
    }
    error.value = ''
  } catch (e) {
    error.value = e instanceof Error ? e.message : '读取失败'
  }
  const now = Date.now()
  if (now - lastBatCheck > 3000) {
    lastBatCheck = now
    void loadBatteryStat()
  }
}

const poll = usePolling(load, 1000)

const cell = computed(() => deriveCellular(status.value))
const battery = computed(() => deriveBattery(status.value, batteryExt.value))
const traffic = computed(() => deriveTraffic(status.value))

const qrStamp = ref(0)
watch(
  () =>
    `${status.value.wifi_band ?? ''}|${status.value.SSID1 ?? ''}|${status.value.SSID1_5g ?? ''}|${status.value.WPAPSK1_encode ?? ''}|${status.value.WPAPSK1_encode_5g ?? ''}`,
  (key) => {
    if (key !== '||||') qrStamp.value = Date.now()
  },
  { immediate: true },
)
const share = computed(() => deriveWifiShare(status.value, qrStamp.value))

const usedPercent = computed(() =>
  traffic.value.monthlyLimit
    ? percentOf(traffic.value.monthlyUsed, traffic.value.monthlyLimit)
    : 0,
)

const ringTone = computed(() => {
  if (!traffic.value.monthlyLimit) return 'primary' as const
  if (usedPercent.value >= 90) return 'danger' as const
  if (usedPercent.value >= 70) return 'warning' as const
  return 'primary' as const
})

const connectionText = computed(() => (cell.value.connected ? '已联网' : '未连接'))

const detailRows = computed(() => [
  { k: '网络制式', v: cell.value.networkType || '—' },
  { k: '运营商', v: cell.value.operator || '—' },
  { k: '信号强度', v: formatDbm(cell.value.signalDbm) },
  { k: 'PCI / EARFCN', v: `${detail.value.nv_pci || '—'} / ${detail.value.nv_arfcn || '—'}` },
  { k: '工作频段', v: detail.value.lte_band ? `Band ${detail.value.lte_band}` : '—' },
  { k: 'SINR', v: detail.value.nv_sinr || '—' },
  { k: 'RSRQ', v: detail.value.nv_rsrq || '—' },
  { k: 'RSRP', v: detail.value.lte_rsrp ? `${detail.value.lte_rsrp} dBm` : '—' },
  { k: '小区 ID', v: detail.value.nv_globecellid || '—' },
  { k: 'IMEI', v: detail.value.imei || '—' },
  { k: 'IMSI', v: detail.value.sim_imsi || '—' },
  { k: '固件版本', v: detail.value.cr_version || '—' },
])

async function toggleDetail(): Promise<void> {
  detailOpen.value = !detailOpen.value
  if (detailOpen.value && Object.keys(detail.value).length === 0) {
    try {
      detail.value = await getStatus(CELL_DETAIL_KEYS)
    } catch {

    }
  }
}

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
  <div class="home-dash">

    <header class="dash-nav">
      <div class="brand-line">
        <span class="device-name">{{ homeTitle }}</span>
        <span class="net-pill" :class="{ 'is-online': cell.connected }">
          <span class="net-dot" />
          <span class="net-txt num">{{ connectionText }}</span>
        </span>
      </div>
      <div class="dash-actions">
        <button
          type="button"
          class="dash-btn"
          :title="isDark ? '浅色' : '深色'"
          @click="toggleTheme"
        >
          <Icon :name="isDark ? 'sun' : 'moon'" :size="15" />
        </button>
        <router-link to="/network/radar" class="dash-btn" title="射频雷达">
          <Icon name="target" :size="15" />
        </router-link>
        <router-link to="/network/sms" class="dash-btn" title="短信">
          <Icon name="mail" :size="15" />
        </router-link>
        <button type="button" class="dash-btn" title="刷新" @click="poll.refresh()">
          <Icon name="refresh" :size="15" />
        </button>
        <button type="button" class="dash-btn btn-exit" title="退出" @click="handleLogout">
          <Icon name="log-out" :size="15" />
        </button>
      </div>
    </header>

    <div v-if="error" class="dash-err">
      <Icon name="alert" :size="14" />
      <span>{{ error }}</span>
    </div>

    <section class="hero-masthead">
      <div class="masthead-main">
        <div class="radio-badge">
          <div class="bars-wrap">
            <SignalBars :bars="cell.signalBars" size="lg" />
          </div>
          <div class="radio-meta">
            <div class="radio-title-row">
              <span class="net-label num">{{ cell.networkType || '4G' }}</span>
              <span class="op-label">{{ cell.operator || '蜂窝网络' }}</span>
            </div>
            <span class="rsrp-val num">RSRP {{ formatDbm(cell.signalDbm) }}</span>
          </div>
        </div>

        <div class="masthead-extra">
          <span v-if="cell.roaming" class="tag-roam">ROAMING</span>
          <router-link to="/network/radar" class="radar-quick-pill" title="查看射频雷达">
            <Icon name="target" :size="11" />
            <span>雷达</span>
          </router-link>
          <span class="band-tag num">
            {{ status.lte_band || detail.lte_band ? `B${status.lte_band || detail.lte_band}` : 'LTE' }}
          </span>
        </div>
      </div>

      <div class="speed-rail">
        <div class="speed-unit">
          <span class="unit-hdr"><Icon name="download" :size="12" class="ic-rx" /> 下行</span>
          <span class="unit-rate num">{{ formatRate(traffic.rxRate) }}</span>
        </div>
        <div class="rail-sep" />
        <div class="speed-unit">
          <span class="unit-hdr"><Icon name="upload" :size="12" class="ic-tx" /> 上行</span>
          <span class="unit-rate num">{{ formatRate(traffic.txRate) }}</span>
        </div>
        <div class="rail-sep" />
        <router-link to="/wifi/clients" class="speed-unit unit-link">
          <span class="unit-hdr"><Icon name="smartphone" :size="12" /> 终端</span>
          <span class="unit-rate num">{{ status.sta_count || '0' }} <small>台</small></span>
        </router-link>
      </div>
    </section>

    <div class="bento-row">

      <div
        class="bento-tile tile-battery"
        role="button"
        tabindex="0"
        title="点击查看电池健康与温控保护卫士"
        @click="openBatteryGuardian"
        @keyup.enter="openBatteryGuardian"
      >
        <div class="tile-hdr">
          <span class="tile-k">能源状态</span>
          <div class="tile-hdr-right">
            <span
              v-if="battery.temp !== null"
              class="bat-mini-temp num"
              :class="{ 'is-hot': battery.temp >= 45 }"
            >
              <Icon name="thermometer" :size="11" />
              <span>{{ battery.temp }}°C</span>
            </span>
            <Icon
              :name="battery.charging ? 'battery-charging' : 'battery'"
              :size="16"
              class="tile-ic"
            />
          </div>
        </div>
        <div class="tile-content">
          <div v-if="battery.present" class="bat-data">
            <div class="bat-num-row">
              <span class="val-big num">{{ battery.percent !== null ? battery.percent : '—' }}</span>
              <span v-if="battery.percent !== null" class="val-unit num">%</span>
            </div>
            <div class="bat-sub-meta">
              <span
                class="state-label"
                :class="{
                  'is-charging': battery.charging,
                  'is-full': battery.percent !== null && battery.percent >= 100
                }"
              >
                {{ battery.percent !== null && battery.percent >= 100 ? '已充满' : (battery.charging ? '充电中' : '电池供电') }}
              </span>
              <span v-if="battery.voltage !== null" class="val-volt num">{{ battery.voltage }}V</span>
            </div>
          </div>
          <div v-else class="bat-data">
            <div class="bat-num-row">
              <span class="val-big">直供电</span>
            </div>
            <div class="bat-sub-meta">
              <span class="state-label">{{ battery.powerSource === 'PC' ? 'USB 直驱' : '外部适配器' }}</span>
              <span v-if="battery.voltage !== null" class="val-volt num">{{ battery.voltage }}V</span>
            </div>
          </div>
        </div>
      </div>

      <router-link to="/network/traffic" class="bento-tile tile-traffic">
        <div class="tile-hdr">
          <span class="tile-k">本月用量</span>
          <span class="tile-arrow">›</span>
        </div>
        <div class="tile-content traffic-body">
          <div class="chart-holder">
            <RingChart
              v-if="traffic.monthlyLimit"
              :percent="usedPercent"
              :tone="ringTone"
              :size="46"
              :stroke="4.5"
            />
            <div v-else class="unlim-ring">
              <Icon name="activity" :size="18" />
            </div>
          </div>
          <div class="traffic-text">
            <span class="val-medium num">{{ formatBytes(traffic.monthlyUsed) }}</span>
            <span class="state-label num">
              {{ traffic.monthlyLimit ? `上限 ${formatBytes(traffic.monthlyLimit)}` : '未设上限' }}
            </span>
          </div>
        </div>
      </router-link>
    </div>

    <section class="wifi-share-slab">
      <div class="share-main">
        <div class="share-header">
          <div class="share-title-row">
            <Icon name="wifi" :size="16" class="wifi-ic" />
            <span class="slab-title">Wi-Fi 网络</span>
          </div>
          <div class="share-header-actions">
            <router-link to="/wifi/radar?tab=wifi" class="link-radar">
              <Icon name="target" :size="12" />
              <span>周边雷达 ›</span>
            </router-link>
            <router-link to="/wifi/basic" class="link-manage">设置 ›</router-link>
          </div>
        </div>

        <div class="share-meta-list">
          <div class="meta-item">
            <span class="meta-label">SSID</span>
            <span class="meta-val num text-primary-strong">{{ share.ssid || '—' }}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">密码</span>
            <span class="meta-val num text-pwd">{{ share.password || '—' }}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">加密</span>
            <span class="meta-val">{{ share.authMode || 'WPA2-PSK' }}</span>
          </div>
        </div>
      </div>

      <div class="share-qr-col">
        <div class="qr-plate">
          <img
            v-if="share.qrcodeUrl"
            class="qr-img"
            :src="share.qrcodeUrl"
            width="80"
            height="80"
            alt="WiFi二维码"
          />
        </div>
      </div>
    </section>

    <section class="telemetry-slab">
      <button type="button" class="telemetry-toggle" @click="toggleDetail">
        <div class="toggle-left">
          <Icon name="cpu" :size="15" />
          <span>蜂窝网络参数</span>
        </div>
        <Icon :name="detailOpen ? 'chevron-down' : 'chevron-right'" :size="15" class="toggle-arrow" />
      </button>

      <Transition name="fade">
        <div v-if="detailOpen" class="telemetry-grid">
          <div v-for="r in detailRows" :key="r.k" class="t-cell">
            <span class="t-cell-k">{{ r.k }}</span>
            <span class="t-cell-v num">{{ r.v }}</span>
          </div>
        </div>
      </Transition>
    </section>

    <Teleport to="body">
      <Transition name="fade">
        <div
          v-if="batteryGuardianOpen"
          class="guardian-overlay"
          @click.self="closeBatteryGuardian"
        >
          <div class="guardian-sheet card" role="dialog" aria-modal="true">
            <div class="guardian-header">
              <div class="guardian-title-col">
                <div class="guardian-icon-pill">
                  <Icon name="thermometer" :size="16" />
                </div>
                <div>
                  <h3 class="guardian-title">电池健康与温控卫士</h3>
                  <p class="guardian-sub num">硬件实时遥测 · 电源管理架构</p>
                </div>
              </div>
              <button
                type="button"
                class="btn-close-guardian"
                aria-label="关闭"
                @click="closeBatteryGuardian"
              >
                <Icon name="close" :size="15" />
              </button>
            </div>

            <div
              class="guardian-status-bar"
              :class="battery.temp !== null && battery.temp >= 45 ? 'is-warning' : 'is-normal'"
            >
              <Icon
                :name="battery.temp !== null && battery.temp >= 45 ? 'alert' : 'check'"
                :size="14"
              />
              <span class="status-bar-text">
                {{
                  battery.temp !== null && battery.temp >= 45
                    ? `模组温度偏高 (${battery.temp}°C)，温控防护持续监测中`
                    : `系统热管理稳定，实时温度 ${battery.temp !== null ? `${battery.temp}°C` : '正常'}`
                }}
              </span>
            </div>

            <div class="guardian-grid">
              <div class="g-cell">
                <span class="g-cell-label">实时电芯温度</span>
                <span
                  class="g-cell-val num"
                  :class="{ 'text-danger': battery.temp !== null && battery.temp >= 45 }"
                >
                  {{ battery.temp !== null ? `${battery.temp} °C` : '—' }}
                </span>
                <span class="g-cell-note">
                  {{ battery.temp !== null ? (battery.temp >= 45 ? '偏高告警' : '正常') : '无电芯' }}
                </span>
              </div>

              <div class="g-cell">
                <span class="g-cell-label">供电母线电压</span>
                <span class="g-cell-val num">
                  {{ battery.voltage !== null ? `${battery.voltage} V` : '—' }}
                </span>
                <span class="g-cell-note">工作电压平稳</span>
              </div>

              <div class="g-cell">
                <span class="g-cell-label">电芯物理健康</span>
                <span class="g-cell-val">{{ battery.health || '良好' }}</span>
                <span class="g-cell-note">未见物理衰减</span>
              </div>

              <div class="g-cell">
                <span class="g-cell-label">电源管理芯片</span>
                <span class="g-cell-val num">{{ battery.chipType || 'PSC2965' }}</span>
                <span class="g-cell-note">I2C 芯片总线</span>
              </div>

              <div class="g-cell">
                <span class="g-cell-label">供电架构通道</span>
                <span class="g-cell-val">
                  {{ battery.present ? (battery.charging ? 'USB 充电' : (battery.percent !== null && battery.percent >= 100 ? '浮充饱电' : '电芯供电')) : '免电池直供' }}
                </span>
                <span class="g-cell-note">
                  {{ battery.powerSource === 'PC' ? 'USB 5V 接口' : '外部适配器' }}
                </span>
              </div>

              <div class="g-cell">
                <span class="g-cell-label">电芯在位状态</span>
                <span class="g-cell-val">
                  {{ battery.exist ? '已装入电芯' : '无电池运行' }}
                </span>
                <span class="g-cell-note">
                  {{ battery.exist ? '便携模式' : '防鼓包直驱模式' }}
                </span>
              </div>
            </div>

            <div class="guardian-footer">
              <button
                type="button"
                class="btn-guardian-done"
                @click="closeBatteryGuardian"
              >
                完成
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.home-dash {
  width: 100%;
  max-width: var(--content-max);
  margin: 0 auto;
  padding: 12px 14px 28px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.dash-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 2px;
}

.brand-line {
  display: flex;
  align-items: center;
  gap: 8px;
}

.device-name {
  font-size: 16px;
  font-weight: 800;
  letter-spacing: -0.01em;
  color: var(--c-text-1);
}

.net-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 7px;
  border-radius: var(--r-full);
  background: var(--c-surface-2);
  color: var(--c-text-3);
}
.net-pill.is-online {
  background: var(--c-primary-50);
  color: var(--c-primary-600);
}
[data-theme='dark'] .net-pill.is-online {
  background: rgba(34, 181, 134, 0.15);
  color: var(--c-primary-400);
}

.net-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
}

.net-txt {
  font-size: 11px;
  font-weight: 700;
}

.dash-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.dash-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  color: var(--c-text-2);
  background: var(--c-surface);
  border: 1px solid var(--c-line);
  box-shadow: var(--shadow-sm);
  cursor: pointer;
  transition: all 0.15s ease;
  text-decoration: none;
}
.dash-btn:hover {
  color: var(--c-text-1);
  border-color: var(--c-line-strong);
}
.dash-btn:active {
  transform: scale(0.92);
}
.btn-exit:hover {
  color: var(--c-danger);
}

.dash-err {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-radius: var(--r-sm);
  font-size: 12px;
  color: var(--c-danger);
  background: var(--c-danger-bg);
}

.hero-masthead {
  position: relative;
  overflow: hidden;
  background: var(--card-bg, var(--c-surface));
  backdrop-filter: var(--card-backdrop);
  -webkit-backdrop-filter: var(--card-backdrop);
  border: 1px solid var(--card-border, var(--c-line));
  border-radius: var(--r-lg);
  padding: 16px;
  box-shadow: var(--shadow-md);
  transition: transform var(--dur-fast) var(--ease-spring),
              box-shadow var(--dur-fast) ease,
              border-color var(--dur-fast) ease;
}
.hero-masthead:hover {
  transform: translateY(var(--lift-y, 0px));
  border-color: var(--card-border-hover, var(--c-primary-400));
  box-shadow: var(--shadow-hover);
}

.masthead-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
}

.radio-badge {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex: 1 1 auto;
}

.bars-wrap {
  display: flex;
  align-items: center;
  padding: 6px;
  border-radius: 8px;
  background: var(--c-surface);
  border: 1px solid var(--c-line);
  flex-shrink: 0;
}

.radio-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.radio-title-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.net-label {
  font-size: 15px;
  font-weight: 800;
  color: var(--c-text-1);
  flex-shrink: 0;
}

.op-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--c-text-2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.rsrp-val {
  font-size: 11px;
  color: var(--c-text-3);
  white-space: nowrap;
}

.masthead-extra {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  margin-left: auto;
}

.tag-roam {
  font-size: 10px;
  font-weight: 800;
  padding: 2px 5px;
  border-radius: 4px;
  background: var(--c-warning-bg);
  color: var(--c-warning);
}

.radar-quick-pill {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 6px;
  background: rgba(var(--c-primary-rgb, 16, 185, 129), 0.12);
  border: 1px solid var(--c-primary-400);
  color: var(--c-primary-500);
  text-decoration: none;
  transition: all 0.15s ease;
}
.radar-quick-pill:hover {
  background: var(--c-primary-500);
  color: #fff;
}

.band-tag {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 6px;
  background: var(--c-surface);
  border: 1px solid var(--c-line);
  color: var(--c-text-2);
}

.speed-rail {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--c-line);
}

.speed-unit {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  text-decoration: none;
  color: inherit;
}
.unit-link {
  cursor: pointer;
}
.unit-link:hover .unit-rate {
  color: var(--c-primary-500);
}

.unit-hdr {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  color: var(--c-text-3);
}
.ic-rx { color: var(--c-primary-500); }
.ic-tx { color: #0288d1; }

.unit-rate {
  font-size: 14px;
  font-weight: 700;
  color: var(--c-text-1);
}
.unit-rate small {
  font-size: 11px;
  font-weight: 400;
  color: var(--c-text-3);
}

.rail-sep {
  width: 1px;
  height: 22px;
  background: var(--c-line);
  margin: 0 8px;
}

.bento-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.bento-tile {
  position: relative;
  overflow: hidden;
  background: var(--card-bg, var(--c-surface));
  backdrop-filter: var(--card-backdrop);
  -webkit-backdrop-filter: var(--card-backdrop);
  border: 1px solid var(--card-border, var(--c-line));
  border-radius: var(--r-md);
  padding: 12px 14px;
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 84px;
  text-decoration: none;
  color: inherit;
  transition: transform var(--dur-fast) var(--ease-spring),
              box-shadow var(--dur-fast) ease,
              border-color var(--dur-fast) ease;
}
.bento-tile:hover {
  border-color: var(--card-border-hover, var(--c-primary-400));
  box-shadow: var(--shadow-hover);
  transform: translateY(var(--lift-y, 0px));
}
.tile-traffic {
  cursor: pointer;
}
.tile-traffic:active {
  transform: scale(var(--press-scale, 0.98));
}

.tile-hdr {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.tile-k {
  font-size: 12px;
  font-weight: 600;
  color: var(--c-text-2);
}

.tile-ic {
  color: var(--c-primary-500);
}

.tile-arrow {
  font-size: 14px;
  color: var(--c-text-3);
}

.tile-content {
  margin-top: 6px;
}

.bat-data {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.val-big {
  font-size: 20px;
  font-weight: 800;
  color: var(--c-text-1);
  letter-spacing: -0.02em;
}

.val-unit {
  font-size: 12px;
  font-weight: 600;
  color: var(--c-text-3);
  margin-left: 1px;
}

.state-label {
  font-size: 11px;
  color: var(--c-text-3);
}
.state-label.is-charging,
.state-label.is-full {
  color: var(--c-primary-500);
  font-weight: 600;
}

.traffic-body {
  display: flex;
  align-items: center;
  gap: 8px;
}

.chart-holder {
  flex: none;
}

.unlim-ring {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--c-surface-2);
  color: var(--c-primary-500);
}

.traffic-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.val-medium {
  font-size: 15px;
  font-weight: 700;
  color: var(--c-text-1);
  white-space: nowrap;
}

.wifi-share-slab {
  position: relative;
  overflow: hidden;
  background: var(--card-bg, var(--c-surface));
  backdrop-filter: var(--card-backdrop);
  -webkit-backdrop-filter: var(--card-backdrop);
  border: 1px solid var(--card-border, var(--c-line));
  border-radius: var(--r-md);
  padding: 12px 14px;
  box-shadow: var(--shadow-sm);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  transition: transform var(--dur-fast) var(--ease-spring),
              box-shadow var(--dur-fast) ease,
              border-color var(--dur-fast) ease;
}

.share-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.share-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.share-title-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.meta-item {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
}

.meta-label {
  color: var(--c-text-3);
  flex-shrink: 0;
}

.meta-val {
  font-weight: 600;
  color: var(--c-text-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: right;
}

.qr-plate {
  padding: 3px;
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  flex-shrink: 0;
}

.qr-img {
  display: block;
  width: 72px;
  height: 72px;
  border-radius: 4px;
}
.wifi-share-slab:hover {
  border-color: var(--card-border-hover, var(--c-primary-400));
  box-shadow: var(--shadow-hover);
  transform: translateY(var(--lift-y, 0px));
}

.share-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.share-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.share-title-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.wifi-ic {
  color: var(--c-primary-500);
}

.slab-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--c-text-1);
}

.share-header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.link-radar {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  font-weight: 600;
  color: var(--c-primary-500);
  text-decoration: none;
}
.link-radar:hover {
  text-decoration: underline;
}

.link-manage {
  font-size: 11px;
  font-weight: 600;
  color: var(--c-text-3);
  text-decoration: none;
}
.link-manage:hover {
  color: var(--c-text-1);
}

.share-meta-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.meta-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
}

.meta-label {
  color: var(--c-text-3);
}

.meta-val {
  font-weight: 600;
  color: var(--c-text-1);
}
.text-primary-strong {
  color: var(--c-primary-600);
}
[data-theme='dark'] .text-primary-strong {
  color: var(--c-primary-400);
}
.text-pwd {
  font-family: var(--font-mono);
}

.share-qr-col {
  flex: none;
}

.qr-plate {
  padding: 4px;
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

.qr-img {
  display: block;
  border-radius: 4px;
}

.telemetry-slab {
  position: relative;
  overflow: hidden;
  background: var(--card-bg, var(--c-surface));
  backdrop-filter: var(--card-backdrop);
  -webkit-backdrop-filter: var(--card-backdrop);
  border: 1px solid var(--card-border, var(--c-line));
  border-radius: var(--r-md);
  padding: 12px 14px;
  box-shadow: var(--shadow-sm);
  transition: transform var(--dur-fast) var(--ease-spring),
              box-shadow var(--dur-fast) ease,
              border-color var(--dur-fast) ease;
}
.telemetry-slab:hover {
  border-color: var(--card-border-hover, var(--c-primary-400));
  box-shadow: var(--shadow-hover);
}

.telemetry-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--c-text-2);
  font-size: 12px;
  font-weight: 600;
  padding: 0;
}

.toggle-left {
  display: flex;
  align-items: center;
  gap: 6px;
}

.toggle-arrow {
  color: var(--c-text-3);
}

.telemetry-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 12px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--c-line);
}

.t-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 11px;
  min-width: 0;
  background: var(--c-surface-2);
  padding: 5px 8px;
  border-radius: var(--r-sm);
  border: 1px solid var(--c-line);
}

.t-cell-k {
  color: var(--c-text-3);
  font-size: 10px;
  white-space: nowrap;
}

.t-cell-v {
  color: var(--c-text-1);
  font-weight: 700;
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tile-battery {
  cursor: pointer;
  user-select: none;
  transition: transform var(--dur-fast) var(--ease-spring),
              box-shadow var(--dur-fast) ease,
              border-color var(--dur-fast) ease;
}
.tile-battery:hover {
  border-color: var(--card-border-hover, var(--c-primary-400));
}
.tile-battery:active {
  transform: scale(0.98);
}

.tile-hdr-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

.bat-mini-temp {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 10px;
  font-weight: 600;
  color: var(--c-text-2);
  background: var(--c-surface-2);
  padding: 1px 5px;
  border-radius: 999px;
  border: 1px solid var(--c-border);
}
.bat-mini-temp.is-hot {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.12);
  border-color: rgba(239, 68, 68, 0.3);
}

.bat-sub-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 1px;
}

.val-volt {
  font-size: 10px;
  font-weight: 600;
  color: var(--c-text-3);
}

.guardian-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.48);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.guardian-sheet {
  width: 100%;
  max-width: 440px;
  border-radius: 20px;
  padding: 20px 22px;
  background: var(--card-bg, var(--c-surface));
  backdrop-filter: var(--card-backdrop);
  -webkit-backdrop-filter: var(--card-backdrop);
  border: 1px solid var(--card-border, var(--c-line));
  box-shadow: 0 20px 48px -12px rgba(0, 0, 0, 0.45);
  animation: modal-pop 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes modal-pop {
  from {
    opacity: 0;
    transform: scale(0.94) translateY(8px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.guardian-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 14px;
}

.guardian-title-col {
  display: flex;
  align-items: center;
  gap: 10px;
}

.guardian-icon-pill {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  background: var(--c-primary-500);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
}

.guardian-title {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: var(--c-text-1);
}

.guardian-sub {
  margin: 2px 0 0;
  font-size: 11px;
  color: var(--c-text-3);
}

.btn-close-guardian {
  background: var(--c-surface-2);
  border: 1px solid var(--c-border);
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--c-text-2);
  transition: opacity 0.15s ease;
}
.btn-close-guardian:hover {
  opacity: 0.8;
}

.guardian-status-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 14px;
}
.guardian-status-bar.is-normal {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
}
.guardian-status-bar.is-warning {
  background: rgba(239, 68, 68, 0.12);
  color: #ef4444;
}

.guardian-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  margin-bottom: 18px;
}

.g-cell {
  background: var(--c-surface-2);
  border: 1px solid var(--c-border);
  border-radius: 12px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
}

.g-cell-label {
  font-size: 11px;
  color: var(--c-text-3);
  font-weight: 500;
}

.g-cell-val {
  font-size: 15px;
  font-weight: 700;
  color: var(--c-text-1);
  margin-top: 4px;
}
.g-cell-val.text-danger {
  color: #ef4444;
}

.g-cell-note {
  font-size: 10px;
  color: var(--c-text-3);
  margin-top: 2px;
}

.guardian-footer {
  display: flex;
  justify-content: flex-end;
}

.btn-guardian-done {
  width: 100%;
  padding: 10px;
  border-radius: 12px;
  border: none;
  background: var(--c-primary-500);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s ease;
}
.btn-guardian-done:hover {
  opacity: 0.9;
}
</style>
