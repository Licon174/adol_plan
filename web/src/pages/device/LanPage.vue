<script setup lang="ts">import { computed, ref } from 'vue'
import { dhcpSetting, getStatus, post, type StatusKey } from '@/api'
import { toast } from '@/components/toast'
import { confirm } from '@/components/confirm'
import { withLoading } from '@/components/loading'
import { isIpv4, validateIp, validateNetmask } from '@/utils/validators'
import PageForm from '@/layouts/PageForm.vue'
import Card from '@/components/Card.vue'
import FormField from '@/components/FormField.vue'
import Toggle from '@/components/Toggle.vue'
import Icon from '@/components/Icon.vue'

interface Model {
  ip: string
  mask: string
  dhcpOn: boolean
  dhcpStart: string
  dhcpEnd: string
  leaseHour: string
  dnsMode: 'auto' | 'manual'
  dns1: string
  dns2: string
}

const raw = ref<Record<string, string>>({})
const saved = ref<Model | null>(null)
const loading = ref(true)
const error = ref('')
const busy = ref(false)

const model = ref<Model>({
  ip: '',
  mask: '',
  dhcpOn: true,
  dhcpStart: '',
  dhcpEnd: '',
  leaseHour: '',
  dnsMode: 'auto',
  dns1: '',
  dns2: '',
})

const KEYS: StatusKey[] = [
  'lan_ipaddr',
  'lan_netmask',
  'mac_address',
  'dhcpEnabled',
  'dhcpStart',
  'dhcpEnd',
  'dhcpLease_hour',
  'lan_dns_mode',
  'lan_dns_ip',
]

const DNS_PRESETS = [
  { label: '阿里 DNS', d1: '223.5.5.5', d2: '223.6.6.6' },
  { label: '腾讯 DNSPod', d1: '119.29.29.29', d2: '182.254.116.116' },
  { label: '114 DNS', d1: '114.114.114.114', d2: '114.114.115.115' },
  { label: 'Cloudflare', d1: '1.1.1.1', d2: '1.0.0.1' },
  { label: 'Google', d1: '8.8.8.8', d2: '8.8.4.4' },
]

function applyDnsPreset(p: { d1: string; d2: string }): void {
  model.value.dnsMode = 'manual'
  model.value.dns1 = p.d1
  model.value.dns2 = p.d2
}

async function load(): Promise<void> {
  loading.value = true
  try {
    raw.value = (await getStatus(KEYS)) as Record<string, string>
    const dnsRaw = (raw.value.lan_dns_ip ?? '').trim()
    const dnsParts = dnsRaw.split(/[,;\s]+/).filter(Boolean)
    const m: Model = {
      ip: raw.value.lan_ipaddr ?? '',
      mask: raw.value.lan_netmask ?? '',
      dhcpOn: (raw.value.dhcpEnabled ?? '1') === '1',
      dhcpStart: raw.value.dhcpStart ?? '',
      dhcpEnd: raw.value.dhcpEnd ?? '',
      leaseHour: raw.value.dhcpLease_hour ?? '',
      dnsMode: (raw.value.lan_dns_mode ?? 'auto').toLowerCase() === 'manual' ? 'manual' : 'auto',
      dns1: dnsParts[0] ?? '',
      dns2: dnsParts[1] ?? '',
    }
    model.value = m
    saved.value = { ...m }
    error.value = ''
  } catch (e) {
    error.value = e instanceof Error ? e.message : '读取失败'
  } finally {
    loading.value = false
  }
}
void load()

const dirty = computed(() => JSON.stringify(model.value) !== JSON.stringify(saved.value))

const poolCapacity = computed(() => {
  if (!model.value.dhcpOn) return 0
  const start = model.value.dhcpStart
  const end = model.value.dhcpEnd
  if (!isIpv4(start) || !isIpv4(end)) return 0
  const toNum = (ip: string) => ip.split('.').reduce((a, b) => a * 256 + Number(b), 0)
  const diff = toNum(end) - toNum(start) + 1
  return diff > 0 ? diff : 0
})

async function copyMac(): Promise<void> {
  if (!raw.value.mac_address) return
  try {
    await navigator.clipboard.writeText(raw.value.mac_address)
    toast('已复制 MAC 地址', 'success')
  } catch {
    toast('复制失败', 'error')
  }
}

async function save(): Promise<void> {
  const m = model.value
  const ie = validateIp(m.ip)
  if (ie) {
    toast('管理地址：' + ie, 'error')
    return
  }
  const me = validateNetmask(m.mask)
  if (me) {
    toast('子网掩码：' + me, 'error')
    return
  }
  if (m.dhcpOn) {
    if (!isIpv4(m.dhcpStart) || !isIpv4(m.dhcpEnd)) {
      toast('请填写完整的地址池起止地址', 'error')
      return
    }
    const toNum = (ip: string) =>
      ip.split('.').reduce((a, b) => a * 256 + Number(b), 0)
    if (toNum(m.dhcpStart) > toNum(m.dhcpEnd)) {
      toast('起始地址不能大于结束地址', 'error')
      return
    }
  }
  if (m.dnsMode === 'manual') {
    if (!m.dns1 && !m.dns2) {
      toast('手动 DNS 模式需至少输入一个 DNS 地址', 'error')
      return
    }
    if (m.dns1 && !isIpv4(m.dns1)) {
      toast('首选 DNS 地址不合法', 'error')
      return
    }
    if (m.dns2 && !isIpv4(m.dns2)) {
      toast('备用 DNS 地址不合法', 'error')
      return
    }
  }

  const ok = await confirm({
    title: '保存 LAN 设置',
    message: '保存后设备将重启，需重新登录。确认继续？',
    danger: true,
  })
  if (!ok) return

  busy.value = true
  try {
    const dnsIpStr = m.dnsMode === 'manual'
      ? [m.dns1.trim(), m.dns2.trim()].filter(Boolean).join(';')
      : ''
    await withLoading(async () => {
      const res = await post(
        dhcpSetting({
          ipAddress: m.ip,
          subnetMask: m.mask,
          dhcpServerOn: m.dhcpOn,
          dhcpStart: m.dhcpStart,
          dhcpEnd: m.dhcpEnd,
          dhcpLease: m.leaseHour,
          dnsMode: m.dnsMode,
          dnsIp: dnsIpStr,
        }),
        { timeoutMs: 5000, expectAbort: true },
      )
      if (res.result && res.result !== 'success') throw new Error(res.result || '保存失败')
    }, '正在保存…')
    saved.value = { ...m }
    toast('已保存，设备正在重启', 'success')
  } catch (e) {
    toast(e instanceof Error ? e.message : '保存失败', 'error')
  } finally {
    busy.value = false
  }
}

function reset(): void {
  if (saved.value) model.value = { ...saved.value }
}
</script>

<template>
  <PageForm
    title="LAN 局域网"
    :loading="loading"
    :error="error"
    :dirty="dirty"
    :saving="busy"
    @save="save"
    @reset="reset"
  >

    <Card class="topo-card">
      <div class="topo-diagram">
        <div class="topo-node">
          <div class="topo-icon-box">
            <Icon name="router" :size="18" />
          </div>
          <div class="topo-meta">
            <span class="topo-title">网关</span>
            <span class="topo-ip num">{{ model.ip || '—' }}</span>
          </div>
        </div>

        <div class="topo-connector">
          <div class="topo-line" />
          <span class="topo-badge num" :class="model.dhcpOn ? 'badge-active' : 'badge-off'">
            {{ model.dhcpOn ? `DHCP (${poolCapacity}台)` : '静态' }}
          </span>
          <div class="topo-line" />
        </div>

        <div class="topo-node">
          <div class="topo-icon-box">
            <Icon name="network" :size="18" />
          </div>
          <div class="topo-meta">
            <span class="topo-title">终端段</span>
            <span class="topo-ip num">
              {{ model.dhcpOn ? `${model.dhcpStart.split('.').pop() || '100'}~${model.dhcpEnd.split('.').pop() || '200'}` : '停用' }}
            </span>
          </div>
        </div>
      </div>
    </Card>

    <Card title="本机参数">
      <FormField label="网关管理地址">
        <input v-model="model.ip" class="num" type="text" inputmode="decimal" autocomplete="off" />
      </FormField>
      <FormField label="子网掩码">
        <input v-model="model.mask" class="num" type="text" inputmode="decimal" autocomplete="off" />
      </FormField>
      <div class="mac-row">
        <div class="mac-meta">
          <span class="t-cap">物理 MAC</span>
          <span class="num mac-val">{{ raw.mac_address || '—' }}</span>
        </div>
        <button
          v-if="raw.mac_address"
          type="button"
          class="copy-btn"
          title="复制 MAC"
          @click="copyMac"
        >
          <Icon name="copy" :size="14" />
        </button>
      </div>
    </Card>

    <Card title="DHCP 服务">
      <div class="switch-row">
        <span class="switch-title">动态分配地址</span>
        <Toggle v-model="model.dhcpOn" label="DHCP" />
      </div>

      <template v-if="model.dhcpOn">
        <div class="row-2">
          <FormField label="起始 IP">
            <input
              v-model="model.dhcpStart"
              class="num"
              type="text"
              inputmode="decimal"
              autocomplete="off"
            />
          </FormField>
          <FormField label="结束 IP">
            <input
              v-model="model.dhcpEnd"
              class="num"
              type="text"
              inputmode="decimal"
              autocomplete="off"
            />
          </FormField>
        </div>
        <FormField label="租期 (小时)">
          <input
            v-model="model.leaseHour"
            class="num"
            type="number"
            min="1"
            inputmode="numeric"
          />
        </FormField>
      </template>
    </Card>

    <Card title="DNS 服务器">
      <div class="switch-row">
        <div>
          <span class="switch-title">自定义 DNS</span>
          <p class="t-cap">{{ model.dnsMode === 'auto' ? '自动获取运营商分配 DNS' : '手动指定终端 DNS' }}</p>
        </div>
        <Toggle
          :model-value="model.dnsMode === 'manual'"
          label="自定义 DNS"
          @update:model-value="(v) => (model.dnsMode = v ? 'manual' : 'auto')"
        />
      </div>

      <template v-if="model.dnsMode === 'manual'">
        <div class="dns-preset-chips mt-2">
          <span class="t-cap">常用：</span>
          <button
            v-for="p in DNS_PRESETS"
            :key="p.label"
            type="button"
            class="dns-preset-chip"
            @click="applyDnsPreset(p)"
          >
            {{ p.label }}
          </button>
        </div>

        <div class="row-2">
          <FormField label="首选 DNS">
            <input
              v-model="model.dns1"
              class="num"
              type="text"
              inputmode="decimal"
              autocomplete="off"
              placeholder="例如 223.5.5.5"
            />
          </FormField>
          <FormField label="备用 DNS">
            <input
              v-model="model.dns2"
              class="num"
              type="text"
              inputmode="decimal"
              autocomplete="off"
              placeholder="例如 223.6.6.6"
            />
          </FormField>
        </div>
      </template>
    </Card>

    <div class="warn-banner">
      <Icon name="shield-alert" :size="16" />
      <span>修改网关、DHCP 或 DNS 设置将重启设备</span>
    </div>
  </PageForm>
</template>

<style scoped>

.topo-card {
  padding: var(--sp-3);
  margin-bottom: var(--sp-3);
}

.topo-diagram {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.topo-node {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
}

.topo-icon-box {
  width: 40px;
  height: 40px;
  border-radius: var(--r-md);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--c-surface-2);
  color: var(--c-primary-500);
  border: 1px solid var(--c-line);
  flex-shrink: 0;
}

.topo-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.topo-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--c-text-3);
}

.topo-ip {
  font-size: 13px;
  font-weight: 700;
  color: var(--c-text-1);
}

.topo-connector {
  display: flex;
  align-items: center;
  flex: 1;
  max-width: 140px;
  position: relative;
}

.topo-line {
  flex: 1;
  height: 1px;
  background: var(--c-line-strong);
}

.topo-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: var(--r-full);
  white-space: nowrap;
  flex-shrink: 0;
}

.badge-active {
  background: rgba(16, 185, 129, 0.12);
  color: var(--c-primary-500);
}

.badge-off {
  background: var(--c-surface-2);
  color: var(--c-text-3);
}

.mac-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0 2px;
  border-top: 1px solid var(--c-line);
  margin-top: var(--sp-2);
}

.mac-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.mac-val {
  font-size: 13px;
  font-weight: 600;
  color: var(--c-text-1);
}

.copy-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
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

.switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
}

.switch-title {
  font-size: var(--fs-body);
  font-weight: 600;
}

.dns-preset-chips {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 8px;
}

.dns-preset-chip {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: var(--r-sm);
  background: var(--c-surface-2);
  border: 1px solid var(--c-line);
  color: var(--c-text-2);
  cursor: pointer;
}
.dns-preset-chip:hover {
  border-color: var(--c-primary-400);
  color: var(--c-primary-500);
}

.row-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--sp-3);
  margin-top: var(--sp-3);
}

@media (max-width: 480px) {
  .row-2 {
    grid-template-columns: 1fr;
  }
}

.warn-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: var(--r-md);
  background: rgba(245, 158, 11, 0.08);
  border: 1px solid rgba(245, 158, 11, 0.2);
  color: #f59e0b;
  font-size: 12px;
  margin-top: var(--sp-4);
  line-height: 1.4;
}
</style>
