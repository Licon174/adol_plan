<script setup lang="ts">import { computed, ref } from 'vue'
import { APN_KEYS, apnSaveProfile, apnSetDefault, atCmd1, getStatus, post } from '@/api'
import { parseApnProfiles, type ApnProfile } from '@/utils/parse'
import { toast } from '@/components/toast'
import { confirm } from '@/components/confirm'
import { withLoading } from '@/components/loading'
import { validateApn, validateProfileName } from '@/utils/validators'
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
    raw.value = (await getStatus(APN_KEYS)) as Record<string, string>
  } catch (e) {
    error.value = e instanceof Error ? e.message : '读取失败'
  } finally {
    loading.value = false
  }
}
void load()

const profiles = computed(() => {
  const out = parseApnProfiles(raw.value, 20)

  for (const p of out) {
    if (p.pdpType.toUpperCase() !== 'IPV6') continue
    const f = (raw.value[`ipv6_APN_configtmp${p.index}`] ?? '').split('($)')
    if (!f[0] && !f[1]) continue
    p.name = f[0] || p.name
    p.apn = f[1] || p.apn
    p.authMode = (f[4] ?? '').toLowerCase() || p.authMode
    p.username = f[5] || p.username
    p.password = f[6] || p.password
  }
  return out
})
const currentIndex = computed(() => {
  const idx = raw.value.apn_index ?? raw.value.index ?? '0'
  return Number.parseInt(idx, 10) || 0
})
const apnMode = computed(() => raw.value.apn_mode || 'auto')

const editing = ref<ApnProfile | null>(null)
const editForm = ref({ name: '', apn: '', username: '', password: '', authMode: '', pdpType: 'IP' })

const editErrors = computed(() => {
  if (!editing.value) return {} as Record<string, string>
  const errs: Record<string, string> = {}
  const n = validateProfileName(editForm.value.name)
  if (n) errs.name = n
  const a = validateApn(editForm.value.apn)
  if (a) errs.apn = a
  return errs
})

function startEdit(p: ApnProfile): void {
  editing.value = p
  editForm.value = {
    name: p.name,
    apn: p.apn,
    username: p.username,
    password: p.password,
    authMode: p.authMode || 'none',
    pdpType: p.pdpType || 'IP',
  }
}

function startAdd(): void {
  const used = new Set(profiles.value.map((p) => p.index))
  let nextIdx = 1
  while (used.has(nextIdx) && nextIdx < 16) nextIdx++
  const newProfile: ApnProfile = {
    index: nextIdx,
    name: `APN_${nextIdx}`,
    apn: '',
    username: '',
    password: '',
    authMode: 'none',
    pdpType: 'IPV4V6',
  }
  editing.value = newProfile
  editForm.value = {
    name: `APN_${nextIdx}`,
    apn: '',
    username: '',
    password: '',
    authMode: 'none',
    pdpType: 'IPV4V6',
  }
}

async function applyToModem(what: string): Promise<void> {
  const ok = await confirm({
    title: '重启模组',
    message: `${what}已保存，但要让网络侧真正生效还得重启模组（断网约 30 秒）。现在重启？`,
    confirmText: '重启模组',
    danger: true,
  })
  if (!ok) {
    toast('已保存，重启模组后才会生效', 'info')
    return
  }
  try {
    await withLoading(async () => {
      await post(atCmd1('CFUN=0'))
      await new Promise((r) => setTimeout(r, 3000))
      await post(atCmd1('CFUN=1'))
    }, '正在重启模组…')
    toast('已重启模组，约 30 秒后恢复联网', 'success')
  } catch (e) {
    toast(e instanceof Error ? e.message : '重启模组失败', 'error')
  }
}

async function setDefault(p: ApnProfile): Promise<void> {
  busy.value = true
  try {
    await withLoading(async () => {
      const res = await post(
        apnSetDefault({ apnMode: 'manual', pdpType: p.pdpType || 'IP', index: String(p.index) }),
      )
      if (res.result !== 'success') throw new Error(res.result || '设置失败')
    }, '正在应用…')
    toast('已设为默认 APN', 'success')
    await load()
  } catch (e) {
    toast(e instanceof Error ? e.message : '设置失败', 'error')
  } finally {
    busy.value = false
  }
  await applyToModem('默认 APN')
}

async function saveEdit(): Promise<void> {
  if (Object.keys(editErrors.value).length) {
    toast('请先修正表单里的问题', 'error')
    return
  }
  const p = editing.value
  if (!p) return
  busy.value = true
  try {
    await withLoading(async () => {

      const isV6 = editForm.value.pdpType === 'IPV6'
      const res = await post(
        apnSaveProfile(
          isV6
            ? {
                profileName: editForm.value.name,
                pdpType: editForm.value.pdpType,
                index: String(p.index),
                ipv6WanApn: editForm.value.apn,
                ipv6PppAuthMode: editForm.value.authMode,
                ipv6PppUsername: editForm.value.username,
                ipv6PppPassword: editForm.value.password,
              }
            : {
                profileName: editForm.value.name,
                pdpType: editForm.value.pdpType,
                index: String(p.index),
                wanApn: editForm.value.apn,
                pppAuthMode: editForm.value.authMode,
                pppUsername: editForm.value.username,
                pppPassword: editForm.value.password,
              },
        ),
      )
      if (res.result !== 'success') throw new Error(res.result || '保存失败')
    }, '正在保存…')
    toast('APN 已保存', 'success')
    editing.value = null
    await load()
  } catch (e) {
    toast(e instanceof Error ? e.message : '保存失败', 'error')
  } finally {
    busy.value = false
  }
  await applyToModem('APN')
}

const AUTH_MODES = [
  { label: '无认证', value: 'none' },
  { label: 'PAP', value: 'pap' },
  { label: 'CHAP', value: 'chap' },
  { label: 'PAP/CHAP', value: 'papchap' },
]

const PDP_TYPES = ['IP', 'IPV6', 'IPV4V6']
</script>

<template>
  <PageForm
    title="APN 设置"
    :loading="loading"
    :error="error"
    :savable="false"
  >
    <template #right>
      <button type="button" class="refresh" aria-label="刷新" @click="load">
        <Icon name="refresh" :size="20" />
      </button>
    </template>

    <Card>
      <div class="apn-hero">
        <div class="apn-hero-icon">
          <Icon name="globe" :size="22" />
        </div>
        <div class="apn-hero-main">
          <div class="apn-hero-top">
            <span class="apn-hero-title">
              {{ profiles[currentIndex]?.name || raw.profile_name || raw.wan_apn || '默认接入点' }}
            </span>
            <span class="pdp-pill num">{{ raw.pdp_type || 'IP' }}</span>
          </div>
          <div class="apn-hero-sub">
            <span class="t-cap num">APN: {{ raw.wan_apn || '自动' }}</span>
            <span class="dot-sep">·</span>
            <span class="t-cap num">槽位 #{{ currentIndex }} ({{ apnMode }})</span>
          </div>
        </div>
      </div>
    </Card>

    <Card v-if="editing" :title="`编辑 #${editing.index}`">
      <FormField label="配置名称" required :error="editErrors.name">
        <input v-model="editForm.name" type="text" autocomplete="off" />
      </FormField>
      <FormField label="APN" required :error="editErrors.apn">
        <input v-model="editForm.apn" class="num" type="text" autocomplete="off" spellcheck="false" />
      </FormField>

      <div class="pdp-seg-wrap">
        <p class="seg-label">协议 (PDP Type)</p>
        <div class="pdp-seg">
          <button
            v-for="t in PDP_TYPES"
            :key="t"
            type="button"
            class="pdp-btn num"
            :class="{ 'is-on': editForm.pdpType === t }"
            @click="editForm.pdpType = t"
          >
            {{ t }}
          </button>
        </div>
      </div>

      <FormField label="认证方式">
        <select v-model="editForm.authMode">
          <option v-for="a in AUTH_MODES" :key="a.value" :value="a.value">{{ a.label }}</option>
        </select>
      </FormField>

      <div class="row-2">
        <FormField label="用户名">
          <input v-model="editForm.username" type="text" autocomplete="off" placeholder="选填" />
        </FormField>
        <FormField label="密码">
          <input v-model="editForm.password" type="password" autocomplete="off" placeholder="选填" />
        </FormField>
      </div>

      <div class="edit-actions">
        <button type="button" class="btn btn-ghost" :disabled="busy" @click="editing = null">
          取消
        </button>
        <button type="button" class="btn btn-primary" :disabled="busy" @click="saveEdit">
          保存
        </button>
      </div>
    </Card>

    <Card v-else title="APN 列表">
      <div class="apn-toolbar">
        <span class="t-cap num">{{ profiles.length }} 组配置</span>
        <button
          type="button"
          class="btn btn-secondary btn-compact"
          :disabled="busy"
          @click="startAdd"
        >
          + 新增
        </button>
      </div>

      <div v-if="profiles.length" class="apn-grid">
        <div
          v-for="p in profiles"
          :key="p.index"
          class="apn-card"
          :class="{ 'is-current': p.index === currentIndex }"
        >
          <div class="apn-main">
            <div class="apn-title-row">
              <span class="apn-idx num">#{{ p.index }}</span>
              <span class="apn-name">{{ p.name || '未命名' }}</span>
              <span class="pdp-tag num">{{ p.pdpType || 'IP' }}</span>
              <span v-if="p.index === currentIndex" class="badge-cur">生效中</span>
            </div>
            <p class="apn-code num">APN: {{ p.apn || '—' }}</p>
          </div>
          <div class="apn-actions">
            <button type="button" class="mini" :disabled="busy" @click="startEdit(p)">编辑</button>
            <button
              v-if="p.index !== currentIndex"
              type="button"
              class="mini primary"
              :disabled="busy"
              @click="setDefault(p)"
            >
              启用
            </button>
          </div>
        </div>
      </div>
      <p v-else class="empty">无配置</p>
    </Card>

  </PageForm>
</template>

<style scoped>
.refresh {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--r-md);
  color: var(--c-text-2);
}

.apn-hero {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
}

.apn-hero-icon {
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

[data-theme='dark'] .apn-hero-icon {
  background: var(--c-primary-100);
  color: var(--c-primary-600);
}

.apn-hero-main {
  flex: 1;
  min-width: 0;
}

.apn-hero-top {
  display: flex;
  align-items: center;
  gap: 8px;
}

.apn-hero-title {
  font-size: var(--fs-h2);
  font-weight: 700;
  color: var(--c-text-1);
}

.pdp-pill {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: var(--r-full);
  background: var(--c-primary-50);
  color: var(--c-primary-600);
}

[data-theme='dark'] .pdp-pill {
  background: rgba(34, 181, 134, 0.2);
  color: var(--c-primary-400);
}

.apn-hero-sub {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
}

.dot-sep {
  color: var(--c-text-3);
}

.pdp-seg-wrap {
  margin-top: var(--sp-4);
  margin-bottom: var(--sp-4);
}

.seg-label {
  font-size: var(--fs-sub);
  color: var(--c-text-2);
  margin-bottom: var(--sp-2);
}

.pdp-seg {
  display: flex;
  gap: 4px;
  padding: 4px;
  background: var(--c-surface-2);
  border-radius: var(--r-md);
}

.pdp-btn {
  flex: 1;
  min-height: 36px;
  border-radius: var(--r-sm);
  font-size: var(--fs-sub);
  color: var(--c-text-2);
  transition: all 0.15s ease;
}

.pdp-btn.is-on {
  background: var(--c-surface);
  color: var(--c-primary-600);
  font-weight: 600;
  box-shadow: var(--shadow-sm);
}

[data-theme='dark'] .pdp-btn.is-on {
  color: var(--c-primary-400);
}

.row-2 {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--sp-3);
  margin-top: var(--sp-4);
}

.row-2 :deep(.field + .field) {
  margin-top: 0;
}

.apn-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--sp-3);
  padding-bottom: var(--sp-2);
  border-bottom: 1px dashed var(--c-line);
}

.apn-grid {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}

.apn-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
  padding: var(--sp-3);
  border-radius: var(--r-md);
  background: var(--c-surface-2);
  border: 1px solid var(--c-line);
  transition: all 0.15s ease;
}

.apn-card.is-current {
  border-color: var(--c-primary-400);
  background: var(--c-primary-50);
}

[data-theme='dark'] .apn-card.is-current {
  background: rgba(34, 181, 134, 0.12);
}

.apn-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.apn-title-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.apn-idx {
  font-size: 11px;
  font-weight: 700;
  color: var(--c-text-3);
}

.apn-name {
  font-size: var(--fs-body);
  font-weight: 600;
  color: var(--c-text-1);
}

.pdp-tag {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: var(--r-sm);
  background: var(--c-surface);
  color: var(--c-text-2);
  border: 1px solid var(--c-line);
}

.badge-cur {
  font-size: 11px;
  font-weight: 600;
  color: var(--c-primary-600);
}

[data-theme='dark'] .badge-cur {
  color: var(--c-primary-400);
}

.apn-code {
  font-size: var(--fs-cap);
  color: var(--c-text-2);
}

.apn-actions {
  display: flex;
  gap: 6px;
  flex: none;
}

.mini {
  padding: 6px 12px;
  border-radius: var(--r-sm);
  font-size: var(--fs-cap);
  font-weight: 500;
  color: var(--c-text-2);
  background: var(--c-surface);
  border: 1px solid var(--c-line);
}

.mini.primary {
  color: #ffffff;
  background: var(--c-primary-400);
  border-color: transparent;
}

.edit-actions {
  display: flex;
  gap: var(--sp-3);
  margin-top: var(--sp-5);
}

.edit-actions .btn {
  flex: 1;
}
</style>
