<script setup lang="ts">import { computed } from 'vue'
import { DMZ_KEYS, dmzSetting } from '@/api'
import { usePageForm } from '@/composables/usePageForm'
import { useStations } from '@/composables/useStations'
import { isIpv4, validateIp } from '@/utils/validators'
import PageForm from '@/layouts/PageForm.vue'
import Card from '@/components/Card.vue'
import FormField from '@/components/FormField.vue'
import Toggle from '@/components/Toggle.vue'
import Icon from '@/components/Icon.vue'

interface Model {
  enabled: boolean
  ipAddress: string
}

const { model, raw, loading, saving, error, fieldErrors, dirty, load, save, reset } =
  usePageForm<Model>({
    keys: [...DMZ_KEYS, 'lan_ipaddr'],
    fromStatus: (s) => ({
      enabled: (s.DMZEnable ?? '0') === '1',
      ipAddress: s.DMZIPAddress || '',
    }),
    validate: (m): Record<string, string> | null => {
      if (!m.enabled) return null
      const err = validateIp(m.ipAddress)
      if (err) return { ipAddress: err }
      const lan = raw.value.lan_ipaddr || ''
      if (lan && isIpv4(lan)) {
        const a = lan.split('.').slice(0, 3).join('.')
        const b = m.ipAddress.split('.').slice(0, 3).join('.')
        if (a !== b) return { ipAddress: `必须与路由器处于同网段 (${a}.*)` }
      }
      return null
    },
    toPayload: (m) => [
      dmzSetting({ enabled: m.enabled ? '1' : '0', ipAddress: m.ipAddress }),
    ],
    confirmText: (m) =>
      m.enabled
        ? '高危警告：开启 DMZ 将把目标主机的全部 65535 个端口直接暴露至蜂窝公网，脱离路由器 NAT 保护！确认继续？'
        : null,
  })

const { stations, refresh: refreshStations } = useStations()

const _load = load
async function loadAll(): Promise<void> {
  await _load()
  await refreshStations()
}
void loadAll()

const lanPrefix = computed(() => {
  const lan = raw.value.lan_ipaddr || '192.168.0.1'
  return lan.split('.').slice(0, 3).join('.')
})
</script>

<template>
  <PageForm
    title="DMZ 主机"
    :loading="loading"
    :saving="saving"
    :error="error"
    :dirty="dirty"
    @save="save()"
    @reset="reset()"
  >
    <Card>
      <div class="dmz-hero">
        <div class="dmz-hero-left">
          <div class="dmz-hero-icon" :class="{ 'is-active': model.enabled }">
            <Icon name="target" :size="20" />
          </div>
          <div class="dmz-hero-meta">
            <div class="dmz-title-row">
              <span class="dmz-name">DMZ 主机</span>
              <span class="status-pill" :class="model.enabled ? 'pill-alert' : 'pill-safe'">
                {{ model.enabled ? '已暴露' : '已关闭' }}
              </span>
            </div>
            <span class="t-cap">
              {{ model.enabled ? `暴露 IP：${model.ipAddress || '未设定'}` : '所有外部入站端口默认拦截' }}
            </span>
          </div>
        </div>
        <Toggle v-model="model.enabled" label="启用 DMZ" />
      </div>
    </Card>

    <Card v-if="model.enabled" title="目标主机 IP">
      <FormField label="局域网 IP" required :error="fieldErrors.ipAddress">
        <input
          v-model="model.ipAddress"
          class="num ip-input"
          type="text"
          inputmode="decimal"
          autocomplete="off"
          :placeholder="`${lanPrefix}.100`"
        />
      </FormField>

      <div v-if="stations.length" class="quick-device-zone">
        <span class="t-cap quick-title">在线设备一键带入：</span>
        <div class="quick-tags">
          <button
            v-for="s in stations"
            :key="s.mac"
            type="button"
            class="dev-tag"
            :class="{ 'is-selected': s.ip && model.ipAddress === s.ip }"
            :disabled="!s.ip"
            @click="s.ip && (model.ipAddress = s.ip)"
          >
            <span class="tag-host">{{ s.hostname || '未命名' }}</span>
            <span class="tag-ip num">{{ s.ip }}</span>
          </button>
        </div>
      </div>
    </Card>

    <Card v-else title="状态">
      <div class="status-rows">
        <div class="status-row">
          <span class="t-cap">状态</span>
          <span class="status-val">未开启</span>
        </div>
        <div class="status-row">
          <span class="t-cap">网段</span>
          <span class="status-val num">{{ lanPrefix }}.0/24</span>
        </div>
      </div>
    </Card>
  </PageForm>
</template>

<style scoped>
.dmz-hero { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-3); }
.dmz-hero-left { display: flex; align-items: center; gap: var(--sp-3); min-width: 0; }
.dmz-hero-icon { width: 38px; height: 38px; border-radius: var(--r-md); background: var(--c-surface-2); color: var(--c-text-3); display: flex; align-items: center; justify-content: center; flex: none; }
.dmz-hero-icon.is-active { background: #fee2e2; color: #ef4444; }
[data-theme='dark'] .dmz-hero-icon.is-active { background: rgba(239, 68, 68, 0.2); color: #f87171; }

.dmz-hero-meta { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.dmz-title-row { display: flex; align-items: center; gap: 6px; }
.dmz-name { font-size: 15px; font-weight: 700; color: var(--c-text-1); }
.status-pill { font-size: 11px; font-weight: 600; padding: 1px 6px; border-radius: var(--r-sm); }
.pill-safe { background: var(--c-primary-50); color: var(--c-primary-600); }
[data-theme='dark'] .pill-safe { background: rgba(34, 181, 134, 0.2); color: var(--c-primary-400); }
.pill-alert { background: var(--c-danger-bg); color: var(--c-danger); }

.ip-input { height: 38px; }
.quick-device-zone { margin-top: var(--sp-2); padding: var(--sp-2) var(--sp-3); border-radius: var(--r-sm); background: var(--c-surface-2); }
.quick-title { font-size: 11px; display: block; margin-bottom: 4px; }
.quick-tags { display: flex; flex-wrap: wrap; gap: 6px; }
.dev-tag { display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: var(--r-sm); background: var(--c-surface); border: 1px solid var(--c-line); color: var(--c-text-2); font-size: 11px; cursor: pointer; }
.dev-tag:hover:not(:disabled) { border-color: var(--c-primary-400); color: var(--c-text-1); }
.dev-tag.is-selected { border-color: var(--c-primary-400); background: var(--c-primary-50); color: var(--c-primary-600); font-weight: 600; }
[data-theme='dark'] .dev-tag.is-selected { background: rgba(34, 181, 134, 0.15); color: var(--c-primary-400); }
.dev-tag:disabled { opacity: 0.4; cursor: not-allowed; }
.tag-host { font-weight: 600; }
.tag-ip { font-size: 10px; opacity: 0.85; }

.status-rows { display: flex; flex-direction: column; gap: 6px; }
.status-row { display: flex; align-items: center; justify-content: space-between; padding: 3px 0; }
.status-row + .status-row { border-top: 1px solid var(--c-line); }
.status-val { font-size: 13px; font-weight: 600; color: var(--c-text-1); }
</style>
