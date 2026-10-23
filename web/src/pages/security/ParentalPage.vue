<script setup lang="ts">import { computed, ref } from 'vue'
import { addDevice, delDevice, getCmdRaw, getStatus, post, saveTimeLimited } from '@/api'
import { useStations } from '@/composables/useStations'
import { normalizeMac, validateMac } from '@/utils/validators'
import { toast } from '@/components/toast'
import { confirm } from '@/components/confirm'
import { withLoading } from '@/components/loading'
import PageForm from '@/layouts/PageForm.vue'
import Card from '@/components/Card.vue'
import FormField from '@/components/FormField.vue'
import Icon from '@/components/Icon.vue'

interface ChildDevice {
  hostname: string
  mac: string
}

const raw = ref<Record<string, string>>({})
const childDevices = ref<ChildDevice[]>([])
const loading = ref(true)
const error = ref('')
const busy = ref(false)

const newMac = ref('')
const macError = ref('')

const { stations: onlineStations, refresh: refreshStations } = useStations()

async function load(): Promise<void> {
  loading.value = true
  try {
    const [s, cRes] = await Promise.all([
      getStatus(['time_limited']),
      getCmdRaw<{ devices?: ChildDevice[] }>('childGroupList'),
      refreshStations(),
    ])
    raw.value = s as Record<string, string>
    childDevices.value = (cRes?.devices ?? []).map((d) => ({
      hostname: d.hostname === '--' ? '' : d.hostname,
      mac: (d.mac || '').toUpperCase(),
    }))
    error.value = ''

    const parsed = parseTimeLimited(s.time_limited ?? '')
    if (parsed) {
      startHour.value = parsed.start
      endHour.value = parsed.end
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : '读取失败'
  } finally {
    loading.value = false
  }
}
void load()
const childMacSet = computed(() => new Set(childDevices.value.map((d) => d.mac.toUpperCase())))

async function onAddDevice(macToAdd?: string): Promise<void> {

  const m = normalizeMac(macToAdd ?? newMac.value)
  if (m === null) {
    const msg = 'MAC 格式应为 AA:BB:CC:DD:EE:FF'
    macError.value = msg
    toast(msg, 'error')
    return
  }
  const err = validateMac(m)
  if (err) {
    macError.value = err
    toast(err, 'error')
    return
  }
  macError.value = ''
  if (childMacSet.value.has(m)) {
    toast('该设备已在受控列表中', 'error')
    return
  }
  busy.value = true
  try {
    await withLoading(async () => {
      const res = await post(addDevice(m))
      if (res.result !== 'success') throw new Error(res.result || '添加失败')
    }, '正在添加受控设备…')
    toast('已添加受控设备', 'success')
    newMac.value = ''
    await load()
  } catch (e) {
    toast(e instanceof Error ? e.message : '添加失败', 'error')
  } finally {
    busy.value = false
  }
}

async function onDelDevice(dev: ChildDevice): Promise<void> {
  const ok = await confirm({
    title: '移出受控设备',
    message: `确认将 ${dev.hostname || dev.mac} 移出受控列表？`,
  })
  if (!ok) return
  busy.value = true
  try {
    await withLoading(async () => {
      const res = await post(delDevice(dev.mac))
      if (res.result !== 'success') throw new Error(res.result || '移出失败')
    }, '正在移出…')
    toast('已移出受控列表', 'success')
    await load()
  } catch (e) {
    toast(e instanceof Error ? e.message : '移出失败', 'error')
  } finally {
    busy.value = false
  }
}

function parseTimeLimited(s: string): { start: string; end: string } | null {
  const items = (s ?? '')
    .split(';')
    .map((x) => x.trim())
    .filter(Boolean)
  for (const it of items) {
    const m = /^\d\+(\d{1,2}),(\d{1,2})$/.exec(it)
    if (m) return { start: m[1], end: m[2] }
  }
  return null
}

const startHour = ref('0')
const endHour = ref('24')

const HOURS = Array.from({ length: 25 }, (_, i) => ({
  label: i === 24 ? '24:00' : `${String(i).padStart(2, '0')}:00`,
  value: String(i),
}))

const timeLimited = computed(() =>
  [0, 1, 2, 3, 4, 5, 6].map((d) => `${d}+${startHour.value},${endHour.value}`).join(';'),
)

async function save(): Promise<void> {
  const s = Number(startHour.value)
  const e = Number(endHour.value)
  if (!Number.isFinite(s) || !Number.isFinite(e) || s < 0 || e > 24) {
    toast('时段范围不合法', 'error')
    return
  }
  if (s === e) {
    toast('起止时间不能相同', 'error')
    return
  }
  const ok = await confirm({
    title: '保存上网时段',
    message: `允许上网时段（每天）：${startHour.value} 点 ~ ${endHour.value} 点。`,
    danger: true,
  })
  if (!ok) return
  busy.value = true
  try {
    await withLoading(async () => {
      const res = await post(saveTimeLimited(timeLimited.value))
      if (res.result !== 'success') throw new Error(res.result || '保存失败')
    }, '正在保存…')
    toast('已保存', 'success')
    await load()
  } catch (err0) {
    toast(err0 instanceof Error ? err0.message : '保存失败', 'error')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <PageForm title="家长控制" :loading="loading" :error="error" :savable="false">

    <Card>
      <div class="ctl-hero">
        <div class="ctl-hero-left">
          <div class="ctl-hero-icon" :class="{ 'is-active': childDevices.length > 0 }">
            <Icon name="clock" :size="20" />
          </div>
          <div class="ctl-hero-meta">
            <div class="ctl-title-row">
              <span class="ctl-name">家长控制</span>
              <span class="status-pill" :class="childDevices.length > 0 ? 'pill-on' : 'pill-off'">
                {{ childDevices.length > 0 ? `${childDevices.length} 台受控` : '未开启' }}
              </span>
            </div>
            <span class="t-cap">
              上网时段：{{ startHour }}:00 ~ {{ endHour }}:00
            </span>
          </div>
        </div>
      </div>
    </Card>

    <Card title="允许上网时段">
      <div class="time-window-grid">
        <FormField label="起始时刻">
          <select v-model="startHour">
            <option v-for="h in HOURS" :key="h.value" :value="h.value">{{ h.label }}</option>
          </select>
        </FormField>
        <FormField label="结束时刻">
          <select v-model="endHour">
            <option v-for="h in HOURS" :key="h.value" :value="h.value">{{ h.label }}</option>
          </select>
        </FormField>
      </div>

      <div class="time-foot">
        <span class="t-cap">每日生效</span>
        <button type="button" class="btn-save-time" :disabled="busy" @click="save">
          {{ busy ? '保存中…' : '保存时段' }}
        </button>
      </div>
    </Card>

    <Card :title="`受控设备 (${childDevices.length})`">
      <div v-if="childDevices.length" class="dev-list">
        <div v-for="dev in childDevices" :key="dev.mac" class="dev-card">
          <div class="dev-left">
            <div class="dev-avatar">
              <Icon name="smartphone" :size="16" />
            </div>
            <div class="dev-info">
              <span class="dev-name">{{ dev.hostname || dev.mac }}</span>
              <span class="dev-mac num">{{ dev.mac }}</span>
            </div>
          </div>
          <button
            type="button"
            class="btn-remove"
            :disabled="busy"
            title="移出"
            @click="onDelDevice(dev)"
          >
            <Icon name="trash" :size="14" />
          </button>
        </div>
      </div>
      <p v-else class="empty-p t-cap">暂无受控设备，其余设备不受时段限制</p>

      <div class="add-section">
        <div class="add-bar">
          <input
            v-model="newMac"
            class="num add-input"
            type="text"
            placeholder="MAC 地址 (AA:BB:CC:DD:EE:FF)"
            maxlength="17"
            autocomplete="off"
            @keyup.enter="() => onAddDevice()"
          />
          <button
            type="button"
            class="btn-add"
            :disabled="busy || !newMac.trim()"
            @click="() => onAddDevice()"
          >
            <span>添加</span>
          </button>
        </div>
        <p v-if="macError" class="field-error">{{ macError }}</p>

        <div v-if="onlineStations.length" class="quick-devices">
          <div class="quick-chips">
            <button
              v-for="st in onlineStations"
              :key="st.mac"
              type="button"
              class="st-chip"
              :class="{ 'is-added': childMacSet.has(st.mac) }"
              :disabled="busy || childMacSet.has(st.mac)"
              @click="onAddDevice(st.mac)"
            >
              <span class="chip-host">{{ st.hostname || st.mac }}</span>
              <span v-if="childMacSet.has(st.mac)" class="chip-tag">已添加</span>
            </button>
          </div>
        </div>
      </div>
    </Card>
  </PageForm>
</template>

<style scoped>
.ctl-hero { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-3); }
.ctl-hero-left { display: flex; align-items: center; gap: var(--sp-3); min-width: 0; }
.ctl-hero-icon { width: 38px; height: 38px; border-radius: var(--r-md); background: var(--c-surface-2); color: var(--c-text-3); display: flex; align-items: center; justify-content: center; flex: none; transition: all 0.2s ease; }
.ctl-hero-icon.is-active { background: var(--c-primary-50); color: var(--c-primary-400); }
[data-theme='dark'] .ctl-hero-icon.is-active { background: var(--c-primary-100); color: var(--c-primary-600); }

.ctl-hero-meta { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.ctl-title-row { display: flex; align-items: center; gap: 6px; }
.ctl-name { font-size: 15px; font-weight: 700; color: var(--c-text-1); }
.status-pill { font-size: 11px; font-weight: 600; padding: 1px 6px; border-radius: var(--r-sm); }
.pill-on { background: var(--c-primary-50); color: var(--c-primary-600); }
[data-theme='dark'] .pill-on { background: rgba(34, 181, 134, 0.2); color: var(--c-primary-400); }
.pill-off { background: var(--c-surface-2); color: var(--c-text-3); }

.time-window-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-2); }
@media (max-width: 480px) { .time-window-grid { grid-template-columns: 1fr; } }
.time-foot { display: flex; align-items: center; justify-content: space-between; margin-top: var(--sp-2); padding-top: var(--sp-2); border-top: 1px solid var(--c-line); }
.btn-save-time { padding: 6px 14px; border-radius: var(--r-sm); background: var(--c-primary-400); color: #fff; border: none; font-size: 12px; font-weight: 600; cursor: pointer; }

.dev-list { display: flex; flex-direction: column; gap: var(--sp-2); }
.dev-card { display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; border-radius: var(--r-sm); background: var(--c-surface); border: 1px solid var(--c-line); }
.dev-left { display: flex; align-items: center; gap: var(--sp-2); min-width: 0; }
.dev-avatar { width: 30px; height: 30px; border-radius: var(--r-sm); background: var(--c-surface-2); color: var(--c-text-2); display: flex; align-items: center; justify-content: center; flex: none; }
.dev-info { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.dev-name { font-size: 13px; font-weight: 600; color: var(--c-text-1); }
.dev-mac { font-size: 10px; color: var(--c-text-3); }
.btn-remove { width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border-radius: var(--r-sm); background: transparent; color: var(--c-text-3); border: none; cursor: pointer; }
.btn-remove:hover { background: var(--c-danger-bg); color: var(--c-danger); }
.empty-p { text-align: center; padding: var(--sp-2) 0; }

.add-section { margin-top: var(--sp-3); padding-top: var(--sp-2); border-top: 1px solid var(--c-line); }
.add-bar { display: flex; gap: var(--sp-2); }
.add-input { flex: 1; height: 36px; padding: 0 var(--sp-3); background: var(--c-surface-2); border: 1px solid var(--c-line); border-radius: var(--r-sm); color: var(--c-text-1); font-size: 12px; outline: none; }
.add-input:focus { border-color: var(--c-primary-400); }
.btn-add { display: inline-flex; align-items: center; padding: 0 14px; border-radius: var(--r-sm); background: var(--c-primary-400); color: #fff; border: none; font-size: 12px; font-weight: 600; cursor: pointer; flex: none; }
.btn-add:disabled { opacity: 0.5; cursor: not-allowed; }
.field-error { color: var(--c-danger); font-size: 11px; margin-top: 3px; }

.quick-devices { margin-top: var(--sp-2); }
.quick-chips { display: flex; flex-wrap: wrap; gap: 4px; }
.st-chip { display: inline-flex; align-items: center; gap: 4px; padding: 2px 7px; border-radius: var(--r-sm); background: var(--c-surface); border: 1px solid var(--c-line); color: var(--c-text-2); font-size: 11px; cursor: pointer; }
.st-chip:hover:not(:disabled) { border-color: var(--c-primary-400); color: var(--c-text-1); }
.st-chip.is-added { opacity: 0.5; cursor: default; }
.chip-host { font-weight: 500; }
.chip-tag { font-size: 9px; color: var(--c-text-3); }
</style>
