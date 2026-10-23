<script setup lang="ts">import { computed, ref, watch } from 'vue'
import {
  useTheme,
  type MotionLevel,
  type ThemeMode,
  type WallpaperId,
  MAX_TITLE_LEN,
  MAX_DOC_TITLE_LEN,
  DEFAULT_GATEWAY_TITLE,
  DEFAULT_DOC_TITLE,
} from '@/composables/useTheme'
import { toast } from '@/components/toast'
import PageForm from '@/layouts/PageForm.vue'
import Card from '@/components/Card.vue'
import Toggle from '@/components/Toggle.vue'
import Icon from '@/components/Icon.vue'

const {
  themeMode,
  motionLevel,
  glassEnabled,
  textureEnabled,
  wallpaperId,
  customWallpaper,
  glassBlur,
  glassAlpha,
  wpDim,
  homeTitle,
  loginTitle,
  docTitle,
  customFavicon,
  loginMotionEnabled,
  setThemeMode,
  setMotionLevel,
  setGlassEnabled,
  setTextureEnabled,
  setWallpaperId,
  setCustomWallpaper,
  setGlassBlur,
  setGlassAlpha,
  setWpDim,
  setHomeTitle,
  setLoginTitle,
  setDocTitle,
  setCustomFavicon,
  setLoginMotionEnabled,
  compressWallpaperFile,
  compressFaviconFile,
} = useTheme()

const wpFileInput = ref<HTMLInputElement | null>(null)
const faviconFileInput = ref<HTMLInputElement | null>(null)
const uploadingWp = ref(false)
const uploadingFavicon = ref(false)

const homeInput = ref(homeTitle.value)
const loginInput = ref(loginTitle.value)
const docInput = ref(docTitle.value)

const sliderAccordionOpen = ref(false)

watch(homeTitle, (v) => { homeInput.value = v })
watch(loginTitle, (v) => { loginInput.value = v })
watch(docTitle, (v) => { docInput.value = v })

function saveHomeTitle(): void {
  const v = (homeInput.value.trim() || DEFAULT_GATEWAY_TITLE).slice(0, MAX_TITLE_LEN)
  if (v === homeTitle.value) {
    homeInput.value = homeTitle.value
    return
  }
  setHomeTitle(v)
  homeInput.value = homeTitle.value
  toast(`首页标题已设为：${homeTitle.value}`, 'success')
}

function resetHomeTitle(): void {
  if (homeTitle.value === DEFAULT_GATEWAY_TITLE) return
  setHomeTitle(DEFAULT_GATEWAY_TITLE)
  homeInput.value = DEFAULT_GATEWAY_TITLE
  toast('已恢复首页默认标题', 'info')
}

function saveLoginTitle(): void {
  const v = (loginInput.value.trim() || DEFAULT_GATEWAY_TITLE).slice(0, MAX_TITLE_LEN)
  if (v === loginTitle.value) {
    loginInput.value = loginTitle.value
    return
  }
  setLoginTitle(v)
  loginInput.value = loginTitle.value
  toast(`登录页标题已设为：${loginTitle.value}`, 'success')
}

function resetLoginTitle(): void {
  if (loginTitle.value === DEFAULT_GATEWAY_TITLE) return
  setLoginTitle(DEFAULT_GATEWAY_TITLE)
  loginInput.value = DEFAULT_GATEWAY_TITLE
  toast('已恢复登录页默认标题', 'info')
}

function saveDocTitle(): void {
  const v = (docInput.value.trim() || DEFAULT_DOC_TITLE).slice(0, MAX_DOC_TITLE_LEN)
  if (v === docTitle.value) {
    docInput.value = docTitle.value
    return
  }
  setDocTitle(v)
  docInput.value = docTitle.value
  toast(`网站标题已设为：${docTitle.value}`, 'success')
}

function resetDocTitle(): void {
  if (docTitle.value === DEFAULT_DOC_TITLE) return
  setDocTitle(DEFAULT_DOC_TITLE)
  docInput.value = DEFAULT_DOC_TITLE
  toast('已恢复网站默认标题', 'info')
}

function triggerFaviconUpload(): void {
  faviconFileInput.value?.click()
}

async function onFaviconSelected(ev: Event): Promise<void> {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  uploadingFavicon.value = true
  try {
    const pngData = await compressFaviconFile(file)
    setCustomFavicon(pngData)
    toast('网站图标已更换', 'success')
  } catch (e) {
    toast(e instanceof Error ? e.message : '图标处理失败', 'error')
  } finally {
    uploadingFavicon.value = false
    input.value = ''
  }
}

function clearFavicon(): void {
  setCustomFavicon('')
  toast('已恢复原厂默认图标', 'info')
}

const DEFAULT_BLUR = 14
const DEFAULT_ALPHA = 22
const DEFAULT_DIM = 6

const isSliderChanged = computed(
  () =>
    glassBlur.value !== DEFAULT_BLUR ||
    glassAlpha.value !== DEFAULT_ALPHA ||
    wpDim.value !== DEFAULT_DIM,
)

const WP_PRESETS: { id: WallpaperId; name: string; preview: string }[] = [
  {
    id: 'sequoia',
    name: '塞阔亚',
    preview: 'linear-gradient(135deg, #0284c7 0%, #10b981 48%, #f59e0b 100%)',
  },
  {
    id: 'sonoma',
    name: '索诺玛',
    preview: 'linear-gradient(135deg, #ec4899 0%, #f97316 45%, #a855f7 100%)',
  },
  {
    id: 'obsidian',
    name: '黑曜极光',
    preview: 'linear-gradient(135deg, #064e3b 0%, #0369a1 52%, #111827 100%)',
  },
]

const THEMES: { k: ThemeMode; label: string; ic: 'sun' | 'moon' | 'monitor' }[] = [
  { k: 'light', label: '浅色', ic: 'sun' },
  { k: 'dark', label: '深色', ic: 'moon' },
  { k: 'system', label: '跟随系统', ic: 'monitor' },
]

const MOTIONS: { k: MotionLevel; label: string }[] = [
  { k: 'full', label: '丝滑' },
  { k: 'gentle', label: '柔和' },
  { k: 'off', label: '关闭' },
]

function selectWallpaper(id: WallpaperId): void {
  if (id === 'custom' && !customWallpaper.value) {
    wpFileInput.value?.click()
    return
  }
  setWallpaperId(id)
  if (!glassEnabled.value) setGlassEnabled(true)
}

function triggerWpUpload(): void {
  wpFileInput.value?.click()
}

async function onWpFileSelected(ev: Event): Promise<void> {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  uploadingWp.value = true
  try {
    const dataUrl = await compressWallpaperFile(file)
    setCustomWallpaper(dataUrl)
    if (!glassEnabled.value) setGlassEnabled(true)
    toast('自定义壁纸已应用', 'success')
  } catch (e) {
    toast(e instanceof Error ? e.message : '图片处理失败', 'error')
  } finally {
    uploadingWp.value = false
    input.value = ''
  }
}

function clearCustomWp(): void {
  setCustomWallpaper('')
  toast('已恢复默认壁纸', 'info')
}

function resetSliders(): void {
  setGlassBlur(DEFAULT_BLUR)
  setGlassAlpha(DEFAULT_ALPHA)
  setWpDim(DEFAULT_DIM)
  toast('已恢复默认材质参数', 'success')
}
</script>

<template>
  <PageForm title="主题与动效" :savable="false">

    <Card>
      <div class="ctrl-block">
        <div class="ctrl-row">
          <span class="ctrl-label">外观</span>
          <div class="seg-bar">
            <button
              v-for="t in THEMES"
              :key="t.k"
              type="button"
              class="seg-pill"
              :class="{ 'is-active': themeMode === t.k }"
              @click="setThemeMode(t.k as ThemeMode)"
            >
              <Icon :name="t.ic" :size="14" />
              <span>{{ t.label }}</span>
            </button>
          </div>
        </div>

        <div class="row-sep" />

        <div class="ctrl-row">
          <span class="ctrl-label">动效等级</span>
          <div class="seg-bar">
            <button
              v-for="m in MOTIONS"
              :key="m.k"
              type="button"
              class="seg-pill"
              :class="{ 'is-active': motionLevel === m.k }"
              @click="setMotionLevel(m.k)"
            >
              <span>{{ m.label }}</span>
            </button>
          </div>
        </div>

        <div class="row-sep" />

        <div class="ctrl-row">
          <span class="ctrl-label">登录转场动效</span>
          <Toggle :model-value="loginMotionEnabled" @update:model-value="setLoginMotionEnabled" />
        </div>
      </div>
    </Card>

    <Card title="个性化标识">
      <div class="custom-identity-list">

        <div class="compact-cell">
          <div class="cell-label-col">
            <span class="cell-title">首页标题</span>
            <span class="cell-tag num">{{ homeInput.length }}/{{ MAX_TITLE_LEN }}</span>
          </div>
          <div class="cell-action-col">
            <input
              v-model="homeInput"
              type="text"
              :maxlength="MAX_TITLE_LEN"
              placeholder="GATEWAY"
              class="compact-input num"
              @blur="saveHomeTitle"
              @keyup.enter="saveHomeTitle"
            />
            <button
              v-if="homeInput !== DEFAULT_GATEWAY_TITLE"
              type="button"
              class="btn-cell-reset"
              title="重置为默认"
              @click="resetHomeTitle"
            >
              重置
            </button>
          </div>
        </div>

        <div class="row-sep" />

        <div class="compact-cell">
          <div class="cell-label-col">
            <span class="cell-title">登录页标题</span>
            <span class="cell-tag num">{{ loginInput.length }}/{{ MAX_TITLE_LEN }}</span>
          </div>
          <div class="cell-action-col">
            <input
              v-model="loginInput"
              type="text"
              :maxlength="MAX_TITLE_LEN"
              placeholder="GATEWAY"
              class="compact-input num"
              @blur="saveLoginTitle"
              @keyup.enter="saveLoginTitle"
            />
            <button
              v-if="loginInput !== DEFAULT_GATEWAY_TITLE"
              type="button"
              class="btn-cell-reset"
              title="重置为默认"
              @click="resetLoginTitle"
            >
              重置
            </button>
          </div>
        </div>

        <div class="row-sep" />

        <div class="compact-cell">
          <div class="cell-label-col">
            <span class="cell-title">网站标题</span>
            <span class="cell-tag num">{{ docInput.length }}/{{ MAX_DOC_TITLE_LEN }}</span>
          </div>
          <div class="cell-action-col">
            <input
              v-model="docInput"
              type="text"
              :maxlength="MAX_DOC_TITLE_LEN"
              placeholder="Adol-Plan"
              class="compact-input"
              @blur="saveDocTitle"
              @keyup.enter="saveDocTitle"
            />
            <button
              v-if="docInput !== DEFAULT_DOC_TITLE"
              type="button"
              class="btn-cell-reset"
              title="重置为默认"
              @click="resetDocTitle"
            >
              重置
            </button>
          </div>
        </div>

        <div class="row-sep" />

        <div class="compact-cell">
          <div class="cell-label-col">
            <span class="cell-title">网站图标</span>
            <span class="cell-sub-tip">Favicon (64×64)</span>
          </div>
          <div class="cell-action-col favicon-col">
            <div
              class="favicon-preview-box"
              title="点击更换网站图标"
              @click="triggerFaviconUpload"
            >
              <img
                :src="customFavicon || '/favicon.ico'"
                alt="Favicon"
                class="favicon-img"
              />
              <span class="fav-edit-badge">
                <Icon name="edit" :size="9" />
              </span>
            </div>
            <button
              type="button"
              class="btn-text-action"
              :disabled="uploadingFavicon"
              @click="triggerFaviconUpload"
            >
              {{ uploadingFavicon ? '处理中…' : '更换图标' }}
            </button>
            <button
              v-if="customFavicon"
              type="button"
              class="btn-cell-reset"
              @click="clearFavicon"
            >
              重置
            </button>
          </div>
        </div>
      </div>

      <input
        ref="faviconFileInput"
        type="file"
        accept="image/*"
        class="sr-only-file"
        @change="onFaviconSelected"
      />
    </Card>

    <Card title="背景壁纸">
      <div class="wp-row">
        <button
          v-for="wp in WP_PRESETS"
          :key="wp.id"
          type="button"
          class="wp-tile"
          :class="{ 'is-active': wallpaperId === wp.id }"
          @click="selectWallpaper(wp.id)"
        >
          <div class="wp-thumb" :style="{ background: wp.preview }">
            <span v-if="wallpaperId === wp.id" class="wp-badge">
              <Icon name="check" :size="10" :stroke="3" />
            </span>
          </div>
          <span class="wp-label">{{ wp.name }}</span>
        </button>

        <button
          type="button"
          class="wp-tile"
          :class="{ 'is-active': wallpaperId === 'custom' }"
          @click="triggerWpUpload"
        >
          <div
            class="wp-thumb wp-thumb-custom"
            :style="
              customWallpaper
                ? {
                    backgroundImage: `url(${customWallpaper})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }
                : undefined
            "
          >
            <Icon v-if="!customWallpaper" name="plus" :size="18" />
            <span v-if="wallpaperId === 'custom'" class="wp-badge">
              <Icon name="check" :size="10" :stroke="3" />
            </span>
          </div>
          <span class="wp-label">{{ uploadingWp ? '处理中' : '自定义' }}</span>
        </button>
      </div>

      <div v-if="customWallpaper" class="wp-custom-bar">
        <button
          v-if="wallpaperId !== 'custom'"
          type="button"
          class="link-btn"
          @click="selectWallpaper('custom')"
        >
          使用当前图
        </button>
        <button type="button" class="link-btn" @click="triggerWpUpload">更换图片</button>
        <button type="button" class="link-btn is-danger" @click="clearCustomWp">清除</button>
      </div>

      <input
        ref="wpFileInput"
        type="file"
        accept="image/*"
        class="sr-only-file"
        @change="onWpFileSelected"
      />
    </Card>

    <Card title="高级材质">
      <div class="glass-panel">
        <div class="switch-line">
          <span class="line-label">液态玻璃</span>
          <Toggle :model-value="glassEnabled" @update:model-value="setGlassEnabled" />
        </div>

        <div class="row-sep" />

        <div class="switch-line">
          <span class="line-label">立体质感</span>
          <Toggle :model-value="textureEnabled" @update:model-value="setTextureEnabled" />
        </div>

        <template v-if="glassEnabled">
          <div class="row-sep" />

          <div
            class="accordion-toggle-bar"
            @click="sliderAccordionOpen = !sliderAccordionOpen"
          >
            <div class="acc-left">
              <span class="acc-title">光学参数调节</span>
              <span class="acc-badge num">{{ glassBlur }}px · {{ glassAlpha }}%</span>
            </div>
            <div class="acc-right">
              <button
                v-if="isSliderChanged"
                type="button"
                class="btn-reset-params"
                title="恢复默认"
                @click.stop="resetSliders"
              >
                <Icon name="refresh" :size="12" />
                <span>重置</span>
              </button>
              <Icon
                :name="sliderAccordionOpen ? 'chevron-down' : 'chevron-right'"
                :size="15"
                class="acc-chevron"
              />
            </div>
          </div>

          <Transition name="scale">
            <div v-if="sliderAccordionOpen" class="accordion-body">

              <div class="ios-slider-card">
                <div class="slider-meta">
                  <span class="slider-title">模糊度</span>
                  <span class="slider-pill num">{{ glassBlur }} px</span>
                </div>
                <div class="capsule-track">
                  <div
                    class="capsule-fill"
                    :style="{ width: `${Math.round((glassBlur / 36) * 100)}%` }"
                  />
                  <input
                    type="range"
                    min="0"
                    max="36"
                    step="1"
                    :value="glassBlur"
                    class="capsule-input"
                    @input="setGlassBlur(Number(($event.target as HTMLInputElement).value))"
                  />
                </div>
              </div>

              <div class="ios-slider-card">
                <div class="slider-meta">
                  <span class="slider-title">透光度</span>
                  <span class="slider-pill num">{{ glassAlpha }} %</span>
                </div>
                <div class="capsule-track">
                  <div
                    class="capsule-fill"
                    :style="{ width: `${Math.round(((glassAlpha - 8) / (75 - 8)) * 100)}%` }"
                  />
                  <input
                    type="range"
                    min="8"
                    max="75"
                    step="1"
                    :value="glassAlpha"
                    class="capsule-input"
                    @input="setGlassAlpha(Number(($event.target as HTMLInputElement).value))"
                  />
                </div>
              </div>

              <div class="ios-slider-card">
                <div class="slider-meta">
                  <span class="slider-title">压暗度</span>
                  <span class="slider-pill num">{{ wpDim }} %</span>
                </div>
                <div class="capsule-track">
                  <div
                    class="capsule-fill"
                    :style="{ width: `${Math.round((wpDim / 60) * 100)}%` }"
                  />
                  <input
                    type="range"
                    min="0"
                    max="60"
                    step="1"
                    :value="wpDim"
                    class="capsule-input"
                    @input="setWpDim(Number(($event.target as HTMLInputElement).value))"
                  />
                </div>
              </div>
            </div>
          </Transition>
        </template>
      </div>
    </Card>
  </PageForm>
</template>

<style scoped>

.ctrl-block {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ctrl-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.ctrl-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--c-text-1);
  flex: none;
}

.seg-bar {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 4px;
  flex: 1;
  max-width: 260px;
  padding: 3px;
  border-radius: 12px;
  background: var(--c-surface-2);
  border: 1px solid var(--c-line);
  box-shadow: var(--well-shadow);
}

.seg-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 32px;
  border-radius: 9px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--c-text-2);
  transition: all var(--dur-fast) var(--ease-spring);
}

.seg-pill.is-active {
  background: var(--icon-dome, var(--c-surface));
  color: var(--c-primary-600);
  box-shadow: var(--icon-dome-shadow);
  font-weight: 700;
}
[data-theme='dark'] .seg-pill.is-active {
  color: var(--c-primary-400);
}

.row-sep {
  height: 1px;
  background: var(--c-line);
}

.custom-identity-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.compact-cell {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.cell-label-col {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: none;
}

.cell-title {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--c-text-1);
}

.cell-tag {
  font-size: 10px;
  font-weight: 700;
  color: var(--c-text-3);
}

.cell-sub-tip {
  font-size: 10px;
  color: var(--c-text-3);
}

.cell-action-col {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  justify-content: flex-end;
  max-width: 250px;
}

.compact-input {
  width: 100%;
  min-height: 34px !important;
  padding: 0 10px !important;
  font-size: 13px !important;
  font-weight: 600;
  text-align: right;
  border-radius: 8px !important;
}

.btn-cell-reset {
  font-size: 11px;
  font-weight: 700;
  color: var(--c-primary-600);
  padding: 4px 8px;
  border-radius: 6px;
  background: var(--c-primary-50);
  border: 1px solid rgba(16, 185, 129, 0.25);
  flex: none;
}
[data-theme='dark'] .btn-cell-reset {
  color: var(--c-primary-400);
}

.favicon-col {
  gap: 10px;
}

.favicon-preview-box {
  position: relative;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  overflow: hidden;
  background: var(--c-surface);
  border: 1px solid var(--c-line-strong);
  box-shadow: var(--well-shadow);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex: none;
}

.favicon-img {
  width: 22px;
  height: 22px;
  object-fit: contain;
}

.fav-edit-badge {
  position: absolute;
  right: 1px;
  bottom: 1px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--c-primary-400);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-text-action {
  font-size: 12px;
  font-weight: 600;
  color: var(--c-primary-600);
  padding: 4px 8px;
  border-radius: 6px;
}
[data-theme='dark'] .btn-text-action {
  color: var(--c-primary-400);
}

.wp-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.wp-tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.wp-thumb {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
  border-radius: 14px;
  overflow: hidden;
  border: 2px solid rgba(255, 255, 255, 0.75);
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--c-text-2);
  transition: transform var(--dur-fast) var(--ease-spring),
              border-color var(--dur-fast) ease;
}
[data-theme='dark'] .wp-thumb {
  border-color: rgba(255, 255, 255, 0.2);
}

.wp-tile:hover .wp-thumb {
  transform: translateY(var(--lift-y, 0px));
}

.wp-tile.is-active .wp-thumb {
  border-color: var(--c-primary-400);
  box-shadow: 0 0 0 2px var(--c-primary-400), 0 6px 14px rgba(16, 185, 129, 0.25);
}

.wp-thumb-custom {
  background: var(--c-surface-2);
  border-style: dashed;
}

.wp-badge {
  position: absolute;
  bottom: 5px;
  right: 5px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--c-primary-400);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
}

.wp-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--c-text-2);
}
.wp-tile.is-active .wp-label {
  color: var(--c-primary-600);
  font-weight: 700;
}
[data-theme='dark'] .wp-tile.is-active .wp-label {
  color: var(--c-primary-400);
}

.wp-custom-bar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 14px;
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid var(--c-line);
}

.link-btn {
  font-size: 12px;
  font-weight: 600;
  color: var(--c-primary-600);
}
[data-theme='dark'] .link-btn {
  color: var(--c-primary-400);
}
.link-btn.is-danger {
  color: var(--c-danger);
}

.sr-only-file {
  display: none;
}

.glass-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.switch-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.line-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--c-text-1);
}

.accordion-toggle-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 2px;
  cursor: pointer;
  user-select: none;
}

.acc-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.acc-title {
  font-size: 13.5px;
  font-weight: 700;
  color: var(--c-text-1);
}

.acc-badge {
  font-size: 10.5px;
  font-weight: 800;
  padding: 1px 6px;
  border-radius: 5px;
  background: var(--c-surface-2);
  color: var(--c-text-3);
  border: 1px solid var(--c-line);
}

.acc-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.acc-chevron {
  color: var(--c-text-3);
  transition: transform var(--dur-fast) ease;
}

.btn-reset-params {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 9px;
  border-radius: 99px;
  font-size: 11.5px;
  font-weight: 700;
  color: var(--c-primary-600);
  background: var(--c-primary-50);
  border: 1px solid rgba(16, 185, 129, 0.28);
  transition: all var(--dur-fast) ease;
}
[data-theme='dark'] .btn-reset-params {
  color: var(--c-primary-400);
}
.btn-reset-params:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.accordion-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 4px;
}

.ios-slider-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  border-radius: var(--r-md);
  background: var(--c-surface-2);
  border: 1px solid var(--c-line);
  box-shadow: var(--well-shadow);
}

.slider-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.slider-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--c-text-1);
}

.slider-pill {
  font-size: 11.5px;
  font-weight: 800;
  padding: 1px 7px;
  border-radius: 6px;
  background: var(--c-surface);
  color: var(--c-primary-600);
  border: 1px solid var(--c-line);
}
[data-theme='dark'] .slider-pill {
  color: var(--c-primary-400);
}

.capsule-track {
  position: relative;
  width: 100%;
  height: 24px;
  border-radius: 12px;
  background: rgba(15, 23, 42, 0.08);
  overflow: hidden;
  display: flex;
  align-items: center;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.1);
}
[data-theme='dark'] .capsule-track {
  background: rgba(255, 255, 255, 0.08);
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.4);
}

.capsule-fill {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  border-radius: 12px;
  background: linear-gradient(90deg, #10b981 0%, #059669 100%);
  box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.45);
  pointer-events: none;
  transition: width 0.04s ease;
}

.capsule-input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  opacity: 0;
  cursor: pointer;
  z-index: 2;
}
</style>
