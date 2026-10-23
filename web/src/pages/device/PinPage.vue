<script setup lang="ts">import { computed, ref } from 'vue'
import { PIN_KEYS, changePin, disablePin, enablePin, enterPin, enterPuk, getStatus, post } from '@/api'
import { toast } from '@/components/toast'
import { withLoading } from '@/components/loading'
import { confirm } from '@/components/confirm'
import { validatePin, validatePuk, sameAs } from '@/utils/validators'
import PageForm from '@/layouts/PageForm.vue'
import Card from '@/components/Card.vue'
import FormField from '@/components/FormField.vue'
import Icon from '@/components/Icon.vue'

const raw = ref<Record<string, string>>({})
const loading = ref(true)
const error = ref('')
const busy = ref(false)

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    raw.value = (await getStatus(PIN_KEYS)) as Record<string, string>
  } catch (e) {
    error.value = e instanceof Error ? e.message : '读取失败'
  } finally {
    loading.value = false
  }
}
void load()

const pinStatus = computed(() => (raw.value.pin_status ?? '').trim())

const pinText = computed(() => {
  switch (pinStatus.value) {
    case '0':
      return '未启用'
    case '1':
      return '已启用'
    case '2':
      return '已锁定（需 PUK）'
    default:
      return pinStatus.value || '未知（SIM 未就绪）'
  }
})

const pinEnabled = computed(() => pinStatus.value === '1' || pinStatus.value === '2')

const pinUnknown = computed(() => pinStatus.value === '')

const togglePin = ref('')
const toggleErr = ref<Record<string, string>>({})

async function submitToggle(turnOn: boolean): Promise<void> {
  const err = validatePin(togglePin.value)
  toggleErr.value = err ? { togglePin: err } : {}
  if (err) return
  const ok = await confirm({
    title: turnOn ? '开启 PIN 锁' : '关闭 PIN 锁',
    message: turnOn
      ? '开启后每次开机都需要输入 PIN 才能使用 SIM。确认继续？'
      : '关闭后 SIM 卡不再受 PIN 保护。确认继续？',
    danger: true,
  })
  if (!ok) return
  busy.value = true
  try {
    await withLoading(async () => {
      const res = await post(turnOn ? enablePin(togglePin.value) : disablePin(togglePin.value))
      if (res.result !== 'success') throw new Error(res.result || '操作失败')
    }, '正在提交…')
    toast(turnOn ? '已开启 PIN 锁' : '已关闭 PIN 锁', 'success')
    togglePin.value = ''
    await load()
  } catch (e) {
    toast(e instanceof Error ? e.message : '操作失败', 'error')
  } finally {
    busy.value = false
  }
}

const unlockPin = ref('')
const unlockErr = ref<Record<string, string>>({})

async function submitUnlock(): Promise<void> {
  const err = validatePin(unlockPin.value)
  unlockErr.value = err ? { unlockPin: err } : {}
  if (err) return
  const ok = await confirm({
    title: '解锁 SIM',
    message: '输错 3 次会锁卡，届时需要 PUK 才能解锁。确认提交？',
    danger: true,
  })
  if (!ok) return
  busy.value = true
  try {
    await withLoading(async () => {
      const res = await post(enterPin(unlockPin.value))
      if (res.result !== 'success') throw new Error(res.result || '解锁失败')
    }, '正在解锁…')
    toast('已解锁', 'success')
    unlockPin.value = ''
    await load()
  } catch (e) {
    toast(e instanceof Error ? e.message : '解锁失败', 'error')
  } finally {
    busy.value = false
  }
}

const puk = ref('')
const newPin = ref('')
const newPin2 = ref('')
const pukErr = ref<Record<string, string>>({})

async function submitPuk(): Promise<void> {
  const errs: Record<string, string> = {}
  const pe = validatePuk(puk.value)
  if (pe) errs.puk = pe
  const ne = validatePin(newPin.value)
  if (ne) errs.newPin = ne
  const se = sameAs(newPin.value, 'PIN')(newPin2.value)
  if (se) errs.newPin2 = se
  pukErr.value = errs
  if (Object.keys(errs).length) return

  const ok = await confirm({
    title: 'PUK 解锁',
    message: 'PUK 输错 10 次会永久锁卡，且会用这里填写的 PIN 作为新 PIN。确认提交？',
    danger: true,
  })
  if (!ok) return
  busy.value = true
  try {
    await withLoading(async () => {
      const res = await post(enterPuk(puk.value, newPin.value))
      if (res.result !== 'success') throw new Error(res.result || 'PUK 解锁失败')
    }, '正在提交…')
    toast('PUK 解锁成功', 'success')
    puk.value = ''
    newPin.value = ''
    newPin2.value = ''
    await load()
  } catch (e) {
    toast(e instanceof Error ? e.message : 'PUK 解锁失败', 'error')
  } finally {
    busy.value = false
  }
}

const modOldPin = ref('')
const modNewPin = ref('')
const modNewPin2 = ref('')
const modErr = ref<Record<string, string>>({})

async function submitChangePin(): Promise<void> {
  const errs: Record<string, string> = {}
  const oe = validatePin(modOldPin.value)
  if (oe) errs.modOldPin = oe
  const ne = validatePin(modNewPin.value)
  if (ne) errs.modNewPin = ne
  const se = sameAs(modNewPin.value, '新 PIN')(modNewPin2.value)
  if (se) errs.modNewPin2 = se
  modErr.value = errs
  if (Object.keys(errs).length) return

  const ok = await confirm({
    title: '修改 PIN 码',
    message: '确认将 SIM 卡的 PIN 码变更为新密码？',
  })
  if (!ok) return
  busy.value = true
  try {
    await withLoading(async () => {
      const res = await post(changePin(modOldPin.value, modNewPin.value))
      if (res.result !== 'success') throw new Error(res.result || '修改失败')
    }, '正在修改…')
    toast('已修改 PIN 码', 'success')
    modOldPin.value = ''
    modNewPin.value = ''
    modNewPin2.value = ''
    await load()
  } catch (e) {
    toast(e instanceof Error ? e.message : '修改失败', 'error')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <PageForm title="PIN 码安全" :loading="loading" :error="error" :savable="false">
    <template #right>
      <button type="button" class="icon-btn" aria-label="刷新" @click="load">
        <Icon name="refresh" :size="20" />
      </button>
    </template>

    <Card class="hero-card">
      <div class="hero-box">
        <div class="hero-left">
          <div class="hero-icon-pill" :class="pinStatus === '2' ? 'pill-err' : pinEnabled ? 'pill-ok' : 'pill-idle'">
            <Icon :name="pinStatus === '2' ? 'shield-alert' : 'lock'" :size="20" />
          </div>
          <div class="hero-meta">
            <span class="hero-title">SIM 锁状态</span>
            <div class="hero-status-row">
              <span class="status-badge" :class="pinStatus === '2' ? 'badge-err' : pinEnabled ? 'badge-ok' : 'badge-idle'">
                {{ pinText }}
              </span>
            </div>
          </div>
        </div>

        <div class="hero-counters">
          <div class="counter-tile">
            <span class="t-cap">PIN 剩余</span>
            <span class="num counter-val" :class="{ 'val-danger': raw.pinnumber && Number(raw.pinnumber) <= 1 }">
              {{ raw.pinnumber || '—' }} <span class="unit">次</span>
            </span>
          </div>
          <div class="counter-tile">
            <span class="t-cap">PUK 剩余</span>
            <span class="num counter-val" :class="{ 'val-danger': raw.puknumber && Number(raw.puknumber) <= 3 }">
              {{ raw.puknumber || '—' }} <span class="unit">次</span>
            </span>
          </div>
        </div>
      </div>
    </Card>

    <Card v-if="pinStatus === '2'" title="PUK 紧急解锁" class="urgent-card">
      <div class="urgent-alert">
        <Icon name="shield-alert" :size="15" />
        <span>SIM 卡已锁，输入 PUK 码重置 PIN</span>
      </div>
      <FormField label="PUK 码" required :error="pukErr.puk">
        <input v-model="puk" class="num" type="text" inputmode="numeric" maxlength="8" autocomplete="off" />
      </FormField>
      <FormField label="新 PIN" required :error="pukErr.newPin">
        <input
          v-model="newPin"
          class="num"
          type="text"
          inputmode="numeric"
          maxlength="8"
          autocomplete="off"
        />
      </FormField>
      <FormField label="确认 PIN" required :error="pukErr.newPin2">
        <input
          v-model="newPin2"
          class="num"
          type="text"
          inputmode="numeric"
          maxlength="8"
          autocomplete="off"
        />
      </FormField>
      <button type="button" class="btn btn-danger btn-block mt-3" :disabled="busy" @click="submitPuk">
        解锁并重置
      </button>
    </Card>

    <Card v-else-if="pinStatus === '1'" title="PIN 解锁" class="urgent-card">
      <FormField label="SIM PIN" required :error="unlockErr.unlockPin">
        <input
          v-model="unlockPin"
          class="num"
          type="password"
          inputmode="numeric"
          maxlength="8"
          autocomplete="off"
        />
      </FormField>
      <button type="button" class="btn btn-primary btn-block mt-3" :disabled="busy" @click="submitUnlock">
        立即解锁
      </button>
    </Card>

    <Card v-if="pinStatus !== '2'" :title="pinEnabled ? '关闭 PIN' : '开启 PIN'">
      <p v-if="pinUnknown" class="t-cap hint-warn">
        SIM 状态未知，暂不可操作
      </p>
      <FormField label="PIN 码" required :error="toggleErr.togglePin">
        <input
          v-model="togglePin"
          class="num"
          type="password"
          inputmode="numeric"
          maxlength="8"
          autocomplete="off"
          placeholder="4~8 位数字"
          :disabled="pinUnknown"
        />
      </FormField>
      <button
        type="button"
        class="btn btn-block mt-3"
        :class="pinEnabled ? 'btn-secondary' : 'btn-primary'"
        :disabled="busy || pinUnknown || !togglePin"
        @click="submitToggle(!pinEnabled)"
      >
        {{ pinEnabled ? '关闭 PIN' : '开启 PIN' }}
      </button>
    </Card>

    <Card v-if="pinEnabled" title="修改 PIN">
      <FormField label="当前 PIN 码" required :error="modErr.modOldPin">
        <input
          v-model="modOldPin"
          class="num"
          type="password"
          inputmode="numeric"
          maxlength="8"
          autocomplete="off"
        />
      </FormField>
      <FormField label="新 PIN 码" required :error="modErr.modNewPin">
        <input
          v-model="modNewPin"
          class="num"
          type="password"
          inputmode="numeric"
          maxlength="8"
          autocomplete="off"
        />
      </FormField>
      <FormField label="确认新 PIN" required :error="modErr.modNewPin2">
        <input
          v-model="modNewPin2"
          class="num"
          type="password"
          inputmode="numeric"
          maxlength="8"
          autocomplete="off"
        />
      </FormField>
      <button
        type="button"
        class="btn btn-secondary btn-block mt-3"
        :disabled="busy || !modOldPin || !modNewPin || !modNewPin2"
        @click="submitChangePin"
      >
        确认修改 PIN
      </button>
    </Card>

    <div class="security-notice">
      <Icon name="shield-alert" :size="16" />
      <span>连续 3 次输错 PIN 码将锁定 SIM 卡；PUK 码连续输错 10 次将造成 SIM 卡硬件永久报废。</span>
    </div>
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

.hero-card {
  padding: var(--sp-3);
  margin-bottom: var(--sp-3);
}

.hero-box {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
}

@media (max-width: 480px) {
  .hero-box {
    flex-direction: column;
    align-items: stretch;
  }
}

.hero-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.hero-icon-pill {
  width: 44px;
  height: 44px;
  border-radius: var(--r-md);
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--c-line);
  flex-shrink: 0;
}

.pill-ok {
  background: rgba(16, 185, 129, 0.1);
  color: var(--c-primary-500);
}

.pill-err {
  background: rgba(239, 68, 68, 0.1);
  color: var(--c-danger);
  animation: pulse-border 1.5s infinite;
}

.pill-idle {
  background: var(--c-surface-2);
  color: var(--c-text-3);
}

@keyframes pulse-border {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.04); }
}

.hero-meta {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.hero-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--c-text-1);
}

.status-badge {
  display: inline-block;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: var(--r-full);
}

.badge-ok {
  background: rgba(16, 185, 129, 0.12);
  color: var(--c-primary-500);
}

.badge-err {
  background: rgba(239, 68, 68, 0.12);
  color: var(--c-danger);
}

.badge-idle {
  background: var(--c-surface-2);
  color: var(--c-text-3);
}

.hero-counters {
  display: flex;
  gap: 8px;
}

.counter-tile {
  background: var(--c-surface-2);
  border: 1px solid var(--c-line);
  border-radius: var(--r-sm);
  padding: 6px 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 68px;
}

.counter-val {
  font-size: 15px;
  font-weight: 700;
  color: var(--c-text-1);
}

.val-danger {
  color: var(--c-danger) !important;
  font-weight: 800;
}

.unit {
  font-size: 10px;
  font-weight: normal;
  color: var(--c-text-3);
}

.urgent-card {
  border-color: rgba(239, 68, 68, 0.3) !important;
}

.urgent-alert {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: var(--r-sm);
  background: rgba(239, 68, 68, 0.08);
  color: var(--c-danger);
  font-size: 12px;
  margin-bottom: var(--sp-3);
}

.hint-warn {
  margin-bottom: 8px;
  color: #f59e0b;
}

.mt-3 {
  margin-top: var(--sp-3);
}

.security-notice {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 14px;
  border-radius: var(--r-md);
  background: rgba(245, 158, 11, 0.08);
  border: 1px solid rgba(245, 158, 11, 0.2);
  color: #f59e0b;
  font-size: 12px;
  line-height: 1.5;
  margin-top: var(--sp-4);
}
</style>
