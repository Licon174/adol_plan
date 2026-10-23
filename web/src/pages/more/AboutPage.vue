<script setup lang="ts">import { computed, onMounted, ref } from 'vue'
import { execSystem, getStatus } from '@/api'
import { formatDuration } from '@/utils/format'
import PageForm from '@/layouts/PageForm.vue'
import Card from '@/components/Card.vue'
import Icon from '@/components/Icon.vue'

const raw = ref<Record<string, string>>({})
const loading = ref(true)
const error = ref('')
const uptimeSec = ref(0)

onMounted(() => {
  void load()
})

async function readText(url: string): Promise<string> {
  try {
    const r = await fetch(`${url}?r=${Date.now()}`, { cache: 'no-store' })
    return r.ok ? (await r.text()).trim() : ''
  } catch {
    return ''
  }
}

async function load(): Promise<void> {
  loading.value = true
  try {
    raw.value = (await getStatus([
      'cr_version',
      'hw_version',
      'imei',
      'sim_imsi',
      'ziccid',
      'network_type',
      'mac_address',
      'realtime_time',
      'monthly_time',
    ])) as Record<string, string>
    error.value = ''
  } catch (e) {
    error.value = e instanceof Error ? e.message : '读取失败'
  } finally {
    loading.value = false
  }

  await execSystem(
    `cut -d' ' -f1 /proc/uptime | cut -d. -f1 > /mnt/userdata/uptime_out.txt 2>/dev/null ; chmod 644 /mnt/userdata/uptime_out.txt`,
  )
  const t = await readText('./uptime_out.txt')
  const n = Number.parseInt(t, 10)
  uptimeSec.value = Number.isFinite(n) && n > 0 ? n : 0

  await execSystem('rm -f /mnt/userdata/uptime_out.txt')
}

const v = (k: string) => raw.value[k] || '—'

const onlineText = computed(() => {
  const t = Number(raw.value.realtime_time ?? 0) || 0
  return t > 0 ? formatDuration(t) : '—'
})

const uptimeText = computed(() => (uptimeSec.value > 0 ? formatDuration(uptimeSec.value) : '—'))
const rows = computed(() => [
  { k: '固件版本', v: v('cr_version') },
  { k: '硬件版本', v: v('hw_version') },
  { k: 'IMEI', v: v('imei') },
  { k: 'IMSI', v: v('sim_imsi') },
  { k: 'ICCID', v: v('ziccid') },
  { k: '网络制式', v: v('network_type') },
  { k: 'MAC 地址', v: v('mac_address') },
  { k: '已运行', v: uptimeText.value },
  { k: '本次在线', v: onlineText.value },
])
</script>

<template>
  <PageForm title="关于与版本" :loading="loading" :error="error" :savable="false">
    <template #right>
      <button type="button" class="icon-btn" aria-label="刷新" @click="load">
        <Icon name="refresh" :size="20" />
      </button>
    </template>

    <Card title="设备信息">
      <dl class="rows">
        <div v-for="r in rows" :key="r.k" class="row">
          <dt class="t-cap">{{ r.k }}</dt>
          <dd class="num">{{ r.v }}</dd>
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
  text-align: right;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 66%;
}
</style>
