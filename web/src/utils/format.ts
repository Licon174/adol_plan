const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const

export function formatBytes(bytes: number, digits = 1): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  let v = bytes
  let i = 0
  while (v >= 1024 && i < UNITS.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(i === 0 ? 0 : digits)} ${UNITS[i]}`
}

export function formatRate(bytesPerSec: number): string {
  return `${formatBytes(bytesPerSec)}/s`
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0分'
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return h > 0 ? `${d}天${h}小时` : `${d}天`
  if (h > 0) return m > 0 ? `${h}小时${m}分` : `${h}小时`
  return `${Math.max(m, 1)}分`
}

export function formatDbm(dbm: number | null): string {
  return dbm === null ? '— —' : `${dbm} dBm`
}

export function toInt(s: string | undefined, fallback = 0): number {
  if (s === undefined || s === '') return fallback
  const n = Number.parseInt(s, 10)
  return Number.isFinite(n) ? n : fallback
}

export function toNum(s: string | undefined, fallback = 0): number {
  if (s === undefined || s === '') return fallback
  const n = Number.parseFloat(s)
  return Number.isFinite(n) ? n : fallback
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}

export function percentOf(used: number, total: number): number {
  if (!Number.isFinite(total) || total <= 0) return 0
  return clamp(Math.round((used / total) * 100), 0, 100)
}

export const FLOW_MULT_MB = 1
export const FLOW_MULT_GB = 1024

export function flowSizeToMB(s: string | undefined): number | null {
  const raw = (s ?? '').trim()
  if (!raw) return null
  const [a, b] = raw.split('_')
  const v = Number.parseFloat(a ?? '')
  const m = Number.parseFloat(b === undefined ? '' : b)
  const mb = b === undefined ? v : v * (Number.isFinite(m) && m > 0 ? m : NaN)
  return Number.isFinite(mb) && mb > 0 ? mb : null
}

export function buildFlowDataSize(mb: number): string {
  return `${mb}_${FLOW_MULT_MB}`
}

export function flowHoursToMin(s: string | undefined): number | null {
  const h = Number.parseFloat((s ?? '').trim())
  return Number.isFinite(h) && h > 0 ? Math.round(h * 60) : null
}
