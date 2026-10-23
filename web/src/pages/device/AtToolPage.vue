<script setup lang="ts">import { computed, ref } from 'vue'
import { execSystem } from '@/api'
import { toast } from '@/components/toast'
import { withLoading } from '@/components/loading'
import PageForm from '@/layouts/PageForm.vue'
import Card from '@/components/Card.vue'
import Icon from '@/components/Icon.vue'

const PORT = 2048
const BIN = '/mnt/userdata/binary/at_cond'

const up = ref(false)
const checking = ref(false)
const busy = ref(false)
const cmd = ref('')
const sending = ref(false)

const USB_SYSFS = '/sys/class/android_usb/android0'
const USB_FUNC_ON = 'rndis,serial,diag,adb'
const USB_FUNC_OFF = 'rndis'
const USB_STAMP = '/mnt/userdata/usb_func.txt'
const USB_URL = './at_usb_func.txt'

const USB_FUNC_RE =
  /^(rndis|ecm|mbim|acm|serial|adb|diag|mass_storage)(,(rndis|ecm|mbim|acm|serial|adb|diag|mass_storage))*$/

const dbgOn = ref(false)
const dbgOk = ref(false)
const dbgFunc = ref('')
const dbgBusy = ref(false)

const dbgLoaded = ref(false)

interface Item {
  id: number
  cmd: string
  ok: boolean
  status: number
  text: string
  at: number
}
const items = ref<Item[]>([])
let seq = 0

const base = computed(() => `${window.location.protocol}//${window.location.hostname}:${PORT}`)

async function ping(): Promise<boolean> {
  try {
    const r = await fetch(`${base.value}/ping`, { cache: 'no-store' })
    return r.ok
  } catch {
    return false
  }
}

async function check(): Promise<void> {
  checking.value = true
  try {
    up.value = await ping()
    await checkDbg()
  } finally {
    checking.value = false
  }
}

async function waitFor(want: boolean): Promise<boolean> {
  for (let i = 0; i < 16; i++) {
    if ((await ping()) === want) return true
    await new Promise((r) => setTimeout(r, 500))
  }
  return (await ping()) === want
}

async function toggle(): Promise<void> {
  busy.value = true
  try {
    if (up.value) {
      await withLoading(async () => {
        await execSystem(`${BIN} -s`)
      }, '正在停止…')
      up.value = !(await waitFor(false))
      toast(up.value ? '停止失败，服务仍在运行' : '已停止', up.value ? 'error' : 'success')
    } else {
      await withLoading(async () => {
        await execSystem(`mkdir -p /mnt/userdata/binary/logs; ${BIN} -b ${PORT}`)
      }, '正在启动…')
      up.value = await waitFor(true)
      toast(up.value ? '已启动' : '启动失败', up.value ? 'success' : 'error')
    }
  } catch (e) {
    toast(e instanceof Error ? e.message : '操作失败', 'error')
  } finally {
    busy.value = false
  }
}

async function readDbgFunc(): Promise<string> {
  try {
    await execSystem(`cat ${USB_SYSFS}/functions > ${USB_STAMP} 2>&1 ; chmod 644 ${USB_STAMP}`)
  } catch {

  }
  try {
    const r = await fetch(`${USB_URL}?r=${Date.now()}`, { cache: 'no-store' })
    return r.ok ? (await r.text()).trim() : ''
  } catch {
    return ''
  }
}

async function checkDbg(): Promise<void> {
  const f = await readDbgFunc()
  const ok = USB_FUNC_RE.test(f)
  dbgOk.value = ok
  dbgFunc.value = ok ? f : ''

  dbgOn.value = ok && /(^|,)(serial|acm|adb|diag)(,|$)/.test(f)
  dbgLoaded.value = true
}

async function toggleDbg(): Promise<void> {
  if (dbgBusy.value || !dbgOk.value) return
  const want = !dbgOn.value
  const funcs = want ? USB_FUNC_ON : USB_FUNC_OFF
  dbgBusy.value = true
  try {
    try {
      await execSystem(
        `echo 0 > ${USB_SYSFS}/enable ; echo ${funcs} > ${USB_SYSFS}/functions ; echo 1 > ${USB_SYSFS}/enable`,
      )
    } catch {

    }
    await new Promise((r) => setTimeout(r, 6000))
    await checkDbg()
    toast(dbgOn.value === want ? (want ? '调试端口已开启' : '调试端口已关闭') : '切换未生效，请刷新重试',
          dbgOn.value === want ? 'success' : 'error')
  } finally {
    dbgBusy.value = false
  }
}

function bodyIsErr(text: string): boolean {
  return /\+CME ERROR|\+CMS ERROR|(^|\n)\s*ERROR\b/i.test(text)
}

async function send(): Promise<void> {
  const c = cmd.value.trim()
  if (!c) {
    toast('请输入 AT 命令', 'error')
    return
  }
  if (!/^at/i.test(c)) {
    toast('命令必须以 AT 开头', 'error')
    return
  }
  if (!up.value) {
    toast('AT 服务未运行', 'error')
    return
  }
  sending.value = true
  try {
    const url = `${base.value}/goform/goform_set_cmd_process?goformId=EXECUTE_AT_COMMAND&at_cmd=${encodeURIComponent(c)}`
    const r = await fetch(url, { cache: 'no-store', headers: { 'X-AT-Console': '1' } })
    const text = await r.text()
    const ok = r.ok && !bodyIsErr(text)
    items.value = [
      { id: ++seq, cmd: c, ok, status: r.status, text, at: Date.now() },
      ...items.value,
    ].slice(0, 50)
    if (!ok) toast(r.ok ? '模组返回错误' : `失败：HTTP ${r.status}`, 'error')
  } catch (e) {
    items.value = [
      { id: ++seq, cmd: c, ok: false, status: 0, text: String(e), at: Date.now() },
      ...items.value,
    ].slice(0, 20)
    toast('请求异常', 'error')
  } finally {
    sending.value = false
  }
}

function clear(): void {
  items.value = []
}

const PRESETS = [
  'AT',
  'AT+CSQ',
  'AT+COPS?',
  'AT+ZLTEBAND?',
  'AT+ZLTELC?',
  'AT+CGSN',
  'AT+CGMR',
  'AT+CFUN=1',
]

function usePreset(p: string): void {
  cmd.value = p
}

const time = (t: number) =>
  new Date(t).toLocaleTimeString('zh-CN', { hour12: false })

void check()
</script>

<template>
  <PageForm title="AT 控制台" :savable="false">
    <template #right>
      <button type="button" class="icon-btn" aria-label="刷新" :disabled="checking" @click="check">
        <Icon name="refresh" :size="20" />
      </button>
    </template>

    <Card title="服务状态">
      <div class="svc-list">
        <div class="svc-item">
          <div class="svc-info">
            <div class="svc-head">
              <span class="status-dot" :class="{ 'is-active': up }" />
              <span class="svc-title">at_cond 控制台服务</span>
            </div>
            <span class="t-cap num">端口 :{{ PORT }} · {{ up ? '已就绪 (支持回显)' : '已停止' }}</span>
          </div>
          <button
            type="button"
            class="action-pill"
            :class="up ? 'pill-danger' : 'pill-primary'"
            :disabled="busy"
            @click="toggle"
          >
            {{ busy ? '…' : up ? '停止服务' : '启动服务' }}
          </button>
        </div>

        <div class="svc-item">
          <div class="svc-info">
            <div class="svc-head">
              <span class="status-dot" :class="{ 'is-active': dbgOn }" />
              <span class="svc-title">USB 调试与 ADB</span>
            </div>
            <span class="t-cap num">
              {{ !dbgLoaded ? '检测中…' : dbgOn ? '已开启 (ADB + COM 串口)' : '仅网卡 (rndis)' }}
            </span>
          </div>
          <button
            type="button"
            class="action-pill"
            :class="dbgOn ? 'pill-danger' : 'pill-primary'"
            :disabled="dbgBusy || !dbgLoaded || !dbgOk"
            @click="toggleDbg"
          >
            {{ dbgBusy ? '…' : dbgOn ? '关闭' : '开启' }}
          </button>
        </div>
      </div>
    </Card>

    <Card title="发送指令">
      <div class="cmd-input-wrap">
        <span class="cmd-prefix num">$</span>
        <input
          v-model="cmd"
          class="cmd-input num"
          type="text"
          autocomplete="off"
          spellcheck="false"
          placeholder="输入 AT 指令，如 AT+CSQ"
          @keyup.enter="send"
        />
        <button
          v-if="cmd"
          type="button"
          class="cmd-clear"
          aria-label="清空输入"
          @click="cmd = ''"
        >
          ×
        </button>
        <button
          type="button"
          class="cmd-send-btn"
          :disabled="sending || !cmd.trim()"
          @click="send"
        >
          <Icon name="send" :size="15" />
          <span>{{ sending ? '执行中' : '发送' }}</span>
        </button>
      </div>

      <div class="preset-wrap">
        <span class="t-cap">快捷指令：</span>
        <div class="preset-chips">
          <button
            v-for="p in PRESETS"
            :key="p"
            type="button"
            class="preset-chip num"
            @click="usePreset(p)"
          >
            {{ p }}
          </button>
        </div>
      </div>
    </Card>

    <Card>
      <template #header>
        <div class="log-card-header">
          <span class="card-title">响应日志</span>
          <div class="log-header-actions">
            <span class="num log-count-badge">{{ items.length }} 条记录</span>
            <button v-if="items.length" type="button" class="btn-clear-log" @click="clear">
              清空
            </button>
          </div>
        </div>
      </template>

      <div v-if="items.length" class="log-stream">
        <div v-for="it in items" :key="it.id" class="log-item">
          <div class="log-item-head">
            <div class="log-cmd-row">
              <span class="log-cmd-prefix num">&gt;</span>
              <span class="num log-cmd-name">{{ it.cmd }}</span>
            </div>
            <div class="log-meta">
              <span class="status-pill num" :class="it.ok ? 'status-ok' : 'status-err'">
                {{ it.ok ? 'OK' : `ERR ${it.status || ''}` }}
              </span>
              <span class="log-time num">{{ time(it.at) }}</span>
            </div>
          </div>
          <pre class="log-output num">{{ it.text || '（无返回数据）' }}</pre>
        </div>
      </div>

      <div v-else class="log-empty">
        <span class="t-cap">暂无执行记录，等待下发指令…</span>
      </div>
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

.svc-list {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}

.svc-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
  padding: 4px 0;
}

.svc-item + .svc-item {
  padding-top: var(--sp-3);
  border-top: 1px solid var(--c-line);
}

.svc-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.svc-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--c-line-strong);
  flex-shrink: 0;
  transition: all 0.25s ease;
}

.status-dot.is-active {
  background: var(--c-primary-400);
  box-shadow: 0 0 8px var(--c-primary-400);
}

.svc-title {
  font-weight: 600;
  font-size: var(--fs-sub);
  color: var(--c-text-1);
}

.action-pill {
  flex-shrink: 0;
  padding: 6px 14px;
  border-radius: var(--r-full);
  font-size: 12px;
  font-weight: 600;
  border: 1px solid transparent;
  transition: all 0.15s ease;
}
.action-pill:active {
  transform: scale(0.94);
}

.pill-primary {
  background: var(--c-primary-50);
  color: var(--c-primary-600);
  border-color: rgba(27, 165, 121, 0.2);
}

.pill-danger {
  background: rgba(220, 38, 38, 0.08);
  color: var(--c-danger);
  border-color: rgba(220, 38, 38, 0.2);
}

.cmd-input-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 6px 4px 10px;
  background: var(--c-surface-2);
  border: 1px solid var(--c-line);
  border-radius: var(--r-md);
  transition: all 0.2s ease;
  min-width: 0;
}
.cmd-input-wrap:focus-within {
  border-color: var(--c-primary-400);
  box-shadow: 0 0 0 3px rgba(27, 165, 121, 0.12);
}

.cmd-prefix {
  font-weight: 700;
  color: var(--c-primary-600);
  user-select: none;
  flex-shrink: 0;
}

.cmd-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  font-size: 13px;
  font-weight: 600;
  color: var(--c-text-1);
  min-width: 0;
  padding: 6px 0;
}

.cmd-clear {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: var(--c-text-3);
  font-size: 15px;
  flex-shrink: 0;
}
.cmd-clear:hover {
  color: var(--c-text-1);
}

.cmd-send-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border-radius: var(--r-sm);
  background: var(--c-primary-400);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  flex-shrink: 0;
  white-space: nowrap;
  transition: all 0.15s ease;
}
.cmd-send-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.cmd-send-btn:not(:disabled):active {
  transform: scale(0.95);
}

.preset-wrap {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: var(--sp-3);
}

.preset-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.preset-chip {
  padding: 4px 10px;
  border-radius: var(--r-full);
  font-size: 11px;
  font-weight: 600;
  background: var(--c-surface-2);
  color: var(--c-text-2);
  border: 1px solid var(--c-line);
  transition: all 0.15s ease;
}
.preset-chip:hover {
  border-color: var(--c-primary-400);
  color: var(--c-primary-600);
}
.preset-chip:active {
  transform: scale(0.92);
  background: var(--c-primary-50);
}

.log-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.card-title {
  font-size: var(--fs-sub);
  font-weight: 600;
  color: var(--c-text-1);
}

.log-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.log-count-badge {
  font-size: 11px;
  color: var(--c-text-3);
}

.btn-clear-log {
  font-size: 11px;
  color: var(--c-primary-600);
  font-weight: 600;
  padding: 2px 6px;
}

.log-stream {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.log-item {
  border: 1px solid var(--c-line);
  border-radius: var(--r-sm);
  background: var(--c-surface);
  padding: 8px 12px;
}

.log-item-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.log-cmd-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.log-cmd-prefix {
  color: var(--c-primary-600);
  font-weight: 700;
}

.log-cmd-name {
  font-weight: 700;
  font-size: 13px;
  color: var(--c-text-1);
}

.log-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-pill {
  font-size: 10px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 4px;
}

.status-ok {
  background: rgba(16, 185, 129, 0.12);
  color: var(--c-primary-600);
}

.status-err {
  background: rgba(239, 68, 68, 0.12);
  color: var(--c-danger);
}

.log-time {
  font-size: 10px;
  color: var(--c-text-3);
}

.log-output {
  margin: 0;
  padding: 6px 10px;
  background: var(--c-surface-2);
  border-radius: 6px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--c-text-1);
  white-space: pre-wrap;
  word-break: break-all;
  border: 1px solid var(--c-line);
}

.log-empty {
  padding: 28px 0;
  text-align: center;
}
</style>
