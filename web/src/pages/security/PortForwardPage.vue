<script setup lang="ts">import { computed, ref } from 'vue'
import { PORT_FORWARD_KEYS, getStatus, portForwardAdd, portForwardDel } from '@/api'
import { post } from '@/api'
import { useStations } from '@/composables/useStations'
import { toast } from '@/components/toast'
import { withLoading } from '@/components/loading'
import { confirm } from '@/components/confirm'
import { isIpv4, validateIp, validatePortRange } from '@/utils/validators'
import PageForm from '@/layouts/PageForm.vue'
import Card from '@/components/Card.vue'
import FormField from '@/components/FormField.vue'
import Toggle from '@/components/Toggle.vue'
import Icon from '@/components/Icon.vue'

interface Rule {
  index: number
  raw: string
  ip: string
  portStart: string
  portEnd: string
  protocol: string
  comment: string
}

const PROTOCOLS = [
  { label: 'TCP', value: 'TCP' },
  { label: 'TCP & UDP', value: 'TCP&UDP' },
]

const raw = ref<Record<string, string>>({})
const loading = ref(true)
const error = ref('')
const busy = ref(false)
const showAdd = ref(false)
const form = ref({ ip: '', portStart: '', portEnd: '', protocol: 'TCP', comment: '' })
const formErrors = ref<Record<string, string>>({})

const { stations, refresh: refreshStations } = useStations()

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {

    raw.value = (await getStatus([...PORT_FORWARD_KEYS, 'lan_ipaddr'])) as Record<string, string>
  } catch (e) {
    error.value = e instanceof Error ? e.message : '读取失败'
  } finally {
    loading.value = false
  }
  await refreshStations()
}
void load()

function parseRules(values: Record<string, string>): Rule[] {
  const out: Rule[] = []
  for (let i = 0; i < 10; i++) {
    const s = values[`PortForwardRules_${i}`] ?? ''
    if (!s.trim()) continue
    const f = s.split(',')
    out.push({
      index: i,
      raw: s,
      ip: f[0] ?? '',
      portStart: f[1] ?? '',
      portEnd: f[2] ?? '',
      protocol: f[3] === '1' ? 'TCP' : f[3] === '2' ? 'UDP' : 'TCP&UDP',
      comment: f[4] ?? '',
    })
  }
  return out
}

const rules = computed(() => parseRules(raw.value))
const enabled = computed(() => (raw.value.PortForwardEnable ?? '0') === '1')

async function toggleSwitch(v: boolean): Promise<void> {
  busy.value = true
  try {
    await withLoading(async () => {

      const res = await post({ goformId: 'VIRTUAL_SERVER', PortForwardEnable: v ? '1' : '0' })
      if (res.result !== 'success') throw new Error(res.result || '设置失败')
    }, '正在保存…')
    toast(v ? '端口转发已启用' : '端口转发已关闭', 'success')
    await load()
  } catch (e) {
    toast(e instanceof Error ? e.message : '设置失败', 'error')
  } finally {
    busy.value = false
  }
}

function validate(): boolean {
  const errs: Record<string, string> = {}
  const ie = validateIp(form.value.ip)
  if (ie) errs.ip = ie
  const pe = validatePortRange(form.value.portStart, form.value.portEnd || form.value.portStart)
  if (pe) errs.portStart = pe
  const lan = raw.value.lan_ipaddr || ''
  if (lan && isIpv4(lan) && isIpv4(form.value.ip)) {
    if (lan.split('.').slice(0, 3).join('.') !== form.value.ip.split('.').slice(0, 3).join('.')) {
      errs.ip = `应与本机同网段（${lan.split('.').slice(0, 3).join('.')}.*）`
    }
  }
  formErrors.value = errs
  const firstErr = Object.values(errs)[0]
  if (firstErr) toast(firstErr, 'error')
  return Object.keys(errs).length === 0
}

async function addRule(): Promise<void> {
  if (!validate()) return
  busy.value = true
  try {
    await withLoading(async () => {

      if (!enabled.value) {
        await post({ goformId: 'VIRTUAL_SERVER', PortForwardEnable: '1' })
      }
      const res = await post(
        portForwardAdd({
          enable: '1',
          ipAddress: form.value.ip,
          portStart: form.value.portStart,
          portEnd: form.value.portEnd || form.value.portStart,
          protocol: form.value.protocol,
          comment: form.value.comment,
        }),
      )
      if (res.result !== 'success') throw new Error(res.result || '添加失败')
    }, '正在添加…')
    toast('已添加转发规则', 'success')
    showAdd.value = false
    form.value = { ip: '', portStart: '', portEnd: '', protocol: 'TCP', comment: '' }
    await load()
  } catch (e) {
    toast(e instanceof Error ? e.message : '添加失败', 'error')
  } finally {
    busy.value = false
  }
}

async function removeRule(r: Rule): Promise<void> {
  const ok = await confirm({
    title: '删除规则',
    message: `删除到 ${r.ip} 的 ${r.portStart}-${r.portEnd} 转发？`,
    danger: true,
  })
  if (!ok) return
  busy.value = true
  try {
    await withLoading(async () => {
      const res = await post(portForwardDel(String(r.index)))
      if (res.result !== 'success') throw new Error(res.result || '删除失败')
    }, '正在删除…')
    toast('已删除', 'success')
    await load()
  } catch (e) {
    toast(e instanceof Error ? e.message : '删除失败', 'error')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <PageForm title="端口转发" :loading="loading" :error="error" :savable="false">
    <Card>
      <div class="pf-hero">
        <div class="pf-hero-left">
          <div class="pf-hero-icon" :class="{ 'is-active': enabled }">
            <Icon name="network" :size="20" />
          </div>
          <div class="pf-hero-meta">
            <div class="pf-title-row">
              <span class="pf-name">端口转发</span>
              <span class="status-pill" :class="enabled ? 'pill-on' : 'pill-off'">
                {{ enabled ? `已开启 (${rules.length}/10)` : '未开启' }}
              </span>
            </div>
            <span class="t-cap">
              {{ enabled ? `已配置 ${rules.length} 条转发规则` : '入站端口请求默认丢弃' }}
            </span>
          </div>
        </div>
        <Toggle :model-value="enabled" label="端口转发" :disabled="busy" @update:model-value="toggleSwitch" />
      </div>
    </Card>

    <Card :title="`转发规则 (${rules.length}/10)`">
      <div class="list-head-actions">
        <span class="t-cap">公网访问直通映射至内网主机</span>
        <button
          type="button"
          class="btn-toggle-add"
          :disabled="busy || rules.length >= 10"
          @click="showAdd = !showAdd"
        >
          <Icon :name="showAdd ? 'close' : 'plus'" :size="13" />
          <span>{{ showAdd ? '收起' : '新增规则' }}</span>
        </button>
      </div>

      <div v-if="showAdd" class="add-drawer">
        <div class="drawer-box">
          <FormField label="内网 IP" :error="formErrors.ip">
            <input v-model="form.ip" class="num drawer-input" type="text" inputmode="decimal" autocomplete="off" placeholder="192.168.0.100" />
          </FormField>

          <div v-if="stations.length" class="quick-devices">
            <div class="chip-row">
              <button
                v-for="s in stations"
                :key="s.mac"
                type="button"
                class="dev-chip"
                :disabled="!s.ip"
                @click="s.ip && (form.ip = s.ip)"
              >
                <span class="chip-name">{{ s.hostname || s.mac }}</span>
                <span class="chip-ip num">{{ s.ip }}</span>
              </button>
            </div>
          </div>

          <div class="port-row">
            <FormField label="外部起始端口" :error="formErrors.portStart">
              <input v-model="form.portStart" type="number" min="1" max="65535" inputmode="numeric" placeholder="1~65535" />
            </FormField>
            <FormField label="外部结束端口">
              <input
                v-model="form.portEnd"
                type="number"
                min="1"
                max="65535"
                inputmode="numeric"
                :placeholder="form.portStart || '单端口'"
              />
            </FormField>
          </div>

          <div class="protocol-row">
            <FormField label="协议">
              <select v-model="form.protocol">
                <option v-for="p in PROTOCOLS" :key="p.value" :value="p.value">{{ p.label }}</option>
              </select>
            </FormField>
            <FormField label="备注">
              <input v-model="form.comment" type="text" maxlength="31" autocomplete="off" placeholder="可选备注" />
            </FormField>
          </div>

          <div class="drawer-actions">
            <button type="button" class="btn-cancel" @click="showAdd = false">取消</button>
            <button type="button" class="btn-confirm-add" :disabled="busy" @click="addRule">保存规则</button>
          </div>
        </div>
      </div>

      <div v-if="rules.length" class="rules-table">
        <div v-for="r in rules" :key="r.index" class="rule-card">
          <div class="rule-left">
            <div class="rule-proto-tag num">{{ r.protocol }}</div>
            <div class="rule-info">
              <span class="rule-ports num">:{{ r.portStart }}{{ r.portEnd && r.portEnd !== r.portStart ? `-${r.portEnd}` : '' }} → {{ r.ip }}</span>
              <span v-if="r.comment" class="t-cap">{{ r.comment }}</span>
            </div>
          </div>
          <button type="button" class="btn-del-rule" :disabled="busy" title="删除" @click="removeRule(r)">
            <Icon name="trash" :size="14" />
          </button>
        </div>
      </div>
      <p v-else class="empty-p t-cap">暂无转发规则</p>
    </Card>
  </PageForm>
</template>

<style scoped>
.pf-hero { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-3); }
.pf-hero-left { display: flex; align-items: center; gap: var(--sp-3); min-width: 0; }
.pf-hero-icon { width: 38px; height: 38px; border-radius: var(--r-md); background: var(--c-surface-2); color: var(--c-text-3); display: flex; align-items: center; justify-content: center; flex: none; }
.pf-hero-icon.is-active { background: var(--c-primary-50); color: var(--c-primary-400); }
[data-theme='dark'] .pf-hero-icon.is-active { background: var(--c-primary-100); color: var(--c-primary-600); }

.pf-hero-meta { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.pf-title-row { display: flex; align-items: center; gap: 6px; }
.pf-name { font-size: 15px; font-weight: 700; color: var(--c-text-1); }
.status-pill { font-size: 11px; font-weight: 600; padding: 1px 6px; border-radius: var(--r-sm); }
.pill-on { background: var(--c-primary-50); color: var(--c-primary-600); }
[data-theme='dark'] .pill-on { background: rgba(34, 181, 134, 0.2); color: var(--c-primary-400); }
.pill-off { background: var(--c-surface-2); color: var(--c-text-3); }

.list-head-actions { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--sp-2); gap: var(--sp-2); }
.btn-toggle-add { display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: var(--r-sm); background: var(--c-primary-400); color: #fff; border: none; font-size: 11px; font-weight: 600; cursor: pointer; flex: none; }
.btn-toggle-add:disabled { opacity: 0.5; cursor: not-allowed; }

.add-drawer { margin-bottom: var(--sp-3); }
.drawer-box { padding: var(--sp-3); border-radius: var(--r-sm); background: var(--c-surface-2); border: 1px solid var(--c-line); display: flex; flex-direction: column; gap: var(--sp-2); }
.drawer-input { height: 36px; }

.quick-devices { padding: var(--sp-2); border-radius: var(--r-sm); background: var(--c-surface); }
.chip-row { display: flex; flex-wrap: wrap; gap: 4px; }
.dev-chip { display: inline-flex; align-items: center; gap: 4px; padding: 2px 7px; border-radius: var(--r-sm); background: var(--c-surface-2); border: 1px solid var(--c-line); font-size: 11px; cursor: pointer; color: var(--c-text-2); }
.dev-chip:hover:not(:disabled) { border-color: var(--c-primary-400); color: var(--c-text-1); }
.chip-name { font-weight: 500; }
.chip-ip { opacity: 0.8; }

.port-row, .protocol-row { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-2); }
@media (max-width: 480px) { .port-row, .protocol-row { grid-template-columns: 1fr; } }
.drawer-actions { display: flex; justify-content: flex-end; gap: var(--sp-2); margin-top: 2px; }
.btn-cancel { padding: 5px 12px; border-radius: var(--r-sm); background: var(--c-surface); color: var(--c-text-2); border: 1px solid var(--c-line); font-size: 11px; cursor: pointer; }
.btn-confirm-add { padding: 5px 14px; border-radius: var(--r-sm); background: var(--c-primary-400); color: #fff; border: none; font-size: 11px; font-weight: 600; cursor: pointer; }

.rules-table { display: flex; flex-direction: column; gap: var(--sp-2); }
.rule-card { display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; border-radius: var(--r-sm); background: var(--c-surface); border: 1px solid var(--c-line); }
.rule-left { display: flex; align-items: center; gap: var(--sp-2); min-width: 0; }
.rule-proto-tag { padding: 2px 5px; border-radius: var(--r-sm); background: var(--c-surface-2); color: var(--c-text-1); font-size: 10px; font-weight: 700; flex: none; }
.rule-info { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.rule-ports { font-size: 12px; font-weight: 600; color: var(--c-text-1); }
.btn-del-rule { width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border-radius: var(--r-sm); background: transparent; color: var(--c-text-3); border: none; cursor: pointer; }
.btn-del-rule:hover { background: var(--c-danger-bg); color: var(--c-danger); }
.empty-p { text-align: center; padding: var(--sp-2) 0; }
</style>
