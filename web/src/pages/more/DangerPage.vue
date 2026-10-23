<script setup lang="ts">import { ref } from 'vue'
import { getStatus, rebootDevice, restoreFactorySettings } from '@/api'
import { toast } from '@/components/toast'
import { confirm } from '@/components/confirm'
import PageForm from '@/layouts/PageForm.vue'
import Card from '@/components/Card.vue'
import Icon from '@/components/Icon.vue'

const raw = ref<Record<string, string>>({})
const loading = ref(true)
const error = ref('')
const rebooting = ref(false)
const restoring = ref(false)

async function load(): Promise<void> {
  loading.value = true
  try {
    raw.value = (await getStatus(['cr_version', 'hw_version', 'imei'])) as Record<string, string>
    error.value = ''
  } catch (e) {
    error.value = e instanceof Error ? e.message : '读取失败'
  } finally {
    loading.value = false
  }
}
void load()

function post(body: Record<string, string>): Promise<Response | null> {

  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(body)) params.append(k, v)
  return fetch('/reqproc/proc_post', { method: 'POST', body: params }).catch(() => null)
}

async function doReboot(): Promise<void> {
  const ok = await confirm({
    title: '重启设备',
    message: '设备将重启，需重新登录后台。确认重启？',
    danger: true,
  })
  if (!ok) return
  rebooting.value = true
  try {

    await post(rebootDevice())
    toast('已下发重启指令，请等待设备恢复', 'success')
  } catch {

    toast('已下发重启指令，请等待设备恢复', 'success')
  } finally {
    rebooting.value = false
  }
}

async function doRestore(): Promise<void> {
  const ok = await confirm({
    title: '恢复出厂设置',
    message: '所有自定义配置（含 WiFi 名称与密码、APN、限速规则）都会被清除，且不可撤销。确认？',
    danger: true,
  })
  if (!ok) return
  const ok2 = await confirm({
    title: '再次确认',
    message: '这一步无法撤销。确定要恢复出厂设置吗？',
    danger: true,
  })
  if (!ok2) return

  restoring.value = true
  try {
    const res = await post(restoreFactorySettings())
    if (res && res.ok) {
      const text = await res.text().catch(() => '')
      if (text && !text.includes('success')) {
        toast('设备返回：' + text.slice(0, 60), 'error')
        return
      }
    }
    toast('已下发恢复出厂指令', 'success')
  } catch {
    toast('已下发恢复出厂指令（响应被掐断）', 'success')
  } finally {
    restoring.value = false
  }
}
</script>

<template>
  <PageForm title="危险操作" :loading="loading" :error="error" :savable="false">
    <template #right>
      <button type="button" class="icon-btn" aria-label="刷新" @click="load">
        <Icon name="refresh" :size="20" />
      </button>
    </template>

    <Card title="重启设备">
      <button
        type="button"
        class="btn btn-secondary btn-block mt"
        :disabled="rebooting"
        @click="doReboot"
      >
        {{ rebooting ? '正在下发…' : '重启设备' }}
      </button>
    </Card>

    <Card title="恢复出厂设置">
      <button
        type="button"
        class="btn btn-danger btn-block mt"
        :disabled="restoring"
        @click="doRestore"
      >
        {{ restoring ? '正在下发…' : '恢复出厂设置' }}
      </button>
    </Card>

    <Card title="设备信息">
      <dl class="rows">
        <div class="row">
          <dt class="t-cap">固件版本</dt>
          <dd class="num">{{ raw.cr_version || '—' }}</dd>
        </div>
        <div class="row">
          <dt class="t-cap">硬件版本</dt>
          <dd class="num">{{ raw.hw_version || '—' }}</dd>
        </div>
        <div class="row">
          <dt class="t-cap">IMEI</dt>
          <dd class="num">{{ raw.imei || '—' }}</dd>
        </div>
      </dl>
    </Card>

  </PageForm>
</template>

<style scoped>
.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: var(--r-sm);
  color: var(--c-text-2);
}

.warn {
  margin-bottom: var(--sp-3);
  padding: 8px var(--sp-3);
  border-radius: var(--r-sm);
  color: var(--c-warning);
  background: var(--c-warning-bg);
}

.mt {
  margin-top: var(--sp-3);
}

.rows {
  margin: 0;
}

.row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--sp-3);
  padding: 7px 0;
}

.row + .row {
  border-top: 1px solid var(--c-line);
}

.row dd {
  margin: 0;
  font-size: var(--fs-sub);
}

.foot {
  margin-top: var(--sp-4);
  text-align: center;
}
</style>
