<script setup lang="ts">import { computed, onUnmounted, ref } from 'vue'
import {
  NETWORK_INFO_KEYS,
  NETWORK_SELECT_KEYS,
  atCmd1,
  execSystem,
  getStatus,
  post,
  setBearerPreference,
  setFreqBand,
} from '@/api'
import { BANDS, bandNames, bandsToStr, normalizeWorkBand, strToBands } from '@/utils/band'
import { formatDbm } from '@/utils/format'
import { toast } from '@/components/toast'
import { confirm } from '@/components/confirm'
import { withLoading } from '@/components/loading'
import PageForm from '@/layouts/PageForm.vue'
import Card from '@/components/Card.vue'
import FormField from '@/components/FormField.vue'
import Icon from '@/components/Icon.vue'

const raw = ref<Record<string, string>>({})
const error = ref('')
const loading = ref(true)
const fastSniff = ref(false)

interface SignalPoint {
  time: string
  rsrp: number
  sinr: number
}
const signalHistory = ref<SignalPoint[]>([])

function recordSignalPoint(): void {
  const rsrpStr = raw.value.lte_rsrp || raw.value.rscp || ''
  const sinrStr = raw.value.nv_sinr || raw.value.lte_snr || raw.value.lte_sinr || ''
  const rsrp = Number.parseFloat(rsrpStr)
  const sinr = Number.parseFloat(sinrStr)
  if (Number.isFinite(rsrp) && rsrp < 0) {
    const d = new Date()
    const timeStr = `${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
    signalHistory.value.push({
      time: timeStr,
      rsrp,
      sinr: Number.isFinite(sinr) ? sinr : 0,
    })
    if (signalHistory.value.length > 30) {
      signalHistory.value.shift()
    }
  }
}

async function load(): Promise<void> {
  try {
    raw.value = (await getStatus([
      ...NETWORK_SELECT_KEYS,
      ...NETWORK_INFO_KEYS,
      'sub_network_type',
    ])) as Record<string, string>
    recordSignalPoint()
    error.value = ''
  } catch (e) {
    error.value = e instanceof Error ? e.message : '读取失败'
  } finally {
    loading.value = false
  }
}

let pollTimer: number | null = null
function startPolling(interval: number): void {
  if (pollTimer !== null) clearInterval(pollTimer)
  pollTimer = window.setInterval(() => {
    if (document.hidden || bandBusy.value || cellBusy.value) return
    void load()
  }, interval)
}

function toggleFastSniff(): void {
  fastSniff.value = !fastSniff.value
  startPolling(fastSniff.value ? 2000 : 5000)
  toast(fastSniff.value ? '已开启 2 秒高频信号嗅探' : '已恢复 5 秒常规采样', 'success')
}

startPolling(5000)
void load()

onUnmounted(() => {
  if (pollTimer !== null) {
    clearInterval(pollTimer)
    pollTimer = null
  }
})

const v = (k: string) => raw.value[k] || '—'

const currentMask = computed(() => normalizeWorkBand(raw.value.work_lte_band ?? ''))
const currentBands = computed<number[]>(() => (currentMask.value ? strToBands(currentMask.value) : []))
const bandSel = ref<number[]>([])
const bandDirty = ref(false)
const bandBusy = ref(false)
const bandChosen = computed(() =>
  bandDirty.value ? [...bandSel.value].sort((a, b) => a - b) : currentBands.value,
)

function toggleBand(b: number): void {
  if (!bandDirty.value) {
    bandSel.value = [...currentBands.value]
    bandDirty.value = true
  }
  const i = bandSel.value.indexOf(b)
  if (i >= 0) bandSel.value.splice(i, 1)
  else bandSel.value.push(b)
}

const BAND_META: Record<number, { freq: string; desc: string; tag?: string; fdd: boolean }> = {
  1: { freq: '2100M', desc: '电信/联通', tag: '基干', fdd: true },
  3: { freq: '1800M', desc: '全网通主力', tag: '★主力', fdd: true },
  5: { freq: '850M', desc: '电信覆盖', tag: '低频', fdd: true },
  8: { freq: '900M', desc: '移动/联通', tag: '穿透', fdd: true },
  34: { freq: '2000M', desc: '移动微蜂窝', fdd: false },
  38: { freq: '2600M', desc: '移动室外', fdd: false },
  39: { freq: '1900M', desc: '移动广覆盖', tag: '广域', fdd: false },
  40: { freq: '2300M', desc: '室内增强', fdd: false },
  41: { freq: '2500M', desc: '移动大带宽', tag: '容量', fdd: false },
}

function bandAll(): void {
  bandDirty.value = true
  bandSel.value = bandChosen.value.length === BANDS.length ? [] : [...BANDS]
}

function bandMainFdd(): void {
  bandDirty.value = true
  bandSel.value = [1, 3, 5, 8]
  toast('已选中主力 FDD 频段 (B1/B3/B5/B8)', 'success')
}

function bandTdd(): void {
  bandDirty.value = true
  bandSel.value = [39, 41]
  toast('已选中移动 TDD 容量频段 (B39/B41)', 'success')
}

async function applyBand(): Promise<void> {
  if (!bandChosen.value.length) {
    toast('请至少选择一个频段', 'error')
    return
  }
  const mask = bandsToStr(bandChosen.value)
  const ok = await confirm({
    title: '应用频段设置',
    message: `锁定到 ${bandNames(mask)}，模组会重启，期间短暂断网。`,
    danger: true,
  })
  if (!ok) return
  bandBusy.value = true
  try {
    await withLoading(async () => {
      const r = await post(setFreqBand({ work_lte_band: mask, ping_google: raw.value.ping_google || '' }))
      if (r.result !== 'success') throw new Error(r.result || '写配置失败')
      await post(atCmd1(`ZLTEBAND=${mask}`))
    }, '正在写入…')
    if (!(await verify(() => normalizeWorkBand(raw.value.work_lte_band ?? '') === mask))) {
      toast('已下发，但回读未确认', 'error')
      return
    }
    await withLoading(() => post(atCmd1('CFUN=1')), '模组重启中…')
    toast('已应用：' + bandNames(mask), 'success')
    bandDirty.value = false
    await load()
  } catch (e) {
    toast(e instanceof Error ? e.message : '应用失败', 'error')
  } finally {
    bandBusy.value = false
  }
}

async function verify(pred: () => boolean): Promise<boolean> {
  for (let i = 0; i < 5; i++) {
    if (pred()) return true
    await new Promise((r) => setTimeout(r, 2000))
    await load()
  }
  return pred()
}

const cellBusy = ref(false)
const showManual = ref(false)
const manArfcn = ref('')
const manPci = ref('')
const freqOnly = ref(false)

const curArfcn = computed(() => (raw.value.nv_arfcn ?? '').trim())
const curPci = computed(() => (raw.value.nv_pci ?? '').trim())

async function lockCell(arfcn: string, pci: string): Promise<void> {
  const a = String(arfcn).trim()
  const p = String(pci).trim()
  if (!/^\d{1,5}$/.test(a) || (!freqOnly.value && !/^\d{1,4}$/.test(p))) {
    toast(freqOnly.value ? 'EARFCN 为 1-5 位数字' : 'EARFCN 为 1-5 位数字，PCI 为 1-4 位数字', 'error')
    return
  }
  const realPci = freqOnly.value ? '65535' : p
  const ok = await confirm({
    title: '锁定小区',
    message:
      (freqOnly.value ? `只锁频点 EARFCN=${a}` : `锁定小区 EARFCN=${a} PCI=${realPci}`) +
      '，模组会重启，期间短暂断网。',
    danger: true,
  })
  if (!ok) return
  cellBusy.value = true
  try {
    await withLoading(async () => {
      const r = await post(atCmd1(`ZLTELC=1,${a},${realPci}`))
      if (r.result !== 'success') throw new Error(r.result || '下发失败')
    }, '正在下发…')
    await withLoading(() => post(atCmd1('CFUN=1')), '模组重启中…')
    toast(freqOnly.value ? `已锁定频点 EARFCN=${a}` : `已锁定小区 EARFCN=${a} PCI=${realPci}`, 'success')
    await load()
  } catch (e) {
    toast(e instanceof Error ? e.message : '锁定失败', 'error')
  } finally {
    cellBusy.value = false
  }
}

async function unlockCell(): Promise<void> {
  const ok = await confirm({ title: '解除小区锁', message: '将恢复自动选小区，模组会重启。', danger: true })
  if (!ok) return
  cellBusy.value = true
  try {
    await withLoading(async () => {
      const r = await post(atCmd1('ZLTELC=0,0,0'))
      if (r.result !== 'success') throw new Error(r.result || '下发失败')
    }, '正在下发…')
    await withLoading(() => post(atCmd1('CFUN=1')), '模组重启中…')
    toast('已解除小区锁', 'success')
    await load()
  } catch (e) {
    toast(e instanceof Error ? e.message : '解除失败', 'error')
  } finally {
    cellBusy.value = false
  }
}

const MODES = [
  { label: '自动', value: 'NETWORK_auto' },
  { label: '仅 4G', value: 'Only_LTE' },
  { label: '仅 3G', value: 'Only_WCDMA' },
]
const modeBusy = ref(false)

async function setMode(value: string): Promise<void> {
  modeBusy.value = true
  try {
    await withLoading(async () => {

      const wasConnected = ['ppp_connected', 'ppp_connecting', 'ppp_online'].includes(
        raw.value.ppp_status ?? '',
      )
      if (wasConnected) {
        await post({ goformId: 'DISCONNECT_NETWORK', notCallback: 'true' })
        for (let i = 0; i < 20; i++) {
          await sleep(500)
          const s = await getStatus(['ppp_status'])
          if (s.ppp_status === 'ppp_disconnected' || s.ppp_status === 'ppp_disconnecting') {
            if (s.ppp_status === 'ppp_disconnected') break
          }
        }
      }
      const res = await post(setBearerPreference(value))
      if (res.result !== 'success') throw new Error(res.result || '设置失败')
      if (wasConnected) {
        try { await post({ goformId: 'CONNECT_NETWORK', notCallback: 'true' }) } catch {  }
      }
    }, '正在切换…')
    toast('已切换', 'success')
    await load()
  } catch (e) {
    toast(e instanceof Error ? e.message : '设置失败', 'error')
  } finally {
    modeBusy.value = false
  }
}

type SegKey = 'band' | 'cell'

const SEGS: { k: SegKey; t: string }[] = [
  { k: 'band', t: '频段' },
  { k: 'cell', t: '小区' },
]
const seg = ref<SegKey>('band')

const AT_PORT = 2048
const AT_BIN = '/mnt/userdata/binary/at_cond'

const atUp = ref(false)
const atBusy = ref(false)
const atBase = computed(() => `${window.location.protocol}//${window.location.hostname}:${AT_PORT}`)

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function atPing(): Promise<boolean> {
  try {
    const r = await fetch(`${atBase.value}/ping`, { cache: 'no-store' })
    return r.ok
  } catch {
    return false
  }
}

async function atCheck(): Promise<void> {
  atBusy.value = true
  try {
    atUp.value = await atPing()
  } finally {
    atBusy.value = false
  }
}

async function atWaitFor(want: boolean): Promise<boolean> {
  for (let i = 0; i < 16; i++) {
    if ((await atPing()) === want) return true
    await sleep(500)
  }
  return (await atPing()) === want
}

async function toggleAt(): Promise<void> {
  atBusy.value = true
  try {
    if (atUp.value) {
      await withLoading(() => execSystem(`${AT_BIN} -s`), '正在停止…')
      atUp.value = !(await atWaitFor(false))
      toast(atUp.value ? '停止失败，服务仍在运行' : 'AT 服务已停止', atUp.value ? 'error' : 'success')
    } else {
      await withLoading(
        () => execSystem(`mkdir -p /mnt/userdata/binary/logs; ${AT_BIN} -b ${AT_PORT}`),
        '正在启动…',
      )
      atUp.value = await atWaitFor(true)
      toast(atUp.value ? 'AT 服务已启动' : '启动失败', atUp.value ? 'success' : 'error')
    }
  } catch (e) {
    toast(e instanceof Error ? e.message : '操作失败', 'error')
  } finally {
    atBusy.value = false
  }
}

async function atCmd(c: string): Promise<string> {
  const url = `${atBase.value}/goform/goform_set_cmd_process?goformId=EXECUTE_AT_COMMAND&at_cmd=${encodeURIComponent(c)}`
  const r = await fetch(url, { cache: 'no-store', headers: { 'X-AT-Console': '1' } })
  return r.text()
}

interface NCell {
  gcid: string
  arfcn: string
  plmn: string
  tac: string
  pci: string
  rsrp: string
  rsrq: string
}

const ncells = ref<NCell[]>([])
const nBusy = ref(false)
const nMsg = ref('')

const plmnName = (p: string): string =>
  p.startsWith('46000')
    ? '中国移动'
    : p.startsWith('46001')
      ? '中国联通'
      : p.startsWith('46011')
        ? '中国电信'
        : p.startsWith('46015')
          ? '中国广电'
          : p || '—'

function parseZNCELLINFO(text: string): NCell[] {
  const line = text.split(/\r?\n/).find((l) => l.trim().startsWith('+ZNCELLINFO:'))
  if (!line) return []
  const nums = line
    .slice(line.indexOf(':') + 1)
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s !== '')
  if (nums.length < 12) return []
  const out: NCell[] = []
  for (let i = 4; i + 8 <= nums.length; i += 8) {
    const g = nums.slice(i, i + 8)
    const rsrpIdx = Number.parseInt(g[5], 10)
    const rsrqIdx = Number.parseInt(g[6], 10)
    out.push({
      gcid: g[0],
      arfcn: g[1],
      plmn: g[2],
      tac: g[3],
      pci: g[4],
      rsrp: Number.isFinite(rsrpIdx) ? String(rsrpIdx - 141) : '',
      rsrq: Number.isFinite(rsrqIdx) && rsrqIdx > 0 ? String(rsrqIdx) : '',
    })
  }
  return out
}

async function regHint(): Promise<string> {
  try {
    const t = await atCmd('AT+CEREG?')
    const m = /\+CEREG:\s*\d+\s*,\s*(\d+)/.exec(t)
    const st = m ? m[1] : ''
    if (st === '2') return '模组正在搜网，尚未注册'
    if (st === '3') return '网络拒绝注册（SIM 未实名 / 欠费 / 被禁止）'
    if (st === '1' || st === '5') return '已注册但没有数据连接，模组不在连接态'
    if (st === '0' || st === '4') return '模组未注册到任何网络'
    return '未获取到邻区'
  } catch {
    return '未获取到邻区'
  }
}

async function wakeModem(): Promise<void> {
  try {
    await execSystem('ping -c 3 -w 3 223.5.5.5 >/dev/null 2>&1')
  } catch {

  }
}

async function scanNeighbors(): Promise<void> {
  if (!atUp.value) {
    toast('请先开启上方 AT 服务', 'error')
    return
  }
  nBusy.value = true
  ncells.value = []
  let list: NCell[] = []
  try {

    for (let i = 0; i < 3 && !list.length; i++) {
      nMsg.value = i === 0 ? '正在唤醒模组…' : '模组空闲，再次唤醒…'
      await wakeModem()
      const t = await atCmd('AT+ZNCELLINFO?')
      if (/CME ERROR:\s*3/.test(t)) {
        nMsg.value = '模组正忙，重试中…'
        await sleep(2000)
        continue
      }
      list = parseZNCELLINFO(t)
    }
    ncells.value = list
    if (list.length) {
      nMsg.value = ''
      toast(`找到 ${list.length} 个邻区`, 'success')
    } else {
      nMsg.value = await regHint()
      toast(nMsg.value, 'error')
    }
  } catch (e) {
    nMsg.value = e instanceof Error ? e.message : '扫描失败'
  } finally {
    nBusy.value = false
  }
}

void atCheck()

const rsrpStats = computed(() => {
  if (signalHistory.value.length === 0) return null
  const vals = signalHistory.value.map((p) => p.rsrp)
  const cur = vals[vals.length - 1]
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const avg = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
  const delta = Math.abs(max - min)
  return { cur, min, max, avg, delta }
})

const waveformSvg = computed(() => {
  const pts = signalHistory.value
  if (pts.length < 2) return null
  const w = 400
  const h = 80
  const vals = pts.map((p) => p.rsrp)
  const minV = Math.min(...vals)
  const maxV = Math.max(...vals)

  const span = Math.max(8, maxV - minV + 2)
  const mid = (maxV + minV) / 2
  const minLimit = mid - span / 2
  const maxLimit = mid + span / 2

  const coords = pts.map((p, idx) => {
    const x = (idx / (pts.length - 1)) * w
    const y = h - ((p.rsrp - minLimit) / (maxLimit - minLimit)) * (h - 24) - 12
    return { x, y }
  })
  const polyline = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ')
  const area = `0,${h} ${polyline} ${w},${h}`
  const last = coords[coords.length - 1]
  return {
    polyline,
    area,
    last,
    topVal: Math.round(maxLimit),
    bottomVal: Math.round(minLimit),
  }
})

const statusRows = computed(() => [
  { k: '网络制式', v: v('network_type') },
  { k: '运营商', v: raw.value.network_provider || raw.value.network_operator || '—' },
  { k: 'RSRP', v: raw.value.lte_rsrp ? formatDbm(Number(raw.value.lte_rsrp)) : '— —' },
  { k: 'SINR', v: v('nv_sinr') },
  { k: '当前频段', v: raw.value.lte_band ? `Band ${raw.value.lte_band}` : '—' },
  { k: 'PCI / EARFCN', v: `${v('nv_pci')} / ${v('nv_arfcn')}` },
  { k: '小区 ID', v: v('nv_globecellid') },
  { k: 'IMEI', v: v('imei') },
  { k: 'ICCID', v: v('ziccid') },
])
</script>

<template>
  <PageForm title="网络设置" :loading="loading" :error="error" :savable="false">
    <template #right>
      <button type="button" class="icon-btn" aria-label="刷新" @click="load">
        <Icon name="refresh" :size="20" />
      </button>
    </template>

    <Card>
      <div class="seg" role="tablist">
        <button
          v-for="s in SEGS"
          :key="s.k"
          type="button"
          class="seg-item"
          :class="{ 'is-on': seg === s.k }"
          role="tab"
          :aria-selected="seg === s.k"
          @click="seg = s.k"
        >
          {{ s.t }}
        </button>
      </div>

      <div v-if="seg === 'band'" class="pane">
        <div class="band-active-banner">
          <div class="band-active-meta">
            <span class="t-cap">当前频段</span>
            <span class="band-active-names num">{{ bandNames(currentMask) }}</span>
          </div>
          <span class="band-count-badge num">{{ bandChosen.length }}/{{ BANDS.length }}</span>
        </div>

        <div class="band-group-title">
          <span>FDD 频段</span>
        </div>
        <div class="band-carrier-grid">
          <button
            v-for="b in [1, 3, 5, 8]"
            :key="b"
            type="button"
            class="carrier-card"
            :class="{ 'is-on': bandChosen.includes(b) }"
            :disabled="bandBusy"
            @click="toggleBand(b)"
          >
            <div class="carrier-top">
              <span class="carrier-b num">B{{ b }}</span>
              <span v-if="BAND_META[b]?.tag" class="carrier-tag">{{ BAND_META[b].tag }}</span>
              <span class="carrier-check" :class="{ 'is-checked': bandChosen.includes(b) }">
                <Icon v-if="bandChosen.includes(b)" name="check" :size="11" :stroke="3" />
              </span>
            </div>
            <div class="carrier-bot">
              <span class="carrier-freq num">{{ BAND_META[b]?.freq }}</span>
              <span class="carrier-op">{{ BAND_META[b]?.desc }}</span>
            </div>
          </button>
        </div>

        <div class="band-group-title mt-3">
          <span>TDD 频段</span>
        </div>
        <div class="band-carrier-grid">
          <button
            v-for="b in [34, 38, 39, 40, 41]"
            :key="b"
            type="button"
            class="carrier-card"
            :class="{ 'is-on': bandChosen.includes(b) }"
            :disabled="bandBusy"
            @click="toggleBand(b)"
          >
            <div class="carrier-top">
              <span class="carrier-b num">B{{ b }}</span>
              <span v-if="BAND_META[b]?.tag" class="carrier-tag">{{ BAND_META[b].tag }}</span>
              <span class="carrier-check" :class="{ 'is-checked': bandChosen.includes(b) }">
                <Icon v-if="bandChosen.includes(b)" name="check" :size="11" :stroke="3" />
              </span>
            </div>
            <div class="carrier-bot">
              <span class="carrier-freq num">{{ BAND_META[b]?.freq }}</span>
              <span class="carrier-op">{{ BAND_META[b]?.desc }}</span>
            </div>
          </button>
        </div>

        <div class="preset-pill-bar mt">
          <button type="button" class="preset-pill" :disabled="bandBusy" @click="bandMainFdd">
            主力 FDD
          </button>
          <button type="button" class="preset-pill" :disabled="bandBusy" @click="bandTdd">
            移动 TDD
          </button>
          <button type="button" class="preset-pill" :disabled="bandBusy" @click="bandAll">
            {{ bandChosen.length === BANDS.length ? '全不选' : '全选' }}
          </button>
        </div>

        <button
          type="button"
          class="btn btn-primary btn-block mt"
          :disabled="bandBusy || !bandDirty"
          @click="applyBand"
        >
          {{ bandBusy ? '下发中…' : bandDirty ? '应用频段' : '未修改' }}
        </button>
      </div>

      <div v-else-if="seg === 'cell'" class="pane">
        <div class="cell-now">
          <div>
            <p class="head-main">当前小区</p>
            <p class="t-cap num">EARFCN {{ v('nv_arfcn') }} · PCI {{ v('nv_pci') }}</p>
          </div>
          <button
            type="button"
            class="mini"
            :disabled="cellBusy || !curArfcn || !curPci"
            @click="lockCell(curArfcn, curPci)"
          >
            锁定此小区
          </button>
        </div>

        <button type="button" class="link" @click="showManual = !showManual">
          {{ showManual ? '收起手动输入' : '手动指定' }}
        </button>

        <div v-if="showManual" class="manual">
          <div class="row-2">
            <FormField label="EARFCN">
              <input
                v-model="manArfcn"
                class="num"
                type="text"
                inputmode="numeric"
                maxlength="5"
                autocomplete="off"
              />
            </FormField>
            <FormField label="PCI">
              <input
                v-model="manPci"
                class="num"
                type="text"
                inputmode="numeric"
                maxlength="4"
                autocomplete="off"
                :disabled="freqOnly"
              />
            </FormField>
          </div>
          <label class="check-inline">
            <input v-model="freqOnly" type="checkbox" />
            <span>只锁频点</span>
          </label>
          <button
            type="button"
            class="btn btn-primary btn-block mt"
            :disabled="cellBusy"
            @click="lockCell(manArfcn, manPci)"
          >
            锁定
          </button>
        </div>

        <button
          type="button"
          class="btn btn-danger btn-block mt"
          :disabled="cellBusy"
          @click="unlockCell"
        >
          {{ cellBusy ? '下发中…' : '解除小区锁' }}
        </button>

        <div class="sep"><span>邻区扫描</span></div>

        <div class="svc">
          <div>
            <p class="svc-main">at_cond</p>
            <p class="t-cap">端口 {{ AT_PORT }} · {{ atUp ? '运行中' : '未运行' }}</p>
          </div>
          <button type="button" class="mini" :disabled="atBusy" @click="toggleAt">
            {{ atBusy ? '…' : atUp ? '停止' : '启动' }}
          </button>
        </div>

        <button
          type="button"
          class="btn btn-primary btn-block mt"
          :disabled="nBusy || !atUp"
          @click="scanNeighbors"
        >
          {{ nBusy ? '扫描中…' : '扫描邻区' }}
        </button>

        <p v-if="nMsg" class="nmsg">{{ nMsg }}</p>

        <ul v-if="ncells.length" class="ncell-list">
          <li v-for="(c, i) in ncells" :key="i" class="ncell-card">
            <div class="ncell-info">
              <div class="ncell-top">
                <span class="ncell-title num">EARFCN {{ c.arfcn }} · PCI {{ c.pci }}</span>
                <span v-if="c.arfcn === curArfcn && c.pci === curPci" class="tag">当前驻留</span>
              </div>
              <div class="ncell-badges">
                <span v-if="c.rsrp" class="rf-pill is-rsrp num">RSRP {{ c.rsrp }} dBm</span>
                <span v-if="c.rsrq" class="rf-pill num">RSRQ {{ c.rsrq }}</span>
                <span v-if="c.plmn" class="rf-pill">{{ plmnName(c.plmn) }}</span>
              </div>
            </div>
            <button
              type="button"
              class="mini"
              :disabled="cellBusy"
              @click="lockCell(c.arfcn, c.pci)"
            >
              锁定
            </button>
          </li>
        </ul>

      </div>
    </Card>

    <Card title="网络模式">
      <div class="chips">
        <button
          v-for="m in MODES"
          :key="m.value"
          type="button"
          class="chip"
          :class="{ 'is-on': (raw.net_select || 'NETWORK_auto') === m.value }"
          :disabled="modeBusy"
          @click="setMode(m.value)"
        >
          {{ m.label }}
        </button>
      </div>
    </Card>

    <Card title="信号遥测">
      <template #right>
        <button
          type="button"
          class="mini"
          :class="{ 'is-fast': fastSniff }"
          @click="toggleFastSniff"
        >
          {{ fastSniff ? '● 2s 采样' : '2s 采样' }}
        </button>
      </template>

      <div v-if="rsrpStats" class="waveform-box">
        <div class="wf-meta">
          <div class="wf-stat">
            <span class="t-cap">实时 RSRP</span>
            <span class="wf-num num">{{ rsrpStats.cur }} <small>dBm</small></span>
          </div>
          <div class="wf-stat">
            <span class="t-cap">振幅</span>
            <span class="num t-primary wf-val-sub">Δ {{ rsrpStats.delta }} dB</span>
          </div>
          <div class="wf-stat">
            <span class="t-cap">均值</span>
            <span class="num wf-val-sub">{{ rsrpStats.avg }}</span>
          </div>
          <div class="wf-stat">
            <span class="t-cap">峰值</span>
            <span class="num t-primary wf-val-sub">{{ rsrpStats.max }}</span>
          </div>
          <div class="wf-stat">
            <span class="t-cap">谷值</span>
            <span class="num wf-val-sub">{{ rsrpStats.min }}</span>
          </div>
        </div>

        <div v-if="waveformSvg" class="wf-chart-wrap">
          <svg class="wf-svg" viewBox="0 0 400 80" preserveAspectRatio="none">
            <defs>
              <linearGradient id="wfGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="var(--c-primary-400)" stop-opacity="0.38" />
                <stop offset="100%" stop-color="var(--c-primary-400)" stop-opacity="0.0" />
              </linearGradient>
            </defs>
            <line x1="0" y1="20" x2="400" y2="20" class="wf-grid-line" />
            <line x1="0" y1="40" x2="400" y2="40" class="wf-grid-line" />
            <line x1="0" y1="60" x2="400" y2="60" class="wf-grid-line" />
            <polygon :points="waveformSvg.area" fill="url(#wfGrad)" />
            <polyline
              :points="waveformSvg.polyline"
              fill="none"
              stroke="var(--c-primary-400)"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <circle
              :cx="waveformSvg.last.x"
              :cy="waveformSvg.last.y"
              r="4.5"
              fill="var(--c-primary-400)"
              stroke="#ffffff"
              stroke-width="1.8"
            />
          </svg>
          <div class="wf-axis-labels">
            <span class="t-cap num">{{ waveformSvg.topVal }} dBm</span>
            <span class="t-cap">动态自适应量程 ({{ signalHistory.length }} 点)</span>
            <span class="t-cap num">{{ waveformSvg.bottomVal }} dBm</span>
          </div>
        </div>
      </div>

      <div class="rf-bento">
        <div v-for="r in statusRows" :key="r.k" class="rf-tile">
          <span class="rf-k t-cap">{{ r.k }}</span>
          <span class="rf-v num">{{ r.v }}</span>
        </div>
      </div>
    </Card>
  </PageForm>
</template>

<style scoped>
.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: var(--r-sm);
  color: var(--c-text-2);
}

.head {
  margin-bottom: var(--sp-3);
}

.head-main {
  font-size: var(--fs-body);
}

.row-2 {
  display: flex;
  gap: var(--sp-2);
  margin-top: var(--sp-3);
}

.mini {
  padding: 6px 12px;
  border-radius: var(--r-sm);
  font-size: var(--fs-cap);
  color: var(--c-primary-600);
  background: var(--c-primary-50);
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.2s ease;
}

.mini.is-fast {
  background: var(--c-primary-500);
  color: #ffffff;
  font-weight: 500;
  box-shadow: 0 0 8px rgba(15, 110, 86, 0.4);
}

.svc {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
}

.svc-main {
  font-size: var(--fs-body);
}

.nmsg {
  margin-top: var(--sp-2);
  font-size: var(--fs-cap);
  color: var(--c-text-2);
}

.sep {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  margin: var(--sp-4) 0 var(--sp-3);
  font-size: var(--fs-cap);
  color: var(--c-text-3);
}

.sep::before,
.sep::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--c-line);
}

.seg {
  display: flex;
  gap: 4px;
  padding: 4px;
  margin-bottom: var(--sp-4);
  background: var(--c-surface-2);
  border-radius: var(--r-md);
}

.seg-item {
  flex: 1;
  min-height: 36px;
  border-radius: var(--r-sm);
  font-size: var(--fs-sub);
  color: var(--c-text-2);
  background: transparent;
  transition: background 0.15s, color 0.15s;
}

.seg-item.is-on {
  color: var(--c-primary-600);
  background: var(--c-surface);
  box-shadow: 0 1px 2px rgb(0 0 0 / 6%);
}

.pane {
  min-height: 176px;
}

.band-active-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: var(--c-surface-2);
  border: 1px solid var(--c-line);
  border-radius: var(--r-md);
  margin-bottom: var(--sp-4);
}

.band-active-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.band-active-names {
  font-size: var(--fs-sub);
  font-weight: 700;
  color: var(--c-primary-600);
}

[data-theme='dark'] .band-active-names {
  color: var(--c-primary-400);
}

.band-count-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: var(--r-full);
  background: var(--c-surface);
  border: 1px solid var(--c-line);
  color: var(--c-text-2);
}

.band-group-title {
  font-size: 11px;
  font-weight: 700;
  color: var(--c-text-3);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: var(--sp-2);
  padding-left: 2px;
}

.mt-3 {
  margin-top: var(--sp-3);
}

.band-carrier-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.carrier-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 10px 12px;
  background: var(--c-surface-2);
  border: 1px solid var(--c-line);
  border-radius: var(--r-md);
  text-align: left;
  transition: all 0.15s cubic-bezier(0.2, 0, 0, 1);
  cursor: pointer;
}

.carrier-card:active {
  transform: scale(0.965);
}

.carrier-card.is-on {
  border-color: var(--c-primary-400);
  background: var(--c-primary-50);
  box-shadow: 0 0 10px rgba(28, 165, 123, 0.2);
}

[data-theme='dark'] .carrier-card.is-on {
  background: rgba(34, 181, 134, 0.16);
}

.carrier-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.carrier-b {
  font-size: 16px;
  font-weight: 800;
  color: var(--c-text-1);
}

.carrier-card.is-on .carrier-b {
  color: var(--c-primary-600);
}

[data-theme='dark'] .carrier-card.is-on .carrier-b {
  color: var(--c-primary-400);
}

.carrier-tag {
  font-size: 10px;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: var(--r-sm);
  background: var(--c-surface);
  color: var(--c-text-2);
  border: 1px solid var(--c-line);
}

.carrier-card.is-on .carrier-tag {
  background: #ffffff;
  color: var(--c-primary-600);
  border-color: transparent;
}

[data-theme='dark'] .carrier-card.is-on .carrier-tag {
  background: var(--c-surface);
  color: var(--c-primary-400);
}

.carrier-check {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 1px solid var(--c-line-strong);
  background: var(--c-surface);
  color: #ffffff;
}

.carrier-check.is-checked {
  background: var(--c-primary-400);
  border-color: var(--c-primary-400);
}

.carrier-bot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11px;
}

.carrier-freq {
  font-weight: 600;
  color: var(--c-text-2);
}

.carrier-op {
  font-size: 10px;
  color: var(--c-text-3);
}

.preset-pill-bar {
  display: flex;
  gap: 6px;
  margin-top: var(--sp-3);
}

.preset-pill {
  flex: 1;
  min-height: 32px;
  border-radius: var(--r-full);
  font-size: var(--fs-cap);
  font-weight: 600;
  color: var(--c-text-2);
  background: var(--c-surface-2);
  border: 1px solid var(--c-line);
  transition: all 0.15s ease;
}

.preset-pill:active {
  background: var(--c-primary-50);
  color: var(--c-primary-600);
  border-color: var(--c-primary-400);
}

.note {
  margin-bottom: var(--sp-3);
  padding: var(--sp-2) var(--sp-3);
  border-radius: var(--r-sm);
  font-size: var(--fs-cap);
  line-height: 1.6;
  color: var(--c-text-2);
  background: var(--c-surface-2);
}

.tag {
  display: inline-block;
  margin-left: 6px;
  padding: 0 6px;
  border-radius: var(--r-full);
  font-size: 10px;
  color: var(--c-primary-600);
  background: var(--c-primary-50);
  vertical-align: middle;
}

.cell-now {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
}

.link {
  margin-top: var(--sp-3);
  font-size: var(--fs-cap);
  color: var(--c-primary-600);

  position: relative;
}

.link::after {
  content: '';
  position: absolute;
  inset: -8px -4px;
}

.manual {
  margin-top: var(--sp-3);
  padding-top: var(--sp-3);
  border-top: 1px dashed var(--c-line);
}

.check-inline {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  margin-top: var(--sp-2);
  font-size: var(--fs-sub);
  color: var(--c-text-2);
}

.check-inline input {
  width: 18px;
  height: 18px;
  accent-color: var(--c-primary-400);
}

.chips {
  display: flex;
  gap: var(--sp-2);
}

.chip {
  flex: 1;
  min-height: 40px;
  border: 1px solid var(--c-line);
  border-radius: var(--r-md);
  font-size: var(--fs-sub);
  color: var(--c-text-2);
  background: var(--c-surface);
}

.chip.is-on {
  border-color: var(--c-primary-400);
  color: var(--c-primary-600);
  background: var(--c-primary-50);
  box-shadow: 0 0 8px rgba(28, 165, 123, 0.2);
  font-weight: 600;
}

[data-theme='dark'] .chip.is-on {
  background: var(--c-primary-100);
  color: var(--c-primary-800);
}

.ncell-list {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  margin-top: var(--sp-3);
}

.ncell-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
  padding: var(--sp-3);
  border-radius: var(--r-md);
  background: var(--c-surface-2);
  border: 1px solid var(--c-line);
}

.ncell-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.ncell-top {
  display: flex;
  align-items: center;
  gap: 6px;
}

.ncell-title {
  font-size: var(--fs-sub);
  font-weight: 700;
  color: var(--c-text-1);
}

.ncell-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.rf-pill {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: var(--r-sm);
  background: var(--c-surface);
  color: var(--c-text-2);
  border: 1px solid var(--c-line);
}

.rf-pill.is-rsrp {
  color: var(--c-primary-600);
  background: var(--c-primary-50);
  border-color: transparent;
  font-weight: 600;
}

[data-theme='dark'] .rf-pill.is-rsrp {
  color: var(--c-primary-400);
  background: rgba(34, 181, 134, 0.16);
}

.mt {
  margin-top: var(--sp-3);
}

.waveform-box {
  margin-bottom: var(--sp-3);
  padding: var(--sp-3);
  background: var(--c-surface-2);
  border-radius: var(--r-md);
  border: 1px solid var(--c-line);
}

.wf-meta {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 4px;
  margin-bottom: var(--sp-2);
}

.wf-stat {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.wf-num {
  font-size: 14px;
  font-weight: 700;
  color: var(--c-text-1);
  line-height: 1.1;
  white-space: nowrap;
}

.wf-num small {
  font-size: 9px;
  font-weight: 500;
  color: var(--c-text-3);
}

.wf-val-sub {
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.wf-chart-wrap {
  width: 100%;
}

.wf-svg {
  display: block;
  width: 100%;
  height: 84px;
  border-radius: var(--r-sm);
  background: var(--c-surface);
  border: 1px solid var(--c-line);
}

.wf-grid-line {
  stroke: var(--c-line);
  stroke-width: 1;
  stroke-dasharray: 3 3;
}

.wf-axis-labels {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 6px;
}

.rf-bento {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--sp-2);
}

.rf-tile {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 12px;
  border-radius: var(--r-md);
  background: var(--c-surface-2);
  border: 1px solid var(--c-line);
  min-width: 0;
}

.rf-k {
  font-size: 11px;
}

.rf-v {
  font-size: var(--fs-sub);
  font-weight: 600;
  color: var(--c-text-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
