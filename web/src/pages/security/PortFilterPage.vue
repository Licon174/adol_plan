<script setup lang="ts">import { computed, ref } from 'vue'
import {
  PORT_FILTER_KEYS,
  getStatus,
  portFilterAdd,
  portFilterBasic,
  portFilterDel,
  post,
} from '@/api'
import { toast } from '@/components/toast'
import { confirm } from '@/components/confirm'
import { withLoading } from '@/components/loading'
import { validateIp, validatePortRange } from '@/utils/validators'
import PageForm from '@/layouts/PageForm.vue'
import Card from '@/components/Card.vue'
import FormField from '@/components/FormField.vue'
import Toggle from '@/components/Toggle.vue'
import Icon from '@/components/Icon.vue'

const raw = ref<Record<string, string>>({})
const loading = ref(true)
const error = ref('')
const busy = ref(false)

async function load(): Promise<void> {
  loading.value = true
  try {
    raw.value = (await getStatus(PORT_FILTER_KEYS)) as Record<string, string>
    error.value = ''
    if (!policyDirty.value) policy.value = raw.value.DefaultFirewallPolicy || '0'
  } catch (e) {
    error.value = e instanceof Error ? e.message : '读取失败'
  } finally {
    loading.value = false
  }
}
void load()

const enabled = computed(() => (raw.value.IPPortFilterEnable ?? '0') === '1')
const policy = ref('0')
const policyDirty = ref(false)

async function savePolicy(): Promise<void> {
  busy.value = true
  try {
    await withLoading(async () => {
      const res = await post(
        portFilterBasic({
          portFilterEnabled: enabled.value ? '1' : '0',
          defaultFirewallPolicy: policy.value,
        }),
      )
      if (res.result !== 'success') throw new Error(res.result || '保存失败')
    }, '正在保存默认策略…')
    toast('已保存默认策略', 'success')
    policyDirty.value = false
    await load()
  } catch (e) {
    toast(e instanceof Error ? e.message : '保存失败', 'error')
  } finally {
    busy.value = false
  }
}

interface Rule {
  index: number
  v6: boolean
  text: string
}

const rules = computed<Rule[]>(() => {
  const out: Rule[] = []
  for (let i = 0; i < 10; i++) {
    const v4 = (raw.value[`IPPortFilterRules_${i}`] ?? '').trim()
    if (v4) out.push({ index: i, v6: false, text: v4 })
    const v6 = (raw.value[`IPPortFilterRulesv6_${i}`] ?? '').trim()
    if (v6) out.push({ index: i, v6: true, text: v6 })
  }
  return out
})

async function saveBasic(nextEnabled: boolean): Promise<void> {
  busy.value = true
  try {
    await withLoading(async () => {
      const res = await post(
        portFilterBasic({
          portFilterEnabled: nextEnabled ? '1' : '0',
          defaultFirewallPolicy: policy.value,
        }),
      )
      if (res.result !== 'success') throw new Error(res.result || '保存失败')
    }, '正在保存开关…')
    toast(nextEnabled ? '端口过滤已启用' : '端口过滤已关闭', 'success')
    policyDirty.value = false
    await load()
  } catch (e) {
    toast(e instanceof Error ? e.message : '保存失败', 'error')
  } finally {
    busy.value = false
  }
}

const showAdd = ref(false)
const form = ref({
  ipVersion: '4',
  destIp: '',
  sourceIp: '',
  destPortStart: '',
  destPortEnd: '',
  action: '0',
  protocol: 'TCP',
  comment: '',
})

async function add(): Promise<void> {
  const f = form.value
  const pe = validatePortRange(f.destPortStart, f.destPortEnd || f.destPortStart)
  if (pe) {
    toast(pe, 'error')
    return
  }
  if (f.destIp) {
    const ie = validateIp(f.destIp)
    if (ie && f.ipVersion === '4') {
      toast('目标地址：' + ie, 'error')
      return
    }
  }
  busy.value = true
  try {
    await withLoading(async () => {
      const res = await post(
        portFilterAdd({
          ipVersion: f.ipVersion,
          destIp: f.destIp,
          sourceIp: f.sourceIp,
          destPortStart: f.destPortStart,
          destPortEnd: f.destPortEnd || f.destPortStart,
          action: f.action,
          protocol: f.protocol,
          comment: f.comment,
        }),
      )
      if (res.result !== 'success') throw new Error(res.result || '添加失败')
    }, '正在添加规则…')
    toast('已添加规则', 'success')
    showAdd.value = false
    form.value = {
      ipVersion: '4',
      destIp: '',
      sourceIp: '',
      destPortStart: '',
      destPortEnd: '',
      action: '0',
      protocol: 'TCP',
      comment: '',
    }
    await load()
  } catch (e) {
    toast(e instanceof Error ? e.message : '添加失败', 'error')
  } finally {
    busy.value = false
  }
}

async function remove(r: Rule): Promise<void> {
  const ok = await confirm({
    title: '删除规则',
    message: `删除该条 ${r.v6 ? 'IPv6' : 'IPv4'} 过滤规则？`,
    danger: true,
  })
  if (!ok) return
  busy.value = true
  try {
    await withLoading(async () => {
      const res = await post(portFilterDel(r.v6 ? [] : [String(r.index)], r.v6 ? [String(r.index)] : []))
      if (res.result !== 'success') throw new Error(res.result || '删除失败')
      await new Promise((x) => setTimeout(x, 600))
      const s = (await getStatus(PORT_FILTER_KEYS)) as Record<string, string>
      const key = r.v6 ? `IPPortFilterRulesv6_${r.index}` : `IPPortFilterRules_${r.index}`
      if ((s[key] ?? '').trim()) {
        raw.value = s
        throw new Error('规则未删除（设备固件端口过滤删除为空桩，未从 NV 移除）')
      }
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
  <PageForm title="端口过滤" :loading="loading" :error="error" :savable="false">

    <Card>
      <div class="pf-hero">
        <div class="pf-hero-left">
          <div class="pf-hero-icon" :class="{ 'is-active': enabled }">
            <Icon name="filter" :size="22" />
          </div>
          <div class="pf-hero-meta">
            <div class="pf-title-row">
              <span class="pf-name">IP / 端口数据包过滤</span>
              <span class="status-pill" :class="enabled ? 'pill-on' : 'pill-off'">
                {{ enabled ? (policy === '1' ? '黑名单默认拦截' : '白名单放行') : '未启用' }}
              </span>
            </div>
            <span class="t-cap">
              {{ enabled ? `当前已加载 ${rules.length} 条过滤规则` : '关闭时放行所有内外部 IP 数据包流量' }}
            </span>
          </div>
        </div>
        <Toggle :model-value="enabled" label="端口过滤总开关" :disabled="busy" @update:model-value="saveBasic" />
      </div>
    </Card>

    <Card title="默认兜底策略">
      <FormField label="未匹配规则的流量处理方式">
        <select v-model="policy" @change="policyDirty = true">
          <option value="0">放行未匹配的流量（黑名单模式）</option>
          <option value="1">丢弃未匹配的流量（白名单模式）</option>
        </select>
      </FormField>
      <div v-if="policyDirty" class="policy-save-bar">
        <span class="t-cap">策略变更尚未保存</span>
        <button type="button" class="btn-save-policy" :disabled="busy" @click="savePolicy">
          保存默认策略
        </button>
      </div>
    </Card>

    <Card :title="`过滤规则管理 (${rules.length})`">
      <div class="firmware-notice">
        <Icon name="info" :size="15" class="notice-ic" />
        <span class="t-cap notice-text">
          说明：本型号设备底层端口过滤规则写入为有限实现。总开关与默认策略全局生效；规则列表供查看当前状态。
        </span>
      </div>

      <div class="rules-toolbar">
        <button
          type="button"
          class="btn-toggle-add"
          :disabled="busy"
          @click="showAdd = !showAdd"
        >
          <Icon :name="showAdd ? 'close' : 'plus'" :size="14" />
          <span>{{ showAdd ? '收起面板' : '新增规则' }}</span>
        </button>
      </div>

      <div v-if="showAdd" class="add-drawer">
        <div class="drawer-box">
          <FormField label="网络协议版本">
            <select v-model="form.ipVersion">
              <option value="4">IPv4</option>
              <option value="6">IPv6</option>
            </select>
          </FormField>
          <div class="row-2">
            <FormField label="目标 IP 地址">
              <input v-model="form.destIp" class="num" type="text" inputmode="decimal" autocomplete="off" placeholder="例如：192.168.0.50" />
            </FormField>
            <FormField label="源 IP 地址">
              <input v-model="form.sourceIp" class="num" type="text" inputmode="decimal" autocomplete="off" placeholder="可留空匹配全部" />
            </FormField>
          </div>
          <div class="row-2">
            <FormField label="目标起始端口">
              <input v-model="form.destPortStart" type="number" min="1" max="65535" inputmode="numeric" placeholder="1~65535" />
            </FormField>
            <FormField label="目标结束端口">
              <input
                v-model="form.destPortEnd"
                type="number"
                min="1"
                max="65535"
                inputmode="numeric"
                :placeholder="form.destPortStart || '单端口留空'"
              />
            </FormField>
          </div>
          <div class="row-2">
            <FormField label="过滤动作">
              <select v-model="form.action">
                <option value="0">丢弃拦截 (Drop)</option>
                <option value="1">允许放行 (Accept)</option>
              </select>
            </FormField>
            <FormField label="传输协议">
              <select v-model="form.protocol">
                <option value="TCP">TCP</option>
                <option value="UDP">UDP</option>
                <option value="TCP&UDP">TCP &amp; UDP</option>
              </select>
            </FormField>
          </div>
          <FormField label="备注说明">
            <input v-model="form.comment" type="text" maxlength="31" autocomplete="off" placeholder="规则标识备注" />
          </FormField>
          <div class="drawer-actions">
            <button type="button" class="btn-cancel" @click="showAdd = false">取消</button>
            <button type="button" class="btn-submit" :disabled="busy" @click="add">添加规则</button>
          </div>
        </div>
      </div>

      <div v-if="rules.length" class="rules-list">
        <div v-for="r in rules" :key="`${r.v6}-${r.index}`" class="rule-item">
          <div class="rule-left">
            <span class="ip-ver-tag">{{ r.v6 ? 'IPv6' : 'IPv4' }}</span>
            <span class="num rule-text">{{ r.text }}</span>
          </div>
          <button type="button" class="btn-del" :disabled="busy" title="删除规则" @click="remove(r)">
            <Icon name="trash" :size="15" />
          </button>
        </div>
      </div>
      <div v-else class="empty-box">
        <p class="empty-title">当前暂无端口过滤规则</p>
        <p class="t-cap">所有流量按默认兜底策略处理</p>
      </div>
    </Card>
  </PageForm>
</template>

<style scoped>
.pf-hero { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-3); }
.pf-hero-left { display: flex; align-items: center; gap: var(--sp-3); min-width: 0; }
.pf-hero-icon { width: 44px; height: 44px; border-radius: var(--r-md); background: var(--c-surface-2); color: var(--c-text-3); display: flex; align-items: center; justify-content: center; flex: none; transition: all 0.2s ease; }
.pf-hero-icon.is-active { background: var(--c-primary-50); color: var(--c-primary-400); }
[data-theme='dark'] .pf-hero-icon.is-active { background: var(--c-primary-100); color: var(--c-primary-600); }

.pf-hero-meta { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.pf-title-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.pf-name { font-size: var(--fs-h2); font-weight: 700; color: var(--c-text-1); }
.status-pill { font-size: 11px; font-weight: 600; padding: 1px 7px; border-radius: var(--r-sm); }
.pill-on { background: var(--c-primary-50); color: var(--c-primary-600); }
[data-theme='dark'] .pill-on { background: rgba(34, 181, 134, 0.2); color: var(--c-primary-400); }
.pill-off { background: var(--c-surface-2); color: var(--c-text-3); }

.policy-save-bar { display: flex; align-items: center; justify-content: space-between; margin-top: var(--sp-3); padding-top: var(--sp-3); border-top: 1px solid var(--c-line); }
.btn-save-policy { padding: 6px 14px; border-radius: var(--r-sm); background: var(--c-primary-400); color: #fff; border: none; font-size: 12px; font-weight: 600; cursor: pointer; }

.firmware-notice { display: flex; align-items: flex-start; gap: 8px; margin-bottom: var(--sp-3); padding: 8px 12px; border-radius: var(--r-sm); background: var(--c-surface-2); color: var(--c-text-2); }
.notice-ic { flex: none; margin-top: 2px; color: var(--c-primary-400); }
.notice-text { color: inherit !important; line-height: 1.4; }

.rules-toolbar { display: flex; justify-content: flex-end; margin-bottom: var(--sp-3); }
.btn-toggle-add { display: inline-flex; align-items: center; gap: 4px; padding: 6px 12px; border-radius: var(--r-sm); background: var(--c-primary-400); color: #fff; border: none; font-size: 12px; font-weight: 600; cursor: pointer; }

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
.ip-ver-tag { padding: 2px 6px; border-radius: var(--r-sm); background: var(--c-surface-2); color: var(--c-text-2); font-size: 10px; font-weight: 700; flex: none; }
.rule-text { font-size: 12px; color: var(--c-text-1); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.btn-del { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: var(--r-sm); background: transparent; color: var(--c-text-3); border: none; cursor: pointer; flex: none; }
.btn-del:hover { background: var(--c-danger-bg); color: var(--c-danger); }

.empty-box { text-align: center; padding: var(--sp-4) 0; }
.empty-title { font-size: 13px; font-weight: 600; color: var(--c-text-2); margin-bottom: 2px; }
</style>
