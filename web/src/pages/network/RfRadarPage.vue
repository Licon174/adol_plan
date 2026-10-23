<script setup lang="ts">import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { getStatus, post } from '@/api'
import { parseRelayScan, type RelayAp } from '@/utils/parse'
import { toast } from '@/components/toast'
import PageForm from '@/layouts/PageForm.vue'
import Card from '@/components/Card.vue'
import Icon from '@/components/Icon.vue'
import SignalBars from '@/components/SignalBars.vue'

const route = useRoute()

type RadarTab = 'cellular' | 'wifi'
const activeTab = ref<RadarTab>(
  (route.query.tab as RadarTab) || (route.path.startsWith('/wifi') ? 'wifi' : 'cellular'),
)

const loading = ref(true)
const scanning = ref(false)
const raw = ref<Record<string, string>>({})
const aps = ref<RelayAp[]>([])
const selectedApMac = ref<string | null>(null)

let scanPollTimer: ReturnType<typeof setTimeout> | undefined

const CELL_RADAR_KEYS = [
  'nv_pci',
  'nv_arfcn',
  'lte_band',
  'nv_sinr',
  'nv_rsrq',
  'lte_rsrp',
  'rssi',
  'nv_globecellid',
  'cell_id',
  'csq',
  'network_provider',
  'network_type',
  'cr_version',
  'imei',
  'scan_finish',
  'EX_APLIST',
  'EX_APLIST1',
  'wifi_sta_connection',
  'wifi_band',
  'wifi_channel',
  'channel_5g',
] as const

async function loadData(): Promise<void> {
  try {
    const s = (await getStatus(CELL_RADAR_KEYS)) as Record<string, string>
    raw.value = s
    if (!scanning.value) {
      const list = parseRelayScan(s)
      if (list.length > 0) {
        aps.value = list
        if (!selectedApMac.value) {
          selectedApMac.value = list[0]?.mac || null
        }
      }
    }
  } catch {

  } finally {
    loading.value = false
  }
}

async function triggerWifiScan(): Promise<void> {
  if (scanning.value) return
  scanning.value = true
  toast('正在扫描周边 WiFi 信道频谱…', 'info')

  try {
    if ((raw.value.wifi_sta_connection ?? '0') !== '1') {
      await post({ goformId: 'WIFI_STA_CONTROL', wifi_sta_connection: '1' }).catch(() => {})
    }
    await post({ goformId: 'WLAN_SET_STA_REFRESH' })
  } catch {

  }

  let attempts = 0
  const maxAttempts = 15

  const checkScan = async () => {
    attempts++
    try {
      const res = await getStatus(['scan_finish', 'EX_APLIST', 'EX_APLIST1', 'wifi_band', 'wifi_channel'])
      if (res.scan_finish === '1' || attempts >= maxAttempts) {
        if (res.wifi_band) raw.value.wifi_band = res.wifi_band
        const list = parseRelayScan(res)
        if (list.length > 0) {
          aps.value = list
          if (!selectedApMac.value || !list.some((a) => a.mac === selectedApMac.value)) {
            selectedApMac.value = list[0]?.mac || null
          }
          toast(`频谱已更新，共 ${list.length} 个热点`, 'success')
        } else if (attempts >= maxAttempts) {
          toast('扫描完成，未发现新信号', 'info')
        }
        scanning.value = false
        return
      }
    } catch {

    }
    if (scanning.value) {
      scanPollTimer = setTimeout(checkScan, 1000)
    }
  }

  scanPollTimer = setTimeout(checkScan, 1200)
}

onMounted(async () => {
  await loadData()
  if (activeTab.value === 'wifi' && aps.value.length === 0) {
    void triggerWifiScan()
  }
})

watch(activeTab, (tab) => {
  if (tab === 'wifi' && aps.value.length === 0 && !scanning.value) {
    void triggerWifiScan()
  }
})

onUnmounted(() => {
  if (scanPollTimer) clearTimeout(scanPollTimer)
})

const cellPci = computed(() => raw.value.nv_pci || '—')
const cellArfcn = computed(() => Number.parseInt(raw.value.nv_arfcn || '0', 10) || 0)
const cellBand = computed(() => raw.value.lte_band || '—')
const cellRsrp = computed(() => {
  const n = Number.parseFloat(raw.value.lte_rsrp || raw.value.rssi || '')
  return Number.isFinite(n) && n !== 0 ? n : -89
})
const cellSinr = computed(() => {
  const n = Number.parseFloat(raw.value.nv_sinr || '')
  return Number.isFinite(n) ? n : 13
})
const cellRsrq = computed(() => raw.value.nv_rsrq || '—')
const cellCsq = computed(() => raw.value.csq || '—')
const cellProvider = computed(() => raw.value.network_provider || '蜂窝网络')

const cellCenterFreq = computed(() => {
  const n = cellArfcn.value
  if (!n) return '1805.0 MHz'
  if (n >= 1200 && n <= 1949) return `${(1805 + 0.1 * (n - 1200)).toFixed(1)} MHz`
  if (n >= 0 && n <= 599) return `${(2110 + 0.1 * n).toFixed(1)} MHz`
  if (n >= 2400 && n <= 2649) return `${(869 + 0.1 * (n - 2400)).toFixed(1)} MHz`
  if (n >= 3450 && n <= 3799) return `${(925 + 0.1 * (n - 3450)).toFixed(1)} MHz`
  if (n >= 38650 && n <= 39649) return `${(2300 + 0.1 * (n - 38650)).toFixed(1)} MHz`
  if (n >= 39650 && n <= 41589) return `${(2496 + 0.1 * (n - 39650)).toFixed(1)} MHz`
  return `${n}`
})

const cellTopology = computed(() => {
  const gid = Number.parseInt(raw.value.nv_globecellid || '108967189', 10) || 108967189
  const enodeb = Math.floor(gid / 256)
  const sector = gid % 256
  return {
    enodeb: String(enodeb),
    sector: String(sector),
    hex: `0x${gid.toString(16).toUpperCase()}`,
  }
})

const activeSectorIdx = computed(() => {
  const s = Number.parseInt(cellTopology.value.sector, 10) || 0
  return s % 3
})

const sectorDirections = [
  { id: 0, centerAngle: 60, name: '扇区 0', label: '60° 东北' },
  { id: 1, centerAngle: 180, name: '扇区 1', label: '180° 正南' },
  { id: 2, centerAngle: 300, name: '扇区 2', label: '300° 西北' },
]

function makeCardioidLobePath(centerAngle: number, maxRadius = 110): string {
  const cx = 160
  const cy = 160
  const rad = (centerAngle * Math.PI) / 180
  const leftRad = ((centerAngle - 52) * Math.PI) / 180
  const rightRad = ((centerAngle + 52) * Math.PI) / 180

  const lx = cx + (maxRadius * 0.65) * Math.sin(leftRad)
  const ly = cy - (maxRadius * 0.65) * Math.cos(leftRad)
  const px = cx + maxRadius * Math.sin(rad)
  const py = cy - maxRadius * Math.cos(rad)
  const rx = cx + (maxRadius * 0.65) * Math.sin(rightRad)
  const ry = cy - (maxRadius * 0.65) * Math.cos(rightRad)

  return `M ${cx} ${cy} C ${cx} ${cy}, ${lx.toFixed(1)} ${ly.toFixed(1)}, ${px.toFixed(1)} ${py.toFixed(1)} C ${rx.toFixed(1)} ${ry.toFixed(1)}, ${cx} ${cy}, ${cx} ${cy} Z`
}

const signalQualityVerdict = computed(() => {
  const rsrp = cellRsrp.value
  const sinr = cellSinr.value
  if (rsrp >= -85 && sinr >= 15) return { label: '极佳', color: '#10b981', badge: '强场覆盖' }
  if (rsrp >= -95 && sinr >= 5) return { label: '良好', color: '#0ea5e9', badge: '良好覆盖' }
  if (rsrp >= -105) return { label: '中等', color: '#f59e0b', badge: '中等覆盖' }
  return { label: '较弱', color: '#ef4444', badge: '弱信号' }
})

const isWifi5g = computed(() => (raw.value.wifi_band ?? 'a').trim() === 'a')

export interface SpectrumCurve {
  ap: RelayAp
  channel: number
  dbm: number
  pathData: string
  peakX: number
  peakY: number
  badgeX: number
  badgeY: number
  color: string
}

const PALETTE = [
  '#10b981', '#0ea5e9', '#8b5cf6', '#f59e0b',
  '#ec4899', '#06b6d4', '#84cc16', '#3b82f6',
]

const CHANNELS_5G = [36, 40, 44, 48, 52, 56, 60, 64]
const CHANNELS_24 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]

const activeChannelsList = computed(() => {
  return isWifi5g.value ? CHANNELS_5G : CHANNELS_24
})

function getApDbm(signalStr: string): number {
  const lv = Number.parseInt(signalStr, 10)
  if (Number.isNaN(lv)) return -85

  return -92 + Math.max(0, Math.min(5, lv)) * 8
}

function buildCurves(
  list: RelayAp[],
  minCh: number,
  maxCh: number,
  spreadCh: number,
): SpectrumCurve[] {
  const axisLeft = 72
  const axisRight = 482
  const axisWidth = axisRight - axisLeft
  const plotBottom = 152
  const plotHeight = 118

  const chRankMap: Record<number, number> = {}
  const placedBadges: Array<{ x: number; y: number }> = []

  return list.map((ap, idx) => {
    const ch = Number.parseInt(ap.channel, 10) || minCh
    const rankInCh = chRankMap[ch] || 0
    chRankMap[ch] = rankInCh + 1

    const baseDbm = getApDbm(ap.signal)

    const visualDbm = Math.max(-96, baseDbm - rankInCh * 4)

    const normCh = Math.max(minCh, Math.min(maxCh, ch))
    const cx = axisLeft + ((normCh - minCh) / (maxCh - minCh)) * axisWidth
    const spreadPx = (spreadCh / (maxCh - minCh)) * axisWidth

    const normDbm = Math.min(-40, Math.max(-100, visualDbm))

    const peakY = plotBottom - ((normDbm - (-100)) / 60) * plotHeight
    const ctrlY = 2 * peakY - plotBottom

    const x1 = Math.max(36, cx - spreadPx)
    const x2 = Math.min(525, cx + spreadPx)
    const path = `M ${x1.toFixed(1)} ${plotBottom} Q ${cx.toFixed(1)} ${ctrlY.toFixed(1)} ${x2.toFixed(1)} ${plotBottom} Z`

    const badgeX = Math.max(76, Math.min(490, cx))
    let badgeY = Math.max(15, peakY - 9)
    let guard = 0
    while (
      guard < 12 &&
      placedBadges.some((p) => Math.abs(p.x - badgeX) < 74 && Math.abs(p.y - badgeY) < 15)
    ) {
      badgeY += 15
      if (badgeY > plotBottom - 8) {
        badgeY = 15 + guard * 14
      }
      guard++
    }
    placedBadges.push({ x: badgeX, y: badgeY })

    return {
      ap,
      channel: ch,
      dbm: baseDbm,
      pathData: path,
      peakX: cx,
      peakY,
      badgeX,
      badgeY,
      color: PALETTE[idx % PALETTE.length] || '#10b981',
    }
  })
}

const activeSpectrumCurves = computed<SpectrumCurve[]>(() => {
  if (isWifi5g.value) {
    const list = aps.value.filter((ap) => {
      const ch = Number.parseInt(ap.channel, 10) || 1
      return ch >= 36 && ch <= 64
    })
    return buildCurves(list, 36, 64, 4.2)
  } else {
    const list = aps.value.filter((ap) => {
      const ch = Number.parseInt(ap.channel, 10) || 1
      return ch <= 14
    })
    return buildCurves(list, 1, 13, 2.0)
  }
})

const channelStats = computed(() => {
  const count: Record<number, number> = {}
  for (const a of aps.value) {
    const ch = Number.parseInt(a.channel, 10) || 1
    count[ch] = (count[ch] || 0) + 1
  }

  const candidates = isWifi5g.value ? [36, 40, 44, 48, 52, 56, 60, 64] : [1, 6, 11]
  let bestCh = candidates[0] || 36
  let minCount = Infinity
  for (const c of candidates) {
    const v = count[c] || 0
    if (v < minCount) {
      minCount = v
      bestCh = c
    }
  }

  return { count, bestCh, candidates }
})

async function copyText(text: string, label: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
    toast(`已复制${label}：${text}`, 'success')
  } catch {
    toast(`复制失败：${text}`, 'error')
  }
}
</script>

<template>
  <PageForm title="射频与信号雷达" :savable="false">
    <div class="rf-radar-container">

      <div class="radar-domain-tabs">
        <button
          type="button"
          class="domain-tab-btn"
          :class="{ 'is-active': activeTab === 'cellular' }"
          @click="activeTab = 'cellular'"
        >
          <Icon name="radio-tower" :size="15" />
          <span class="tab-label">4G 基站</span>
        </button>

        <button
          type="button"
          class="domain-tab-btn"
          :class="{ 'is-active': activeTab === 'wifi' }"
          @click="activeTab = 'wifi'"
        >
          <Icon name="wifi" :size="15" />
          <span class="tab-label">WiFi 信道频谱</span>
          <span class="tab-badge num">{{ aps.length }}</span>
        </button>
      </div>

      <template v-if="activeTab === 'cellular'">

        <Card title="物理层指标">
          <template #action>
            <router-link to="/network/select" class="link-action">锁频/锁小区 ›</router-link>
          </template>

          <div class="gauges-flex-row">
            <div class="semi-gauge-card">
              <div class="gauge-title-line">
                <span class="gauge-name">RSRP 接收功率</span>
                <span class="gauge-status-tag" :style="{ color: signalQualityVerdict.color }">
                  {{ signalQualityVerdict.badge }}
                </span>
              </div>
              <div class="gauge-numeric-box">
                <span class="gauge-big-num num">{{ cellRsrp }}</span>
                <span class="gauge-unit">dBm</span>
              </div>
              <div class="gauge-bar-track">
                <div
                  class="gauge-bar-fill"
                  :style="{
                    width: `${Math.min(100, Math.max(0, ((cellRsrp + 140) / 96) * 100))}%`,
                    background: signalQualityVerdict.color,
                  }"
                />
              </div>
            </div>

            <div class="semi-gauge-card">
              <div class="gauge-title-line">
                <span class="gauge-name">SINR 信噪比</span>
                <span class="gauge-status-tag text-accent">
                  {{ cellSinr >= 12 ? '优质抗噪' : '一般' }}
                </span>
              </div>
              <div class="gauge-numeric-box">
                <span class="gauge-big-num num">{{ cellSinr }}</span>
                <span class="gauge-unit">dB</span>
              </div>
              <div class="gauge-bar-track">
                <div
                  class="gauge-bar-fill fill-blue"
                  :style="{
                    width: `${Math.min(100, Math.max(0, ((cellSinr + 5) / 35) * 100))}%`,
                  }"
                />
              </div>
            </div>
          </div>

          <div class="cell-params-grid">
            <div class="param-item">
              <span class="param-k">运营商与频段</span>
              <span class="param-v num text-accent">{{ cellProvider }} B{{ cellBand }}</span>
            </div>
            <div class="param-item">
              <span class="param-k">中心频率</span>
              <span class="param-v num">{{ cellCenterFreq }}</span>
            </div>
            <div class="param-item">
              <span class="param-k">物理小区 PCI</span>
              <span class="param-v num">{{ cellPci }}</span>
            </div>
            <div class="param-item">
              <span class="param-k">频点 EARFCN</span>
              <span class="param-v num">{{ cellArfcn }}</span>
            </div>
            <div class="param-item">
              <span class="param-k">参考质量 RSRQ</span>
              <span class="param-v num">{{ cellRsrq }}</span>
            </div>
            <div class="param-item">
              <span class="param-k">CSQ 电平</span>
              <span class="param-v num">{{ cellCsq }}</span>
            </div>
            <div class="param-item">
              <span class="param-k">宏基站 eNodeB</span>
              <span class="param-v num">{{ cellTopology.enodeb }}</span>
            </div>
            <div class="param-item">
              <span class="param-k">服务扇区</span>
              <span class="param-v num text-accent">第 {{ cellTopology.sector }} 扇区</span>
            </div>
          </div>
        </Card>

        <Card title="基站扇区方位">
          <template #action>
            <span class="sector-summary-badge num">
              第 {{ cellTopology.sector }} 扇区 · {{ sectorDirections[activeSectorIdx]?.label }}
            </span>
          </template>

          <div class="tactical-radar-wrapper">
            <svg class="tactical-radar-svg" viewBox="0 0 320 320">
              <defs>
                <radialGradient id="deepRadarBg" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stop-color="#0b1329" />
                  <stop offset="70%" stop-color="#040714" />
                  <stop offset="100%" stop-color="#010309" />
                </radialGradient>

                <radialGradient id="activeBeamGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stop-color="#8b5cf6" stop-opacity="0.2" />
                  <stop offset="65%" stop-color="#8b5cf6" stop-opacity="0.55" />
                  <stop offset="100%" stop-color="#c084fc" stop-opacity="0.85" />
                </radialGradient>
              </defs>

              <circle cx="160" cy="160" r="150" fill="url(#deepRadarBg)" stroke="#1e293b" stroke-width="2" />

              <g class="tactical-bezel-ticks">
                <circle cx="160" cy="160" r="148" fill="none" stroke="rgba(148, 163, 184, 0.25)" stroke-width="1.2" />
                <line
                  v-for="deg in [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330]"
                  :key="deg"
                  :x1="160 + 142 * Math.sin((deg * Math.PI) / 180)"
                  :y1="160 - 142 * Math.cos((deg * Math.PI) / 180)"
                  :x2="160 + 148 * Math.sin((deg * Math.PI) / 180)"
                  :y2="160 - 148 * Math.cos((deg * Math.PI) / 180)"
                  stroke="rgba(148, 163, 184, 0.55)"
                  stroke-width="1.5"
                />
              </g>

              <g class="range-rings">
                <circle cx="160" cy="160" r="115" fill="none" stroke="rgba(148, 163, 184, 0.12)" stroke-width="1" />
                <circle cx="160" cy="160" r="80" fill="none" stroke="rgba(148, 163, 184, 0.14)" stroke-dasharray="3 3" />
                <circle cx="160" cy="160" r="45" fill="none" stroke="rgba(148, 163, 184, 0.16)" stroke-dasharray="3 3" />
                <line x1="160" y1="20" x2="160" y2="300" stroke="rgba(148, 163, 184, 0.15)" stroke-width="1" />
                <line x1="20" y1="160" x2="300" y2="160" stroke="rgba(148, 163, 184, 0.15)" stroke-width="1" />
              </g>

              <g class="cardinal-badges">
                <rect x="151" y="6" width="18" height="13" rx="3" fill="#ef4444" />
                <text x="160" y="16" text-anchor="middle" class="cardinal-txt is-bold num">N</text>
                <text x="306" y="164" text-anchor="middle" class="cardinal-txt num">E</text>
                <text x="160" y="313" text-anchor="middle" class="cardinal-txt num">S</text>
                <text x="14" y="164" text-anchor="middle" class="cardinal-txt num">W</text>
              </g>

              <g class="antenna-sectors">
                <g
                  v-for="sec in sectorDirections"
                  :key="sec.id"
                  class="sector-lobe-group"
                  :class="{ 'is-active-lobe': activeSectorIdx === sec.id }"
                >
                  <path
                    :d="makeCardioidLobePath(sec.centerAngle, 115)"
                    :fill="activeSectorIdx === sec.id ? 'url(#activeBeamGlow)' : 'rgba(30, 41, 59, 0.35)'"
                    :stroke="activeSectorIdx === sec.id ? '#c084fc' : 'rgba(100, 116, 139, 0.35)'"
                    :stroke-width="activeSectorIdx === sec.id ? 2.5 : 1"
                  />

                  <g v-if="activeSectorIdx === sec.id" class="wave-pulses">
                    <path
                      :d="makeCardioidLobePath(sec.centerAngle, 65)"
                      fill="none"
                      stroke="#c084fc"
                      stroke-width="1.8"
                      stroke-dasharray="4 3"
                      opacity="0.85"
                    />
                    <path
                      :d="makeCardioidLobePath(sec.centerAngle, 90)"
                      fill="none"
                      stroke="#a855f7"
                      stroke-width="2"
                      opacity="0.95"
                    />
                  </g>

                  <text
                    :x="160 + 128 * Math.sin((sec.centerAngle * Math.PI) / 180)"
                    :y="160 - 128 * Math.cos((sec.centerAngle * Math.PI) / 180)"
                    text-anchor="middle"
                    class="sector-txt num"
                    :class="{ 'is-active-txt': activeSectorIdx === sec.id }"
                  >
                    {{ sec.name }} ({{ sec.label }})
                  </text>
                </g>
              </g>

              <g
                class="target-lock-reticle"
                :transform="`translate(${160 + 100 * Math.sin((sectorDirections[activeSectorIdx]?.centerAngle! * Math.PI) / 180)}, ${160 - 100 * Math.cos((sectorDirections[activeSectorIdx]?.centerAngle! * Math.PI) / 180)})`"
              >
                <circle cx="0" cy="0" r="10" fill="none" stroke="#f59e0b" stroke-width="1.8" stroke-dasharray="3 2" />
                <circle cx="0" cy="0" r="3" fill="#f59e0b" />
              </g>

              <g class="radar-origin-reticle">
                <circle cx="160" cy="160" r="8" fill="#0f172a" stroke="#8b5cf6" stroke-width="1.8" />
                <circle cx="160" cy="160" r="2.8" fill="#10b981" />
                <line x1="160" y1="148" x2="160" y2="172" stroke="rgba(167, 139, 250, 0.45)" stroke-width="1" />
                <line x1="148" y1="160" x2="172" y2="160" stroke="rgba(167, 139, 250, 0.45)" stroke-width="1" />
              </g>
            </svg>
          </div>
        </Card>
      </template>

      <template v-else>

        <Card title="WiFi 信道频谱">
          <template #action>
            <div class="spectrum-ctrl-row">
              <span class="band-mode-badge num">
                {{ isWifi5g ? '5 GHz 频段' : '2.4 GHz 频段' }}
              </span>
              <button
                type="button"
                class="btn-rescan-wifi"
                :disabled="scanning"
                @click="triggerWifiScan"
              >
                <Icon name="refresh" :size="12" :class="{ 'is-spinning': scanning }" />
                <span>{{ scanning ? '扫描中' : '刷新' }}</span>
              </button>
            </div>
          </template>

          <div class="spectrum-viewport">
            <div v-if="activeSpectrumCurves.length === 0" class="spectrum-empty-box">
              <Icon name="wifi-off" :size="20" />
              <span>当前 {{ isWifi5g ? '5GHz' : '2.4GHz' }} 射频未扫到信号，点击右上角「刷新」</span>
            </div>

            <svg
              v-else
              class="spectrum-svg"
              viewBox="0 0 540 176"
            >

              <g class="grid-lines">
                <line x1="40" y1="22" x2="520" y2="22" stroke="rgba(255,255,255,0.08)" />
                <line x1="40" y1="65" x2="520" y2="65" stroke="rgba(255,255,255,0.08)" />
                <line x1="40" y1="108" x2="520" y2="108" stroke="rgba(255,255,255,0.08)" />
                <line x1="40" y1="152" x2="520" y2="152" stroke="rgba(255,255,255,0.22)" />
              </g>

              <g class="axis-y-labels">
                <text x="34" y="26" text-anchor="end" class="svg-axis-txt num">-40</text>
                <text x="34" y="69" text-anchor="end" class="svg-axis-txt num">-60</text>
                <text x="34" y="112" text-anchor="end" class="svg-axis-txt num">-80</text>
                <text x="34" y="155" text-anchor="end" class="svg-axis-txt num">-100</text>
              </g>

              <g class="axis-x-labels">
                <g
                  v-for="(ch, idx) in activeChannelsList"
                  :key="ch"
                  :transform="`translate(${72 + (idx / (activeChannelsList.length - 1)) * (482 - 72)}, 0)`"
                >
                  <line x1="0" y1="152" x2="0" y2="156" stroke="rgba(255,255,255,0.3)" stroke-width="1" />
                  <text
                    x="0"
                    y="169"
                    text-anchor="middle"
                    class="svg-channel-txt num"
                    :class="{ 'is-best-ch': ch === channelStats.bestCh }"
                  >
                    {{ ch }}
                  </text>
                </g>
              </g>

              <g class="ap-parabolas">
                <g
                  v-for="target in activeSpectrumCurves"
                  :key="`curve-${target.ap.mac}`"
                  class="ap-curve-group"
                  :class="{ 'is-selected': selectedApMac === target.ap.mac }"
                  @click="selectedApMac = target.ap.mac"
                >
                  <path
                    :d="target.pathData"
                    :fill="target.color"
                    fill-opacity="0.22"
                    :stroke="target.color"
                    stroke-width="2"
                  />
                  <circle :cx="target.peakX" :cy="target.peakY" r="3.5" :fill="target.color" />
                </g>
              </g>

              <g class="ap-badges-top-layer">
                <g
                  v-for="target in activeSpectrumCurves"
                  :key="`badge-${target.ap.mac}`"
                  class="peak-badge-group"
                  @click="selectedApMac = target.ap.mac"
                >
                  <line
                    v-if="Math.abs(target.badgeY - target.peakY) > 14"
                    :x1="target.peakX"
                    :y1="target.peakY"
                    :x2="target.badgeX"
                    :y2="target.badgeY"
                    :stroke="target.color"
                    stroke-width="0.9"
                    stroke-dasharray="2 2"
                    opacity="0.75"
                  />
                  <rect
                    :x="target.badgeX - 38"
                    :y="target.badgeY - 10"
                    width="76"
                    height="13"
                    rx="3"
                    fill="rgba(4, 9, 20, 0.9)"
                    :stroke="selectedApMac === target.ap.mac ? '#f59e0b' : target.color"
                    :stroke-width="selectedApMac === target.ap.mac ? 1.5 : 1"
                  />
                  <text
                    :x="target.badgeX"
                    :y="target.badgeY - 1"
                    text-anchor="middle"
                    class="svg-peak-label num"
                    :fill="selectedApMac === target.ap.mac ? '#fde68a' : target.color"
                  >
                    {{ target.ap.ssid ? target.ap.ssid.slice(0, 7) : '隐藏' }} {{ target.dbm }}
                  </text>
                </g>
              </g>
            </svg>
          </div>

          <div class="channel-quick-strip" :class="{ 'is-24g': !isWifi5g }">
            <div
              v-for="c in channelStats.candidates"
              :key="c"
              class="ch-mini-pill num"
              :class="{
                'is-best': c === channelStats.bestCh,
                'is-crowded': (channelStats.count[c] || 0) >= 3,
              }"
            >
              <span class="ch-num">CH{{ c }}</span>
              <span class="ch-cnt">
                {{ c === channelStats.bestCh ? '★推荐' : `${channelStats.count[c] || 0}个` }}
              </span>
            </div>
          </div>
        </Card>

        <Card :title="`周边信号列表 (${aps.length})`">
          <div v-if="aps.length === 0" class="empty-hint">
            <span>当前未扫描到周边热点，请点击上方「刷新」</span>
          </div>
          <div v-else class="ap-item-list">
            <div
              v-for="(item, idx) in aps"
              :key="item.mac"
              class="ap-row-card"
              :class="{ 'is-active-row': selectedApMac === item.mac }"
              @click="selectedApMac = item.mac"
            >
              <div class="ap-row-idx num">#{{ idx + 1 }}</div>
              <div class="ap-row-info">
                <div class="ap-row-top">
                  <span class="ap-row-ssid">{{ item.ssid || '(隐藏 SSID)' }}</span>
                  <span class="ap-row-band num">CH {{ item.channel }}</span>
                  <span class="ap-row-enc num">{{ item.authMode || 'OPEN' }}</span>
                </div>
                <div class="ap-row-sub num" @click.stop="copyText(item.mac, 'BSSID')">
                  <span>{{ item.mac }}</span>
                  <Icon name="copy" :size="10" class="copy-ic" />
                  <span>· {{ item.encryptType || 'NONE' }}</span>
                </div>
              </div>
              <div class="ap-row-signal">
                <SignalBars :bars="Number(item.signal) || 1" :total="5" />
                <span class="ap-row-dbm num">{{ getApDbm(item.signal) }} dBm</span>
              </div>
            </div>
          </div>
        </Card>
      </template>
    </div>
  </PageForm>
</template>

<style scoped>
.rf-radar-container {
  max-width: 100%;
  overflow-x: hidden;
  box-sizing: border-box;
}

.radar-domain-tabs {
  display: flex;
  gap: 8px;
  background: var(--c-surface-2);
  padding: 4px;
  border-radius: 12px;
  border: 1px solid var(--c-border);
  margin-bottom: 10px;
}
.domain-tab-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 10px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--c-text-2);
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}
.domain-tab-btn.is-active {
  background: var(--c-surface-1);
  color: var(--c-primary-500);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}
.tab-label {
  font-size: 13px;
  font-weight: 700;
}
.tab-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 999px;
  background: rgba(var(--c-primary-rgb, 16, 185, 129), 0.12);
  color: var(--c-primary-500);
}

.gauges-flex-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  margin-bottom: 8px;
  width: 100%;
  box-sizing: border-box;
}
.semi-gauge-card {
  background: var(--c-surface-2);
  border: 1px solid var(--c-border);
  border-radius: 10px;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  min-width: 0;
  box-sizing: border-box;
}
.gauge-title-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.gauge-name { font-size: 10px; font-weight: 600; color: var(--c-text-2); }
.gauge-status-tag { font-size: 10px; font-weight: 700; }

.gauge-numeric-box {
  display: flex;
  align-items: baseline;
  gap: 3px;
  margin: 3px 0;
}
.gauge-big-num {
  font-size: 20px;
  font-weight: 800;
  color: var(--c-text-1);
}
.gauge-unit { font-size: 10px; color: var(--c-text-3); }

.gauge-bar-track {
  height: 4px;
  border-radius: 999px;
  background: var(--c-surface-3, rgba(0,0,0,0.08));
  overflow: hidden;
}
.gauge-bar-fill {
  height: 100%;
  border-radius: 999px;
  transition: width 0.3s ease;
}
.fill-blue { background: #0ea5e9; }

.cell-params-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
  width: 100%;
  box-sizing: border-box;
}
.param-item {
  background: var(--c-surface-2);
  border: 1px solid var(--c-border);
  border-radius: 8px;
  padding: 5px 8px;
  display: flex;
  flex-direction: column;
  min-width: 0;
  box-sizing: border-box;
}
.param-k {
  font-size: 9px;
  color: var(--c-text-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.param-v {
  font-size: 12px;
  font-weight: 800;
  color: var(--c-text-1);
  margin-top: 1px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.text-accent {
  color: #10b981 !important;
}

.sector-summary-badge {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 6px;
  background: rgba(139, 92, 246, 0.14);
  color: #c084fc;
}
.tactical-radar-wrapper {
  display: flex;
  justify-content: center;
  padding: 4px 0;
  width: 100%;
}
.tactical-radar-svg {
  width: 100%;
  max-width: 240px;
  height: auto;
  aspect-ratio: 1;
  display: block;
  user-select: none;
}
.cardinal-txt {
  font-size: 9px;
  font-weight: 800;
  fill: rgba(148, 163, 184, 0.7);
}
.cardinal-txt.is-bold {
  fill: #fff;
  font-size: 10px;
}
.sector-lobe-group {
  transition: all 0.3s ease;
}
.sector-txt {
  font-size: 8px;
  font-weight: 700;
  fill: rgba(148, 163, 184, 0.55);
}
.sector-txt.is-active-txt {
  fill: #c084fc;
  font-weight: 900;
}

.spectrum-ctrl-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.band-mode-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 5px;
  background: rgba(16, 185, 129, 0.12);
  color: #10b981;
}
.btn-rescan-wifi {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 6px;
  border: 1px solid var(--c-primary-400);
  background: rgba(var(--c-primary-rgb, 16, 185, 129), 0.1);
  color: var(--c-primary-500);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
}
.is-spinning { animation: spin 1s linear infinite; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

.spectrum-viewport {
  width: 100%;
  padding: 2px 0;
  box-sizing: border-box;
}
.spectrum-empty-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 28px 12px;
  color: var(--c-text-3);
  font-size: 11px;
}
.spectrum-svg {
  display: block;
  width: 100%;
  height: auto;
  background: radial-gradient(circle at bottom, rgba(16, 185, 129, 0.05) 0%, rgba(0, 0, 0, 0.32) 100%);
  border-radius: 10px;
}
.svg-axis-txt {
  font-size: 8px;
  fill: rgba(255, 255, 255, 0.45);
}
.svg-channel-txt {
  font-size: 10px;
  font-weight: 700;
  fill: rgba(255, 255, 255, 0.72);
}
.svg-channel-txt.is-best-ch {
  fill: #10b981;
  font-weight: 900;
}
.ap-curve-group {
  cursor: pointer;
}
.ap-curve-group:hover path {
  fill-opacity: 0.42;
  stroke-width: 2.6;
}
.ap-curve-group.is-selected path {
  fill-opacity: 0.5;
  stroke-width: 3;
  stroke: #f59e0b;
}
.svg-peak-label {
  font-size: 7.5px;
  font-weight: 800;
  pointer-events: none;
}

.channel-quick-strip {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 5px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed var(--c-line);
}
.channel-quick-strip.is-24g {
  grid-template-columns: repeat(3, 1fr);
}
.ch-mini-pill {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 7px;
  border-radius: 5px;
  background: var(--c-surface-2);
  border: 1px solid var(--c-border);
  font-size: 10px;
  min-width: 0;
  box-sizing: border-box;
}
.peak-badge-group {
  cursor: pointer;
}
.ch-mini-pill.is-best {
  border-color: #10b981;
  background: rgba(16, 185, 129, 0.12);
}
.ch-mini-pill.is-crowded {
  border-color: rgba(245, 158, 11, 0.45);
}
.ch-num {
  font-weight: 800;
  color: var(--c-text-1);
}
.ch-cnt {
  font-size: 9px;
  color: var(--c-text-3);
}
.ch-mini-pill.is-best .ch-cnt {
  color: #10b981;
  font-weight: 800;
}

.empty-hint {
  padding: 20px 0;
  text-align: center;
  font-size: 12px;
  color: var(--c-text-3);
}
.ap-item-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
  width: 100%;
}
.ap-row-card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border-radius: 9px;
  background: var(--c-surface-2);
  border: 1px solid var(--c-border);
  cursor: pointer;
  transition: all 0.15s ease;
  width: 100%;
  box-sizing: border-box;
}
.ap-row-card:hover {
  border-color: var(--c-primary-400);
}
.ap-row-card.is-active-row {
  border-color: var(--c-primary-500);
  background: rgba(var(--c-primary-rgb, 16, 185, 129), 0.08);
}
.ap-row-idx {
  font-size: 10px;
  font-weight: 800;
  color: var(--c-text-3);
  width: 18px;
  flex: none;
}
.ap-row-info {
  flex: 1;
  min-width: 0;
}
.ap-row-top {
  display: flex;
  align-items: center;
  gap: 5px;
}
.ap-row-ssid {
  font-size: 12px;
  font-weight: 700;
  color: var(--c-text-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ap-row-band {
  font-size: 9px;
  font-weight: 700;
  padding: 0 4px;
  border-radius: 3px;
  background: rgba(14, 165, 233, 0.14);
  color: #38bdf8;
  flex: none;
}
.ap-row-enc {
  font-size: 8px;
  font-weight: 600;
  padding: 0 4px;
  border-radius: 3px;
  background: rgba(148, 163, 184, 0.14);
  color: var(--c-text-2);
  flex: none;
}
.ap-row-sub {
  font-size: 9.5px;
  color: var(--c-text-3);
  margin-top: 2px;
  display: flex;
  align-items: center;
  gap: 4px;
}
.ap-row-signal {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  flex: none;
}
.ap-row-dbm {
  font-size: 10px;
  font-weight: 700;
  color: var(--c-text-2);
}
.copy-ic { color: var(--c-text-3); }
.link-action {
  font-size: 11px;
  font-weight: 600;
  color: var(--c-primary-500);
  text-decoration: none;
}

@media (max-width: 480px) {
  .cell-params-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
