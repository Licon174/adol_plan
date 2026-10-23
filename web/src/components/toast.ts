import { reactive } from 'vue'

export type ToastType = 'info' | 'success' | 'error'

export interface ToastItem {
  id: number
  text: string
  type: ToastType
}

const items = reactive<ToastItem[]>([])
let seq = 0

export function toast(text: string, type: ToastType = 'info', duration = 2400): number {
  const id = ++seq
  items.push({ id, text, type })
  if (duration > 0) {
    setTimeout(() => dismissToast(id), duration)
  }
  return id
}

export function dismissToast(id: number): void {
  const i = items.findIndex((t) => t.id === id)
  if (i >= 0) items.splice(i, 1)
}

export function useToasts(): ToastItem[] {
  return items
}
