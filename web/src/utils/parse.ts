export interface ScannedNetwork {

  state: number

  shortName: string

  numeric: string

  rat: number

  subAct: number
}

export function parseNetSelectContents(raw: string): ScannedNetwork[] {
  const s = (raw ?? '').trim()
  if (!s) return []

  const normalized = s
    .split(';')
    .filter((seg) => seg !== '')
    .map((seg) => (seg.split(',').length === 4 ? `${seg},NON` : seg))
    .join(';')

  const re = /([^,;]*),([^,]*),([^,]*),([^,]*),([^,;]*)/g
  const out: ScannedNetwork[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(normalized)) !== null) {
    out.push({
      state: Number.parseInt(m[1] ?? '', 10) || 0,
      shortName: (m[2] ?? '').replace(/"/g, ''),
      numeric: (m[3] ?? '').replace(/\D/g, ''),
      rat: Number.parseInt(m[4] ?? '', 10) || 0,
      subAct: Number.parseInt(m[5] ?? '', 10) || 0,
    })
  }
  return out
}

export function ratLabel(rat: number): string {
  switch (rat) {
    case 7:
      return '4G / LTE'
    case 2:
      return '3G / WCDMA'
    case 0:
      return '自动'
    default:
      return `制式 ${rat}`
  }
}

export interface Station {
  mac: string
  hostname: string
  ip: string
}

export function parseStationList(raw: unknown): Station[] {
  if (!raw) return []
  let arr: unknown = raw
  if (typeof raw === 'string') {
    const s = raw.trim()
    if (!s) return []
    try {
      arr = JSON.parse(s)
    } catch {
      return []
    }
  }
  if (arr && typeof arr === 'object' && !Array.isArray(arr) && 'station_list' in arr) {
    arr = (arr as Record<string, unknown>).station_list
  }
  if (!Array.isArray(arr)) return []
  return arr
    .map((d) => {
      const o = d as Record<string, unknown>
      return {
        mac: String(o.mac_addr ?? o.macAddress ?? o.mac ?? '').toUpperCase(),
        hostname: String(o.hostname ?? o.hostName ?? ''),
        ip: String(o.ip_addr ?? o.ipAddress ?? o.ip ?? ''),
      }
    })
    .filter((d) => d.mac !== '')
}

export function parseHostNameList(_raw: string): Record<string, string> {
  return {}
}

export interface ApnProfile {
  index: number

  name: string

  apn: string

  authMode: string

  username: string

  password: string

  pdpType: string
}

export function parseApnProfiles(values: Record<string, string>, count: number): ApnProfile[] {
  const out: ApnProfile[] = []
  for (let i = 0; i < count; i++) {
    const raw = values[`APN_configtmp${i}`] ?? ''
    if (!raw.trim()) continue
    const f = raw.split('($)')
    out.push({
      index: i,
      name: f[0] ?? '',
      apn: f[1] ?? '',
      authMode: (f[4] ?? '').toLowerCase(),
      username: f[5] ?? '',
      password: f[6] ?? '',
      pdpType: f[7] ?? '',
    })
  }
  return out
}

export interface FluxHour {
  date: string
  hour: number
  tx: number
  rx: number
}

export interface FluxDay {
  date: string
  tx: number
  rx: number
}

function discardBadDate(date: string): boolean {
  return !date || date.startsWith('2000-')
}

export function parseFluxHourly(text: string): FluxHour[] {
  const map = new Map<string, FluxHour>()
  for (const line of (text ?? '').split('\n')) {
    const f = line.trim().split(/\s+/)
    if (f.length < 4) continue
    const hour = Number.parseInt(f[1] ?? '', 10)
    if (!Number.isFinite(hour)) continue
    if (discardBadDate(f[0] ?? '')) continue
    const date = f[0] ?? ''
    map.set(`${date}_${hour}`, {
      date,
      hour,
      tx: Number.parseInt(f[2] ?? '', 10) || 0,
      rx: Number.parseInt(f[3] ?? '', 10) || 0,
    })
  }
  const acc = Array.from(map.values()).sort((a, b) =>
    a.date === b.date ? a.hour - b.hour : a.date < b.date ? -1 : 1,
  )

  const out: FluxHour[] = []
  for (let i = 0; i < acc.length; i++) {
    const cur = acc[i]!
    const prev = i > 0 ? acc[i - 1]! : null
    const dtx = prev ? (cur.tx >= prev.tx ? cur.tx - prev.tx : cur.tx) : cur.tx
    const drx = prev ? (cur.rx >= prev.rx ? cur.rx - prev.rx : cur.rx) : cur.rx
    out.push({ date: cur.date, hour: cur.hour, tx: dtx, rx: drx })
  }
  return out
}

export function parseFluxDaily(text: string): FluxDay[] {
  const map = new Map<string, FluxDay>()
  for (const line of (text ?? '').split('\n')) {
    const f = line.trim().split(/\s+/)
    if (f.length < 3) continue
    if (discardBadDate(f[0] ?? '')) continue
    const date = f[0] ?? ''
    map.set(date, {
      date,
      tx: Number.parseInt(f[1] ?? '', 10) || 0,
      rx: Number.parseInt(f[2] ?? '', 10) || 0,
    })
  }
  const acc = Array.from(map.values()).sort((a, b) => (a.date < b.date ? -1 : 1))

  const out: FluxDay[] = []
  for (let i = 0; i < acc.length; i++) {
    const cur = acc[i]!
    const prev = i > 0 ? acc[i - 1]! : null
    out.push({
      date: cur.date,
      tx: prev ? (cur.tx >= prev.tx ? cur.tx - prev.tx : cur.tx) : cur.tx,
      rx: prev ? (cur.rx >= prev.rx ? cur.rx - prev.rx : cur.rx) : cur.rx,
    })
  }
  return out
}

export function parseFluxUptime(text: string): { total: number; session: number } {
  const f = (text ?? '').trim().split(/\s+/)
  return {
    total: Number.parseFloat(f[0] ?? '') || 0,
    session: Number.parseFloat(f[1] ?? '') || 0,
  }
}

export interface QosRule {
  mac: string

  down: string

  up: string
  hostName: string
}

export function parseQosState(text: string): Record<string, QosRule> {
  const out: Record<string, QosRule> = {}
  for (const line of (text ?? '').split('\n')) {
    const f = line.trim().split('|')
    if (f.length >= 3 && f[0]) {
      out[f[0].toUpperCase()] = {
        mac: f[0],
        down: f[1] ?? '0',
        up: f[2] ?? '0',
        hostName: f[3] || '-',
      }
    }
  }
  return out
}

export interface RelayProfile {

  index: number

  raw: string
  profileName: string
  fromProvider: string
  connectStatus: string
  signal: string
  ssid: string
  authMode: string
  encryptType: string

  password: string
  keyID: string
  mac: string
}

function profileFromFields(index: number, raw: string, f: string[]): RelayProfile {
  return {
    index,
    raw,
    profileName: f[0] ?? '',
    fromProvider: f[1] ?? '',
    connectStatus: f[2] ?? '',
    signal: f[3] ?? '',
    ssid: f[4] ?? '',
    authMode: f[5] ?? '',
    encryptType: f[6] ?? '',
    password: f[7] === '0' ? '' : (f[7] ?? ''),
    keyID: f[8] ?? '',
    mac: f[9] ?? '',
  }
}

export function parseRelayProfiles(values: Record<string, string>, count = 10): RelayProfile[] {
  const out: RelayProfile[] = []
  const maxSlots = Math.max(10, count)
  for (let i = 0; i < maxSlots; i++) {
    const raw = (i === 0 ? values.wifi_profile : values[`wifi_profile${i}`]) ?? ''
    if (!raw.trim()) continue
    for (const item of raw.split(';')) {
      const f = item.split(',')
      if (!f[0]) continue
      out.push(profileFromFields(i, item, f))
    }
  }
  return out
}

export interface RelayAp {
  fromProvider: string
  connectStatus: string
  ssid: string
  signal: string
  channel: string
  authMode: string
  encryptType: string
  mac: string
}

export type RelayScanState = 'scanning' | 'done' | 'empty' | 'idle'

export function parseRelayScan(values: Record<string, string>): RelayAp[] {
  if (values.scan_finish !== '1') return []
  const out: RelayAp[] = []
  for (const key of ['EX_APLIST', 'EX_APLIST1'] as const) {
    const raw = values[key] ?? ''
    if (!raw.trim()) continue
    for (const item of raw.split(';')) {
      const f = item.split(',')
      if (!f[0]) continue
      out.push({
        fromProvider: f[0] ?? '',
        connectStatus: f[1] ?? '',
        ssid: f[2] ?? '',
        signal: f[3] ?? '',
        channel: f[4] ?? '',
        authMode: f[5] ?? '',
        encryptType: f[6] ?? '',
        mac: f[7] ?? '',
      })
    }
  }
  return out
}
