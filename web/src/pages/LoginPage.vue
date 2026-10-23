<script setup lang="ts">import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { login } from '@/api'
import { toast } from '@/components/toast'
import { withLoading } from '@/components/loading'
import { useTheme } from '@/composables/useTheme'
import Icon from '@/components/Icon.vue'

const REMEMBER_KEY = 'adol.remember'

const { isDark, toggleTheme, loginTitle, loginMotionEnabled } = useTheme()
const route = useRoute()
const router = useRouter()

const password = ref('')
const showPassword = ref(false)
const remember = ref(false)
const error = ref('')
const kicked = ref(false)

const isBooting = ref(false)
const bootProgress = ref(0)
const bootLog = ref('SYSTEM INITIALIZING...')

const BOOT_LOGS = [
  'BOOT: ZX297520V3 ARM CORTEX-A7',
  'KERNEL: LINUX KERNEL 3.18.20 READY',
  'RF: LTE CAT4 BASEBAND SYNCED',
  'NETWORK: APN CONDUIT CONNECTED',
  'SECURITY: ROOT ACL AUTHENTICATED',
  'GATEWAY: USER CONSOLE LAUNCHING',
]

onMounted(() => {
  kicked.value = route.query.kicked === '1'
  try {
    const saved = localStorage.getItem(REMEMBER_KEY)
    if (saved) {
      password.value = saved
      remember.value = true
    }
  } catch {

  }
})

async function runAndroidBootAnimation(redirect: string): Promise<void> {
  isBooting.value = true
  bootProgress.value = 5

  const interval = 160
  for (let i = 0; i < BOOT_LOGS.length; i++) {
    await new Promise((r) => setTimeout(r, interval))
    bootLog.value = BOOT_LOGS[i]
    bootProgress.value = Math.min(100, Math.round(((i + 1) / BOOT_LOGS.length) * 100))
  }

  await new Promise((r) => setTimeout(r, 220))
  await router.replace(redirect)
}

async function submit(): Promise<void> {
  const pwd = password.value
  if (!pwd) {
    error.value = '请输入密码'
    return
  }
  error.value = ''
  try {
    const ok = await withLoading(() => login(pwd), '正在校验凭据…')
    if (!ok) {
      error.value = '密码错误'
      return
    }
    try {
      if (remember.value) localStorage.setItem(REMEMBER_KEY, pwd)
      else localStorage.removeItem(REMEMBER_KEY)
    } catch {

    }

    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/home'

    if (loginMotionEnabled.value) {
      await runAndroidBootAnimation(redirect)
    } else {
      toast('登录成功', 'success')
      await router.replace(redirect)
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : '登录失败，请重试'
  }
}
</script>

<template>
  <div class="login-wrapper">

    <div class="ambient-glow glow-top" />
    <div class="ambient-glow glow-bottom" />

    <div class="top-bar">
      <div class="top-status">
        <span class="live-dot" />
        <span class="top-tag num">ROUTER CONSOLE</span>
      </div>
      <button
        type="button"
        class="theme-btn"
        :title="isDark ? '切换浅色模式' : '切换深色模式'"
        :aria-label="isDark ? '切换浅色模式' : '切换深色模式'"
        @click="toggleTheme"
      >
        <Icon :name="isDark ? 'sun' : 'moon'" :size="16" />
      </button>
    </div>

    <div v-if="!isBooting" class="login-container">
      <div class="brand">
        <div class="hardware-badge">
          <div class="hw-chip">
            <Icon name="router" :size="24" :stroke="2.2" />
          </div>
          <div class="hw-dots">
            <span class="dot active" />
            <span class="dot active" />
            <span class="dot" />
          </div>
        </div>
        <h1 class="brand-title">{{ loginTitle }}</h1>
        <p class="brand-sub num">ZX297520 · CONTROL PANEL</p>
      </div>

      <div v-if="kicked" class="notice">
        <Icon name="info" :size="15" />
        <span>会话已在其他终端登录，请重新验证</span>
      </div>

      <div class="login-card">
        <div class="card-head">
          <span class="card-title">管理鉴权</span>
          <span class="card-subtitle">控制台安全校验</span>
        </div>

        <form @submit.prevent="submit">
          <div class="form-item">
            <div class="input-wrap">
              <span class="input-ic">
                <Icon name="lock" :size="17" />
              </span>
              <input
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                placeholder="请输入管理密码"
                autocomplete="current-password"
                class="login-input"
              />
              <button
                type="button"
                class="btn-eye"
                tabindex="-1"
                @click="showPassword = !showPassword"
              >
                <Icon :name="showPassword ? 'eye-off' : 'eye'" :size="17" />
              </button>
            </div>
          </div>

          <p v-if="error" class="err-tip">
            <Icon name="alert" :size="14" />
            <span>{{ error }}</span>
          </p>

          <div class="remember-row">
            <label class="remember-box">
              <input v-model="remember" type="checkbox" class="cb-custom" />
              <span class="cb-label">记住密码</span>
            </label>
          </div>

          <button type="submit" class="btn btn-primary btn-block btn-login">
            <span>安全登录</span>
            <Icon name="chevron-right" :size="16" />
          </button>
        </form>
      </div>
    </div>

    <div v-else class="android-boot-stage" aria-live="polite">

      <div class="boot-glow-ring" />
      <div class="boot-glow-ripple" />

      <div class="boot-center">

        <div class="boot-emblem">
          <div class="emblem-inner">
            <Icon name="router" :size="38" :stroke="2.2" />
          </div>
          <div class="emblem-halo" />
        </div>

        <h2 class="boot-title">{{ loginTitle }}</h2>
        <span class="boot-arch num">ZX297520V3 ARM CORTEX</span>

        <div class="boot-terminal-box">
          <span class="term-prompt num">&gt;&gt;</span>
          <span :key="bootLog" class="term-log num">{{ bootLog }}</span>
        </div>

        <div class="boot-progress-wrap">
          <div class="boot-capsule-track">
            <div
              class="boot-capsule-bar"
              :style="{ width: `${bootProgress}%` }"
            />
            <div class="boot-shine-light" />
          </div>
          <span class="boot-percent num">{{ bootProgress }}%</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-wrapper {
  position: relative;
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  padding: calc(var(--safe-t) + 12px) 20px calc(var(--safe-b) + 20px);
  overflow: hidden;
}

.ambient-glow {
  position: absolute;
  width: 320px;
  height: 320px;
  border-radius: 50%;
  filter: blur(80px);
  pointer-events: none;
  z-index: 0;
  opacity: 0.45;
  transition: opacity 0.3s ease;
}

.glow-top {
  top: -80px;
  left: 50%;
  transform: translateX(-50%);
  background: radial-gradient(circle, var(--c-primary-400), transparent 70%);
}

.glow-bottom {
  bottom: -60px;
  right: -60px;
  background: radial-gradient(circle, #0288d1, transparent 70%);
}

[data-theme='dark'] .ambient-glow {
  opacity: 0.28;
}

.top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--sp-4);
  z-index: 2;
}

.top-status {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: var(--r-full);
  background: var(--c-surface-2);
  border: 1px solid var(--c-line);
  box-shadow: var(--well-shadow);
}

.live-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--c-primary-400);
  box-shadow: 0 0 8px var(--c-primary-400);
}

.top-tag {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--c-text-2);
}

.theme-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 10px;
  color: var(--c-text-2);
  background: var(--icon-dome);
  border: 1px solid var(--card-border);
  box-shadow: var(--icon-dome-shadow);
  cursor: pointer;
  transition: all 0.15s ease;
}
.theme-btn:active {
  transform: scale(0.92);
}

.login-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  width: 100%;
  max-width: 360px;
  margin: 0 auto;
  padding-bottom: var(--sp-6);
  z-index: 2;
  animation: fade-up 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes fade-up {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

.brand {
  text-align: center;
  margin-bottom: var(--sp-5);
}

.hardware-badge {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.hw-chip {
  width: 60px;
  height: 60px;
  border-radius: 18px;
  background: var(--icon-dome);
  color: var(--c-primary-500);
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--card-border);
  box-shadow: var(--icon-dome-shadow);
}

.hw-dots {
  display: flex;
  gap: 5px;
}
.hw-dots .dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--c-line-strong);
}
.hw-dots .dot.active {
  background: var(--c-primary-400);
  box-shadow: 0 0 4px var(--c-primary-400);
}

.brand-title {
  margin-top: 14px;
  font-size: 24px;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: var(--c-text-1);
}

.brand-sub {
  margin-top: 3px;
  font-size: 11px;
  color: var(--c-text-3);
  letter-spacing: 0.06em;
}

.notice {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: var(--sp-3);
  padding: 8px 12px;
  border-radius: var(--r-sm);
  font-size: 12px;
  color: var(--c-info);
  background: var(--c-info-bg);
  border: 1px solid rgba(2, 136, 209, 0.2);
}

.login-card {
  border-radius: var(--r-xl);
  padding: 22px;
}

.card-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 16px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--c-line);
}

.card-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--c-text-1);
}

.card-subtitle {
  font-size: 11px;
  color: var(--c-text-3);
}

.form-item {
  margin-bottom: 12px;
}

.input-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.input-ic {
  position: absolute;
  left: 12px;
  color: var(--c-text-3);
  display: flex;
  align-items: center;
  pointer-events: none;
}

.login-input {
  width: 100%;
  padding-left: 38px !important;
  padding-right: 40px !important;
}

.btn-eye {
  position: absolute;
  right: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  color: var(--c-text-3);
  cursor: pointer;
  border-radius: 6px;
}
.btn-eye:hover {
  color: var(--c-text-1);
}

.err-tip {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-bottom: 12px;
  font-size: 12px;
  color: var(--c-danger);
}

.remember-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18px;
  font-size: 12px;
  color: var(--c-text-2);
}

.remember-box {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  user-select: none;
}

.cb-custom {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  accent-color: var(--c-primary-400);
  cursor: pointer;
}

.btn-login {
  height: 46px;
  font-size: 15px;
  letter-spacing: 0.02em;
}

.android-boot-stage {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  position: relative;
  z-index: 10;
  animation: boot-stage-in 0.35s ease;
}

@keyframes boot-stage-in {
  from { opacity: 0; transform: scale(0.96); }
  to { opacity: 1; transform: scale(1); }
}

.boot-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  width: 100%;
  max-width: 320px;
  position: relative;
  z-index: 2;
}

.boot-emblem {
  position: relative;
  margin-bottom: 16px;
}

.emblem-inner {
  position: relative;
  z-index: 2;
  width: 84px;
  height: 84px;
  border-radius: 26px;
  background: var(--icon-dome);
  border: 1.5px solid var(--card-border);
  box-shadow:
    0 16px 38px -8px rgba(16, 185, 129, 0.45),
    inset 2px 2px 2px rgba(255, 255, 255, 0.95),
    inset -2px -2px 2px rgba(255, 255, 255, 0.5);
  color: var(--c-primary-500);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: emblem-breath 1.6s ease-in-out infinite alternate;
}

[data-theme='dark'] .emblem-inner {
  color: var(--c-primary-400);
}

@keyframes emblem-breath {
  0% { transform: scale(1); filter: drop-shadow(0 0 6px rgba(16, 185, 129, 0.3)); }
  100% { transform: scale(1.06); filter: drop-shadow(0 0 20px rgba(16, 185, 129, 0.8)); }
}

.emblem-halo {
  position: absolute;
  inset: -14px;
  border-radius: 36px;
  background: radial-gradient(circle, rgba(16, 185, 129, 0.4) 0%, transparent 70%);
  animation: halo-rotate 3s linear infinite;
}

@keyframes halo-rotate {
  from { transform: rotate(0deg); opacity: 0.6; }
  to { transform: rotate(360deg); opacity: 0.9; }
}

.boot-title {
  font-size: 24px;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: var(--c-text-1);
}

.boot-arch {
  margin-top: 2px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--c-text-3);
}

.boot-terminal-box {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  margin-top: 24px;
  padding: 8px 12px;
  border-radius: 10px;
  background: var(--c-surface-2);
  border: 1px solid var(--c-line);
  box-shadow: var(--well-shadow);
  overflow: hidden;
}

.term-prompt {
  font-size: 12px;
  font-weight: 800;
  color: var(--c-primary-500);
  flex: none;
}

.term-log {
  font-size: 11px;
  font-weight: 700;
  color: var(--c-text-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  animation: log-slide 0.18s ease;
}

@keyframes log-slide {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

.boot-progress-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  margin-top: 14px;
}

.boot-capsule-track {
  position: relative;
  flex: 1;
  height: 10px;
  border-radius: 99px;
  background: var(--c-surface-2);
  border: 1px solid var(--c-line-strong);
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.12);
  overflow: hidden;
}

.boot-capsule-bar {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  border-radius: 99px;
  background: linear-gradient(90deg, #10b981 0%, #06b6d4 50%, #3b82f6 100%);
  box-shadow: 0 0 12px rgba(16, 185, 129, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.6);
  transition: width 0.16s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.boot-shine-light {
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.65) 50%, transparent 100%);
  animation: bar-shine 1.2s linear infinite;
  pointer-events: none;
}

@keyframes bar-shine {
  from { transform: translateX(-100%); }
  to { transform: translateX(100%); }
}

.boot-percent {
  font-size: 12px;
  font-weight: 800;
  color: var(--c-primary-600);
  width: 38px;
  text-align: right;
  flex: none;
}
[data-theme='dark'] .boot-percent {
  color: var(--c-primary-400);
}
</style>
