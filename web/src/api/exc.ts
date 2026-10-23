import { post } from './proc'

export async function execAt(cmd: string): Promise<boolean> {
  const res = await post({
    goformId: 'ALK_EXC_AT_CMD1',
    AT_CMD1: cmd,
  })
  return res.result === 'success'
}

export async function execSystem(shellCmd: string): Promise<void> {
  await post({
    goformId: 'ALK_EXC_SYSTEM_CMD',
    SYS_CMD: shellCmd,
  })
}

export async function pingAtCond(host = location.hostname, timeoutMs = 3000): Promise<boolean> {
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), timeoutMs)
  try {
    const res = await fetch(`http://${host}:2048/ping`, { signal: ac.signal })
    return res.ok
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}
