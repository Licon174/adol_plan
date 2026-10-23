<script setup lang="ts">import { DIAL_KEYS, setConnectionMode } from '@/api'
import { usePageForm } from '@/composables/usePageForm'
import PageForm from '@/layouts/PageForm.vue'
import Card from '@/components/Card.vue'
import Icon from '@/components/Icon.vue'
import Toggle from '@/components/Toggle.vue'

interface Model {

  mode: string
  allowRoaming: boolean
}

const { model, loading, saving, error, dirty, load, save, reset } = usePageForm<Model>({
  keys: DIAL_KEYS,
  fromStatus: (s) => ({
    mode: s.dial_mode || 'auto_dial',
    allowRoaming: (s.roam_setting_option ?? 'on') === 'on',
  }),
  toPayload: (m) => [
    setConnectionMode({
      ConnectionMode: m.mode,
      roam_setting_option: m.allowRoaming ? 'on' : 'off',
    }),
  ],
})

void load()
</script>

<template>
  <PageForm
    title="拨号设置"
    :loading="loading"
    :saving="saving"
    :error="error"
    :dirty="dirty"
    @save="save()"
    @reset="reset()"
  >
    <Card title="拨号模式">
      <div class="dial-grid">
        <button
          type="button"
          class="dial-card"
          :class="{ 'is-on': model.mode === 'auto_dial' }"
          @click="model.mode = 'auto_dial'"
        >
          <div class="dial-top">
            <span class="dial-icon">
              <Icon name="zap" :size="18" />
            </span>
            <span v-if="model.mode === 'auto_dial'" class="check-dot">
              <Icon name="check" :size="12" :stroke="2.5" />
            </span>
          </div>
          <span class="dial-title">自动拨号</span>
          <span class="dial-tag">掉线自动重连</span>
        </button>

        <button
          type="button"
          class="dial-card"
          :class="{ 'is-on': model.mode === 'manual_dial' }"
          @click="model.mode = 'manual_dial'"
        >
          <div class="dial-top">
            <span class="dial-icon">
              <Icon name="power" :size="18" />
            </span>
            <span v-if="model.mode === 'manual_dial'" class="check-dot">
              <Icon name="check" :size="12" :stroke="2.5" />
            </span>
          </div>
          <span class="dial-title">手动拨号</span>
          <span class="dial-tag">手动发起连接</span>
        </button>
      </div>
    </Card>

    <Card title="数据漫游">
      <div class="roam-row">
        <div class="roam-left">
          <span class="roam-icon">
            <Icon name="globe" :size="16" />
          </span>
          <div>
            <p class="switch-title">数据漫游</p>
            <p class="t-cap">漫游时允许数据连接</p>
          </div>
        </div>
        <Toggle v-model="model.allowRoaming" label="允许漫游" />
      </div>
    </Card>
  </PageForm>
</template>

<style scoped>
.dial-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--sp-3);
}

.dial-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: var(--sp-4);
  border: 1px solid var(--c-line);
  border-radius: var(--r-lg);
  background: var(--c-surface-2);
  text-align: left;
  transition: all 0.16s cubic-bezier(0.2, 0, 0, 1);
}

.dial-card:active {
  transform: scale(0.965);
}

.dial-card.is-on {
  border-color: var(--c-primary-400);
  background: var(--c-primary-50);
  box-shadow: 0 0 12px rgba(28, 165, 123, 0.18);
}

[data-theme='dark'] .dial-card.is-on {
  background: rgba(34, 181, 134, 0.14);
}

.dial-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  margin-bottom: var(--sp-3);
}

.dial-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: var(--r-md);
  background: var(--c-surface);
  color: var(--c-text-2);
  border: 1px solid var(--c-line);
}

.dial-card.is-on .dial-icon {
  background: var(--c-primary-400);
  color: #ffffff;
  border-color: transparent;
}

.check-dot {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--c-primary-400);
  color: #ffffff;
}

.dial-title {
  font-size: var(--fs-body);
  font-weight: 700;
  color: var(--c-text-1);
}

.dial-tag {
  font-size: 11px;
  color: var(--c-text-3);
  margin-top: 2px;
}

.dial-card.is-on .dial-tag {
  color: var(--c-primary-600);
}

[data-theme='dark'] .dial-card.is-on .dial-tag {
  color: var(--c-primary-400);
}

.roam-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
}

.roam-left {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
}

.roam-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--r-md);
  background: var(--c-primary-50);
  color: var(--c-primary-400);
  flex: none;
}

[data-theme='dark'] .roam-icon {
  background: var(--c-primary-100);
}

.switch-title {
  font-size: var(--fs-body);
  font-weight: 600;
}
</style>
