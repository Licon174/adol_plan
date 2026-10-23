import { onMounted, onUnmounted } from 'vue'

export interface PollingHandle {

  refresh: () => Promise<void>
  start: () => void
  stop: () => void
  isRunning: () => boolean
}

export function usePolling(fn: () => Promise<void> | void, intervalMs = 1000): PollingHandle {
  let timer: number | null = null
  let busy = false
  let disposed = false

  async function tick(): Promise<void> {
    if (disposed || busy) return
    if (document.hidden) return
    busy = true
    try {
      await fn()
    } finally {
      busy = false
    }
  }

  function start(): void {
    if (disposed || timer !== null) return
    timer = window.setInterval(() => void tick(), intervalMs)
  }

  function stop(): void {
    if (timer !== null) {
      window.clearInterval(timer)
      timer = null
    }
  }

  async function refresh(): Promise<void> {
    if (disposed) return
    try {
      await fn()
    } finally {

    }
  }

  function onVisibility(): void {
    if (document.hidden) stop()
    else {
      void tick()
      start()
    }
  }

  onMounted(() => {
    void tick()
    start()
    document.addEventListener('visibilitychange', onVisibility)
  })

  onUnmounted(() => {
    disposed = true
    stop()
    document.removeEventListener('visibilitychange', onVisibility)
  })

  return { refresh, start, stop, isRunning: () => timer !== null }
}
