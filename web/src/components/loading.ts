import { reactive } from 'vue'
import { toast } from './toast'

export const loadingState = reactive({
  visible: false,
  text: '',

  elapsed: 0,

  canCancel: false,
})

const CANCEL_AFTER_MS = 8_000

const FORCE_CLOSE_MS = 15_000

let tickTimer: number | null = null
function stopTick(): void {
  if (tickTimer !== null) {
    clearInterval(tickTimer)
    tickTimer = null
  }
}

export function resetLoading(): void {
  stopTick()
  pending.clear()
  depth = 0
  loadingState.visible = false
  loadingState.text = ''
  loadingState.elapsed = 0
  loadingState.canCancel = false
}

interface PendingCall {
  text: string
  stack: string
  at: number
}
const pending = new Map<number, PendingCall>()
let seq = 0
let warnTimer: number | null = null

const LEAK_WARN_MS = 10_000

function scheduleWarn(): void {
  if (warnTimer !== null || pending.size === 0) return
  const first = pending.values().next().value as PendingCall | undefined
  if (!first) return
  const wait = Math.max(1000, LEAK_WARN_MS - (Date.now() - first.at))
  warnTimer = window.setTimeout(() => {
    warnTimer = null
    if (pending.size === 0) return
    const list = [...pending.values()]
    console.error(
      `[loading] 遮罩已持续 ${Math.round((Date.now() - list[0].at) / 1000)}s，` +
        `疑似 ${list.length} 处未配对：\n` +
        list.map((c) => `  · ${c.text || '(无文案)'}\n${c.stack}`).join('\n'),
    )
  }, wait)
}

let depth = 0

export function showLoading(text = ''): void {
  const id = ++seq
  pending.set(id, { text, stack: new Error().stack ?? '(无栈)', at: Date.now() })
  depth++
  loadingState.text = text
  loadingState.visible = true
  if (tickTimer === null) {
    const t0 = Date.now()
    tickTimer = window.setInterval(() => {
      const ms = Date.now() - t0
      loadingState.elapsed = Math.round(ms / 1000)
      if (ms >= CANCEL_AFTER_MS) loadingState.canCancel = true
      if (ms >= FORCE_CLOSE_MS) {
        const what = loadingState.text || '未知操作'
        resetLoading()
        toast(`「${what}」等待超时，已退出等待（设备可能仍在处理）`, 'error', 4000)
      }
    }, 500)
  }
  scheduleWarn()
}

export function hideLoading(): void {

  const first = pending.keys().next().value
  if (first !== undefined) pending.delete(first)
  depth = Math.max(0, depth - 1)
  if (depth === 0) {
    stopTick()
    loadingState.visible = false
    loadingState.text = ''
    loadingState.elapsed = 0
    loadingState.canCancel = false
  }
}

export async function withLoading<T>(fn: () => Promise<T>, text = ''): Promise<T> {
  showLoading(text)
  try {
    return await fn()
  } finally {
    hideLoading()
  }
}
