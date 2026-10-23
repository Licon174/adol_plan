<script setup lang="ts">import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getStatus, portForwardAdd, portMapAdd, portMapDel, post, type StatusKey } from '@/api'
import { toast } from '@/components/toast'
import { confirm } from '@/components/confirm'
import { withLoading } from '@/components/loading'
import { validateIp, validatePortRange } from '@/utils/validators'
import PageForm from '@/layouts/PageForm.vue'
import Card from '@/components/Card.vue'
import FormField from '@/components/FormField.vue'
import Toggle from '@/components/Toggle.vue'
import Icon from '@/components/Icon.vue'

const router = useRouter()

const raw = ref<Record<string, string>>({})
const loading = ref(true)
const error = ref('')
const busy = ref(false)

const degraded = ref(false)

const KEYS: StatusKey[] = [
  'PortMapEnable',
  ...Array.from({ length: 10 }, (_, i) => `PortMapRules_${i}` as StatusKey),
]

async function load(): Promise<void> {
  loading.value = true
  try {
    raw.value = (await getStatus(KEYS)) as Record<string, string>
    error.value = ''
  } catch (e) {
    error.value = e instanceof Error ? e.message : '读取失败'
  } finally {
    loading.value = false
  }
}
void load()

async function verify(expectEnable: string, expectRule: boolean): Promise<string | null> {
  await new Promise((r) => setTimeout(r, 600))
  const s = (await getStatus(KEYS)) as Record<string, string>
  raw.value = s
  if ((s.PortMapEnable ?? '0') !== expectEnable) {
    return `开关回读为 ${s.PortMapEnable ?? ''}（期望 ${expectEnable}）`
  }
  if (expectRule) {
    const any = Object.keys(s).some((k) => k.startsWith('PortMapRules_') && (s[k] ?? '').trim() !== '')
    if (!any) return '规则未落盘（本固件端口映射为半成品，恒报 success 但不写入）'
  }
  return null
}

interface Rule {
  index: number
  ip: string
  fromPort: string
  toPort: string
  protocol: string
  comment: string
}

const rules = computed<Rule[]>(() => {
  const out: Rule[] = []
  for (let i = 0; i < 10; i++) {
    const s = (raw.value[`PortMapRules_${i}`] ?? '').trim()
    if (!s) continue
    const f = s.split(',')
    out.push({
      index: i,
      ip: f[0] ?? '',
      fromPort: f[1] ?? '',
      toPort: f[2] ?? '',

      protocol: f[3] === '1' ? 'TCP' : f[3] === '2' ? 'UDP' : f[3] === '3' ? 'TCP&UDP' : 'ALL',
      comment: f[4] ?? '',
    })
  }
  return out
})

const enabled = computed(() => (raw.value.PortMapEnable ?? '0') === '1')

async function toggleSwitch(v: boolean): Promise<void> {
  busy.value = true
  try {
    await withLoading(async () => {
      const res = await post(portMapAdd({ portMapEnabled: v ? '1' : '0' }))
      if (res.result !== 'success') throw new Error(res.result || '设置失败')
      const diff = await verify(v ? '1' : '0', false)
      if (diff) throw new Error(diff)
      degraded.value = false
    }, '正在保存…')
    toast('已保存', 'success')
  } catch (e) {
    degraded.value = true
    toast(e instanceof Error ? e.message : '设置失败', 'error')
    await load()
  } finally {
    busy.value = false
  }
}

const showAdd = ref(false)
const form = ref({ ip: '', fromPort: '', toPort: '', protocol: 'TCP', comment: '' })

async function add(): Promise<void> {
  const f = form.value
  const ie = validateIp(f.ip)
  if (ie) {
    toast('内网地址：' + ie, 'error')
    return
  }
  const pe = validatePortRange(f.fromPort, f.toPort || f.fromPort)
  if (pe) {
    toast(pe, 'error')
    return
  }
  busy.value = true
  try {
    await withLoading(async () => {
      const res = await post(
        portMapAdd({
          portMapEnabled: '1',
          fromPort: f.fromPort,
          ipAddress: f.ip,
          toPort: f.toPort || f.fromPort,

          protocol: f.protocol === 'TCP' ? '1' : f.protocol === 'UDP' ? '2' : f.protocol === 'TCP&UDP' ? '3' : 'ALL',
          comment: f.comment,
        }),
      )
      if (res.result !== 'success') throw new Error(res.result || '添加失败')
      const diff = await verify('1', true)
      if (diff) throw new Error(diff)
      degraded.value = false
    }, '正在添加…')
    toast('已添加', 'success')
    showAdd.value = false
    form.value = { ip: '', fromPort: '', toPort: '', protocol: 'TCP', comment: '' }
  } catch (e) {
    degraded.value = true
    toast(e instanceof Error ? e.message : '添加失败', 'error')
    await load()
  } finally {
    busy.value = false
  }
}

async function remove(r: Rule): Promise<void> {
  const ok = await confirm({
    title: '删除规则',
    message: `删除到 ${r.ip}:${r.toPort} 的映射？`,
    danger: true,
  })
  if (!ok) return
  busy.value = true
  try {
    await withLoading(async () => {
      const res = await post(portMapDel(String(r.index)))
      if (res.result !== 'success') throw new Error(res.result || '删除失败')
      await new Promise((x) => setTimeout(x, 600))
      const s = (await getStatus(KEYS)) as Record<string, string>
      raw.value = s
      const still = (s[`PortMapRules_${r.index}`] ?? '').trim()
      if (still) throw new Error(`规则未删除（仍为 ${still}）`)
      degraded.value = false
    }, '正在删除…')
    toast('已删除', 'success')
  } catch (e) {
    degraded.value = true
    toast(e instanceof Error ? e.message : '删除失败', 'error')
    await load()
  } finally {
    busy.value = false
  }
}

async function syncToPortForward(r: Rule): Promise<void> {
  const ok = await confirm({
    title: '同步至端口转发',
    message: `将规则「${r.fromPort} → ${r.ip}:${r.toPort}」写入端口转发 (FW_FORWARD_ADD)，以确保真实生效？`,
  })
  if (!ok) return
  busy.value = true
  try {
    await withLoading(async () => {

      await post({ goformId: 'VIRTUAL_SERVER', PortForwardEnable: '1' })
      const res = await post(
        portForwardAdd({
          enable: '1',
          ipAddress: r.ip,
          portStart: r.fromPort,
          portEnd: r.toPort || r.fromPort,
          protocol: r.protocol === 'UDP' ? 'TCP&UDP' : r.protocol,
          comment: r.comment || 'from-map',
        }),
      )
      if (res.result !== 'success') throw new Error(res.result || '同步写入失败')
    }, '正在同步至内核端口转发…')
    toast('已同步至端口转发，内核规则已生效', 'success')
  } catch (e) {
    toast(e instanceof Error ? e.message : '同步失败', 'error')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <PageForm title="端口映射" :loading="loading" :error="error" :savable="false">

    <Card>
      <div class="map-hero">
        <div class="map-hero-left">
          <div class="map-hero-icon">
            <Icon name="link-2-off" :size="22" />
          </div>
          <div class="map-hero-meta">
            <div class="map-title-row">
              <span class="map-name">底层端口映射 (Port Map)</span>
              <span class="status-pill pill-warn">半成品特性</span>
            </div>
            <span class="t-cap">
              固件 ADD_PORT_MAP 恒报成功但不落 NV；本控制台已接入「同步至端口转发」，提交时可直接下发真实规则。
            </span>
          </div>
        </div>
        <button type="button" class="btn-goto-fwd" @click="router.push('/settings/portforward')">
          前往端口转发 ›
        </button>
      </div>
    </Card>

    <Card title="总开关">
      <div class="switch-row">
        <div>
          <p class="switch-title">启用端口映射</p>
          <p class="t-cap">共 {{ rules.length }} 条（上限 10）</p>
        </div>
        <Toggle :model-value="enabled" label="端口映射" :disabled="busy" @update:model-value="toggleSwitch" />
      </div>
    </Card>

    <Card title="规则管理">
      <button
        type="button"
        class="btn-toggle-add"
        :disabled="busy || rules.length >= 10"
        @click="showAdd = !showAdd"
      >
        <Icon :name="showAdd ? 'close' : 'plus'" :size="14" />
        <span>{{ rules.length >= 10 ? '已达上限' : showAdd ? '收起面板' : '新增规则' }}</span>
      </button>

      <div v-if="showAdd" class="add-drawer">
        <div class="drawer-box">
          <FormField label="内网目标地址">
            <input v-model="form.ip" class="num" type="text" inputmode="decimal" autocomplete="off" placeholder="例如：192.168.0.100" />
          </FormField>
          <div class="row-2">
            <FormField label="外部公网端口">
              <input v-model="form.fromPort" type="number" min="1" max="65535" inputmode="numeric" placeholder="1~65535" />
            </FormField>
            <FormField label="内部目标端口">
              <input
                v-model="form.toPort"
                type="number"
                min="1"
                max="65535"
                inputmode="numeric"
                :placeholder="form.fromPort"
              />
            </FormField>
          </div>
          <FormField label="传输协议">
            <select v-model="form.protocol">
              <option value="TCP">TCP</option>
              <option value="UDP">UDP</option>
              <option value="TCP&UDP">TCP &amp; UDP</option>
            </select>
          </FormField>
          <FormField label="规则备注">
            <input v-model="form.comment" type="text" maxlength="31" autocomplete="off" placeholder="备注说明" />
          </FormField>
          <div class="drawer-actions">
            <button type="button" class="btn-cancel" @click="showAdd = false">取消</button>
            <button type="button" class="btn-submit" :disabled="busy" @click="add">添加映射</button>
          </div>
        </div>
      </div>

      <div v-if="rules.length" class="rules-list">
        <div v-for="r in rules" :key="r.index" class="rule-item">
          <div class="rule-left">
            <span class="rule-proto num">{{ r.protocol }}</span>
            <div class="rule-meta">
              <span class="num rule-ports">:{{ r.fromPort }} → {{ r.ip }}:{{ r.toPort }}</span>
              <span v-if="r.comment" class="t-cap">{{ r.comment }}</span>
            </div>
          </div>
          <div class="rule-right">
            <button
              type="button"
              class="btn-sync-fwd"
              :disabled="busy"
              title="将此映射同步至内核端口转发以真正生效"
              @click="syncToPortForward(r)"
            >
              同步转发
            </button>
            <button type="button" class="btn-del" :disabled="busy" title="删除" @click="remove(r)">
              <Icon name="trash" :size="15" />
            </button>
          </div>
        </div>
      </div>
      <div v-else class="empty-box">
        <p class="empty-title">暂无端口映射规则</p>
      </div>
    </Card>
  </PageForm>
</template>

<style scoped>
.map-hero { display: flex; align-items: center; justify-content: space-between; }
.map-hero-left { display: flex; align-items: center; gap: var(--sp-3); min-width: 0; }
.map-hero-icon { width: 44px; height: 44px; border-radius: var(--r-md); background: #fef3c7; color: #d97706; display: flex; align-items: center; justify-content: center; flex: none; }
[data-theme='dark'] .map-hero-icon { background: rgba(245, 158, 11, 0.2); color: #fbbf24; }

.map-hero-meta { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.map-title-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.map-name { font-size: var(--fs-h2); font-weight: 700; color: var(--c-text-1); }
.status-pill { font-size: 11px; font-weight: 600; padding: 1px 7px; border-radius: var(--r-sm); }
.pill-warn { background: #fef3c7; color: #b45309; }
[data-theme='dark'] .pill-warn { background: rgba(245, 158, 11, 0.2); color: #fbbf24; }

.switch-row { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-3); }
.switch-title { font-size: var(--fs-body); font-weight: 600; }

.btn-toggle-add { display: inline-flex; align-items: center; gap: 4px; padding: 6px 12px; border-radius: var(--r-sm); background: var(--c-primary-400); color: #fff; border: none; font-size: 12px; font-weight: 600; cursor: pointer; margin-bottom: var(--sp-3); }
.btn-toggle-add:disabled { opacity: 0.5; cursor: not-allowed; }

.add-drawer { margin-bottom: var(--sp-4); }
.drawer-box { padding: var(--sp-3); border-radius: var(--r-sm); background: var(--c-surface-2); border: 1px solid var(--c-line); display: flex; flex-direction: column; gap: var(--sp-2); }
.row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-2); }
@media (max-width: 480px) { .row-2 { grid-template-columns: 1fr; } }
.drawer-actions { display: flex; justify-content: flex-end; gap: var(--sp-2); margin-top: 4px; }
.btn-cancel { padding: 6px 14px; border-radius: var(--r-sm); background: var(--c-surface); color: var(--c-text-2); border: 1px solid var(--c-line); font-size: 12px; cursor: pointer; }
.btn-submit { padding: 6px 18px; border-radius: var(--r-sm); background: var(--c-primary-400); color: #fff; border: none; font-size: 12px; font-weight: 600; cursor: pointer; }

.rules-list { display: flex; flex-direction: column; gap: var(--sp-2); }
.rule-item { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border-radius: var(--r-sm); background: var(--c-surface); border: 1px solid var(--c-line); }
.rule-left { display: flex; align-items: center; gap: var(--sp-3); min-width: 0; }
.rule-right { display: flex; align-items: center; gap: 8px; flex: none; }
.btn-sync-fwd { padding: 4px 8px; border-radius: var(--r-sm); background: var(--c-surface-2); border: 1px solid var(--c-line); color: var(--c-primary-500); font-size: 11px; font-weight: 600; cursor: pointer; transition: all 0.15s ease; }
.btn-sync-fwd:hover { border-color: var(--c-primary-400); background: var(--c-primary-50); }
.btn-goto-fwd { padding: 5px 10px; border-radius: var(--r-sm); background: var(--c-surface); border: 1px solid var(--c-line); color: var(--c-text-1); font-size: 11px; font-weight: 600; cursor: pointer; flex: none; }
.btn-goto-fwd:hover { border-color: var(--c-primary-400); color: var(--c-primary-500); }
.rule-proto { padding: 2px 6px; border-radius: var(--r-sm); background: var(--c-surface-2); color: var(--c-text-1); font-size: 11px; font-weight: 700; flex: none; }
.rule-meta { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.rule-ports { font-size: 12px; font-weight: 600; color: var(--c-text-1); }
.btn-del { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: var(--r-sm); background: transparent; color: var(--c-text-3); border: none; cursor: pointer; flex: none; }
.btn-del:hover { background: var(--c-danger-bg); color: var(--c-danger); }

.empty-box { text-align: center; padding: var(--sp-4) 0; }
.empty-title { font-size: 13px; font-weight: 600; color: var(--c-text-2); margin-bottom: 2px; }
</style>
