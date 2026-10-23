<script setup lang="ts">import { computed, ref } from 'vue'
import { changePassword, post } from '@/api'
import { toast } from '@/components/toast'
import { confirm } from '@/components/confirm'
import { withLoading } from '@/components/loading'
import { validateAdminPassword } from '@/utils/validators'
import PageForm from '@/layouts/PageForm.vue'
import Card from '@/components/Card.vue'
import FormField from '@/components/FormField.vue'
import Icon from '@/components/Icon.vue'

const oldPwd = ref('')
const newPwd = ref('')
const confirmPwd = ref('')
const showOld = ref(false)
const showNew = ref(false)
const showConfirm = ref(false)
const busy = ref(false)
const errText = ref('')

const strengthScore = computed(() => {
  const p = newPwd.value
  if (!p || p.length < 8) return 0
  let score = 1
  if (/[a-zA-Z]/.test(p) && /\d/.test(p)) score = 2
  if (/[^a-zA-Z0-9]/.test(p) && p.length >= 10) score = 3
  return score
})

const strengthLabel = computed(() => {
  switch (strengthScore.value) {
    case 1:
      return { text: '弱 (建议混用字母与数字)', color: '#ef4444' }
    case 2:
      return { text: '中等 (良好)', color: '#f59e0b' }
    case 3:
      return { text: '极强', color: '#10b981' }
    default:
      return { text: '至少 8 位可见字符', color: 'var(--c-text-3)' }
  }
})

const matchState = computed(() => {
  if (!confirmPwd.value) return null
  return confirmPwd.value === newPwd.value
})

async function submit(): Promise<void> {
  if (!oldPwd.value) {
    toast('请输入当前密码', 'error')
    return
  }

  const pe = validateAdminPassword(newPwd.value, oldPwd.value)
  if (pe) {
    toast(pe, 'error')
    return
  }
  if (newPwd.value !== confirmPwd.value) {
    toast('两次输入的新密码不一致', 'error')
    return
  }
  const ok = await confirm({
    title: '修改管理员密码',
    message: '修改后需要使用新密码重新登录。',
    danger: true,
  })
  if (!ok) return

  busy.value = true
  errText.value = ''
  try {
    await withLoading(async () => {
      const res = await post(changePassword(oldPwd.value, newPwd.value))
      if (res.result !== 'success') {
        throw new Error(
          res.result === 'badPassword' || res.result === 'failure'
            ? '当前密码不正确'
            : `设备返回：${res.result || '失败'}`,
        )
      }
    }, '正在提交…')
    toast('已修改，请重新登录', 'success')
    oldPwd.value = ''
    newPwd.value = ''
    confirmPwd.value = ''
  } catch (e) {
    errText.value = e instanceof Error ? e.message : '修改失败'
    toast(errText.value, 'error')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <PageForm title="管理员密码" :savable="false">
    <Card title="修改密码">

      <FormField label="当前密码" required>
        <div class="pwd-field">
          <input
            v-model="oldPwd"
            :type="showOld ? 'text' : 'password'"
            autocomplete="current-password"
            placeholder="当前密码"
            class="pwd-input"
          />
          <button
            type="button"
            class="eye-btn"
            :title="showOld ? '隐藏密码' : '显示密码'"
            @click="showOld = !showOld"
          >
            <Icon :name="showOld ? 'eye-off' : 'eye'" :size="16" />
          </button>
        </div>
      </FormField>

      <FormField label="新密码" required>
        <div class="pwd-field">
          <input
            v-model="newPwd"
            :type="showNew ? 'text' : 'password'"
            autocomplete="new-password"
            placeholder="8~63 位字符"
            class="pwd-input"
          />
          <button
            type="button"
            class="eye-btn"
            :title="showNew ? '隐藏密码' : '显示密码'"
            @click="showNew = !showNew"
          >
            <Icon :name="showNew ? 'eye-off' : 'eye'" :size="16" />
          </button>
        </div>

        <div class="meter-box">
          <div class="meter-bars">
            <div
              class="bar"
              :class="{ 'is-active': strengthScore >= 1 }"
              :style="{ background: strengthScore >= 1 ? strengthLabel.color : '' }"
            />
            <div
              class="bar"
              :class="{ 'is-active': strengthScore >= 2 }"
              :style="{ background: strengthScore >= 2 ? strengthLabel.color : '' }"
            />
            <div
              class="bar"
              :class="{ 'is-active': strengthScore >= 3 }"
              :style="{ background: strengthScore >= 3 ? strengthLabel.color : '' }"
            />
          </div>
          <span class="meter-text t-cap" :style="{ color: strengthLabel.color }">
            {{ strengthLabel.text }}
          </span>
        </div>
      </FormField>

      <FormField label="确认新密码" required>
        <div class="pwd-field">
          <input
            v-model="confirmPwd"
            :type="showConfirm ? 'text' : 'password'"
            autocomplete="new-password"
            placeholder="再次输入"
            class="pwd-input"
            @keyup.enter="submit"
          />
          <button
            type="button"
            class="eye-btn"
            :title="showConfirm ? '隐藏密码' : '显示密码'"
            @click="showConfirm = !showConfirm"
          >
            <Icon :name="showConfirm ? 'eye-off' : 'eye'" :size="16" />
          </button>
        </div>
        <div v-if="confirmPwd" class="match-box">
          <span v-if="matchState" class="match-ok">一致</span>
          <span v-else class="match-err">不一致</span>
        </div>
      </FormField>

      <button
        type="button"
        class="btn btn-primary btn-block mt-3"
        :disabled="busy || !oldPwd || !newPwd || !confirmPwd || !matchState"
        @click="submit"
      >
        {{ busy ? '提交中…' : '保存密码' }}
      </button>
    </Card>

    <div class="tip-card">
      <Icon name="shield-alert" :size="15" />
      <span>保存后会话失效，需重新登录</span>
    </div>
  </PageForm>
</template>

<style scoped>
.pwd-field {
  position: relative;
  display: flex;
  align-items: center;
}

.pwd-input {
  width: 100%;
  padding-right: 40px !important;
}

.eye-btn {
  position: absolute;
  right: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--r-sm);
  color: var(--c-text-3);
  transition: all 0.15s ease;
}
.eye-btn:hover {
  color: var(--c-text-1);
}
.eye-btn:active {
  transform: scale(0.9);
}

.meter-box {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-2);
  margin-top: 6px;
}

.meter-bars {
  display: flex;
  gap: 4px;
  flex: 1;
  max-width: 120px;
}

.bar {
  flex: 1;
  height: 4px;
  border-radius: 2px;
  background: var(--c-line);
  transition: all 0.25s ease;
}

.meter-text {
  font-size: 11px;
  font-weight: 600;
}

.match-box {
  margin-top: 4px;
  font-size: 11px;
  font-weight: 600;
}

.match-ok {
  color: var(--c-primary-500);
}

.match-err {
  color: var(--c-danger);
}

.mt-4 {
  margin-top: var(--sp-4);
}

.tip-card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: var(--r-md);
  background: var(--c-surface-2);
  border: 1px solid var(--c-line);
  color: var(--c-text-2);
  font-size: 12px;
  margin-top: var(--sp-3);
  line-height: 1.4;
}
</style>
