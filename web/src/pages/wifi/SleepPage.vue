<script setup lang="ts">import { computed } from 'vue'
import { WIFI_SLEEP_KEYS, saveTsw, wifiSleep } from '@/api'
import { usePageForm } from '@/composables/usePageForm'
import PageForm from '@/layouts/PageForm.vue'
import Card from '@/components/Card.vue'
import Toggle from '@/components/Toggle.vue'
import Icon from '@/components/Icon.vue'

interface Model {
  tswEnabled: boolean
  openTime: string
  closeTime: string
  sleepInterval: string
}

const SLEEP_OPTIONS = [
  { label: '常开 (从不休眠)', value: '0' },
  { label: '5 分钟无连接休眠', value: '5' },
  { label: '10 分钟无连接休眠', value: '10' },
  { label: '30 分钟无连接休眠', value: '30' },
  { label: '60 分钟无连接休眠', value: '60' },
]

const { model, loading, saving, error, fieldErrors, dirty, load, save, reset } = usePageForm<Model>(
  {
    keys: WIFI_SLEEP_KEYS,
    fromStatus: (s) => ({
      tswEnabled: (s.openEnable ?? '0') === '1',
      openTime: s.openTime || '08:00',
      closeTime: s.closeTime || '23:00',
      sleepInterval: s.Sleep_interval || '0',
    }),
    validate: (m): Record<string, string> | null => {
      if (!m.tswEnabled) return null
      if (!/^\d{2}:\d{2}$/.test(m.openTime)) return { openTime: '格式 HH:MM' }
      if (!/^\d{2}:\d{2}$/.test(m.closeTime)) return { closeTime: '格式 HH:MM' }
      if (m.openTime === m.closeTime) return { closeTime: '起止时间不能相同' }
      return null
    },
    toPayload: (m, raw) => {
      const list: Record<string, string>[] = []
      const wasEnabled = (raw.openEnable ?? '0') === '1'
      if (m.tswEnabled !== wasEnabled || m.tswEnabled) {
        list.push(
          saveTsw({
            openEnable: m.tswEnabled ? '1' : '0',
            closeEnable: m.tswEnabled ? '1' : '0',
            openTime: m.openTime,
            closeTime: m.closeTime,
          }),
        )
      }
      if (m.sleepInterval !== (raw.Sleep_interval || '0')) {
        list.push(wifiSleep(m.sleepInterval))
      }
      return list
    },
  },
)

void load()

const currentIdleLabel = computed(() => {
  const found = SLEEP_OPTIONS.find((o) => o.value === model.value.sleepInterval)
  return found?.label || '不启用'
})
</script>

<template>
  <PageForm
    title="WiFi 休眠"
    :loading="loading"
    :saving="saving"
    :error="error"
    :dirty="dirty"
    @save="save()"
    @reset="reset()"
  >
    <Card>
      <div class="sleep-hero">
        <div class="sleep-hero-left">
          <div class="sleep-hero-icon" :class="{ 'is-active': model.tswEnabled || model.sleepInterval !== '0' }">
            <Icon name="moon" :size="20" />
          </div>
          <div class="sleep-hero-meta">
            <div class="sleep-title-row">
              <span class="sleep-name">WiFi 休眠</span>
              <span class="sleep-badge" :class="model.tswEnabled ? 'badge-on' : 'badge-off'">
                {{ model.tswEnabled ? `${model.closeTime} ~ ${model.openTime}` : '常开' }}
              </span>
            </div>
            <span class="t-cap">
              空闲休眠：{{ currentIdleLabel }}
            </span>
          </div>
        </div>
      </div>
    </Card>

    <Card title="定时开关">
      <div class="switch-row">
        <div>
          <p class="switch-title">定时休眠</p>
          <p class="t-cap">指定时段关闭 WiFi 射频</p>
        </div>
        <Toggle v-model="model.tswEnabled" label="定时开关" />
      </div>

      <Transition name="fade">
        <div v-if="model.tswEnabled" class="schedule-box">
          <div class="time-grid">
            <div class="time-card">
              <span class="time-label">休眠时刻</span>
              <input v-model="model.closeTime" type="time" class="time-input num" />
              <span v-if="fieldErrors.closeTime" class="t-error">{{ fieldErrors.closeTime }}</span>
            </div>

            <div class="time-card">
              <span class="time-label">唤醒时刻</span>
              <input v-model="model.openTime" type="time" class="time-input num" />
              <span v-if="fieldErrors.openTime" class="t-error">{{ fieldErrors.openTime }}</span>
            </div>
          </div>
        </div>
      </Transition>
    </Card>

    <Card title="空闲休眠档位">
      <div class="idle-selector">
        <button
          v-for="o in SLEEP_OPTIONS"
          :key="o.value"
          type="button"
          class="idle-card"
          :class="{ 'is-selected': model.sleepInterval === o.value }"
          @click="model.sleepInterval = o.value"
        >
          <span class="idle-title">{{ o.label }}</span>
          <Icon v-if="model.sleepInterval === o.value" name="check" :size="15" class="check-ic" />
        </button>
      </div>
    </Card>
  </PageForm>
</template>

<style scoped>
.sleep-hero { display: flex; align-items: center; justify-content: space-between; }
.sleep-hero-left { display: flex; align-items: center; gap: var(--sp-3); min-width: 0; }
.sleep-hero-icon { width: 38px; height: 38px; border-radius: var(--r-md); background: var(--c-surface-2); color: var(--c-text-3); display: flex; align-items: center; justify-content: center; flex: none; }
.sleep-hero-icon.is-active { background: #fef3c7; color: #d97706; }
[data-theme='dark'] .sleep-hero-icon.is-active { background: rgba(217, 119, 6, 0.2); color: #fbbf24; }

.sleep-hero-meta { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.sleep-title-row { display: flex; align-items: center; gap: 6px; }
.sleep-name { font-size: 15px; font-weight: 700; color: var(--c-text-1); }
.sleep-badge { font-size: 11px; font-weight: 600; padding: 1px 6px; border-radius: var(--r-sm); }
.badge-on { background: #fef3c7; color: #b45309; }
[data-theme='dark'] .badge-on { background: rgba(217, 119, 6, 0.2); color: #fbbf24; }
.badge-off { background: var(--c-surface-2); color: var(--c-text-3); }

.switch-row { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-3); }
.switch-title { font-size: var(--fs-body); font-weight: 600; }
.schedule-box { margin-top: var(--sp-2); padding-top: var(--sp-2); border-top: 1px solid var(--c-line); }
.time-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-2); }
@media (max-width: 480px) { .time-grid { grid-template-columns: 1fr; } }
.time-card { display: flex; flex-direction: column; gap: 4px; padding: var(--sp-2); border-radius: var(--r-sm); background: var(--c-surface-2); }
.time-label { font-size: 11px; font-weight: 600; color: var(--c-text-2); }
.time-input { height: 36px; padding: 0 var(--sp-2); border-radius: var(--r-sm); border: 1px solid var(--c-line); background: var(--c-surface); color: var(--c-text-1); font-size: 14px; font-weight: 600; outline: none; }
.t-error { font-size: 11px; color: var(--c-danger); }

.idle-selector { display: flex; flex-direction: column; gap: var(--sp-1); }
.idle-card { display: flex; align-items: center; justify-content: space-between; padding: 8px var(--sp-3); border-radius: var(--r-sm); background: var(--c-surface); border: 1px solid var(--c-line); cursor: pointer; }
.idle-card:hover { border-color: var(--c-primary-400); }
.idle-card.is-selected { border-color: var(--c-primary-400); background: var(--c-primary-50); }
[data-theme='dark'] .idle-card.is-selected { background: rgba(34, 181, 134, 0.15); }
.idle-title { font-size: 12px; font-weight: 600; color: var(--c-text-1); }
.check-ic { color: var(--c-primary-400); }
</style>
