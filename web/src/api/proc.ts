import type { StatusKey } from './types'
import { SESSION_PROBE_KEYS } from './types'

export class SessionExpiredError extends Error {
  constructor() {
    super('会话已失效')
    this.name = 'SessionExpiredError'
  }
}

export class DeviceError extends Error {
  constructor(
    message: string,
    readonly raw?: string,
  ) {
    super(message)
    this.name = 'DeviceError'
  }
}

export interface Transport {
  get(keys: readonly StatusKey[]): Promise<Record<string, string>>
  post(
    body: Record<string, string>,
    opts?: { timeoutMs?: number; expectAbort?: boolean },
  ): Promise<Record<string, string>>
}

const DEFAULT_TIMEOUT = 8_000

const MAX_INFLIGHT = 3
const QUEUE_TIMEOUT = 3_000
let inflight = 0
const waiters: Array<() => void> = []

function acquire(): Promise<void> {
  if (inflight < MAX_INFLIGHT) {
    inflight++
    return Promise.resolve()
  }
  return new Promise<void>((resolve, reject) => {
    const go = (): void => {
      clearTimeout(timer)
      inflight++
      resolve()
    }
    const timer = setTimeout(() => {
      const i = waiters.indexOf(go)
      if (i >= 0) waiters.splice(i, 1)
      reject(new DeviceError('设备正忙，请稍后重试'))
    }, QUEUE_TIMEOUT)
    waiters.push(go)
  })
}

function release(): void {
  inflight = Math.max(0, inflight - 1)
  waiters.shift()?.()
}

async function gated<T>(fn: () => Promise<T>): Promise<T> {
  await acquire()
  try {
    return await fn()
  } finally {
    release()
  }
}

async function fetchWithTimeout(
  input: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), timeoutMs)
  try {
    return await fetch(input, { ...init, signal: ac.signal, credentials: 'same-origin' })
  } finally {
    clearTimeout(timer)
  }
}

export const realTransport: Transport = {
  get(keys) {
    if (keys.length === 0) return Promise.resolve({})
    return gated(async () => {
      const q = `cmd=${keys.join(',')}&multi_data=1`
      const res = await fetchWithTimeout(`/reqproc/proc_get?${q}`, { method: 'GET' }, DEFAULT_TIMEOUT)
      if (!res.ok) throw new DeviceError(`proc_get HTTP ${res.status}`)
      const text = await res.text()
      return parseJsonObject(text)
    })
  },

  async post(body, opts) {
    const params = new URLSearchParams(body).toString()
    try {
      return await gated(async () => {
        const res = await fetchWithTimeout(
          '/reqproc/proc_post',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params,
          },
          opts?.timeoutMs ?? DEFAULT_TIMEOUT,
        )
        if (!res.ok) throw new DeviceError(`proc_post HTTP ${res.status}`)
        const text = await res.text()
        return parseJsonObject(text)
      })
    } catch (e) {

      if (opts?.expectAbort && isAbortError(e)) return { result: 'success' }
      throw e
    }
  },
}

function isAbortError(e: unknown): boolean {
  if (e instanceof TypeError) return true
  return e instanceof DOMException && (e.name === 'AbortError' || e.name === 'NetworkError')
}

function parseJsonObject(text: string): Record<string, string> {
  const t = text.trim()
  if (!t) return {}
  try {
    const v: unknown = JSON.parse(t)
    if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, string>
    return {}
  } catch {
    return {}
  }
}

let transport: Transport = realTransport

export function setTransport(t: Transport): void {
  transport = t
}

export function getTransport(): Transport {
  return transport
}

type AuthListener = (authed: boolean) => void

let authed = false
const listeners = new Set<AuthListener>()

export function isAuthed(): boolean {
  return authed
}

export function onAuthChange(fn: AuthListener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function setAuthed(v: boolean): void {
  if (authed === v) return
  authed = v
  for (const fn of listeners) fn(v)
}

export async function getStatus<K extends StatusKey>(
  keys: readonly K[],
): Promise<Record<K, string>> {
  const uniq = Array.from(new Set(keys))
  const raw = await transport.get(uniq)
  const out = {} as Record<K, string>
  for (const k of keys) out[k] = raw[k] ?? ''
  return out
}

export async function post(
  body: Record<string, string>,
  opts?: { timeoutMs?: number; expectAbort?: boolean },
): Promise<Record<string, string>> {
  return transport.post(body, opts)
}

export function isSuccess(res: Record<string, string>): boolean {
  const r = res.result
  return r === 'success' || r === '0' || r === ''
}

export async function login(password: string): Promise<boolean> {
  const res = await post({ goformId: 'LOGIN', password: b64encode(password) })
  const ok = res.result === '0' || res.result === 'success'
  setAuthed(ok)
  return ok
}

export async function logout(): Promise<void> {
  try {
    await post({ goformId: 'LOGOUT' })
  } finally {
    setAuthed(false)
  }
}

export async function probeSession(): Promise<boolean> {
  try {
    const res = await getStatus(SESSION_PROBE_KEYS)
    const alive = SESSION_PROBE_KEYS.some((k) => (res[k] ?? '') !== '')
    setAuthed(alive)
    return alive
  } catch {
    setAuthed(false)
    return false
  }
}

export async function reboot(): Promise<void> {
  try {
    await post({ goformId: 'REBOOT_DEVICE' }, { timeoutMs: 4000, expectAbort: true })
  } catch {

  }
}

export async function getCmdRaw<T = unknown>(cmd: string): Promise<T | null> {
  return gated(async () => {
    const res = await fetchWithTimeout(`/reqproc/proc_get?cmd=${encodeURIComponent(cmd)}`, { method: 'GET' }, DEFAULT_TIMEOUT)
    if (!res.ok) throw new DeviceError(`proc_get HTTP ${res.status}`)
    const text = (await res.text()).trim()
    if (!text) return null
    try {
      return JSON.parse(text) as T
    } catch {
      return null
    }
  })
}

export function b64encode(s: string): string {
  return btoa(String.fromCharCode(...new TextEncoder().encode(s)))
}

export function b64decode(s: string): string {
  try {
    const bin = atob(s)
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
    return new TextDecoder().decode(bytes)
  } catch {
    return ''
  }
}
