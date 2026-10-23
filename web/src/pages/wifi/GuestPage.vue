<script setup lang="ts">import { computed, ref } from 'vue'
import {
  PAGE_KEYS,
  b64decode,
  readBandKeyStrict,
  ssid2Settings,
  wifiInfo,
} from '@/api'
import { usePageForm } from '@/composables/usePageForm'
import { validateSsid, validateWifiPassword } from '@/utils/validators'
import PageForm from '@/layouts/PageForm.vue'
import Card from '@/components/Card.vue'
import FormField from '@/components/FormField.vue'
import Toggle from '@/components/Toggle.vue'
import Icon from '@/components/Icon.vue'
import { toast } from '@/components/toast'

interface Model {
  enabled: boolean
  ssid: string
  broadcast: boolean
  authMode: string
  password: string
  maxStations: string
  isolation: boolean
}

const AUTH_MODES = [
  { label: 'WPA2-PSK', value: 'WPA2PSK' },
  { label: 'WPA-PSK/WPA2-PSK', value: 'WPAPSKWPA2PSK' },
  { label: 'WPA3-Personal', value: 'WPA3Personal' },
  { label: '不加密（OPEN）', value: 'OPEN' },
]

const { model, loading, saving, error, fieldErrors, dirty, load, save, reset } =
  usePageForm<Model>({
    keys: PAGE_KEYS.wifiGuest,
    fromStatus: (s) => {
      const band = s.wifi_band
      const rawMax = readBandKeyStrict(s, 'm_MAX_Access_num', band) || '0'
      return {
        enabled: (s.m_ssid_enable ?? '0') === '1',
        ssid: readBandKeyStrict(s, 'm_SSID', band) || '',
        broadcast: (readBandKeyStrict(s, 'm_HideSSID', band) ?? '0') !== '1',
        authMode: readBandKeyStrict(s, 'm_AuthMode', band) || 'WPA2PSK',
        password: b64decode(readBandKeyStrict(s, 'm_WPAPSK1_encode', band) || ''),
        maxStations: rawMax === '0' ? '8' : rawMax,
        isolation: (readBandKeyStrict(s, 'm_NoForwarding', band) ?? '0') === '1',
      }
    },
    validate: (m): Record<string, string> | null => {
      if (!m.enabled) return null
      const errs: Record<string, string> = {}
      const se = validateSsid(m.ssid)
      if (se) errs.ssid = se
      if (m.authMode !== 'OPEN') {
        const pe = validateWifiPassword(m.password, m.authMode)
        if (pe) errs.password = pe
      }

      const n = Number.parseInt(m.maxStations, 10)
      if (!Number.isFinite(n) || (n !== 0 && (n < 1 || n > 16))) {
        errs.maxStations = '范围 1~16'
      }
      return Object.keys(errs).length ? errs : null
    },
    toPayload: (m, r) => {
      const list: Record<string, string>[] = []
      const band = r.wifi_band

      const wasEnabled = (r.m_ssid_enable ?? '0') === '1'
      if (m.enabled !== wasEnabled) {
        list.push(
          wifiInfo({
            m_ssid_enable: m.enabled ? '1' : '0',
            wifiEnabled: r.wifi_cur_state || '1',
          }),
        )
      }

      if (m.enabled) {
        const rawMax = readBandKeyStrict(r, 'm_MAX_Access_num', band) || '0'
        const effectiveMax = m.maxStations === '0' ? '8' : m.maxStations
        const changed =
          !wasEnabled ||
          m.ssid !== (readBandKeyStrict(r, 'm_SSID', band) || '') ||
          m.broadcast !== ((readBandKeyStrict(r, 'm_HideSSID', band) ?? '0') !== '1') ||
          m.authMode !== (readBandKeyStrict(r, 'm_AuthMode', band) || 'WPA2PSK') ||
          m.password !== b64decode(readBandKeyStrict(r, 'm_WPAPSK1_encode', band) || '') ||
          effectiveMax !== rawMax ||
          m.isolation !== ((readBandKeyStrict(r, 'm_NoForwarding', band) ?? '0') === '1')

        if (changed) {
          list.push(
            ssid2Settings({
              m_SSID: m.ssid,
              m_HideSSID: m.broadcast ? '0' : '1',
              m_MAX_Access_num: effectiveMax,
              m_AuthMode: m.authMode,
              cipher: readBandKeyStrict(r, 'm_EncrypType', band) || 'TKIPCCMP',
              m_NoForwarding: m.isolation ? '1' : '0',
              m_show_qrcode_flag: readBandKeyStrict(r, 'm_show_qrcode_flag', band) || '0',
              passPhrase: m.authMode === 'OPEN' ? undefined : m.password,
            }),
          )
        }
      }

      return list
    },
  })

void load()

const needsPassword = computed(() => model.value.authMode !== 'OPEN')
const showPwd = ref(false)

async function copyText(text: string, label: string): Promise<void> {
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    toast(`已复制访客 ${label}: ${text}`, 'success')
  } catch {
    toast(`复制失败: ${text}`, 'info')
  }
}
</script>

<template>
  <PageForm
    title="访客网络"
    :loading="loading"
    :saving="saving"
    :error="error"
    :dirty="dirty"
    @save="save()"
    @reset="reset()"
  >

    <Card>
      <div class="guest-hero">
        <div class="guest-hero-left">
          <div class="guest-hero-icon" :class="{ 'is-active': model.enabled }">
            <Icon name="user-plus" :size="20" />
          </div>
          <div class="guest-hero-meta">
            <div class="guest-hero-title">
              <span class="guest-title-text">{{ model.enabled ? (model.ssid || '访客网络') : '访客网络' }}</span>
              <span class="status-pill" :class="model.enabled ? 'pill-on' : 'pill-off'">
                {{ model.enabled ? '已开启' : '已停用' }}
              </span>
            </div>
            <span class="t-cap">
              {{ model.enabled ? '独立第二热点，与主机内部局域网隔离' : '开启后为客人提供独立副热点' }}
            </span>
          </div>
        </div>
        <Toggle v-model="model.enabled" label="副 SSID 开关" />
      </div>
    </Card>

    <template v-if="model.enabled">
      <Card title="热点参数">
        <FormField label="SSID 名称" required :error="fieldErrors.ssid">
          <div class="input-with-action">
            <input v-model="model.ssid" type="text" autocomplete="off" spellcheck="false" placeholder="例如：Guest_WiFi" />
            <button
              v-if="model.ssid"
              type="button"
              class="field-btn"
              title="复制名称"
              @click="copyText(model.ssid, '网络名称')"
            >
              <Icon name="copy" :size="14" />
            </button>
          </div>
        </FormField>

        <FormField label="安全加密">
          <select v-model="model.authMode">
            <option v-for="a in AUTH_MODES" :key="a.value" :value="a.value">{{ a.label }}</option>
          </select>
        </FormField>

        <FormField
          v-if="needsPassword"
          label="连接密码"
          required
          :error="fieldErrors.password"
        >
          <div class="input-with-action">
            <input
              v-model="model.password"
              :type="showPwd ? 'text' : 'password'"
              autocomplete="off"
              spellcheck="false"
              placeholder="至少 8 位密码"
            />
            <button
              type="button"
              class="field-btn"
              :title="showPwd ? '隐藏密码' : '显示密码'"
              @click="showPwd = !showPwd"
            >
              <Icon :name="showPwd ? 'eye-off' : 'eye'" :size="14" />
            </button>
            <button
              v-if="model.password"
              type="button"
              class="field-btn"
              title="复制密码"
              @click="copyText(model.password, '密码')"
            >
              <Icon name="copy" :size="14" />
            </button>
          </div>
        </FormField>
      </Card>

      <Card title="访问控制">
        <div class="switch-row">
          <div>
            <p class="switch-title">广播 SSID</p>
            <p class="t-cap">关闭后需手动输入名称连接</p>
          </div>
          <Toggle v-model="model.broadcast" label="广播 SSID" />
        </div>

        <div class="switch-row separated">
          <div>
            <p class="switch-title">AP 隔离</p>
            <p class="t-cap">禁止访客互访与访问路由器后台</p>
          </div>
          <Toggle v-model="model.isolation" label="隔离" />
        </div>

        <FormField label="最大连接数" :error="fieldErrors.maxStations" class="mt-form">
          <input v-model="model.maxStations" type="number" min="1" max="16" inputmode="numeric" class="num" />
        </FormField>
      </Card>
    </template>

    <Card v-else title="网络隔离说明">
      <div class="dormant-box">
        <div class="dormant-grid">
          <div class="dormant-item">
            <span class="dormant-badge">私密保护</span>
            <p class="t-cap">无需告知客人主网络长密码，随时一键开关</p>
          </div>
          <div class="dormant-item">
            <span class="dormant-badge">局域网安全</span>
            <p class="t-cap">限制客人访问路由器控制台及您挂载的本地网络共享</p>
          </div>
        </div>
      </div>
    </Card>
  </PageForm>
</template>

<style scoped>
.guest-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
}

.guest-hero-left {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  min-width: 0;
}

.guest-hero-icon {
  width: 44px;
  height: 44px;
  border-radius: var(--r-md);
  background: var(--c-surface-2);
  color: var(--c-text-3);
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  transition: all 0.2s ease;
}

.guest-hero-icon.is-active {
  background: var(--c-primary-50);
  color: var(--c-primary-400);
}

[data-theme='dark'] .guest-hero-icon.is-active {
  background: var(--c-primary-100);
  color: var(--c-primary-600);
}

.guest-hero-meta {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.guest-hero-title {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.guest-title-text {
  font-size: var(--fs-h2);
  font-weight: 700;
  color: var(--c-text-1);
}

.status-pill {
  font-size: 11px;
  font-weight: 600;
  padding: 1px 7px;
  border-radius: var(--r-sm);
}

.pill-on {
  background: var(--c-primary-50);
  color: var(--c-primary-600);
}

[data-theme='dark'] .pill-on {
  background: rgba(34, 181, 134, 0.2);
  color: var(--c-primary-400);
}

.pill-off {
  background: var(--c-surface-2);
  color: var(--c-text-3);
}

.input-with-action {
  position: relative;
  display: flex;
  align-items: center;
}

.input-with-action input {
  padding-right: 70px !important;
}

.field-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: var(--c-text-3);
  border-radius: var(--r-sm);
  cursor: pointer;
  position: absolute;
  right: 6px;
}

.field-btn:nth-last-child(2) {
  right: 36px;
}

.field-btn:hover {
  color: var(--c-text-1);
}

.switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
}

.switch-row.separated {
  margin-top: var(--sp-4);
  padding-top: var(--sp-4);
  border-top: 1px solid var(--c-line);
}

.switch-title {
  font-size: var(--fs-body);
  font-weight: 600;
}

.mt-form {
  margin-top: var(--sp-4);
}

.dormant-box {
  padding: 4px 0;
}

.dormant-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--sp-3);
}

@media (max-width: 480px) {
  .dormant-grid {
    grid-template-columns: 1fr;
  }
}

.dormant-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: var(--sp-3);
  border-radius: var(--r-sm);
  background: var(--c-surface-2);
}

.dormant-badge {
  font-size: 12px;
  font-weight: 700;
  color: var(--c-text-1);
}
</style>
