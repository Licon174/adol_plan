<script setup lang="ts">import { computed, ref } from 'vue'
import { SIM_KEYS, execSystem, getStatus, post, selectSim } from '@/api'
import { toast } from '@/components/toast'
import { confirm } from '@/components/confirm'
import { withLoading } from '@/components/loading'
import PageForm from '@/layouts/PageForm.vue'
import Card from '@/components/Card.vue'
import Icon from '@/components/Icon.vue'

const SIM_DIR = '/mnt/userdata/sim_switch'
const MAXR = 6

const raw = ref<Record<string, string>>({})
const loading = ref(true)
const error = ref('')
const busy = ref(false)

const keyOn = ref('')
const keyStat = ref('')
const keyMap = ref('')
const keyRules = ref('')
const keyApplied = ref('')
const keySlots = ref('')

async function readText(url: string): Promise<string> {
  try {
    const r = await fetch(`${url}?r=${Date.now()}`, { cache: 'no-store' })
    return r.ok ? (await r.text()).trim() : ''
  } catch {
    return ''
  }
}

async function load(): Promise<void> {
  loading.value = true
  try {
    raw.value = (await getStatus([
      ...SIM_KEYS,
      'alk_check_runsta',
      'alk_operator0',
      'alk_operator1',
      'alk_operator2',
      'alk_operator3',
    ])) as Record<string, string>
    error.value = ''
  } catch (e) {
    error.value = e instanceof Error ? e.message : '读取失败'
  } finally {
    loading.value = false
  }
  keyOn.value = await readText('./keysim_on.txt')
  keyStat.value = await readText('./keysim_stat.txt')
  keyMap.value = await readText('./keysim_map.txt')
  keyRules.value = await readText('./keysim_rules.txt')
  keyApplied.value = await readText('./keysim_applied.txt')
  syncRules()

  await syncSlots()
  keySlots.value = await readText('./keysim_slots.txt')
}
void load()

const current = computed(() => (raw.value.alk_sim_current ?? '').trim())

const operator = computed(() => {
  const bySlot = (raw.value[`alk_operator${current.value}`] ?? '').trim()
  return bySlot || (raw.value.network_provider ?? '').trim() || (raw.value.network_operator ?? '').trim() || '—'
})

const isEmpty = (iccid: string) => !iccid || /^0+$/.test(iccid)

const slots = computed<{ slot: number; iccid: string; isCurrent: boolean }[]>(() => {
  const out: { slot: number; iccid: string; isCurrent: boolean }[] = []
  for (let i = 0; i < 4; i++) {
    out.push({
      slot: i,
      iccid: (raw.value[`alk_iccid${i}`] ?? '').trim(),
      isCurrent: String(i) === current.value,
    })
  }
  if (out.every((x) => isEmpty(x.iccid)) && keyMap.value) {
    for (const line of keyMap.value.split(/[\r\n]+/)) {
      const m = line.trim().match(/^(\d+)\s*=\s*(\S+)/)
      if (m && out[Number(m[1])]) out[Number(m[1])].iccid = m[2]
    }
  }
  return out
})

const slotKind = (slot: number): string => (slot === 0 ? '外置' : '内置')

async function syncSlots(): Promise<void> {
  const cur = Number.parseInt((raw.value.alk_sim_current ?? '').trim(), 10)
  const order = [1, 2, 3, 0]
  const avail: number[] = []
  const mapLines: string[] = []
  for (const s of order) {
    const v = (raw.value[`alk_iccid${s}`] ?? '').trim()
    if (!v || /^0+$/.test(v)) continue
    avail.push(s)
    mapLines.push(`${s}=${v}`)
  }
  const curSlot = Number.isFinite(cur) ? cur : (avail[0] ?? 0)
  const slotsText = avail.length ? `${curSlot} ${avail.join(' ')}` : String(curSlot)

  try {
    await execSystem(`mkdir -p ${SIM_DIR}`)
    await uploadText(slotsText, `${SIM_DIR}/slots.txt`)
    if (mapLines.length) await uploadText(mapLines.join('\n') + '\n', `${SIM_DIR}/map.txt`)
  } catch {

  }
}

async function switchTo(slot: number): Promise<void> {
  if (String(slot) === current.value) return
  const ok = await confirm({ title: '切换 SIM', message: `切换到卡槽 ${slot}？`, danger: true })
  if (!ok) return
  busy.value = true
  try {
    await withLoading(async () => {

      await post(selectSim(slot), { timeoutMs: 8000, expectAbort: true })
    }, '正在切换…')
    toast('已切换', 'success')
    await load()
  } catch (e) {
    toast(e instanceof Error ? e.message : '切换失败', 'error')
  } finally {
    busy.value = false
  }
}

interface Rule {
  key: string
  mode: 'hold' | 'multi'
  count: string
  lo: string
  hi: string
  action: string
}

const rules = ref<Rule[]>([])

const blank = (): Rule => ({ key: 'P', mode: 'hold', count: '2', lo: '300', hi: '2000', action: 'next' })

function parseRule(line: string): Rule | null {
  const p = line.split(',')
  if (p.length < 5) return null
  const [lo, hi] = (p[3] || '').split('-')
  return {
    key: p[0] || 'P',
    mode: p[1] === 'multi' ? 'multi' : 'hold',
    count: p[2] || '2',
    lo: lo || '300',
    hi: hi || '2000',
    action: p[4] || 'next',
  }
}

function syncRules(): void {
  const lines = keyRules.value.split(/[\r\n]+/).map((x) => x.trim()).filter(Boolean)
  const parsed = lines.map(parseRule).filter((x): x is Rule => !!x)
  rules.value = parsed.length ? parsed : [blank()]
}

const serialize = (r: Rule) => `${r.key},${r.mode},${r.count},${r.lo}-${r.hi},${r.action}`

function addRule(): void {
  if (rules.value.length >= MAXR) {
    toast(`最多 ${MAXR} 条规则`, 'error')
    return
  }
  rules.value = [...rules.value, blank()]
}

function delRule(i: number): void {
  rules.value = rules.value.filter((_, k) => k !== i)
  if (!rules.value.length) rules.value = [blank()]
}

function applyPreset(p: 'double_click' | 'long_press' | 'triple_slot0'): void {
  if (p === 'double_click') {
    rules.value = [{ key: 'P', mode: 'multi', count: '2', lo: '150', hi: '800', action: 'next' }]
    toast('已填入「双击电源键切下一张」规则', 'info')
  } else if (p === 'long_press') {
    rules.value = [{ key: 'P', mode: 'hold', count: '1', lo: '1000', hi: '2500', action: 'next' }]
    toast('已填入「长按1.5秒切下一张」规则', 'info')
  } else if (p === 'triple_slot0') {
    rules.value = [{ key: 'P', mode: 'multi', count: '3', lo: '150', hi: '800', action: '0' }]
    toast('已填入「三击切外置卡槽」规则', 'info')
  }
}

const ruleText = computed(() => rules.value.map(serialize).join('\n') + '\n')

const ruleEffective = computed(() => {
  const norm = (x: string) => String(x || '').replace(/\s+/g, '')
  return norm(keyApplied.value) === norm(ruleText.value)
})

async function saveRules(): Promise<void> {
  const on = keySwitchOn.value
  const ok = await confirm({
    title: '保存规则',
    message: `${rules.value.length} 条规则\n${on ? '保存并重启切卡守护进程？' : '按键切卡当前是停用状态，只保存规则（不启动守护进程）。确认？'}`,
    danger: true,
  })
  if (!ok) return
  busy.value = true
  try {
    await withLoading(async () => {
      await execSystem(`mkdir -p ${SIM_DIR}`)

      await syncSlots()
      await uploadText(ruleText.value, `${SIM_DIR}/rules.txt`)

      await execSystem(`printf '${on ? 1 : 0}' > ${SIM_DIR}/on.txt`)

      await execSystem(`${SIM_DIR}/ctl.sh ${on ? 'start' : 'stop'}`)
    }, '正在保存…')
    toast(on ? '已保存，守护进程已启动' : '已保存（按键切卡处于停用状态）', 'success')
    await load()
  } catch (e) {
    toast(e instanceof Error ? e.message : '保存失败', 'error')
  } finally {
    busy.value = false
  }
}

const CHUNK = 3200

function toHexEscapes(b: Uint8Array): string {
  let s = ''
  for (let i = 0; i < b.length; i++) s += '\\x' + b[i].toString(16).padStart(2, '0')
  return s
}

async function uploadText(text: string, path: string): Promise<void> {
  const bytes = new TextEncoder().encode(text)
  const esc = toHexEscapes(bytes)
  let off = 0
  while (off < bytes.length) {
    const end = Math.min(off + CHUNK, bytes.length)
    await execSystem(`printf '${esc.substr(off * 4, (end - off) * 4)}' ${off === 0 ? '>' : '>>'} ${path}`)
    off = end
  }
}

const keySwitchOn = computed(() => keyOn.value.startsWith('1'))

async function toggleKeySwitch(next: boolean): Promise<void> {
  busy.value = true
  try {
    await withLoading(async () => {
      await execSystem(`${SIM_DIR}/ctl.sh ${next ? 'start' : 'stop'} ; echo ${next ? 1 : 0} > ${SIM_DIR}/on.txt`)
    }, next ? '正在启用…' : '正在停用…')
    toast(next ? '已启用' : '已停用', 'success')
    await load()
  } catch (e) {
    toast(e instanceof Error ? e.message : '操作失败', 'error')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <PageForm title="SIM 卡管理" :loading="loading" :error="error" :savable="false">
    <template #right>
      <button type="button" class="icon-btn" aria-label="刷新" @click="load">
        <Icon name="refresh" :size="20" />
      </button>
    </template>

    <Card>
      <div class="active-sim-banner">
        <div class="sim-brand-box">
          <div class="sim-icon-pill">
            <Icon name="sim-card" :size="22" />
          </div>
          <div class="sim-brand-meta">
            <span class="sim-op-name">{{ operator }}</span>
            <span class="sim-slot-capsule">
              <span class="dot-online" /> 卡槽 {{ current }} ({{ slotKind(Number(current)) }})
            </span>
          </div>
        </div>
        <div class="sim-ids">
          <span class="t-cap num">ICCID: {{ raw.ziccid || '—' }}</span>
          <span class="t-cap num">IMSI: {{ raw.sim_imsi || '—' }}</span>
        </div>
      </div>
    </Card>

    <Card title="卡槽与芯片">
      <div class="sim-tray-grid">
        <button
          v-for="s in slots"
          :key="s.slot"
          type="button"
          class="sim-chip-card"
          :class="{
            'is-active': s.isCurrent,
            'is-empty': isEmpty(s.iccid),
          }"
          :disabled="busy || s.isCurrent || isEmpty(s.iccid)"
          @click="switchTo(s.slot)"
        >

          <div class="sim-chip-top">
            <div class="slot-badge">
              <span class="badge-num num">槽 {{ s.slot }}</span>
              <span class="badge-type">{{ slotKind(s.slot) }}</span>
            </div>
            <span v-if="s.isCurrent" class="chip-state state-active">● 工作中</span>
            <span v-else-if="isEmpty(s.iccid)" class="chip-state state-empty">空槽</span>
            <span v-else class="chip-state state-idle">待命</span>
          </div>

          <div v-if="!isEmpty(s.iccid)" class="sim-nano-graphic" title="Nano-SIM 芯片">
            <svg viewBox="0 0 34 24" width="34" height="24" class="sim-svg">
              <path d="M1 1h24l7 7v14a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1z" class="sim-svg-shell" />
              <rect x="6" y="3.5" width="20" height="16" rx="2" class="sim-svg-gold" />
              <line x1="6" y1="9" x2="26" y2="9" class="sim-svg-trace" />
              <line x1="6" y1="14" x2="26" y2="14" class="sim-svg-trace" />
              <line x1="16" y1="3.5" x2="16" y2="19.5" class="sim-svg-trace" />
              <rect x="12.5" y="7" width="7" height="9" rx="1.2" class="sim-svg-center" />
            </svg>
          </div>
          <div v-else class="sim-empty-graphic" title="空卡槽 (未插卡)">
            <svg viewBox="0 0 34 24" width="34" height="24" class="sim-svg-empty">
              <path d="M1 1h24l7 7v14a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1z" fill="none" stroke="currentColor" stroke-width="1.2" stroke-dasharray="2.5 1.8" />
              <circle cx="10" cy="7" r="1.1" fill="#d97706" />
              <circle cx="10" cy="11.5" r="1.1" fill="#d97706" />
              <circle cx="10" cy="16" r="1.1" fill="#d97706" />
              <circle cx="21" cy="7" r="1.1" fill="#d97706" />
              <circle cx="21" cy="11.5" r="1.1" fill="#d97706" />
              <circle cx="21" cy="16" r="1.1" fill="#d97706" />
            </svg>
          </div>

          <div class="sim-chip-bot">
            <span class="chip-iccid num">{{ isEmpty(s.iccid) ? '未插入 SIM 卡' : s.iccid }}</span>
            <span v-if="!s.isCurrent && !isEmpty(s.iccid)" class="switch-cta">点击切换 ›</span>
          </div>
        </button>
      </div>
    </Card>

    <Card title="按键切卡规则">

      <div class="preset-rule-bar">
        <span class="t-cap preset-title">预设：</span>
        <button type="button" class="preset-rule-chip" @click="applyPreset('double_click')">
          双击下张
        </button>
        <button type="button" class="preset-rule-chip" @click="applyPreset('long_press')">
          长按1.5s
        </button>
        <button type="button" class="preset-rule-chip" @click="applyPreset('triple_slot0')">
          三击外置
        </button>
      </div>

      <div class="rules-stream">
        <div v-for="(r, i) in rules" :key="i" class="rule-card">
          <div class="rule-top">
            <span class="rule-idx num">#{{ i + 1 }}</span>
            <span class="rule-raw num">{{ serialize(r) }}</span>
            <button type="button" class="del-rule-btn" :disabled="busy" title="删除" @click="delRule(i)">
              ×
            </button>
          </div>

          <div class="rule-pipeline">
            <div class="pipe-node">
              <span class="t-cap">按键</span>
              <span class="pipe-pill">电源</span>
            </div>

            <div class="pipe-arrow">➔</div>

            <div class="pipe-node">
              <span class="t-cap">手势</span>
              <select v-model="r.mode" class="pipe-select">
                <option value="hold">长按</option>
                <option value="multi">连按</option>
              </select>
            </div>

            <div class="pipe-node">
              <span class="t-cap">{{ r.mode === 'multi' ? '次数/间隔(ms)' : '按压(ms)' }}</span>
              <div class="pipe-range">
                <input
                  v-if="r.mode === 'multi'"
                  v-model="r.count"
                  class="num pipe-input count-inp"
                  type="number"
                  min="2"
                  max="9"
                  inputmode="numeric"
                />
                <div class="dur-range">
                  <input v-model="r.lo" class="num pipe-input" type="number" min="50" inputmode="numeric" />
                  <span>-</span>
                  <input v-model="r.hi" class="num pipe-input" type="number" min="50" inputmode="numeric" />
                </div>
              </div>
            </div>

            <div class="pipe-arrow">➔</div>

            <div class="pipe-node">
              <span class="t-cap">动作</span>
              <select v-model="r.action" class="pipe-select action-select">
                <option value="next">下一张</option>
                <option value="prev">上一张</option>
                <option v-for="s in slots" :key="`a${s.slot}`" :value="String(s.slot)">
                  槽 {{ s.slot }} ({{ slotKind(s.slot) }})
                </option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div class="rule-actions mt-3">
        <button type="button" class="btn btn-secondary flex-1" :disabled="busy" @click="addRule">
          + 规则 ({{ rules.length }}/{{ MAXR }})
        </button>
        <button type="button" class="btn btn-primary" :disabled="busy" @click="saveRules">
          保存规则
        </button>
      </div>
    </Card>

    <Card title="守护进程">
      <div class="stat-rows">
        <div class="stat-row">
          <span class="t-cap">key2simd 状态</span>
          <span class="stat-val num">{{ keyStat || '未运行' }}</span>
        </div>
        <div class="stat-row">
          <span class="t-cap">卡槽快照 (slots.txt)</span>
          <span class="stat-val num" :class="keySlots ? 'val-ok' : 'val-warn'">
            {{ keySlots ? '已同步' : '缺失' }}
          </span>
        </div>
        <div class="stat-row">
          <span class="t-cap">规则生效</span>
          <span class="stat-val num" :class="ruleEffective ? 'val-ok' : 'val-warn'">
            {{ ruleEffective ? '已生效' : '未生效' }}
          </span>
        </div>
      </div>

      <div class="mt-3">
        <button
          type="button"
          class="btn btn-block"
          :class="keySwitchOn ? 'btn-ghost' : 'btn-primary'"
          :disabled="busy"
          @click="toggleKeySwitch(!keySwitchOn)"
        >
          {{ keySwitchOn ? '停用按键切卡' : '启用按键切卡' }}
        </button>
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

.cap {
  font-size: var(--fs-cap);
  color: var(--c-text-3);
}

.tip {
  margin-top: var(--sp-2);
  line-height: 1.5;
}

.num {
  font-variant-numeric: tabular-nums;
}

.val {
  font-size: var(--fs-sub);
  color: var(--c-text-1);
  text-align: right;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 70%;
}

.row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--sp-3);
  padding: 7px 0;
}

.active-sim-banner {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}

.sim-brand-box {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
}

.sim-icon-pill {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: var(--r-md);
  background: var(--c-primary-50);
  color: var(--c-primary-400);
}

[data-theme='dark'] .sim-icon-pill {
  background: var(--c-primary-100);
  color: var(--c-primary-600);
}

.sim-brand-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.sim-op-name {
  font-size: var(--fs-h2);
  font-weight: 700;
  color: var(--c-text-1);
}

.sim-slot-capsule {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: var(--fs-cap);
  color: var(--c-primary-600);
  font-weight: 600;
}

.dot-online {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--c-primary-400);
  box-shadow: 0 0 6px var(--c-primary-400);
}

.sim-ids {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-top: var(--sp-2);
  border-top: 1px solid var(--c-line);
}

.sim-tray-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--sp-3);
}

.sim-chip-card {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 110px;
  padding: var(--sp-3);
  background: var(--c-surface);
  border: 1px solid var(--c-line);
  border-radius: var(--r-md);
  text-align: left;
  clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 0 100%);
  transition: all 0.15s cubic-bezier(0.2, 0, 0, 1);
  box-shadow: var(--shadow-sm);
  cursor: pointer;
}

.sim-chip-card:active:not(:disabled) {
  transform: scale(0.96);
}

.sim-chip-card.is-active {
  border-color: var(--c-primary-400);
  background: var(--c-primary-50);
  box-shadow: 0 0 12px rgba(28, 165, 123, 0.22);
}

[data-theme='dark'] .sim-chip-card.is-active {
  background: rgba(34, 181, 134, 0.12);
  border-color: var(--c-primary-400);
}

.sim-chip-card.is-empty {
  border-style: dashed;
  background: var(--c-surface-2);
  opacity: 0.75;
  cursor: default;
}

.sim-chip-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.slot-badge {
  display: flex;
  align-items: center;
  gap: 4px;
}

.badge-num {
  font-size: var(--fs-sub);
  font-weight: 700;
  color: var(--c-text-1);
}

.badge-type {
  font-size: 10px;
  padding: 1px 5px;
  border-radius: var(--r-sm);
  background: var(--c-surface-2);
  color: var(--c-text-3);
}

.chip-state {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: var(--r-full);
}

.state-active {
  color: var(--c-primary-600);
  background: #ffffff;
}

[data-theme='dark'] .state-active {
  background: var(--c-surface);
  color: var(--c-primary-400);
}

.state-idle {
  color: var(--c-text-2);
  background: var(--c-line);
}

.state-empty {
  color: var(--c-text-3);
  background: var(--c-surface-2);
  border: 1px dashed var(--c-line-strong);
}

.sim-nano-graphic,
.sim-empty-graphic {
  display: flex;
  align-items: center;
  margin: 6px 0;
}

.sim-svg-shell {
  fill: var(--c-surface-2);
  stroke: var(--c-line-strong);
  stroke-width: 1.1;
}

[data-theme='dark'] .sim-svg-shell {
  fill: #19241f;
  stroke: #2b3d33;
}

.sim-svg-gold {
  fill: #fef08a;
  stroke: #d97706;
  stroke-width: 0.75;
}

[data-theme='dark'] .sim-svg-gold {
  fill: #fef3c7;
  stroke: #b45309;
}

.sim-svg-trace {
  stroke: #b45309;
  stroke-width: 0.7;
}

.sim-svg-center {
  fill: #fde047;
  stroke: #b45309;
  stroke-width: 0.7;
}

.sim-svg-empty {
  color: var(--c-text-3);
  opacity: 0.85;
}

.sim-chip-bot {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.chip-iccid {
  font-size: 11px;
  color: var(--c-text-2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.switch-cta {
  font-size: 11px;
  font-weight: 600;
  color: var(--c-primary-600);
}

.preset-rule-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: var(--sp-3);
  padding-bottom: var(--sp-2);
  border-bottom: 1px solid var(--c-line);
}

.preset-title {
  color: var(--c-text-3);
}

.preset-rule-chip {
  padding: 4px 10px;
  border-radius: var(--r-full);
  font-size: 11px;
  font-weight: 600;
  background: var(--c-surface-2);
  color: var(--c-primary-600);
  border: 1px solid var(--c-line);
  transition: all 0.15s ease;
}
.preset-rule-chip:hover {
  border-color: var(--c-primary-400);
}
.preset-rule-chip:active {
  transform: scale(0.92);
  background: var(--c-primary-50);
}

.rules-stream {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.rule-card {
  padding: 10px 12px;
  border: 1px solid var(--c-line);
  border-radius: var(--r-md);
  background: var(--c-surface);
  box-shadow: var(--shadow-sm);
}

.rule-top {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  padding-bottom: 6px;
  border-bottom: 1px dashed var(--c-line);
}

.rule-idx {
  font-size: 11px;
  font-weight: 700;
  color: var(--c-primary-500);
}

.rule-raw {
  flex: 1;
  font-size: 11px;
  color: var(--c-text-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.del-rule-btn {
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: var(--c-text-3);
  font-size: 16px;
  transition: all 0.15s ease;
}
.del-rule-btn:hover {
  color: var(--c-danger);
  background: rgba(239, 68, 68, 0.1);
}

.rule-pipeline {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.pipe-node {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.pipe-pill {
  display: inline-block;
  padding: 5px 10px;
  background: var(--c-surface-2);
  border: 1px solid var(--c-line);
  border-radius: var(--r-sm);
  font-size: 12px;
  font-weight: 600;
  color: var(--c-text-1);
}

.pipe-arrow {
  color: var(--c-text-3);
  font-size: 12px;
  user-select: none;
}

.pipe-select {
  min-height: 32px;
  padding: 0 8px;
  border: 1px solid var(--c-line);
  border-radius: var(--r-sm);
  background: var(--c-surface-2);
  color: var(--c-text-1);
  font-size: 12px;
  font-weight: 600;
}

.action-select {
  color: var(--c-primary-600);
  font-weight: 700;
}

.pipe-range {
  display: flex;
  align-items: center;
  gap: 4px;
}

.dur-range {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--c-text-3);
}

.pipe-input {
  min-height: 32px;
  width: 60px;
  padding: 0 4px;
  border: 1px solid var(--c-line);
  border-radius: var(--r-sm);
  background: var(--c-surface-2);
  color: var(--c-text-1);
  font-size: 12px;
  text-align: center;
}

.count-inp {
  width: 44px;
  font-weight: 700;
  color: var(--c-primary-600);
}

.rule-actions {
  display: flex;
  gap: var(--sp-2);
}

.mt-3 {
  margin-top: var(--sp-3);
}

.stat-rows {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.stat-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 0;
}

.stat-row + .stat-row {
  border-top: 1px solid var(--c-line);
}

.stat-val {
  font-size: 12px;
  font-weight: 600;
  color: var(--c-text-1);
}

.val-ok {
  color: var(--c-primary-500);
}

.val-warn {
  color: #f59e0b;
}
</style>
