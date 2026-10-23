<script setup lang="ts">import { computed, onUnmounted, ref } from 'vue'
import { PAGE_KEYS, readBandKeyStrict, wpsSet } from '@/api'
import { usePageForm } from '@/composables/usePageForm'
import { validateWpsPin } from '@/utils/validators'
import PageForm from '@/layouts/PageForm.vue'
import Card from '@/components/Card.vue'
import FormField from '@/components/FormField.vue'
import Icon from '@/components/Icon.vue'

interface Model {
  mode: string
  pin: string
}

const pbcCountdown = ref(0)
let countdownTimer: ReturnType<typeof setInterval> | undefined

onUnmounted(() => {
  if (countdownTimer) clearInterval(countdownTimer)
})

function startPbcTimer(): void {
  pbcCountdown.value = 120
  if (countdownTimer) clearInterval(countdownTimer)
  countdownTimer = setInterval(() => {
    pbcCountdown.value--
    if (pbcCountdown.value <= 0) {
      clearInterval(countdownTimer)
      pbcCountdown.value = 0
    }
  }, 1000)
}

const { model, raw, loading, saving, error, fieldErrors, dirty, load, save, reset } =
  usePageForm<Model>({
    keys: PAGE_KEYS.wifiWps,
    fromStatus: (s) => ({
      mode: s.wps_mode === 'PIN' ? 'PIN' : 'PBC',
      pin: '',
    }),
    validate: (m): Record<string, string> | null => {
      if (m.mode !== 'PIN') return null
      const err = validateWpsPin(m.pin)
      return err ? { pin: err } : null
    },
    preflight: (_m, r): string | null => {
      const band = r.wifi_band
      const ssid = readBandKeyStrict(r, 'SSID1', band) || readBandKeyStrict(r, 'm_SSID', band) || ''
      if (ssid && !/^[\x20-\x7e]+$/.test(ssid)) {
        return `当前 WiFi 名称「${ssid}」含中文。WPS 仅支持纯英文名称。`
      }
      const auth = readBandKeyStrict(r, 'AuthMode', band) || ''
      if (auth === 'WPA3Personal' || auth === 'WPA2WPA3') {
        return `当前加密是 ${auth}。WPA3 协议不支持 WPS 配对。`
      }
      if ((readBandKeyStrict(r, 'HideSSID', band) ?? '0') === '1') {
        return '当前 WiFi 已隐藏 SSID，无法进行 WPS 配对。'
      }
      return null
    },
    toPayload: (m, r): Record<string, string>[] => [
      wpsSet({
        WPS_SSID:
          readBandKeyStrict(r, 'SSID1', r.wifi_band) ||
          readBandKeyStrict(r, 'm_SSID', r.wifi_band) ||
          '',
        wps_mode: m.mode,
        wifi_wps_index: r.wifi_wps_index || '1',
        wps_pin: m.mode === 'PIN' ? m.pin : undefined,
      }),
    ],
    successText: '已启动 WPS 配对',
  })

void load()

const currentSsid = computed(() => {
  const band = raw.value.wifi_band
  return readBandKeyStrict(raw.value, 'SSID1', band) || readBandKeyStrict(raw.value, 'm_SSID', band) || ''
})

const currentAuth = computed(() => {
  const band = raw.value.wifi_band
  return readBandKeyStrict(raw.value, 'AuthMode', band) || 'WPA2PSK'
})

const isCompatible = computed(() => {
  const s = currentSsid.value
  const a = currentAuth.value
  const h = (readBandKeyStrict(raw.value, 'HideSSID', raw.value.wifi_band) ?? '0') === '1'
  if (!s || !/^[\x20-\x7e]+$/.test(s)) return false
  if (a === 'WPA3Personal' || a === 'WPA2WPA3') return false
  if (h) return false
  return true
})

async function handleStartPair(): Promise<void> {
  const ok = await save()
  if (ok && model.value.mode === 'PBC') {
    startPbcTimer()
  }
}
</script>

<template>
  <PageForm
    title="WPS 配对"
    :loading="loading"
    :saving="saving"
    :error="error"
    :dirty="dirty"
    save-text="启动配对"
    @save="handleStartPair()"
    @reset="reset()"
  >
    <Card>
      <div class="wps-hero">
        <div class="wps-hero-left">
          <div class="wps-hero-icon" :class="{ 'is-active': isCompatible }">
            <Icon name="repeat" :size="20" />
          </div>
          <div class="wps-hero-meta">
            <div class="wps-title-row">
              <span class="wps-name">WPS 一键配对</span>
              <span class="wps-badge" :class="isCompatible ? 'badge-ok' : 'badge-warn'">
                {{ isCompatible ? '就绪' : '需调整' }}
              </span>
            </div>
            <span class="t-cap">免密连接打印机或智能终端</span>
          </div>
        </div>
      </div>
    </Card>

    <Card title="配对方式">
      <div class="mode-grid">
        <button
          type="button"
          class="mode-card"
          :class="{ 'is-selected': model.mode === 'PBC' }"
          @click="model.mode = 'PBC'"
        >
          <div class="mode-head">
            <span class="mode-title">PBC 按键</span>
            <Icon v-if="model.mode === 'PBC'" name="check" :size="15" class="check-ic" />
          </div>
          <span class="t-cap mode-desc">按下物理设备的 WPS 按键配对</span>
        </button>

        <button
          type="button"
          class="mode-card"
          :class="{ 'is-selected': model.mode === 'PIN' }"
          @click="model.mode = 'PIN'"
        >
          <div class="mode-head">
            <span class="mode-title">PIN 码</span>
            <Icon v-if="model.mode === 'PIN'" name="check" :size="15" class="check-ic" />
          </div>
          <span class="t-cap mode-desc">输入外接设备上的 8 位 PIN 码</span>
        </button>
      </div>
    </Card>

    <Card v-if="model.mode === 'PBC'" title="按键配对">
      <div class="pbc-interactive-box">
        <div
          class="pbc-round-btn"
          :class="{ 'is-pairing': pbcCountdown > 0 }"
          @click="handleStartPair()"
        >
          <div class="pbc-wave wave-1" v-if="pbcCountdown > 0"></div>
          <div class="pbc-wave wave-2" v-if="pbcCountdown > 0"></div>
          <Icon name="wifi" :size="24" />
          <span class="pbc-btn-label">{{ pbcCountdown > 0 ? `${pbcCountdown}s` : '按此配对' }}</span>
        </div>

        <p class="t-cap">
          {{ pbcCountdown > 0 ? `倒计时 ${pbcCountdown} 秒，请按外设 WPS 键` : '点击按钮启动配对广播' }}
        </p>
      </div>
    </Card>

    <Card v-if="model.mode === 'PIN'" title="设备 PIN 码">
      <FormField label="8 位 PIN 码" required :error="fieldErrors.pin">
        <input
          v-model="model.pin"
          class="num pin-input"
          type="text"
          inputmode="numeric"
          maxlength="8"
          placeholder="例如：12345670"
          autocomplete="off"
        />
      </FormField>
    </Card>

    <Card title="当前环境">
      <div class="status-rows">
        <div class="status-row">
          <span class="t-cap">SSID</span>
          <span class="status-val num">{{ currentSsid || '—' }}</span>
        </div>
        <div class="status-row">
          <span class="t-cap">加密</span>
          <span class="status-val">{{ currentAuth || '—' }}</span>
        </div>
      </div>
    </Card>
  </PageForm>
</template>

<style scoped>
.wps-hero { display: flex; align-items: center; justify-content: space-between; }
.wps-hero-left { display: flex; align-items: center; gap: var(--sp-3); min-width: 0; }
.wps-hero-icon { width: 38px; height: 38px; border-radius: var(--r-md); background: var(--c-surface-2); color: var(--c-text-3); display: flex; align-items: center; justify-content: center; flex: none; }
.wps-hero-icon.is-active { background: var(--c-primary-50); color: var(--c-primary-400); }
[data-theme='dark'] .wps-hero-icon.is-active { background: var(--c-primary-100); color: var(--c-primary-600); }

.wps-hero-meta { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.wps-title-row { display: flex; align-items: center; gap: 6px; }
.wps-name { font-size: 15px; font-weight: 700; color: var(--c-text-1); }
.wps-badge { font-size: 11px; font-weight: 600; padding: 1px 6px; border-radius: var(--r-sm); }
.badge-ok { background: var(--c-primary-50); color: var(--c-primary-600); }
[data-theme='dark'] .badge-ok { background: rgba(34, 181, 134, 0.2); color: var(--c-primary-400); }
.badge-warn { background: #fef3c7; color: #b45309; }
[data-theme='dark'] .badge-warn { background: rgba(245, 158, 11, 0.2); color: #fbbf24; }

.mode-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-2); }
@media (max-width: 480px) { .mode-grid { grid-template-columns: 1fr; } }
.mode-card { display: flex; flex-direction: column; gap: 3px; padding: 8px 10px; border-radius: var(--r-sm); background: var(--c-surface); border: 1px solid var(--c-line); text-align: left; cursor: pointer; }
.mode-card:hover { border-color: var(--c-primary-400); }
.mode-card.is-selected { border-color: var(--c-primary-400); background: var(--c-primary-50); }
[data-theme='dark'] .mode-card.is-selected { background: rgba(34, 181, 134, 0.15); }
.mode-head { display: flex; align-items: center; justify-content: space-between; }
.mode-title { font-size: 13px; font-weight: 700; color: var(--c-text-1); }
.check-ic { color: var(--c-primary-400); }
.mode-desc { font-size: 11px; }

.pbc-interactive-box { display: flex; flex-direction: column; align-items: center; padding: var(--sp-2) 0; gap: var(--sp-2); text-align: center; }
.pbc-round-btn { width: 72px; height: 72px; border-radius: 50%; background: var(--c-primary-400); color: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; cursor: pointer; position: relative; }
.pbc-btn-label { font-size: 11px; font-weight: 700; }
.pbc-wave { position: absolute; top: 0; left: 0; right: 0; bottom: 0; border-radius: 50%; border: 2px solid var(--c-primary-400); animation: pbcPulse 2s ease-out infinite; pointer-events: none; }
.pbc-wave.wave-2 { animation-delay: 1s; }
@keyframes pbcPulse { 0% { transform: scale(1); opacity: 0.8; } 100% { transform: scale(1.6); opacity: 0; } }

.pin-input { font-size: 16px; letter-spacing: 3px; font-weight: 700; text-align: center; height: 38px; }

.status-rows { display: flex; flex-direction: column; gap: 4px; }
.status-row { display: flex; align-items: center; justify-content: space-between; padding: 2px 0; }
.status-row + .status-row { border-top: 1px solid var(--c-line); }
.status-val { font-size: 13px; font-weight: 600; color: var(--c-text-1); }
</style>
