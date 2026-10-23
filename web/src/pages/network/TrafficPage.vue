<script setup lang="ts">import { computed, ref } from 'vue'
import { PAGE_KEYS, flowCalibration, flowLimitNvCmd, getStatus, post } from '@/api'
import { execSystem } from '@/api'
import { toast } from '@/components/toast'
import { confirm } from '@/components/confirm'
import { usePageForm } from '@/composables/usePageForm'
import { usePolling } from '@/composables/usePolling'
import {
  buildFlowDataSize,
  flowHoursToMin,
  flowSizeToMB,
  formatBytes,
  formatDuration,
  formatRate,
  percentOf,
  toNum,
} from '@/utils/format'
import { parseFluxDaily, parseFluxHourly, parseFluxUptime } from '@/utils/parse'
import PageForm from '@/layouts/PageForm.vue'
import Card from '@/components/Card.vue'
import Icon from '@/components/Icon.vue'
import FormField from '@/components/FormField.vue'
import Toggle from '@/components/Toggle.vue'
import RingChart from '@/components/charts/RingChart.vue'

interface Model {
  limitEnabled: boolean

  unit: 'data' | 'time'

  size: string
  alertPercent: string
}

const UNIT_PRESETS = [
  { label: '500 MB', mb: 500 },
  { label: '1 GB', mb: 1024 },
  { label: '3 GB', mb: 3072 },
  { label: '10 GB', mb: 10240 },
  { label: '30 GB', mb: 30720 },
]

const TIME_PRESETS = [
  { label: '1 小时', min: 60 },
  { label: '6 小时', min: 360 },
  { label: '1 天', min: 1440 },
  { label: '7 天', min: 10080 },
]

const { model, raw, loading, saving, error, fieldErrors, dirty, load, save, reset } =
  usePageForm<Model>({
    keys: PAGE_KEYS.traffic,
    fromStatus: (s) => {

      const unit: 'data' | 'time' = (s.data_volume_limit_unit ?? '').trim() === 'time' ? 'time' : 'data'
      const sizeMB = unit === 'data' ? flowSizeToMB(s.data_volume_limit_size) : null
      const sizeMin = unit === 'time' ? flowHoursToMin(s.data_volume_limit_size) : null
      return {
        limitEnabled: (s.data_volume_limit_switch ?? '0') === '1',
        unit,
        size: unit === 'data' ? (sizeMB !== null ? String(sizeMB) : '') : (sizeMin !== null ? String(sizeMin) : ''),
        alertPercent: s.data_volume_alert_percent || '90',
      }
    },
    validate: (m): Record<string, string> | null => {
      if (!m.limitEnabled) return null
      const n = Number.parseFloat(m.size)
      if (!Number.isFinite(n) || n <= 0) return { size: '请输入大于 0 的值' }
      const p = Number.parseInt(m.alertPercent, 10)
      if (!Number.isFinite(p) || p < 1 || p > 100) return { alertPercent: '范围 1~100' }
      return null
    },
    toPayload: (m) => {

      if (!m.limitEnabled) {
        return {
          goformId: 'ALK_EXC_SYSTEM_CMD',
          SYS_CMD: flowLimitNvCmd({
            enabled: '0',
            unit: m.unit,
            size: m.unit === 'data' ? '0' : '0',
            alertPercent: m.alertPercent || '90',
          }),
        }
      }
      const n = Number.parseFloat(m.size)
      const nvSize =
        m.unit === 'time' ? String(n / 60) : buildFlowDataSize(Math.round(n))
      return {
        goformId: 'ALK_EXC_SYSTEM_CMD',
        SYS_CMD: flowLimitNvCmd({
          enabled: '1',
          unit: m.unit,
          size: nvSize,
          alertPercent: m.alertPercent,
        }),
      }
    },
    successText: '限额已写入（nv save）',
  })

void load()

const usage = ref<Record<string, string>>({})
async function loadUsage(): Promise<void> {
  try {
    usage.value = (await getStatus(['monthly_tx_bytes', 'monthly_rx_bytes', 'monthly_time'])) as Record<
      string,
      string
    >
  } catch {

  }
}

async function collectFlux(): Promise<void> {
  try {
    const s = (await getStatus(['realtime_tx_bytes', 'realtime_rx_bytes'])) as Record<string, string>
    await execSystem(
      `sh /mnt/userdata/flux_stat/collect.sh ${toNum(s.realtime_tx_bytes)} ${toNum(s.realtime_rx_bytes)}`,
    )
  } catch {

  }
}
usePolling(loadUsage, 5000)

const hourly = ref<{ date: string; hour: number; tx: number; rx: number }[]>([])
const daily = ref<{ date: string; tx: number; rx: number }[]>([])
const uptime = ref({ total: 0, session: 0 })

const fluxOn = ref(true)

async function readFluxSwitch(): Promise<void> {
  const t = await readText('./flux_stat_state.txt')

  fluxOn.value = t.trim() !== '0'
}

async function setFluxSwitch(next: boolean): Promise<void> {
  fluxOn.value = next
  try {
    await execSystem(`mkdir -p /mnt/userdata/flux_stat; printf '${next ? 1 : 0}' > /mnt/userdata/flux_stat/switch`)
    toast(next ? '已开启流量统计' : '已关闭流量统计', 'success')
    if (next) await refreshAll()
  } catch (e) {
    fluxOn.value = !next
    toast(e instanceof Error ? e.message : '操作失败', 'error')
  }
}

const clearing = ref(false)
async function clearFlux(): Promise<void> {
  const ok = await confirm({
    title: '清空统计历史',
    message: '统计图表中的累计值与按天 / 按小时历史记录都会归零，此操作不可撤销。确认清空？',
    danger: true,
  })
  if (!ok) return
  clearing.value = true
  try {
    const s = (await getStatus(['realtime_tx_bytes', 'realtime_rx_bytes'])) as Record<string, string>
    const rtx = toNum(s.realtime_tx_bytes)
    const rrx = toNum(s.realtime_rx_bytes)
    await execSystem(`sh /mnt/userdata/flux_stat/collect.sh clear ${rtx} ${rrx}`)
    hourly.value = []
    daily.value = []
    toast('已清空统计历史', 'success')
    await refreshAll()
  } catch (e) {
    toast(e instanceof Error ? e.message : '清空失败', 'error')
  } finally {
    clearing.value = false
  }
}

async function readText(url: string): Promise<string> {
  try {
    const r = await fetch(`${url}?r=${Date.now()}`, { cache: 'no-store' })
    return r.ok ? (await r.text()).trim() : ''
  } catch {
    return ''
  }
}

async function writeUptimeFile(): Promise<void> {
  try {
    await execSystem(
      `U=$(cut -d' ' -f1 /proc/uptime | cut -d. -f1); echo "$U $U" > /mnt/userdata/flux_stat/uptime.txt 2>/dev/null ; chmod 644 /mnt/userdata/flux_stat/uptime.txt`,
    )
  } catch {

  }
}

async function loadFlux(): Promise<void> {

  await writeUptimeFile()
  try {
    const [h, d, u] = await Promise.all([
      fetch(`./flux_stat_hourly.txt?r=${Date.now()}`).then((r) => r.text()),
      fetch(`./flux_stat_daily.txt?r=${Date.now()}`).then((r) => r.text()),
      fetch(`./flux_stat_uptime.txt?r=${Date.now()}`).then((r) => r.text()),
    ])
    hourly.value = parseFluxHourly(h)
    daily.value = parseFluxDaily(d)
    uptime.value = parseFluxUptime(u)
  } catch {

  }
}

async function refreshAll(): Promise<void> {
  await readFluxSwitch()

  if (!fluxOn.value) {
    hourly.value = []
    daily.value = []
    uptime.value = { total: 0, session: 0 }
    await loadUsage()
    return
  }
  await collectFlux()
  await Promise.all([loadUsage(), loadFlux()])
}
void refreshAll()

const hourlyValid = computed(() => hourly.value.filter((x) => !x.date.startsWith('2000-')))
const dailyValid = computed(() => daily.value.filter((x) => !x.date.startsWith('2000-')))
const recentHours = computed(() => hourlyValid.value.slice(-24))
const recentDays = computed(() => dailyValid.value.slice(-14))

const fluxTab = ref<'hour' | 'day'>('hour')
const rows = computed(() =>
  fluxTab.value === 'hour'
    ? recentHours.value.map((x) => ({
        key: `${x.date}-${x.hour}`,
        label: `${String(x.hour).padStart(2, '0')}:00`,
        total: x.tx + x.rx,
        tx: x.tx,
        rx: x.rx,
      }))
    : recentDays.value.map((x) => ({
        key: x.date,
        label: x.date.slice(5),
        total: x.tx + x.rx,
        tx: x.tx,
        rx: x.rx,
      })),
)

const sumRx = computed(() => rows.value.reduce((a, b) => a + b.rx, 0))
const sumTx = computed(() => rows.value.reduce((a, b) => a + b.tx, 0))
const sumAll = computed(() => sumRx.value + sumTx.value)
const rowMax = computed(() => Math.max(1, ...rows.value.map((x) => x.total)))

const peak = computed(() =>
  rows.value.reduce<(typeof rows.value)[number] | null>(
    (a, b) => (a === null || b.total > a.total ? b : a),
    null,
  ),
)

const perPeriod = computed(() => (rows.value.length ? sumAll.value / rows.value.length : 0))

const topRows = computed(() => [...rows.value].sort((a, b) => b.total - a.total).slice(0, 8))

const usedBytes = computed(() => toNum(usage.value.monthly_rx_bytes) + toNum(usage.value.monthly_tx_bytes))
const usedTime = computed(() => toNum(usage.value.monthly_time))
const limitBytes = computed(() => {
  if (model.value.unit !== 'data') return null
  const n = Number.parseFloat(model.value.size)
  return Number.isFinite(n) && n > 0 ? n * 1024 * 1024 : null
})
const usedPercent = computed(() =>
  limitBytes.value ? percentOf(usedBytes.value, limitBytes.value) : 0,
)
const tone = computed(() =>
  usedPercent.value >= 90 ? 'danger' : usedPercent.value >= 70 ? 'warning' : 'primary',
)

const clearingMonthly = ref(false)
async function resetMonthlyUsage(): Promise<void> {
  const ok = await confirm({
    title: '清零本月用量',
    message: '确定将本月已用流量与累计联网时长清零吗？此操作将重置设备的月度用量。',
    danger: true,
  })
  if (!ok) return
  clearingMonthly.value = true
  try {
    await post(flowCalibration({ way: 'data', value: '0' }))
    await post(flowCalibration({ way: 'time', value: '0' }))
    toast('本月用量已成功清零', 'success')
    await loadUsage()
  } catch (e) {
    toast(e instanceof Error ? e.message : '清零失败', 'error')
  } finally {
    clearingMonthly.value = false
  }
}

const calMB = ref('')
const calibrating = ref(false)
async function calibrateData(): Promise<void> {
  const val = Number.parseFloat(calMB.value)
  if (!Number.isFinite(val) || val < 0) {
    toast('请输入大于等于 0 的校准数值', 'error')
    return
  }
  calibrating.value = true
  try {
    await post(flowCalibration({ way: 'data', value: String(Math.round(val)) }))
    toast(`已用流量已校准为 ${val} MB`, 'success')
    calMB.value = ''
    await loadUsage()
  } catch (e) {
    toast(e instanceof Error ? e.message : '校准失败', 'error')
  } finally {
    calibrating.value = false
  }
}

const clearingAll = ref(false)
async function clearAllTraffic(): Promise<void> {
  const ok = await confirm({
    title: '全部清空归零',
    message: '将同时清零「本月已用流量与时长」并清除「历史统计图表与分时记录」，全部归零。确认执行？',
    danger: true,
  })
  if (!ok) return
  clearingAll.value = true
  try {

    await post(flowCalibration({ way: 'data', value: '0' }))
    await post(flowCalibration({ way: 'time', value: '0' }))

    const s = (await getStatus(['realtime_tx_bytes', 'realtime_rx_bytes'])) as Record<string, string>
    const rtx = toNum(s.realtime_tx_bytes)
    const rrx = toNum(s.realtime_rx_bytes)
    await execSystem(`sh /mnt/userdata/flux_stat/collect.sh clear ${rtx} ${rrx}`)
    hourly.value = []
    daily.value = []
    toast('全部流量统计已归零', 'success')
    await refreshAll()
  } catch (e) {
    toast(e instanceof Error ? e.message : '清零失败', 'error')
  } finally {
    clearingAll.value = false
  }
}
</script>

<template>
  <PageForm
    title="流量管理"
    :loading="loading"
    :saving="saving"
    :error="error"
    :dirty="dirty"
    save-text="保存限额"
    @save="save()"
    @reset="reset()"
  >
    <template #right>
      <button type="button" class="refresh" aria-label="刷新用量" @click="refreshAll()">
        <Icon name="refresh" :size="20" />
      </button>
    </template>

    <Card>
      <div class="usage-hero">
        <div class="ring-box">
          <template v-if="limitBytes">
            <RingChart :percent="usedPercent" :tone="tone" :size="96" :stroke="8" />
            <div class="ring-overlay">
              <span class="ring-pct num">{{ usedPercent }}<small>%</small></span>
            </div>
          </template>
          <div v-else class="ring-unlim">
            <Icon name="activity" :size="28" />
            <span>不限额</span>
          </div>
        </div>

        <div class="usage-info">
          <span class="usage-label">本月已用流量</span>
          <p class="usage-val num">{{ formatBytes(usedBytes) }}</p>
          <div class="usage-badges">
            <span class="u-badge" :class="limitBytes ? 'is-accent' : ''">
              {{ limitBytes ? `上限 ${formatBytes(limitBytes)}` : '未设上限' }}
            </span>
            <span class="u-badge num">在线 {{ formatDuration(usedTime) }}</span>
          </div>
        </div>
      </div>

      <div class="rate-strip">
        <div class="rate-item">
          <span class="rate-dir is-rx"><Icon name="download" :size="14" /> 实时下行</span>
          <span class="rate-num num">{{ formatRate(toNum(raw.realtime_rx_thrpt)) }}</span>
        </div>
        <div class="rate-sep" />
        <div class="rate-item">
          <span class="rate-dir is-tx"><Icon name="upload" :size="14" /> 实时上行</span>
          <span class="rate-num num">{{ formatRate(toNum(raw.realtime_tx_thrpt)) }}</span>
        </div>
      </div>
    </Card>

    <Card title="校准与清零">
      <div class="cal-bar">
        <div class="cal-input-wrap">
          <input
            v-model="calMB"
            type="number"
            min="0"
            class="cal-input num"
            placeholder="实际已用量"
            inputmode="numeric"
          />
          <span class="cal-unit">MB</span>
        </div>
        <button
          type="button"
          class="btn btn-primary cal-submit"
          :disabled="calibrating || !calMB"
          @click="calibrateData"
        >
          {{ calibrating ? '校准中…' : '校准' }}
        </button>
      </div>

      <div class="btn-row mt">
        <button
          type="button"
          class="btn btn-ghost flex-1 btn-sm"
          :disabled="clearingMonthly"
          @click="resetMonthlyUsage"
        >
          {{ clearingMonthly ? '清零中…' : '清零本月' }}
        </button>
        <button
          type="button"
          class="btn btn-danger flex-1 btn-sm"
          :disabled="clearingAll"
          @click="clearAllTraffic"
        >
          {{ clearingAll ? '清空中…' : '全量归零' }}
        </button>
      </div>
    </Card>

    <Card title="套餐限额">
      <div class="switch-row">
        <span class="switch-title">套餐限额</span>
        <Toggle v-model="model.limitEnabled" label="启用限额" />
      </div>

      <Transition name="fade">
        <div v-if="model.limitEnabled" class="limit-body">
          <div class="seg">
            <button
              type="button"
              class="seg-btn"
              :class="{ 'is-on': model.unit === 'data' }"
              @click="model.unit = 'data'"
            >
              按流量
            </button>
            <button
              type="button"
              class="seg-btn"
              :class="{ 'is-on': model.unit === 'time' }"
              @click="model.unit = 'time'"
            >
              按时长
            </button>
          </div>

          <FormField
            :label="model.unit === 'data' ? '上限 (MB)' : '上限 (分钟)'"
            :error="fieldErrors.size"
          >
            <input v-model="model.size" class="num" type="number" min="1" inputmode="numeric" />
          </FormField>

          <div class="presets">
            <button
              v-for="p in model.unit === 'data' ? UNIT_PRESETS : TIME_PRESETS"
              :key="p.label"
              type="button"
              class="preset num"
              :class="{ 'is-active': model.size === String('mb' in p ? p.mb : p.min) }"
              @click="model.size = String('mb' in p ? p.mb : p.min)"
            >
              {{ p.label }}
            </button>
          </div>

          <FormField label="预警阈值 (%)" :error="fieldErrors.alertPercent" class="mt">
            <input v-model="model.alertPercent" class="num" type="number" min="1" max="100" inputmode="numeric" />
          </FormField>
        </div>
      </Transition>
    </Card>

    <Card title="分时流量">
      <div class="switch-row">
        <span class="switch-title">后台采样</span>
        <Toggle
          :model-value="fluxOn"
          label="启用流量统计"
          @update:model-value="setFluxSwitch"
        />
      </div>

      <p v-if="!fluxOn" class="empty">采样已关闭</p>

      <template v-else>
        <div class="seg mt">
          <button
            type="button"
            class="seg-btn"
            :class="{ 'is-on': fluxTab === 'hour' }"
            @click="fluxTab = 'hour'"
          >
            24 小时
          </button>
          <button
            type="button"
            class="seg-btn"
            :class="{ 'is-on': fluxTab === 'day' }"
            @click="fluxTab = 'day'"
          >
            14 天
          </button>
        </div>

        <div class="stat-bento">
          <div class="stat-box">
            <span class="t-cap">周期合计</span>
            <span class="stat-num num">{{ formatBytes(sumAll) }}</span>
          </div>
          <div class="stat-box">
            <span class="t-cap">{{ fluxTab === 'hour' ? '时均' : '日均' }}</span>
            <span class="stat-num num">{{ formatBytes(perPeriod) }}</span>
          </div>
          <div class="stat-box">
            <span class="t-cap">峰值 {{ peak ? `(${peak.label})` : '' }}</span>
            <span class="stat-num num t-primary">{{ peak ? formatBytes(peak.total) : '—' }}</span>
          </div>
          <div class="stat-box">
            <span class="t-cap">采样时长</span>
            <span class="stat-num num">{{ formatDuration(uptime.session) }}</span>
          </div>
        </div>

        <div class="legend">
          <span><i class="dot dot-rx" />下行 {{ formatBytes(sumRx) }}</span>
          <span><i class="dot dot-tx" />上行 {{ formatBytes(sumTx) }}</span>
        </div>

        <ul v-if="topRows.length" class="hbars">
          <li v-for="r in topRows" :key="r.key" class="hbar">
            <span class="hbar-label num">{{ r.label }}</span>
            <span class="hbar-track">
              <span class="hbar-rx" :style="{ width: `${(r.rx / rowMax) * 100}%` }" />
              <span class="hbar-tx" :style="{ width: `${(r.tx / rowMax) * 100}%` }" />
            </span>
            <span class="hbar-val num">{{ formatBytes(r.total) }}</span>
          </li>
        </ul>

        <p v-else class="empty">暂无记录</p>

        <button
          type="button"
          class="btn btn-ghost btn-block btn-sm mt"
          :disabled="clearing"
          @click="clearFlux"
        >
          {{ clearing ? '清空中…' : '清空图表记录' }}
        </button>
      </template>
    </Card>
  </PageForm>
</template>

<style scoped>
.refresh {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--r-md);
  color: var(--c-text-2);
}

.usage-hero {
  display: flex;
  align-items: center;
  gap: var(--sp-4);
}

.ring-box {
  position: relative;
  flex: none;
  width: 96px;
  height: 96px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ring-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ring-pct {
  font-size: 18px;
  font-weight: 700;
  color: var(--c-text-1);
}

.ring-pct small {
  font-size: 11px;
  font-weight: 500;
  color: var(--c-text-3);
}

.ring-unlim {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: 88px;
  height: 88px;
  border-radius: 50%;
  background: var(--c-primary-50);
  color: var(--c-primary-400);
  border: 1px dashed var(--c-primary-200);
  font-size: 11px;
  font-weight: 600;
}

[data-theme='dark'] .ring-unlim {
  background: rgba(34, 181, 134, 0.12);
  border-color: rgba(34, 181, 134, 0.35);
}

.usage-info {
  flex: 1;
  min-width: 0;
}

.usage-label {
  font-size: var(--fs-cap);
  color: var(--c-text-3);
}

.usage-val {
  font-size: 26px;
  font-weight: 700;
  color: var(--c-text-1);
  line-height: 1.2;
  margin: 2px 0 6px;
}

.usage-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.u-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: var(--r-full);
  background: var(--c-surface-2);
  color: var(--c-text-2);
}

.u-badge.is-accent {
  background: var(--c-primary-50);
  color: var(--c-primary-600);
  font-weight: 600;
}

[data-theme='dark'] .u-badge.is-accent {
  background: rgba(34, 181, 134, 0.18);
  color: var(--c-primary-400);
}

.rate-strip {
  display: flex;
  align-items: center;
  margin-top: var(--sp-4);
  padding-top: var(--sp-3);
  border-top: 1px solid var(--c-line);
}

.rate-item {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.rate-sep {
  width: 1px;
  height: 20px;
  background: var(--c-line);
  margin: 0 var(--sp-3);
}

.rate-dir {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: var(--fs-cap);
  color: var(--c-text-3);
}

.rate-dir.is-rx {
  color: var(--c-primary-400);
}

.rate-num {
  font-size: var(--fs-sub);
  font-weight: 600;
  color: var(--c-text-1);
}

.cal-bar {
  display: flex;
  gap: var(--sp-2);
}

.cal-input-wrap {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
}

.cal-input {
  width: 100%;
  height: 40px;
  padding: 0 38px 0 var(--sp-3);
  background: var(--c-surface-2);
  border: 1px solid var(--c-line);
  border-radius: var(--r-md);
  outline: none;
  font-size: var(--fs-sub);
  color: var(--c-text-1);
}

.cal-input:focus {
  border-color: var(--c-primary-400);
  background: var(--c-surface);
}

.cal-unit {
  position: absolute;
  right: 12px;
  font-size: var(--fs-cap);
  color: var(--c-text-3);
  font-weight: 600;
}

.cal-submit {
  min-height: 40px;
  padding: 0 var(--sp-4);
  font-size: var(--fs-sub);
}

.btn-sm {
  min-height: 38px;
  font-size: var(--fs-sub);
}

.switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
}

.switch-title {
  font-size: var(--fs-body);
  font-weight: 500;
}

.limit-body {
  margin-top: var(--sp-4);
  padding-top: var(--sp-4);
  border-top: 1px solid var(--c-line);
}

.seg {
  display: flex;
  gap: 4px;
  padding: 4px;
  margin-bottom: var(--sp-3);
  background: var(--c-surface-2);
  border-radius: var(--r-md);
}

.seg-btn {
  flex: 1;
  min-height: 34px;
  border-radius: var(--r-sm);
  font-size: var(--fs-sub);
  color: var(--c-text-2);
  transition: all 0.15s ease;
}

.seg-btn.is-on {
  color: var(--c-primary-600);
  background: var(--c-surface);
  font-weight: 600;
  box-shadow: var(--shadow-sm);
}

[data-theme='dark'] .seg-btn.is-on {
  color: var(--c-primary-400);
}

.presets {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
  margin-top: var(--sp-2);
}

.preset {
  padding: 5px 12px;
  border-radius: var(--r-full);
  font-size: var(--fs-cap);
  color: var(--c-text-2);
  background: var(--c-surface-2);
  border: 1px solid var(--c-line);
  transition: all 0.15s ease;
}

.preset.is-active {
  color: var(--c-primary-600);
  background: var(--c-primary-50);
  border-color: var(--c-primary-400);
  font-weight: 600;
}

[data-theme='dark'] .preset.is-active {
  color: var(--c-primary-400);
  background: rgba(34, 181, 134, 0.16);
}

.mt {
  margin-top: var(--sp-3);
}

.stat-bento {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--sp-2);
}

.stat-box {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: var(--sp-3);
  border-radius: var(--r-md);
  background: var(--c-surface-2);
}

.stat-num {
  font-size: 16px;
  font-weight: 700;
  color: var(--c-text-1);
}

.legend {
  display: flex;
  align-items: center;
  gap: var(--sp-4);
  margin-top: var(--sp-3);
  font-size: var(--fs-cap);
  color: var(--c-text-2);
}

.dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  margin-right: 5px;
  border-radius: 50%;
}

.dot-rx {
  background: var(--c-primary-400);
}

.dot-tx {
  background: var(--c-primary-200);
}

.hbars {
  margin-top: var(--sp-3);
}

.hbar {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding: 6px 0;
}

.hbar-label {
  flex: none;
  width: 46px;
  font-size: var(--fs-cap);
  color: var(--c-text-3);
}

.hbar-track {
  flex: 1;
  display: flex;
  min-width: 0;
  height: 10px;
  overflow: hidden;
  border-radius: var(--r-full);
  background: var(--c-surface-2);
}

.hbar-rx {
  height: 100%;
  background: linear-gradient(90deg, var(--c-primary-400), var(--c-primary-200));
}

.hbar-tx {
  height: 100%;
  background: var(--c-primary-100);
}

.hbar-val {
  flex: none;
  width: 68px;
  font-size: var(--fs-cap);
  font-weight: 500;
  text-align: right;
  color: var(--c-text-1);
}

.btn-row {
  display: flex;
  gap: var(--sp-2);
}

.flex-1 {
  flex: 1;
}
</style>
