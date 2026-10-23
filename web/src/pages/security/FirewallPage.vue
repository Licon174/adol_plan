<script setup lang="ts">import { computed, ref } from 'vue'
import { fwSys, getStatus, post, type StatusKey } from '@/api'
import { toast } from '@/components/toast'
import { confirm } from '@/components/confirm'
import { withLoading } from '@/components/loading'
import PageForm from '@/layouts/PageForm.vue'
import Card from '@/components/Card.vue'
import Toggle from '@/components/Toggle.vue'
import Icon from '@/components/Icon.vue'

const raw = ref<Record<string, string>>({})
const loading = ref(true)
const error = ref('')
const busy = ref(false)

async function load(): Promise<void> {
  loading.value = true
  try {
    raw.value = (await getStatus(['RemoteManagement', 'WANPingFilter'] as StatusKey[])) as Record<
      string,
      string
    >
    error.value = ''
  } catch (e) {
    error.value = e instanceof Error ? e.message : '读取失败'
  } finally {
    loading.value = false
  }
}
void load()

const remote = computed({
  get: () => (raw.value.RemoteManagement ?? '0') === '1',
  set: async (v: boolean) => {
    if (v) {
      const ok = await confirm({
        title: '高危操作警告',
        message: '允许 WAN 侧管理将使路由器后台登录端口暴露至蜂窝外网，可能遭受公网暴力破解。确认开启？',
        danger: true,
      })
      if (!ok) return
    }
    await save({ RemoteManagement: v ? '1' : '0' })
  },
})

const ping = computed({
  get: () => (raw.value.WANPingFilter ?? '0') === '1',
  set: (v: boolean) => save({ WANPingFilter: v ? '1' : '0' }),
})

async function save(patch: { RemoteManagement?: string; WANPingFilter?: string }): Promise<void> {
  const next = {
    RemoteManagement: patch.RemoteManagement ?? raw.value.RemoteManagement ?? '0',
    WANPingFilter: patch.WANPingFilter ?? raw.value.WANPingFilter ?? '0',
  }
  const backup = { ...raw.value }
  raw.value = { ...raw.value, ...next }
  busy.value = true
  try {
    await withLoading(async () => {
      const res = await post(fwSys(next))
      if (res.result !== 'success') throw new Error(res.result || '设置失败')
    }, '正在应用防火墙规则…')
    toast('防火墙规则已生效', 'success')
  } catch (e) {
    raw.value = backup
    toast(e instanceof Error ? e.message : '设置失败', 'error')
  } finally {
    busy.value = false
  }
}

const securityLevel = computed(() => {
  if (remote.value) return { text: '开放暴露', color: 'badge-danger', tip: '后台已向外网开放，请务必设置高强度管理员密码' }
  if (ping.value) return { text: '隐蔽防御 (最高)', color: 'badge-secure', tip: '完全阻断外网 Ping 探测与远程未授权访问' }
  return { text: '标准防护', color: 'badge-normal', tip: '外网可 Ping 通，阻断未授权后台访问' }
})
</script>

<template>
  <PageForm title="系统防火墙" :loading="loading" :error="error" :savable="false">
    <Card>
      <div class="fw-hero">
        <div class="fw-hero-left">
          <div class="fw-hero-icon" :class="{ 'is-alert': remote }">
            <Icon :name="remote ? 'shield-alert' : 'shield'" :size="20" />
          </div>
          <div class="fw-hero-meta">
            <div class="fw-title-row">
              <span class="fw-title-text">边界防护</span>
              <span class="status-pill" :class="securityLevel.color">{{ securityLevel.text }}</span>
            </div>
            <span class="t-cap">{{ securityLevel.tip }}</span>
          </div>
        </div>
      </div>
    </Card>

    <Card title="策略控制">
      <div class="switch-row">
        <div>
          <p class="switch-title">忽略 WAN 侧 Ping</p>
          <p class="t-cap">阻断公网 ICMP 探测扫描</p>
        </div>
        <Toggle v-model="ping" label="忽略 Ping" :disabled="busy" />
      </div>

      <div class="switch-row sep">
        <div>
          <p class="switch-title">允许 WAN 侧管理</p>
          <p class="t-cap warning-text">开放公网访问后台，需高强密码</p>
        </div>
        <Toggle v-model="remote" label="远程管理" :disabled="busy" />
      </div>
    </Card>
  </PageForm>
</template>

<style scoped>
.fw-hero { display: flex; align-items: center; justify-content: space-between; }
.fw-hero-left { display: flex; align-items: center; gap: var(--sp-3); min-width: 0; }
.fw-hero-icon { width: 38px; height: 38px; border-radius: var(--r-md); background: var(--c-primary-50); color: var(--c-primary-400); display: flex; align-items: center; justify-content: center; flex: none; }
[data-theme='dark'] .fw-hero-icon { background: var(--c-primary-100); color: var(--c-primary-600); }
.fw-hero-icon.is-alert { background: var(--c-danger-bg); color: var(--c-danger); }

.fw-hero-meta { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.fw-title-row { display: flex; align-items: center; gap: 6px; }
.fw-title-text { font-size: 15px; font-weight: 700; color: var(--c-text-1); }
.status-pill { font-size: 11px; font-weight: 600; padding: 1px 6px; border-radius: var(--r-sm); }
.badge-secure { background: var(--c-primary-50); color: var(--c-primary-600); }
[data-theme='dark'] .badge-secure { background: rgba(34, 181, 134, 0.2); color: var(--c-primary-400); }
.badge-normal { background: #e0f2fe; color: #0284c7; }
[data-theme='dark'] .badge-normal { background: rgba(2, 132, 199, 0.2); color: #38bdf8; }
.badge-danger { background: var(--c-danger-bg); color: var(--c-danger); }

.switch-row { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-3); }
.switch-row.sep { margin-top: var(--sp-3); padding-top: var(--sp-3); border-top: 1px solid var(--c-line); }
.switch-title { font-size: var(--fs-body); font-weight: 600; }
.warning-text { color: #d97706 !important; }
[data-theme='dark'] .warning-text { color: #fbbf24 !important; }
</style>
