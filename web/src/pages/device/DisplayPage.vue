<script setup lang="ts">import { computed, onUnmounted, ref } from 'vue'
import { execSystem, post } from '@/api'
import { toast } from '@/components/toast'
import { confirm } from '@/components/confirm'
import { withLoading } from '@/components/loading'
import PageForm from '@/layouts/PageForm.vue'
import Card from '@/components/Card.vue'
import Icon from '@/components/Icon.vue'

const MMI = '/etc_ro/mmi'
const CHUNK = 3200
const SCREEN = 128
const DEFAULT_TASKS =
  'net_task+ctrl_task+wifi_task+traffic_task+key_task+battery_task+tip_task+tipwps_task+tipwifistation_task+tipfota_task+tipnetconnect_task+wificode_task+ssid_task+sms_task+provider_task'

const ANIM_DEF = {
  on: { n: 11, pre: 'image_poweron_', label: '开机' },
  off: { n: 10, pre: 'image_poweroff_', label: '关机' },
  charge: { n: 6, pre: 'poweroff_charging', label: '充电' },
} as const

type AnimKind = keyof typeof ANIM_DEF

const TASKS = [
  { id: 'battery_task', label: '电池' },
  { id: 'net_task', label: '信号与网络' },
  { id: 'wifi_task', label: 'WiFi 状态' },
  { id: 'ctrl_task', label: '时间日期' },
  { id: 'traffic_task', label: '流量统计' },
  { id: 'key_task', label: '按键响应' },
  { id: 'tip_task', label: '通用提示' },
  { id: 'tipwps_task', label: 'WPS 提示' },
  { id: 'tipwifistation_task', label: '中继提示' },
  { id: 'tipfota_task', label: '升级提示' },
  { id: 'tipnetconnect_task', label: '联网提示' },
  { id: 'wificode_task', label: 'WiFi 二维码' },
  { id: 'ssid_task', label: 'SSID 显示' },
  { id: 'sms_task', label: '短信图标' },
  { id: 'provider_task', label: '运营商名称' },
]

const selected = ref<Set<string>>(new Set())
const savedTasks = ref('')
const loading = ref(true)
const error = ref('')
const busy = ref(false)
const state = ref('RGB565')
const tick = ref(Date.now())

async function readText(url: string): Promise<string> {
  try {
    const r = await fetch(`${url}?r=${Date.now()}`, { cache: 'no-store' })
    return r.ok ? await r.text() : ''
  } catch {
    return ''
  }
}

const parseTask = (t: string) => (t ?? '').split(/[+\s,]+/).map((x) => x.trim()).filter(Boolean)

async function load(): Promise<void> {
  loading.value = true
  try {
    await execSystem(
      'nv get mmi_task_tab > /mnt/userdata/lcd_task_tab.txt 2>/dev/null ; chmod 644 /mnt/userdata/lcd_task_tab.txt',
    )
    const cur = await readText('./lcd_task.txt')
    await execSystem('rm -f /mnt/userdata/lcd_task_tab.txt')

    const list = parseTask(cur)
    selected.value = new Set(list.length ? list : parseTask(DEFAULT_TASKS))
    savedTasks.value = TASKS.map((t) => t.id).filter((id) => selected.value.has(id)).join('+')
    state.value = 'RGB565'
    error.value = ''
    tick.value = Date.now()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '读取失败'
  } finally {
    loading.value = false
  }
}
void load()

const has = (id: string) => selected.value.has(id)
const taskValue = computed(() => TASKS.map((t) => t.id).filter(has).join('+'))
const tasksDirty = computed(() => taskValue.value !== savedTasks.value)

function toggle(id: string): void {
  const s = new Set(selected.value)
  if (s.has(id)) s.delete(id)
  else s.add(id)
  selected.value = s
}

function resetTasks(): void {
  selected.value = new Set(parseTask(DEFAULT_TASKS))
  toast('已载入默认屏幕组件组合')
}

interface Frame {
  url: string
  bytes: Uint8Array
}

function dataUrlToBytes(u: string): Uint8Array {
  const b = atob(u.slice(u.indexOf(',') + 1))
  const out = new Uint8Array(b.length)
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i)
  return out
}

function drawScreen(img: HTMLImageElement, zoom = 1): Frame {
  const c = document.createElement('canvas')
  c.width = SCREEN
  c.height = SCREEN
  const g = c.getContext('2d')!
  g.fillStyle = '#000'
  g.fillRect(0, 0, SCREEN, SCREEN)
  const s = Math.max(SCREEN / img.width, SCREEN / img.height) * zoom
  const w = img.width * s
  const h = img.height * s
  g.drawImage(img, (SCREEN - w) / 2, (SCREEN - h) / 2, w, h)
  const url = c.toDataURL('image/png')
  return { url, bytes: dataUrlToBytes(url) }
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const fr = new FileReader()
    fr.onload = () => {
      const im = new Image()
      im.onload = () => res(im)
      im.onerror = () => rej(new Error('图片解码失败，请确认是否为有效图片格式'))
      im.src = String(fr.result)
    }
    fr.onerror = () => rej(new Error('文件读取失败'))
    fr.readAsDataURL(file)
  })
}

function pickImages(multiple: boolean): Promise<File[] | null> {
  return new Promise((res) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.multiple = multiple
    input.onchange = () => res(input.files?.length ? Array.from(input.files) : null)
    input.click()
  })
}

function toHexEscapes(b: Uint8Array): string {
  let s = ''
  for (let i = 0; i < b.length; i++) s += '\\x' + b[i].toString(16).padStart(2, '0')
  return s
}

async function uploadBytes(b: Uint8Array, path: string): Promise<void> {
  const tmp = '/tmp/mmi_upload.tmp'
  const esc = toHexEscapes(b)
  let off = 0
  while (off < b.length) {
    const end = Math.min(off + CHUNK, b.length)
    await execSystem(`printf '${esc.substr(off * 4, (end - off) * 4)}' ${off === 0 ? '>' : '>>'} ${tmp}`)
    off = end
  }

  await execSystem(`[ -s ${tmp} ] && cp -f ${tmp} ${path} ; rm -f ${tmp}`)
}

const pendingBg = ref<Frame | null>(null)
const bgSource = ref<HTMLImageElement | null>(null)
const bgZoom = ref(100)

const pendingFrames = ref<Record<string, Frame>>({})

const previewPlaying = ref<AnimKind | null>(null)
const playerFrame = ref(0)
let playerTimer: number | null = null

function stopPlayer(): void {
  if (playerTimer !== null) {
    clearInterval(playerTimer)
    playerTimer = null
  }
  previewPlaying.value = null
  playerFrame.value = 0
}

function startPlayer(kind: AnimKind): void {
  stopPlayer()
  previewPlaying.value = kind
  playerFrame.value = 0
  const speed = kind === 'charge' ? 240 : 150
  playerTimer = window.setInterval(() => {
    const total = ANIM_DEF[kind].n
    playerFrame.value = (playerFrame.value + 1) % total
  }, speed)
}

function togglePlay(kind: AnimKind): void {
  if (previewPlaying.value === kind && playerTimer !== null) {
    stopPlayer()
  } else {
    startPlayer(kind)
  }
}

function stepFrame(kind: AnimKind, delta: number): void {
  if (playerTimer !== null) {
    clearInterval(playerTimer)
    playerTimer = null
  }
  previewPlaying.value = kind
  const total = ANIM_DEF[kind].n
  playerFrame.value = (playerFrame.value + delta + total) % total
}

onUnmounted(() => {
  stopPlayer()
})

const pendingCount = computed(() => Object.keys(pendingFrames.value).length + (pendingBg.value ? 1 : 0))
const dirty = computed(() => pendingCount.value > 0 || tasksDirty.value)

const frameKey = (kind: AnimKind, i: number) => `${kind}-${i}`

function frameSrc(kind: AnimKind, i: number): string {
  const p = pendingFrames.value[frameKey(kind, i)]
  return p ? p.url : `./lcd_anim/${ANIM_DEF[kind].pre}${i}.png?r=${tick.value}`
}

const isPendingFrame = (kind: AnimKind, i: number) => !!pendingFrames.value[frameKey(kind, i)]
const frames = (kind: AnimKind) => Array.from({ length: ANIM_DEF[kind].n }, (_, i) => i)

async function pickBg(): Promise<void> {
  const files = await pickImages(false)
  if (!files) return
  try {
    const img = await loadImage(files[0])
    bgSource.value = img
    bgZoom.value = 100
    pendingBg.value = drawScreen(img, 1)
    toast('已选择新背景（暂存中，点保存后生效）', 'success')
  } catch (e) {
    toast(e instanceof Error ? e.message : '读取失败', 'error')
  }
}

function applyZoom(): void {
  if (!bgSource.value) return
  pendingBg.value = drawScreen(bgSource.value, bgZoom.value / 100)
}

function clearBg(): void {
  pendingBg.value = null
  bgSource.value = null
}

async function pickFrames(kind: AnimKind, start: number): Promise<void> {
  const n = ANIM_DEF[kind].n
  const rawFiles = await pickImages(true)
  if (!rawFiles) return

  const files = [...rawFiles].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }),
  )
  const room = n - start
  if (files.length > room) {
    toast(`从第 ${start + 1} 帧起只剩 ${room} 个位置，但选择了 ${files.length} 张图片`, 'error')
    return
  }
  try {
    const imgs = await Promise.all(files.map(loadImage))
    const next = { ...pendingFrames.value }
    imgs.forEach((im, k) => {
      next[frameKey(kind, start + k)] = drawScreen(im, 1)
    })
    pendingFrames.value = next
    toast(`已暂存 ${ANIM_DEF[kind].label}动画 第 ${start + 1}–${start + imgs.length} 帧`, 'success')
  } catch (e) {
    toast(e instanceof Error ? e.message : '处理失败', 'error')
  }
}

async function reverseOrder(kind: AnimKind): Promise<void> {
  const n = ANIM_DEF[kind].n
  try {
    const framesData: Frame[] = []
    for (let i = 0; i < n; i++) {
      const p = pendingFrames.value[frameKey(kind, i)]
      if (p) {
        framesData.push(p)
      } else {
        const url = `./lcd_anim/${ANIM_DEF[kind].pre}${i}.png?r=${tick.value}`
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const m = new Image()
          m.onload = () => resolve(m)
          m.onerror = reject
          m.src = url
        })
        framesData.push(drawScreen(img, 1))
      }
    }
    framesData.reverse()
    const next = { ...pendingFrames.value }
    framesData.forEach((f, i) => {
      next[frameKey(kind, i)] = f
    })
    pendingFrames.value = next
    toast(`已反转 ${ANIM_DEF[kind].label}动画 全部帧序（暂存中）`, 'success')
  } catch (e) {
    toast(e instanceof Error ? e.message : '反转失败', 'error')
  }
}

function clearFrames(kind: AnimKind): void {
  const next: Record<string, Frame> = {}
  for (const [k, v] of Object.entries(pendingFrames.value)) {
    if (!k.startsWith(`${kind}-`)) next[k] = v
  }
  pendingFrames.value = next
  toast(`已撤销${ANIM_DEF[kind].label}动画未保存的修改`)
}

const pendingOf = (kind: AnimKind) =>
  Object.keys(pendingFrames.value).filter((k) => k.startsWith(`${kind}-`)).length

const pendingSummary = computed(() => {
  const parts: string[] = []
  if (pendingBg.value) parts.push('背景图')
  const onN = pendingOf('on')
  if (onN) parts.push(`开机${onN}帧`)
  const offN = pendingOf('off')
  if (offN) parts.push(`关机${offN}帧`)
  const chgN = pendingOf('charge')
  if (chgN) parts.push(`充电${chgN}帧`)
  if (tasksDirty.value) parts.push('组件配置')
  return parts.join(' + ') || '无改动'
})

function resetAll(): void {
  stopPlayer()
  clearBg()
  clearFrames('on')
  clearFrames('off')
  clearFrames('charge')
  selected.value = new Set(parseTask(savedTasks.value))
  toast('已放弃所有未保存修改')
}

type ViewTab = 'bg' | 'on' | 'off' | 'charge'
const activeTab = ref<ViewTab>('bg')
const showCompOverlay = ref(true)

function selectTab(tab: ViewTab): void {
  stopPlayer()
  activeTab.value = tab
  if (tab !== 'bg') {
    startPlayer(tab)
  }
}

const currentPreviewSrc = computed(() => {
  if (activeTab.value === 'bg') {
    return pendingBg.value ? pendingBg.value.url : `./lcd_bg.png?r=${tick.value}`
  }
  return frameSrc(activeTab.value, playerFrame.value)
})

function stepActive(delta: number): void {
  if (activeTab.value === 'bg') return
  stepFrame(activeTab.value, delta)
}

function toggleActive(): void {
  if (activeTab.value === 'bg') return
  togglePlay(activeTab.value)
}

async function rebootOnly(): Promise<void> {
  const ok = await confirm({
    title: '重启设备',
    message: '确定要立即重启设备吗？',
    danger: true,
  })
  if (!ok) return
  busy.value = true
  try {
    toast('正在发送重启指令…', 'success')
    await post({ goformId: 'REBOOT_DEVICE' }, { timeoutMs: 4000, expectAbort: true })
  } catch {

  } finally {
    busy.value = false
  }
}

async function saveAndReboot(): Promise<void> {
  if (!dirty.value) {
    toast('没有待保存的改动', 'error')
    return
  }
  const n = pendingCount.value
  const ok = await confirm({
    title: '保存并重启',
    message:
      (n ? `将写入 ${n} 张图片到系统分区` : '仅保存组件设置') +
      '，写入后将自动重启设备。',
    danger: true,
  })
  if (!ok) return

  busy.value = true
  try {
    await withLoading(async () => {
      if (pendingCount.value > 0) {
        await execSystem('mount -o remount,rw /')
        try {
          if (pendingBg.value) {
            await uploadBytes(pendingBg.value.bytes, `${MMI}/first_background.png`)
            await uploadBytes(pendingBg.value.bytes, `${MMI}/second_background.png`)
          }
          for (const [k, f] of Object.entries(pendingFrames.value)) {
            const [kind, idx] = k.split('-')
            await uploadBytes(f.bytes, `${MMI}/${ANIM_DEF[kind as AnimKind].pre}${idx}.png`)
          }
        } finally {
          await execSystem('sync ; mount -o remount,ro /')
        }
      }
      if (tasksDirty.value) {
        await execSystem(`nv set mmi_task_tab=${taskValue.value} ; nv save`)
      }
    }, '正在写入设备，请勿断电…')

    toast('写入完成，设备正在重启…', 'success')
    try {
      await post({ goformId: 'REBOOT_DEVICE' }, { timeoutMs: 4000, expectAbort: true })
    } catch {

    }
  } catch (e) {
    toast(e instanceof Error ? e.message : '保存失败', 'error')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <PageForm title="屏幕与动效" :loading="loading" :error="error" :savable="false">
    <template #right>
      <button type="button" class="icon-btn" aria-label="刷新" :disabled="busy" @click="load">
        <Icon name="refresh" :size="20" />
      </button>
    </template>

    <div class="display-container">

      <Card title="屏幕背景与动画">

        <div class="view-tabs">
          <button
            type="button"
            class="tab-pill"
            :class="{ 'is-active': activeTab === 'bg' }"
            @click="selectTab('bg')"
          >
            <span>背景图</span>
            <span v-if="pendingBg" class="tab-dot" />
          </button>
          <button
            type="button"
            class="tab-pill"
            :class="{ 'is-active': activeTab === 'on' }"
            @click="selectTab('on')"
          >
            <span>开机 (11帧)</span>
            <span v-if="pendingOf('on')" class="tab-dot" />
          </button>
          <button
            type="button"
            class="tab-pill"
            :class="{ 'is-active': activeTab === 'off' }"
            @click="selectTab('off')"
          >
            <span>关机 (10帧)</span>
            <span v-if="pendingOf('off')" class="tab-dot" />
          </button>
          <button
            type="button"
            class="tab-pill"
            :class="{ 'is-active': activeTab === 'charge' }"
            @click="selectTab('charge')"
          >
            <span>充电 (6帧)</span>
            <span v-if="pendingOf('charge')" class="tab-dot" />
          </button>
        </div>

        <div class="viewport-box">
          <div class="lcd-bezel-frame">
            <div class="lcd-screen-inner">
              <img class="screen-img" :src="currentPreviewSrc" alt="屏幕实时预览" />

              <svg v-if="activeTab === 'bg' && showCompOverlay" class="comp-overlay-svg" viewBox="0 0 128 128" preserveAspectRatio="none">

                <g v-if="has('battery_task')">
                  <rect x="48" y="2" width="28" height="14" rx="2" fill="none" stroke="#fff" stroke-width="1.5" />
                  <rect x="77" y="6" width="3" height="6" rx="1" fill="#fff" />
                  <rect x="50" y="4" width="18" height="10" rx="1" fill="#6f6" />
                </g>

                <g v-if="has('net_task')">
                  <rect x="25" y="91" width="4" height="7" fill="#fff" />
                  <rect x="30" y="88" width="4" height="10" fill="#fff" />
                  <rect x="35" y="85" width="4" height="13" fill="#fff" />
                  <rect x="40" y="82" width="4" height="16" fill="#fff" />
                </g>

                <g v-if="has('wifi_task')">
                  <path d="M71 88A16 16 0 0 1 95 88" fill="none" stroke="#fff" stroke-width="2" />
                  <path d="M76 93A10 10 0 0 1 90 93" fill="none" stroke="#fff" stroke-width="2" />
                  <circle cx="83" cy="97" r="2" fill="#fff" />
                </g>

                <g v-if="has('ctrl_task')">
                  <text x="64" y="34" text-anchor="middle" font-size="13" fill="#fff" font-family="sans-serif">06:01</text>
                  <text x="64" y="47" text-anchor="middle" font-size="8" fill="#fff" font-family="sans-serif">9月18日 周五</text>
                </g>
              </svg>
              <div class="screen-glare" />
            </div>
          </div>

          <div class="viewport-info">

            <template v-if="activeTab === 'bg'">
              <div class="target-title-row">
                <span class="target-title">first_background.png</span>
                <button
                  type="button"
                  class="overlay-toggle-pill"
                  :class="{ 'is-active': showCompOverlay }"
                  title="切换实时组件覆盖"
                  @click="showCompOverlay = !showCompOverlay"
                >
                  <Icon name="monitor" :size="13" />
                  <span>{{ showCompOverlay ? '组件覆盖' : '纯背景' }}</span>
                </button>
              </div>
              <div class="t-cap num">128 × 128 · RGB565</div>
              <div class="t-cap" :class="{ 't-primary': pendingBg }">
                {{ pendingBg ? '已选新图 (暂存)' : '出厂背景' }}
              </div>

              <div v-if="pendingBg" class="zoom-row">
                <span class="t-cap">缩放</span>
                <input v-model.number="bgZoom" type="range" min="10" max="300" :disabled="busy" @input="applyZoom" />
                <span class="t-cap num">{{ bgZoom }}%</span>
              </div>

              <div class="target-actions">
                <button type="button" class="btn btn-secondary flex-1" :disabled="busy" @click="pickBg">
                  {{ pendingBg ? '重选' : '选择图片 (128×128)' }}
                </button>
                <button v-if="pendingBg" type="button" class="btn btn-danger btn-compact" :disabled="busy" @click="clearBg">
                  撤销
                </button>
              </div>
            </template>

            <template v-else>
              <div class="target-title">{{ ANIM_DEF[activeTab].label }}动画</div>
              <div class="t-cap num">
                第 {{ playerFrame + 1 }} / {{ ANIM_DEF[activeTab].n }} 帧
                <span v-if="pendingOf(activeTab)" class="pending-text">({{ pendingOf(activeTab) }} 帧待存)</span>
              </div>

              <div class="playback-bar">
                <button type="button" class="btn-step" title="上一帧" @click="stepActive(-1)">‹</button>
                <button type="button" class="btn-play-pause" @click="toggleActive">
                  <Icon :name="previewPlaying === activeTab && playerTimer !== null ? 'pause' : 'play'" :size="13" />
                  <span>{{ previewPlaying === activeTab && playerTimer !== null ? '暂停' : '播放' }}</span>
                </button>
                <button type="button" class="btn-step" title="下一帧" @click="stepActive(1)">›</button>
              </div>

              <div class="target-actions">
                <button type="button" class="btn btn-secondary flex-1" :disabled="busy" @click="pickFrames(activeTab, 0)">
                  批量替换全部帧
                </button>
                <button type="button" class="btn btn-ghost btn-compact" :disabled="busy" title="倒序反转" @click="reverseOrder(activeTab)">
                  翻转
                </button>
                <button v-if="pendingOf(activeTab)" type="button" class="btn btn-danger btn-compact" :disabled="busy" @click="clearFrames(activeTab)">
                  撤销
                </button>
              </div>
            </template>
          </div>
        </div>

        <div v-if="activeTab !== 'bg'" class="film-reel">
          <div class="strip">
            <button
              v-for="i in frames(activeTab)"
              :key="i"
              type="button"
              class="cell"
              :class="{
                'is-pending': isPendingFrame(activeTab, i),
                'is-current-frame': playerFrame === i,
              }"
              :disabled="busy"
              :title="`第 ${i + 1} 帧 (点击替换单帧)`"
              @click="pickFrames(activeTab, i)"
            >
              <img class="thumb" :src="frameSrc(activeTab, i)" :alt="`第 ${i + 1} 帧`" />
              <span class="frame-idx num">#{{ i + 1 }}</span>
            </button>
          </div>
        </div>
      </Card>

      <Card>
        <template #header>
          <div class="comp-head">
            <span class="comp-title">屏幕显示组件</span>
            <button type="button" class="link-btn" :disabled="busy" @click="resetTasks">
              恢复默认
            </button>
          </div>
        </template>

        <div class="checks">
          <label
            v-for="t in TASKS"
            :key="t.id"
            class="check-item"
            :class="{ 'is-checked': has(t.id) }"
          >
            <input
              type="checkbox"
              class="check-box"
              :checked="has(t.id)"
              :disabled="busy"
              @change="toggle(t.id)"
            />
            <span class="check-label">{{ t.label }}</span>
          </label>
        </div>
      </Card>

      <Card title="生效与重启">
        <div class="save-actions">
          <button
            type="button"
            class="btn btn-primary btn-block btn-lg"
            :disabled="busy || !dirty"
            @click="saveAndReboot"
          >
            {{ busy ? '写入中…' : dirty ? `保存并重启 (${pendingSummary})` : '配置最新' }}
          </button>

          <div v-if="dirty" class="btn-row mt-2">
            <button type="button" class="btn btn-ghost flex-1" :disabled="busy" @click="resetAll">
              放弃修改
            </button>
          </div>
          <div v-else class="btn-row mt-2">
            <button type="button" class="btn btn-ghost flex-1" :disabled="busy" @click="rebootOnly">
              重启设备
            </button>
          </div>
        </div>
      </Card>
    </div>
  </PageForm>
</template>

<style scoped>
.display-container {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  padding-bottom: var(--sp-6);
}

.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--r-md);
  color: var(--c-text-1);
  background: var(--c-surface);
  border: 1px solid var(--c-line);
  box-shadow: var(--shadow-sm);
  transition: all 0.15s cubic-bezier(0.2, 0, 0, 1);
}
.icon-btn:active {
  transform: scale(0.92);
}

.view-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: var(--sp-3);
  padding-bottom: var(--sp-2);
  border-bottom: 1px solid var(--c-line);
}

.tab-pill {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: var(--r-full);
  font-size: 12px;
  font-weight: 600;
  background: var(--c-surface-2);
  color: var(--c-text-2);
  border: 1px solid var(--c-line);
  transition: all 0.15s ease;
  cursor: pointer;
}
.tab-pill:hover {
  border-color: var(--c-primary-400);
}
.tab-pill.is-active {
  background: var(--c-primary-50);
  color: var(--c-primary-600);
  border-color: rgba(27, 165, 121, 0.3);
}

.tab-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--c-primary-400);
}

.viewport-box {
  display: flex;
  align-items: center;
  gap: var(--sp-4);
  padding: var(--sp-1) 0;
}

@media (max-width: 480px) {
  .viewport-box {
    flex-direction: column;
    align-items: flex-start;
  }
}

.lcd-bezel-frame {
  width: 144px;
  height: 144px;
  flex: none;
  border-radius: 18px;
  background: #111815;
  padding: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35), inset 0 1px 1px rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
}

.lcd-screen-inner {
  position: relative;
  width: 128px;
  height: 128px;
  border-radius: 8px;
  overflow: hidden;
  background: #000000;
  border: 1px solid rgba(0, 0, 0, 0.8);
}

.comp-overlay-svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 2;
}

.screen-glare {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, transparent 60%);
  z-index: 3;
}

.screen-img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.viewport-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
  min-width: 0;
}

.target-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.target-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--c-text-1);
}

.overlay-toggle-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: var(--r-full);
  font-size: 11px;
  font-weight: 600;
  background: var(--c-surface-2);
  border: 1px solid var(--c-line);
  color: var(--c-text-2);
  transition: all 0.15s ease;
  cursor: pointer;
}
.overlay-toggle-pill.is-active {
  background: var(--c-primary-50);
  border-color: rgba(27, 165, 121, 0.3);
  color: var(--c-primary-600);
}

.pending-text {
  color: var(--c-primary-600);
  font-weight: 600;
}

.zoom-row {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  margin-top: 2px;
}
.zoom-row input {
  flex: 1;
}

.playback-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 4px 0;
}

.btn-step {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--r-sm);
  background: var(--c-surface-2);
  border: 1px solid var(--c-line);
  color: var(--c-text-1);
  font-size: 16px;
  font-weight: 700;
}
.btn-step:active {
  transform: scale(0.92);
}

.btn-play-pause {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 14px;
  border-radius: var(--r-sm);
  background: var(--c-primary-50);
  border: 1px solid rgba(27, 165, 121, 0.25);
  color: var(--c-primary-600);
  font-size: 12px;
  font-weight: 600;
}
.btn-play-pause:active {
  transform: scale(0.94);
}

.target-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
}

.film-reel {
  background: #0d1411;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--r-md);
  padding: 8px;
  margin-top: var(--sp-3);
  box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.4);
}

.strip {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scroll-snap-type: x proximity;
  padding-bottom: 2px;
}

.cell {
  flex: none;
  width: 84px;
  padding: 4px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--r-sm);
  background: #151f1a;
  scroll-snap-align: start;
  text-align: center;
  transition: all 0.15s ease;
  cursor: pointer;
}
.cell:hover {
  background: #1c2923;
}
.cell.is-pending {
  border-color: var(--c-primary-400);
  background: rgba(27, 165, 121, 0.15);
}
.cell.is-current-frame {
  border-color: var(--c-primary-400);
  box-shadow: 0 0 10px rgba(27, 165, 121, 0.4);
}

.thumb {
  display: block;
  width: 74px;
  height: 74px;
  object-fit: cover;
  border-radius: 4px;
  background: #000000;
  margin: 0 auto;
}

.frame-idx {
  display: block;
  margin-top: 3px;
  font-size: 10px;
  font-weight: 600;
  color: #6b8577;
}
.cell.is-current-frame .frame-idx {
  color: #34d399;
}

.comp-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}
.comp-title {
  font-size: var(--fs-sub);
  font-weight: 600;
  color: var(--c-text-1);
}
.link-btn {
  font-size: 11px;
  color: var(--c-primary-600);
  font-weight: 600;
}

.checks {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  margin-top: var(--sp-2);
}

.check-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border: 1px solid var(--c-line);
  border-radius: var(--r-sm);
  background: var(--c-surface);
  cursor: pointer;
  user-select: none;
  font-size: 11.5px;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: all 0.15s ease;
}
.check-item.is-checked {
  border-color: var(--c-primary-400);
  background: var(--c-primary-50);
  color: var(--c-primary-800);
  font-weight: 600;
}
.check-box {
  width: 14px;
  height: 14px;
  accent-color: var(--c-primary-400);
}

.save-actions {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}
.btn-compact {
  padding: 0 12px;
  font-size: 12px;
}
.mt-2 {
  margin-top: 6px;
}
</style>
