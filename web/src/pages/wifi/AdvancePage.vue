<script setup lang="ts">import { computed } from 'vue'
import {
  WIFI_RADIO_KEYS,
  setPowerOnSpeed,
  wifiCoverage,
  wifiInfo,
} from '@/api'
import { usePageForm } from '@/composables/usePageForm'
import PageForm from '@/layouts/PageForm.vue'
import Card from '@/components/Card.vue'
import FormField from '@/components/FormField.vue'
import Toggle from '@/components/Toggle.vue'
import Icon from '@/components/Icon.vue'

interface Model {

  band: 'a' | 'b'
  wirelessMode: string
  channel: string
  countryCode: string
  coverage: string
  fastboot: boolean
}

const MODES_2G = [
  { label: '802.11 b/g/n/ax (WiFi 6/4/3 兼容)', value: '6' },
  { label: '802.11 b/g/n (WiFi 4)', value: '4' },
  { label: '802.11 b/g 兼容', value: '3' },
  { label: '802.11 b 纯老设备', value: '1' },
]

const MODES_5G = [
  { label: '802.11 a/n/ac/ax (WiFi 6/5 高速模式)', value: '6' },
  { label: '802.11 a/n/ac (WiFi 5)', value: '5' },
  { label: '802.11 a/n (WiFi 4)', value: '4' },
]

const CHANNELS_2G = [
  { label: '自动信道选择（动态避扰）', value: '0' },
  { label: '信道 1 (2412 MHz · ★推荐主频)', value: '1' },
  { label: '信道 2 (2417 MHz)', value: '2' },
  { label: '信道 3 (2422 MHz)', value: '3' },
  { label: '信道 4 (2427 MHz)', value: '4' },
  { label: '信道 5 (2432 MHz)', value: '5' },
  { label: '信道 6 (2437 MHz · ★推荐主频)', value: '6' },
  { label: '信道 7 (2442 MHz)', value: '7' },
  { label: '信道 8 (2447 MHz)', value: '8' },
  { label: '信道 9 (2452 MHz)', value: '9' },
  { label: '信道 10 (2457 MHz)', value: '10' },
  { label: '信道 11 (2462 MHz · ★推荐主频)', value: '11' },
  { label: '信道 12 (2467 MHz)', value: '12' },
  { label: '信道 13 (2472 MHz)', value: '13' },
]

const CHANNELS_5G = [
  { label: '自动信道选择（动态避扰）', value: '0' },
  { label: '信道 36 (5180 MHz · ★低频纯净)', value: '36' },
  { label: '信道 40 (5200 MHz)', value: '40' },
  { label: '信道 44 (5220 MHz)', value: '44' },
  { label: '信道 48 (5240 MHz)', value: '48' },
  { label: '信道 52 (5260 MHz · DFS 频段)', value: '52' },
  { label: '信道 56 (5280 MHz · DFS 频段)', value: '56' },
  { label: '信道 60 (5300 MHz · DFS 频段)', value: '60' },
  { label: '信道 64 (5320 MHz · DFS 频段)', value: '64' },
  { label: '信道 149 (5745 MHz · ★高频穿透强)', value: '149' },
  { label: '信道 153 (5765 MHz)', value: '153' },
  { label: '信道 157 (5785 MHz)', value: '157' },
  { label: '信道 161 (5805 MHz · ★高频推荐)', value: '161' },
  { label: '信道 165 (5825 MHz)', value: '165' },
]

const COVERAGES = [
  { label: '近距省电', sub: '小范围 · 低功耗长续航', value: 'small_mode' },
  { label: '标准中距', sub: '默认均衡 · 室内通用', value: 'medium_mode' },
  { label: '强力广域', sub: '全功率覆盖 · 稍高耗电', value: 'large_mode' },
]

const COUNTRIES = [
  { label: '中国 (CN)', value: 'CN' },
  { label: '美国 (US)', value: 'US' },
  { label: '欧洲 (EU)', value: 'EU' },
  { label: '日本 (JP)', value: 'JP' },
]

function resolveCurrentBand(rawBand: string | undefined): 'a' | 'b' {
  const b = (rawBand || '').trim().toLowerCase()
  if (b === 'b' || b === '2.4g' || b === '2.4ghz') return 'b'
  return 'a'
}

const { model, raw, loading, saving, error, dirty, load, save, reset } = usePageForm<Model>({
  keys: [...WIFI_RADIO_KEYS, 'wifi_coverage', 'mgmt_quicken_power_on'],
  fromStatus: (s) => {
    const curBand = resolveCurrentBand(s.wifi_band)
    const isCur5g = curBand === 'a'
    return {
      band: curBand,
      wirelessMode: (isCur5g ? s.WirelessMode_5g : s.WirelessMode) || '6',
      channel: (isCur5g ? s.Channel_5g : s.Channel) || '0',
      countryCode: s.CountryCode || 'CN',
      coverage: s.wifi_coverage || 'medium_mode',
      fastboot: (s.mgmt_quicken_power_on ?? '0') === '1',
    }
  },
  toPayload: (m, r) => {
    const list: Record<string, string>[] = []
    const originBand = resolveCurrentBand(r.wifi_band)
    const isOrigin5g = originBand === 'a'
    const originMode = (isOrigin5g ? r.WirelessMode_5g : r.WirelessMode) || '6'
    const originChannel = (isOrigin5g ? r.Channel_5g : r.Channel) || '0'
    const originCountry = r.CountryCode || 'CN'

    const bandChanged = m.band !== originBand
    const radioChanged =
      bandChanged ||
      m.wirelessMode !== originMode ||
      m.channel !== originChannel ||
      m.countryCode !== originCountry

    if (radioChanged) {
      list.push(
        wifiInfo({
          wifiMode: m.wirelessMode,
          countryCode: m.countryCode,
          selectedChannel: m.channel,
          wifi_band: m.band,
          MAX_Access_num: r.MAX_Access_num || '16',
          m_MAX_Access_num: r.m_MAX_Access_num || '0',
        }),
      )
    }

    if (m.coverage !== (r.wifi_coverage || 'medium_mode')) {
      list.push(wifiCoverage(m.coverage))
    }

    if (m.fastboot !== ((r.mgmt_quicken_power_on ?? '0') === '1')) {
      list.push(setPowerOnSpeed(m.fastboot ? '1' : '0'))
    }

    return list
  },
  confirmText: (m) => {
    const originBand = resolveCurrentBand(raw.value.wifi_band)
    const isOrigin5g = originBand === 'a'
    const originChannel = (isOrigin5g ? raw.value.Channel_5g : raw.value.Channel) || '0'
    if (m.band !== originBand) {
      return `将 Wi-Fi 频段切换为 ${m.band === 'a' ? '5GHz' : '2.4GHz'}？切换期间无线热点将断开并重启，请在几秒后重新连接。`
    }
    if (m.channel !== originChannel && m.channel !== '0') {
      return '固定单信道后，周围同频干扰可能增大。确认继续？'
    }
    return null
  },
})

void load()

const isSelected5g = computed(() => model.value.band === 'a')
const modeOptions = computed(() => (isSelected5g.value ? MODES_5G : MODES_2G))
const channelOptions = computed(() => (isSelected5g.value ? CHANNELS_5G : CHANNELS_2G))

function handleBandSwitch(targetBand: 'a' | 'b'): void {
  if (model.value.band === targetBand) return
  model.value.band = targetBand
  if (targetBand === 'a') {
    model.value.wirelessMode = raw.value.WirelessMode_5g || '6'
    model.value.channel = raw.value.Channel_5g || '0'
  } else {
    model.value.wirelessMode = raw.value.WirelessMode || '6'
    model.value.channel = raw.value.Channel || '0'
  }
}
</script>

<template>
  <PageForm
    title="高级射频"
    :loading="loading"
    :saving="saving"
    :error="error"
    :dirty="dirty"
    @save="save()"
    @reset="reset()"
  >

    <Card>
      <div class="rf-hero-box">
        <div class="rf-hero-left">
          <div class="rf-icon-pill" :class="{ 'is-5g': isSelected5g }">
            <Icon name="sliders" :size="22" />
          </div>
          <div class="rf-hero-meta">
            <div class="rf-title-row">
              <span class="rf-band-name">{{ isSelected5g ? '5GHz 高频优先' : '2.4GHz 基础频段' }}</span>
              <span class="rf-badge num">{{ isSelected5g ? '5180~5825 MHz' : '2412~2472 MHz' }}</span>
              <span v-if="model.band !== resolveCurrentBand(raw.wifi_band)" class="rf-changed-tag">待保存切换</span>
            </div>
            <span class="t-cap">
              {{ isSelected5g ? '高速抗干扰 · 适合近距大流量传输与低时延游戏' : '广域穿透强 · 兼容传统老旧智能家居设备' }}
            </span>
          </div>
        </div>
      </div>

      <div class="band-toggle-grid">
        <button
          type="button"
          class="band-card"
          :class="{ 'is-active': model.band === 'a' }"
          @click="handleBandSwitch('a')"
        >
          <div class="band-card-head">
            <span class="band-card-title">5GHz 频段</span>
            <Icon v-if="model.band === 'a'" name="check" :size="16" class="check-ic" />
          </div>
          <span class="t-cap band-card-desc">WiFi 5/6 极速互联 · 干净避扰</span>
        </button>

        <button
          type="button"
          class="band-card"
          :class="{ 'is-active': model.band === 'b' }"
          @click="handleBandSwitch('b')"
        >
          <div class="band-card-head">
            <span class="band-card-title">2.4GHz 频段</span>
            <Icon v-if="model.band === 'b'" name="check" :size="16" class="check-ic" />
          </div>
          <span class="t-cap band-card-desc">超远距离覆盖 · 穿墙强</span>
        </button>
      </div>
    </Card>

    <Card :title="isSelected5g ? '5GHz 射频参数' : '2.4GHz 射频参数'">
      <FormField label="协议标准">
        <select v-model="model.wirelessMode">
          <option v-for="m in modeOptions" :key="m.value" :value="m.value">{{ m.label }}</option>
        </select>
      </FormField>

      <FormField label="工作信道">
        <select v-model="model.channel">
          <option v-for="c in channelOptions" :key="c.value" :value="c.value">{{ c.label }}</option>
        </select>
      </FormField>

      <FormField label="国家 / 地区代码">
        <select v-model="model.countryCode">
          <option v-for="c in COUNTRIES" :key="c.value" :value="c.value">{{ c.label }}</option>
        </select>
      </FormField>
    </Card>

    <Card title="发射功率覆盖">
      <div class="coverage-selector">
        <button
          v-for="c in COVERAGES"
          :key="c.value"
          type="button"
          class="cov-option"
          :class="{ 'is-active': model.coverage === c.value }"
          @click="model.coverage = c.value"
        >
          <span class="cov-label">{{ c.label }}</span>
          <span class="t-cap cov-sub">{{ c.sub }}</span>
        </button>
      </div>
    </Card>

    <Card>
      <div class="switch-row">
        <div>
          <p class="switch-title">快速开机模式</p>
          <p class="t-cap">跳过部分硬件冷启动冗长自检流程，加快开机时间</p>
        </div>
        <Toggle v-model="model.fastboot" label="快速开机" />
      </div>
    </Card>

    <Card title="底层射频明细">
      <div class="detail-rows">
        <div class="detail-row">
          <span class="t-cap">当前硬件生效频段</span>
          <span class="detail-val num">{{ resolveCurrentBand(raw.wifi_band) === 'a' ? '5GHz (Band A)' : '2.4GHz (Band B/G)' }}</span>
        </div>
        <div class="detail-row">
          <span class="t-cap">802.11n 吞吐能力</span>
          <span class="detail-val num">{{ (resolveCurrentBand(raw.wifi_band) === 'a' ? raw.wifi_11n_cap_5g : raw.wifi_11n_cap) || raw.wifi_11n_cap || '—' }}</span>
        </div>
        <div class="detail-row">
          <span class="t-cap">射频最大连接数</span>
          <span class="detail-val num">{{ raw.MAX_Access_num || '16' }} 台</span>
        </div>
      </div>
    </Card>
  </PageForm>
</template>

<style scoped>
.rf-hero-box { display: flex; align-items: center; justify-content: space-between; }
.rf-hero-left { display: flex; align-items: center; gap: var(--sp-3); min-width: 0; }
.rf-icon-pill { width: 44px; height: 44px; border-radius: var(--r-md); background: var(--c-surface-2); color: var(--c-text-3); display: flex; align-items: center; justify-content: center; flex: none; transition: all 0.2s ease; }
.rf-icon-pill.is-5g { background: var(--c-primary-50); color: var(--c-primary-400); }
[data-theme='dark'] .rf-icon-pill.is-5g { background: var(--c-primary-100); color: var(--c-primary-600); }
.rf-hero-meta { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.rf-title-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.rf-band-name { font-size: var(--fs-h2); font-weight: 700; color: var(--c-text-1); }
.rf-badge { font-size: 11px; font-weight: 600; padding: 1px 6px; border-radius: var(--r-sm); background: var(--c-surface-2); color: var(--c-text-2); }
.rf-changed-tag { font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: var(--r-sm); background: #fef3c7; color: #b45309; }
[data-theme='dark'] .rf-changed-tag { background: rgba(245, 158, 11, 0.2); color: #fbbf24; }

.band-toggle-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-2); margin-top: var(--sp-3); padding-top: var(--sp-3); border-top: 1px solid var(--c-line); }
@media (max-width: 480px) { .band-toggle-grid { grid-template-columns: 1fr; } }
.band-card { display: flex; flex-direction: column; gap: 4px; padding: 10px 12px; border-radius: var(--r-sm); border: 1px solid var(--c-line); background: var(--c-surface); text-align: left; cursor: pointer; transition: all 0.15s ease; }
.band-card:hover { border-color: var(--c-primary-400); }
.band-card.is-active { border-color: var(--c-primary-400); background: var(--c-primary-50); box-shadow: 0 0 0 1px var(--c-primary-400); }
[data-theme='dark'] .band-card.is-active { background: rgba(34, 181, 134, 0.15); }
.band-card-head { display: flex; align-items: center; justify-content: space-between; }
.band-card-title { font-size: 13px; font-weight: 700; color: var(--c-text-1); }
.check-ic { color: var(--c-primary-400); }
.band-card-desc { font-size: 11px; }

.coverage-selector { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--sp-2); }
@media (max-width: 480px) { .coverage-selector { grid-template-columns: 1fr; } }
.cov-option { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 10px 8px; border-radius: var(--r-sm); border: 1px solid var(--c-line); background: var(--c-surface); cursor: pointer; transition: all 0.15s ease; text-align: center; }
.cov-option:hover { border-color: var(--c-primary-400); }
.cov-option.is-active { border-color: var(--c-primary-400); background: var(--c-primary-50); box-shadow: 0 0 0 1px var(--c-primary-400); }
[data-theme='dark'] .cov-option.is-active { background: rgba(34, 181, 134, 0.15); }
.cov-label { font-size: 13px; font-weight: 700; color: var(--c-text-1); }
.cov-sub { font-size: 10px; }

.switch-row { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-3); }
.switch-title { font-size: var(--fs-body); font-weight: 600; }
.detail-rows { display: flex; flex-direction: column; gap: 8px; }
.detail-row { display: flex; align-items: center; justify-content: space-between; padding: 4px 0; }
.detail-row + .detail-row { border-top: 1px solid var(--c-line); }
.detail-val { font-size: 13px; font-weight: 600; color: var(--c-text-1); }
</style>
