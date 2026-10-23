<script setup lang="ts">import { computed, ref } from 'vue'
import { PAGE_KEYS, b64decode, readBandKeyStrict, ssid1Settings, wifiInfo } from '@/api'
import { usePageForm } from '@/composables/usePageForm'
import { toast } from '@/components/toast'
import PageForm from '@/layouts/PageForm.vue'
import Card from '@/components/Card.vue'
import Icon from '@/components/Icon.vue'
import FormField from '@/components/FormField.vue'
import Toggle from '@/components/Toggle.vue'
import { validateSsid, validateWifiPassword } from '@/utils/validators'

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
  { label: 'WPA2/WPA3 混合', value: 'WPA2WPA3' },
  { label: '不加密（OPEN）', value: 'OPEN' },
]

const { model, raw, loading, saving, error, fieldErrors, dirty, load, save, reset } = usePageForm<Model>(
  {
    keys: PAGE_KEYS.wifiBasic,
    fromStatus: (s) => {
      const band = s.wifi_band
      return {
        enabled: (s.wifi_cur_state ?? '1') === '1',
        ssid: readBandKeyStrict(s, 'SSID1', band) || '',
        broadcast: (readBandKeyStrict(s, 'HideSSID', band) ?? '0') !== '1',
        authMode: readBandKeyStrict(s, 'AuthMode', band) || 'WPA2PSK',
        password: b64decode(readBandKeyStrict(s, 'WPAPSK1_encode', band) || ''),
        maxStations: readBandKeyStrict(s, 'MAX_Access_num', band) || '8',
        isolation: (readBandKeyStrict(s, 'NoForwarding', band) ?? '0') === '1',
      }
    },
    validate: (m): Record<string, string> | null => {
      const errs: Record<string, string> = {}
      const ssidErr = validateSsid(m.ssid)
      if (ssidErr) errs.ssid = ssidErr
      if (m.authMode !== 'OPEN') {
        const pwdErr = validateWifiPassword(m.password, m.authMode)
        if (pwdErr) errs.password = pwdErr
      }
      const n = Number.parseInt(m.maxStations, 10)
      if (!Number.isFinite(n) || n < 1 || n > 16) errs.maxStations = '范围 1~16'
      return Object.keys(errs).length ? errs : null
    },
    toPayload: (m, raw) => {
      const list: Record<string, string>[] = []
      const band = raw.wifi_band
      const wasEnabled = (raw.wifi_cur_state ?? '1') === '1'

      if (m.enabled !== wasEnabled) {
        list.push(wifiInfo({ wifiEnabled: m.enabled ? '1' : '0' }))
      }

      const ssidChanged =
        m.ssid !== (readBandKeyStrict(raw, 'SSID1', band) || '') ||
        m.broadcast !== ((readBandKeyStrict(raw, 'HideSSID', band) ?? '0') !== '1') ||
        m.maxStations !== (readBandKeyStrict(raw, 'MAX_Access_num', band) || '8') ||
        m.isolation !== ((readBandKeyStrict(raw, 'NoForwarding', band) ?? '0') === '1')
      const pwdChanged =
        m.authMode !== (readBandKeyStrict(raw, 'AuthMode', band) || 'WPA2PSK') ||
        m.password !== b64decode(readBandKeyStrict(raw, 'WPAPSK1_encode', band) || '')

      if (ssidChanged || pwdChanged) {
        list.push(
          ssid1Settings({
            ssid: m.ssid,

            broadcastSsidEnabled: m.broadcast ? '0' : '1',
            MAX_Access_num: m.maxStations,
            security_mode: m.authMode,

            cipher: readBandKeyStrict(raw, 'EncrypType', band) || 'AES',
            NoForwarding: m.isolation ? '1' : '0',
            show_qrcode_flag: readBandKeyStrict(raw, 'show_qrcode_flag', band) || '1',
            passPhrase: m.authMode === 'OPEN' ? undefined : m.password,
          }),
        )
      }

      return list
    },
    confirmText: (m) => {
      if (!m.enabled) return '关闭 WiFi 后，本机将无法连接。确认继续？'
      return null
    },
  },
)

void load()

const needsPassword = computed(() => model.value.authMode !== 'OPEN')
const showPwd = ref(false)

async function copyText(text: string, label: string): Promise<void> {
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    toast(`已复制${label}`, 'success')
  } catch {
    toast('复制失败', 'error')
  }
}
</script>

<template>
  <PageForm
    title="WiFi 设置"
    :loading="loading"
    :saving="saving"
    :error="error"
    :dirty="dirty"
    @save="save()"
    @reset="reset()"
  >

    <Card>
      <div class="hotspot-banner">
        <div class="hotspot-main">
          <div class="hotspot-icon" :class="{ 'is-off': !model.enabled }">
            <Icon :name="model.enabled ? 'wifi' : 'wifi-off'" :size="24" />
          </div>
          <div class="hotspot-meta">
            <div class="ssid-row">
              <span class="hotspot-ssid num">{{ model.ssid || '未命名网络' }}</span>
              <button
                type="button"
                class="copy-mini"
                title="复制 WiFi 名称"
                @click="copyText(model.ssid, 'WiFi 名称')"
              >
                <Icon name="copy" :size="13" />
              </button>
            </div>
            <div class="hotspot-tags">
              <span class="mini-tag" :class="model.enabled ? 'tag-green' : 'tag-gray'">
                {{ model.enabled ? (model.broadcast ? '广播中' : '隐藏广播') : '已关闭' }}
              </span>
              <span class="mini-tag tag-gray">{{ raw.wifi_band === 'a' ? '5GHz' : '2.4GHz' }}</span>
              <span class="mini-tag tag-gray">{{ model.authMode }}</span>
              <span class="mini-tag tag-gray">限 {{ model.maxStations }} 台</span>
            </div>
          </div>
        </div>
        <Toggle v-model="model.enabled" label="WiFi 开关" />
      </div>

      <div v-if="model.enabled && needsPassword" class="pwd-fast-row">
        <div class="fast-meta">
          <span class="t-cap">连接密码</span>
          <span class="fast-val num">{{ showPwd ? (model.password || '—') : '••••••••' }}</span>
        </div>
        <div class="fast-actions">
          <button type="button" class="fast-btn" title="查看密码" @click="showPwd = !showPwd">
            <Icon :name="showPwd ? 'eye-off' : 'eye'" :size="15" />
          </button>
          <button
            type="button"
            class="fast-btn"
            title="复制密码"
            @click="copyText(model.password, 'WiFi 密码')"
          >
            <Icon name="copy" :size="15" />
          </button>
        </div>
      </div>
    </Card>

    <Card title="网络名称与安全">
      <FormField label="WiFi 名称（SSID）" required :error="fieldErrors.ssid">
        <input v-model="model.ssid" type="text" autocomplete="off" spellcheck="false" />
      </FormField>

      <FormField label="加密协议">
        <select v-model="model.authMode">
          <option v-for="a in AUTH_MODES" :key="a.value" :value="a.value">{{ a.label }}</option>
        </select>
      </FormField>

      <FormField
        v-if="needsPassword"
        label="WiFi 密码"
        required
        :error="fieldErrors.password"
      >
        <div class="pwd-wrap">
          <input
            v-model="model.password"
            :type="showPwd ? 'text' : 'password'"
            autocomplete="off"
            spellcheck="false"
            class="pwd-inp num"
          />
          <button type="button" class="eye-btn" :title="showPwd ? '隐藏密码' : '显示密码'" @click="showPwd = !showPwd">
            <Icon :name="showPwd ? 'eye-off' : 'eye'" :size="16" />
          </button>
        </div>
      </FormField>
    </Card>

    <Card title="连接控制">
      <div class="switch-row">
        <div>
          <p class="switch-title">广播 SSID</p>
          <p class="t-cap">关闭后周围设备需手动输入名称连接</p>
        </div>
        <Toggle v-model="model.broadcast" label="广播 SSID" />
      </div>

      <div class="switch-row separated">
        <div>
          <p class="switch-title">客户端隔离 (AP 隔离)</p>
          <p class="t-cap">禁止已连接的局域网终端互相访问</p>
        </div>
        <Toggle v-model="model.isolation" label="客户端隔离" />
      </div>

      <FormField label="最大连接数" :error="fieldErrors.maxStations" class="mt">
        <input v-model="model.maxStations" type="number" min="1" max="16" inputmode="numeric" class="num" />
      </FormField>
    </Card>
  </PageForm>
</template>

<style scoped>
.hotspot-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
}

.hotspot-main {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  min-width: 0;
}

.hotspot-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: var(--r-md);
  background: var(--c-primary-50);
  color: var(--c-primary-400);
  flex: none;
}

[data-theme='dark'] .hotspot-icon {
  background: var(--c-primary-100);
  color: var(--c-primary-600);
}

.hotspot-icon.is-off {
  background: var(--c-surface-2);
  color: var(--c-text-3);
}

.hotspot-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.hotspot-ssid {
  font-size: var(--fs-h2);
  font-weight: 700;
  color: var(--c-text-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hotspot-tags {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.mini-tag {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: var(--r-sm);
}

.tag-green {
  background: var(--c-primary-50);
  color: var(--c-primary-600);
}

[data-theme='dark'] .tag-green {
  background: rgba(34, 181, 134, 0.2);
  color: var(--c-primary-400);
}

.tag-gray {
  background: var(--c-surface-2);
  color: var(--c-text-2);
}

.ssid-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.copy-mini {
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--r-sm);
  color: var(--c-text-3);
  background: var(--c-surface-2);
  transition: all 0.15s ease;
}
.copy-mini:hover {
  color: var(--c-text-1);
}

.pwd-fast-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: var(--sp-3);
  padding: 8px 12px;
  border-radius: var(--r-sm);
  background: var(--c-surface-2);
  border: 1px solid var(--c-line);
}

.fast-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.fast-val {
  font-size: 13px;
  font-weight: 700;
  color: var(--c-text-1);
}

.fast-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.fast-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--r-sm);
  color: var(--c-text-3);
  transition: all 0.15s ease;
}
.fast-btn:hover {
  color: var(--c-text-1);
}
.fast-btn:active {
  transform: scale(0.9);
}

.pwd-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.pwd-inp {
  padding-right: 44px !important;
}

.eye-btn {
  position: absolute;
  right: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  color: var(--c-text-3);
  border-radius: var(--r-sm);
}

.eye-btn:active {
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

.mt {
  margin-top: var(--sp-3);
}
</style>
