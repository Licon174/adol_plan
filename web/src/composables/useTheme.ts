import { ref } from 'vue'

const THEME_KEY = 'adol_theme'
const MOTION_KEY = 'adol_motion'
const GLASS_KEY = 'adol_glass'
const TEXTURE_KEY = 'adol_texture'
const WP_ID_KEY = 'adol_wp_id'
const WP_CUSTOM_KEY = 'adol_wp_custom'
const GLASS_BLUR_KEY = 'adol_glass_blur'
const GLASS_ALPHA_KEY = 'adol_glass_alpha'
const WP_DIM_KEY = 'adol_wp_dim'
const HOME_TITLE_KEY = 'adol_title_home'
const LOGIN_TITLE_KEY = 'adol_title_login'
const DOC_TITLE_KEY = 'adol_title_doc'
const FAVICON_KEY = 'adol_custom_favicon'
const LOGIN_MOTION_KEY = 'adol_login_motion'

export const MAX_TITLE_LEN = 16
export const MAX_DOC_TITLE_LEN = 24
export const DEFAULT_GATEWAY_TITLE = 'GATEWAY'
export const DEFAULT_DOC_TITLE = 'Adol-Plan'

export type ThemeMode = 'light' | 'dark' | 'system'
export type MotionLevel = 'full' | 'gentle' | 'off'
export type WallpaperId = 'sequoia' | 'sonoma' | 'obsidian' | 'custom'

const isDark = ref<boolean>(false)
const themeMode = ref<ThemeMode>('system')
const motionLevel = ref<MotionLevel>('full')
const glassEnabled = ref<boolean>(true)
const textureEnabled = ref<boolean>(true)

const wallpaperId = ref<WallpaperId>('sequoia')
const customWallpaper = ref<string>('')
const glassBlur = ref<number>(14)
const glassAlpha = ref<number>(22)
const wpDim = ref<number>(6)

const homeTitle = ref<string>(DEFAULT_GATEWAY_TITLE)
const loginTitle = ref<string>(DEFAULT_GATEWAY_TITLE)
const docTitle = ref<string>(DEFAULT_DOC_TITLE)
const customFavicon = ref<string>('')
const loginMotionEnabled = ref<boolean>(true)

function applyDarkClass(dark: boolean): void {
  isDark.value = dark
  if (dark) {
    document.documentElement.setAttribute('data-theme', 'dark')
  } else {
    document.documentElement.removeAttribute('data-theme')
  }
}

function syncWallpaperDom(): void {
  const root = document.documentElement
  root.setAttribute('data-wp', wallpaperId.value)
  if (wallpaperId.value === 'custom' && customWallpaper.value) {
    const safeUrl = customWallpaper.value.replace(/"/g, '\\"')
    root.style.setProperty('--wp-custom-image', `url("${safeUrl}")`)
  } else {
    root.style.removeProperty('--wp-custom-image')
  }
}

function syncFaviconDom(): void {
  let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']")
  if (!link) {
    link = document.createElement('link')
    link.rel = 'icon'
    document.head.appendChild(link)
  }
  link.href = customFavicon.value || '/favicon.ico'
}

function syncDocTitleDom(): void {
  document.title = docTitle.value || DEFAULT_DOC_TITLE
}

let rafId: number | null = null

function syncLiquidGlassVars(): void {
  if (rafId !== null) return
  rafId = window.requestAnimationFrame(() => {
    rafId = null
    const root = document.documentElement
    root.style.setProperty('--glass-blur', `${glassBlur.value}px`)
    root.style.setProperty('--glass-alpha', (glassAlpha.value / 100).toFixed(2))
    root.style.setProperty('--glass-alpha-low', (Math.max(4, glassAlpha.value - 10) / 100).toFixed(2))
    root.style.setProperty('--glass-alpha-high', (Math.min(92, glassAlpha.value + 16) / 100).toFixed(2))
    root.style.setProperty('--wp-dim', (wpDim.value / 100).toFixed(2))
  })
}

export function setThemeMode(mode: ThemeMode): void {
  themeMode.value = mode
  try {
    localStorage.setItem(THEME_KEY, mode)
  } catch {

  }
  if (mode === 'dark') {
    applyDarkClass(true)
  } else if (mode === 'light') {
    applyDarkClass(false)
  } else {
    const sysDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    applyDarkClass(sysDark)
  }
}

export function setMotionLevel(level: MotionLevel): void {
  motionLevel.value = level
  document.documentElement.setAttribute('data-motion', level)
  try {
    localStorage.setItem(MOTION_KEY, level)
  } catch {

  }
}

export function setGlassEnabled(enabled: boolean): void {
  glassEnabled.value = enabled
  document.documentElement.setAttribute('data-glass', enabled ? 'on' : 'off')
  try {
    localStorage.setItem(GLASS_KEY, enabled ? 'on' : 'off')
  } catch {

  }
}

export function setTextureEnabled(enabled: boolean): void {
  textureEnabled.value = enabled
  document.documentElement.setAttribute('data-texture', enabled ? 'on' : 'off')
  try {
    localStorage.setItem(TEXTURE_KEY, enabled ? 'on' : 'off')
  } catch {

  }
}

export function setWallpaperId(id: WallpaperId): void {
  wallpaperId.value = id
  try {
    localStorage.setItem(WP_ID_KEY, id)
  } catch {

  }
  syncWallpaperDom()
}

export function setCustomWallpaper(dataUrl: string): void {
  customWallpaper.value = dataUrl
  try {
    if (dataUrl) {
      localStorage.setItem(WP_CUSTOM_KEY, dataUrl)
    } else {
      localStorage.removeItem(WP_CUSTOM_KEY)
    }
  } catch {

  }
  if (dataUrl) {
    setWallpaperId('custom')
  } else if (wallpaperId.value === 'custom') {
    setWallpaperId('sequoia')
  } else {
    syncWallpaperDom()
  }
}

export function setGlassBlur(px: number): void {
  glassBlur.value = Math.max(0, Math.min(40, Math.round(px)))
  try {
    localStorage.setItem(GLASS_BLUR_KEY, String(glassBlur.value))
  } catch {

  }
  syncLiquidGlassVars()
}

export function setGlassAlpha(pct: number): void {
  glassAlpha.value = Math.max(6, Math.min(85, Math.round(pct)))
  try {
    localStorage.setItem(GLASS_ALPHA_KEY, String(glassAlpha.value))
  } catch {

  }
  syncLiquidGlassVars()
}

export function setWpDim(pct: number): void {
  wpDim.value = Math.max(0, Math.min(70, Math.round(pct)))
  try {
    localStorage.setItem(WP_DIM_KEY, String(wpDim.value))
  } catch {

  }
  syncLiquidGlassVars()
}

export function setHomeTitle(t: string): void {
  const clean = t.trim().slice(0, MAX_TITLE_LEN)
  homeTitle.value = clean || DEFAULT_GATEWAY_TITLE
  try {
    if (clean && clean !== DEFAULT_GATEWAY_TITLE) {
      localStorage.setItem(HOME_TITLE_KEY, clean)
    } else {
      localStorage.removeItem(HOME_TITLE_KEY)
    }
  } catch {

  }
}

export function setLoginTitle(t: string): void {
  const clean = t.trim().slice(0, MAX_TITLE_LEN)
  loginTitle.value = clean || DEFAULT_GATEWAY_TITLE
  try {
    if (clean && clean !== DEFAULT_GATEWAY_TITLE) {
      localStorage.setItem(LOGIN_TITLE_KEY, clean)
    } else {
      localStorage.removeItem(LOGIN_TITLE_KEY)
    }
  } catch {

  }
}

export function setDocTitle(t: string): void {
  const clean = t.trim().slice(0, MAX_DOC_TITLE_LEN)
  docTitle.value = clean || DEFAULT_DOC_TITLE
  try {
    if (clean && clean !== DEFAULT_DOC_TITLE) {
      localStorage.setItem(DOC_TITLE_KEY, clean)
    } else {
      localStorage.removeItem(DOC_TITLE_KEY)
    }
  } catch {

  }
  syncDocTitleDom()
}

export function setCustomFavicon(dataUrl: string): void {
  customFavicon.value = dataUrl
  try {
    if (dataUrl) {
      localStorage.setItem(FAVICON_KEY, dataUrl)
    } else {
      localStorage.removeItem(FAVICON_KEY)
    }
  } catch {

  }
  syncFaviconDom()
}

export function setLoginMotionEnabled(enabled: boolean): void {
  loginMotionEnabled.value = enabled
  try {
    localStorage.setItem(LOGIN_MOTION_KEY, enabled ? 'on' : 'off')
  } catch {

  }
}

export function compressWallpaperFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('读取图片失败'))
    reader.onload = () => {
      const src = String(reader.result || '')
      const img = new Image()
      img.onerror = () => reject(new Error('解析图片格式失败'))
      img.onload = () => {
        const MAX_SIDE = 1440
        let w = img.naturalWidth || img.width
        let h = img.naturalHeight || img.height
        if (w > MAX_SIDE || h > MAX_SIDE) {
          const ratio = Math.min(MAX_SIDE / w, MAX_SIDE / h)
          w = Math.round(w * ratio)
          h = Math.round(h * ratio)
        }
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(src)
          return
        }
        ctx.drawImage(img, 0, 0, w, h)
        let out = canvas.toDataURL('image/webp', 0.82)
        if (!out.startsWith('data:image/webp') || out.length > 1800000) {
          out = canvas.toDataURL('image/jpeg', 0.8)
        }
        resolve(out)
      }
      img.src = src
    }
    reader.readAsDataURL(file)
  })
}

export function compressFaviconFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('读取图标失败'))
    reader.onload = () => {
      const src = String(reader.result || '')
      const img = new Image()
      img.onerror = () => reject(new Error('解析图标格式失败'))
      img.onload = () => {
        const size = 64
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(src)
          return
        }
        const sw = img.naturalWidth || img.width
        const sh = img.naturalHeight || img.height
        const minSide = Math.min(sw, sh)
        const sx = (sw - minSide) / 2
        const sy = (sh - minSide) / 2
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size)
        resolve(canvas.toDataURL('image/png'))
      }
      img.src = src
    }
    reader.readAsDataURL(file)
  })
}

export function initTheme(): void {
  try {
    const savedTheme = localStorage.getItem(THEME_KEY) as ThemeMode | null
    if (savedTheme === 'dark' || savedTheme === 'light' || savedTheme === 'system') {
      setThemeMode(savedTheme)
    } else {
      setThemeMode('system')
    }
  } catch {
    setThemeMode('light')
  }

  try {
    const savedMotion = localStorage.getItem(MOTION_KEY) as MotionLevel | null
    if (savedMotion === 'full' || savedMotion === 'gentle' || savedMotion === 'off') {
      setMotionLevel(savedMotion)
    } else {
      setMotionLevel('full')
    }
  } catch {
    setMotionLevel('full')
  }

  try {
    const savedGlass = localStorage.getItem(GLASS_KEY)
    setGlassEnabled(savedGlass !== 'off')
  } catch {
    setGlassEnabled(true)
  }

  try {
    const savedTexture = localStorage.getItem(TEXTURE_KEY)
    setTextureEnabled(savedTexture !== 'off')
  } catch {
    setTextureEnabled(true)
  }

  try {
    const savedCustom = localStorage.getItem(WP_CUSTOM_KEY) || ''
    customWallpaper.value = savedCustom
    const savedWp = localStorage.getItem(WP_ID_KEY) as WallpaperId | null
    const validIds: WallpaperId[] = ['sequoia', 'sonoma', 'obsidian', 'custom']
    if (savedWp && validIds.includes(savedWp)) {
      if (savedWp === 'custom' && !savedCustom) {
        wallpaperId.value = 'sequoia'
      } else {
        wallpaperId.value = savedWp
      }
    }
  } catch {
    wallpaperId.value = 'sequoia'
  }

  try {
    const b = Number(localStorage.getItem(GLASS_BLUR_KEY))
    if (!Number.isNaN(b) && localStorage.getItem(GLASS_BLUR_KEY) !== null) {
      glassBlur.value = Math.max(0, Math.min(40, b))
    }
    const a = Number(localStorage.getItem(GLASS_ALPHA_KEY))
    if (!Number.isNaN(a) && localStorage.getItem(GLASS_ALPHA_KEY) !== null) {
      glassAlpha.value = Math.max(6, Math.min(85, a))
    }
    const d = Number(localStorage.getItem(WP_DIM_KEY))
    if (!Number.isNaN(d) && localStorage.getItem(WP_DIM_KEY) !== null) {
      wpDim.value = Math.max(0, Math.min(70, d))
    }
  } catch {

  }

  try {
    const ht = localStorage.getItem(HOME_TITLE_KEY)
    if (ht) homeTitle.value = ht.slice(0, MAX_TITLE_LEN)
    const lt = localStorage.getItem(LOGIN_TITLE_KEY)
    if (lt) loginTitle.value = lt.slice(0, MAX_TITLE_LEN)
    const dt = localStorage.getItem(DOC_TITLE_KEY)
    if (dt) docTitle.value = dt.slice(0, MAX_DOC_TITLE_LEN)
    const fv = localStorage.getItem(FAVICON_KEY)
    if (fv) customFavicon.value = fv
    const lm = localStorage.getItem(LOGIN_MOTION_KEY)
    loginMotionEnabled.value = lm !== 'off'
  } catch {

  }

  syncWallpaperDom()
  syncLiquidGlassVars()
  syncDocTitleDom()
  syncFaviconDom()
}

export function toggleTheme(): void {
  setThemeMode(isDark.value ? 'light' : 'dark')
}

export function useTheme() {
  return {
    isDark,
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
    toggleTheme,
  }
}
