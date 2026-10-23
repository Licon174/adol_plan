<script setup lang="ts">import { computed, ref } from 'vue'
import { execSystem, post } from '@/api'
import { toast } from '@/components/toast'
import { confirm } from '@/components/confirm'
import { withLoading } from '@/components/loading'
import PageForm from '@/layouts/PageForm.vue'
import Card from '@/components/Card.vue'
import Icon from '@/components/Icon.vue'
import { validateImei } from '@/utils/validators'

const TOOL = '/mnt/userdata/binary/imei_tool'
const OUT = '/mnt/userdata/imei_out.txt'

const persist = ref('')
const runtime = ref('')
const loading = ref(true)
const working = ref(false)
const newImei = ref('')

async function runTool(args: string): Promise<string> {
  await execSystem(`${TOOL} ${args} > ${OUT} 2>&1 ; chmod 644 ${OUT}`)

  await new Promise((r) => setTimeout(r, 1500))
  let text = ''
  try {
    const r = await fetch(`./imei_out.txt?r=${Date.now()}`)
    text = r.ok ? await r.text() : ''
  } catch {
    text = ''
  }
  await execSystem(`rm -f ${OUT}`)
  return text
}

async function refresh(): Promise<void> {
  loading.value = true
  try {
    const t = await runTool('show')
    persist.value = (t.match(/persist=(\S+)/) ?? [, '读取失败'])[1] ?? '读取失败'
    runtime.value = (t.match(/runtime=(\S+)/) ?? [, '读取失败'])[1] ?? '读取失败'
  } catch (e) {
    toast(e instanceof Error ? e.message : '读取失败', 'error')
  } finally {
    loading.value = false
  }
}
void refresh()

async function write(): Promise<void> {
  const v = newImei.value.trim()
  if (!/^\d{15}$/.test(v)) {
    toast('IMEI 必须是 15 位数字', 'error')
    return
  }
  const err = validateImei(v)
  if (err) {

    const ok = await confirm({
      title: 'IMEI 校验位不正确',
      message: `${err}。仍要写入吗？`,
      danger: true,
    })
    if (!ok) return
  }

  const ok1 = await confirm({
    title: '写入 IMEI',
    message: `将把 IMEI 写入持久区：${v}。此操作会改写设备标识。`,
    danger: true,
  })
  if (!ok1) return
  const ok2 = await confirm({
    title: '再次确认',
    message: '写入后需重启设备才会生效，且无法自动撤销。确定继续？',
    danger: true,
  })
  if (!ok2) return

  working.value = true
  try {
    const t = await withLoading(() => runTool(`persist ${v}`), '正在写入…')
    toast('已写入持久区，需重启后生效', 'success')
    result.value = t.trim()
    await refresh()
  } catch (e) {
    toast(e instanceof Error ? e.message : '写入失败', 'error')
  } finally {
    working.value = false
  }
}

const result = ref('')

async function copyText(text: string): Promise<void> {
  if (!text || text === '读取失败' || text === '—') return
  try {
    await navigator.clipboard.writeText(text)
    toast('已复制到剪贴板', 'success')
  } catch {
    toast('复制失败，请手动选择复制', 'error')
  }
}

function generateCompliantImei(): void {

  let s = '86'
  for (let i = 0; i < 12; i++) {
    s += Math.floor(Math.random() * 10).toString()
  }

  let sum = 0
  for (let i = 1; i <= 14; i++) {
    let d = Number(s[14 - i])
    if (i % 2 === 1) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
  }
  const checkDigit = (10 - (sum % 10)) % 10
  newImei.value = s + checkDigit.toString()
  toast('已生成 15 位合规 IMEI', 'info')
}

function fillCurrent(): void {
  const cur = persist.value && persist.value !== '读取失败' ? persist.value : runtime.value
  if (cur && cur !== '读取失败') {
    newImei.value = cur
  }
}

const isSynced = computed(() => {
  return (
    !!persist.value &&
    !!runtime.value &&
    persist.value !== '读取失败' &&
    persist.value === runtime.value
  )
})

const luhnErr = computed(() => {
  if (!newImei.value) return null
  return validateImei(newImei.value)
})

async function reboot(): Promise<void> {
  const ok = await confirm({
    title: '重启设备',
    message: '设备将重启，之后需重新登录。确认继续？',
    danger: true,
  })
  if (!ok) return
  try {

    await post({ goformId: 'REBOOT_DEVICE' }, { timeoutMs: 4000, expectAbort: true })
  } catch {

  }
  toast('已下发重启指令', 'success')
}
</script>

<template>
  <PageForm title="IMEI 标识" :loading="loading" :savable="false">
    <template #right>
      <button type="button" class="icon-btn" aria-label="刷新" @click="refresh">
        <Icon name="refresh" :size="20" />
      </button>
    </template>

    <div class="zones-grid">
      <Card class="zone-card">
        <div class="zone-top">
          <span class="zone-tag">持久区 (NV)</span>
          <button
            type="button"
            class="copy-btn"
            title="复制"
            @click="copyText(persist)"
          >
            <Icon name="copy" :size="13" />
          </button>
        </div>
        <div class="zone-val num">{{ persist || '—' }}</div>
        <div class="zone-foot">
          <span class="foot-pill">基准</span>
        </div>
      </Card>

      <Card class="zone-card">
        <div class="zone-top">
          <span class="zone-tag">运行时 (RAM)</span>
          <button
            type="button"
            class="copy-btn"
            title="复制"
            @click="copyText(runtime)"
          >
            <Icon name="copy" :size="13" />
          </button>
        </div>
        <div class="zone-val num">{{ runtime || '—' }}</div>
        <div class="zone-foot">
          <span class="foot-pill" :class="isSynced ? 'pill-synced' : 'pill-desync'">
            {{ isSynced ? '已同步' : '待重启' }}
          </span>
        </div>
      </Card>
    </div>

    <Card title="改写持久区">
      <div class="input-head">
        <span class="t-cap">目标 IMEI</span>
        <div class="input-badges">
          <span
            v-if="newImei"
            class="badge-luhn num"
            :class="!luhnErr ? 'luhn-ok' : 'luhn-err'"
          >
            {{ !luhnErr ? 'Luhn 通过' : '校验未过' }}
          </span>
          <span
            class="badge-count num"
            :class="{ 'count-ok': newImei.length === 15 }"
          >
            {{ newImei.length }}/15
          </span>
        </div>
      </div>

      <div class="imei-input-box">
        <input
          v-model="newImei"
          class="num imei-input"
          type="text"
          inputmode="numeric"
          maxlength="15"
          placeholder="15 位数字 IMEI"
          autocomplete="off"
        />
        <button
          v-if="newImei"
          type="button"
          class="clear-mini"
          @click="newImei = ''"
        >
          ×
        </button>
      </div>

      <div class="imei-tools">
        <button type="button" class="tool-btn" @click="generateCompliantImei">
          <Icon name="refresh" :size="13" />
          <span>随机生成</span>
        </button>
        <button type="button" class="tool-btn" @click="fillCurrent">
          <span>填入当前</span>
        </button>
      </div>

      <button
        type="button"
        class="btn btn-danger btn-block mt-3"
        :disabled="working || newImei.length !== 15"
        @click="write"
      >
        {{ working ? '写入中…' : '写入持久区 (NV)' }}
      </button>
    </Card>

    <Card class="reboot-card">
      <div class="reboot-box">
        <div class="reboot-meta">
          <span class="reboot-title">生效需重启</span>
          <span class="t-cap">写入后设备需重启重载</span>
        </div>
        <button type="button" class="btn btn-secondary reboot-btn" @click="reboot">
          立即重启
        </button>
      </div>
    </Card>

    <Card v-if="result" title="上次输出">
      <pre class="out num">{{ result }}</pre>
    </Card>
  </PageForm>
</template>

<style scoped>
.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--r-md);
  color: var(--c-text-1);
  background: var(--c-surface);
  border: 1px solid var(--c-line);
  box-shadow: var(--shadow-sm);
  transition: all 0.15s cubic-bezier(0.2, 0, 0, 1);
}
.icon-btn:active {
  transform: scale(0.92);
}

.zones-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--sp-3);
  margin-bottom: var(--sp-3);
}

@media (max-width: 480px) {
  .zones-grid {
    grid-template-columns: 1fr;
  }
}

.zone-card {
  padding: var(--sp-3);
  margin-bottom: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.zone-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.zone-tag {
  font-size: 11px;
  font-weight: 600;
  color: var(--c-text-3);
  letter-spacing: 0.3px;
}

.copy-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: var(--r-sm);
  color: var(--c-text-3);
  background: var(--c-surface-2);
  transition: all 0.15s ease;
}
.copy-btn:hover {
  color: var(--c-text-1);
}
.copy-btn:active {
  transform: scale(0.9);
}

.zone-val {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.5px;
  color: var(--c-text-1);
  word-break: break-all;
}

.zone-foot {
  display: flex;
  align-items: center;
}

.foot-pill {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: var(--r-full);
  background: var(--c-surface-2);
  color: var(--c-text-3);
}

.pill-synced {
  background: rgba(16, 185, 129, 0.1);
  color: var(--c-primary-500);
}

.pill-desync {
  background: rgba(245, 158, 11, 0.1);
  color: #f59e0b;
}

.input-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.input-badges {
  display: flex;
  align-items: center;
  gap: 6px;
}

.badge-luhn {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
}
.luhn-ok {
  background: rgba(16, 185, 129, 0.12);
  color: var(--c-primary-500);
}
.luhn-err {
  background: rgba(245, 158, 11, 0.12);
  color: #f59e0b;
}

.badge-count {
  font-size: 11px;
  font-weight: 600;
  color: var(--c-text-3);
}
.count-ok {
  color: var(--c-primary-500);
  font-weight: 700;
}

.imei-input-box {
  display: flex;
  align-items: center;
  padding: 4px 8px;
  background: var(--c-surface-2);
  border: 1px solid var(--c-line);
  border-radius: var(--r-md);
  transition: all 0.2s ease;
}
.imei-input-box:focus-within {
  border-color: var(--c-primary-500);
  box-shadow: 0 0 0 3px rgba(27, 165, 121, 0.12);
}

.imei-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 1px;
  color: var(--c-text-1);
  padding: 6px 0;
}

.clear-mini {
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--c-text-3);
  font-size: 16px;
}

.imei-tools {
  display: flex;
  gap: var(--sp-2);
  margin-top: 8px;
}

.tool-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: var(--r-sm);
  font-size: 12px;
  font-weight: 600;
  color: var(--c-text-2);
  background: var(--c-surface-2);
  border: 1px solid var(--c-line);
  transition: all 0.15s ease;
}
.tool-btn:hover {
  border-color: var(--c-primary-400);
  color: var(--c-primary-600);
}
.tool-btn:active {
  transform: scale(0.95);
}

.mt-3 {
  margin-top: var(--sp-3);
}

.reboot-card {
  padding: var(--sp-3);
}
.reboot-box {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
}
.reboot-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.reboot-title {
  font-weight: 600;
  font-size: var(--fs-sub);
  color: var(--c-text-1);
}
.reboot-btn {
  flex-shrink: 0;
  padding: 8px 16px;
  font-size: 12px;
}

.out {
  margin: 0;
  padding: var(--sp-2) var(--sp-3);
  overflow-x: auto;
  font-family: ui-monospace, monospace;
  font-size: 11px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
  background: var(--c-surface-2);
  border-radius: var(--r-sm);
}
</style>
