export type Validator = (v: string) => string | null

export const validateSsid: Validator = (v) => {
  const s = v ?? ''
  if (s.length === 0) return '请输入 WiFi 名称'
  if (/[\u0000-\u001f\u007f]/.test(s)) return '不能包含控制字符'
  const bytes = new TextEncoder().encode(s).length
  if (bytes > 32) {
    const zh = Math.floor(32 / 3)
    return `名称过长（${bytes}/32 字节，中文最多约 ${zh} 字）`
  }
  return null
}

export const validateWifiPassword = (v: string, authMode = 'WPA2PSK'): string | null => {
  const s = v ?? ''
  if (authMode === 'OPEN') return null
  if (s.length === 0) return '请输入 WiFi 密码'
  if (s.length < 8) return '密码至少 8 位'
  if (s.length > 63) return '密码最多 63 位'
  if (/[^\u0020-\u007e]/.test(s)) return '密码只能用可见 ASCII 字符'
  return null
}

export const validateWepPassword = (v: string): string | null => {
  const s = v ?? ''
  if (/^(?:[0-9a-fA-F]{10}|[0-9a-fA-F]{26})$/.test(s)) return null
  if (/^[\u0020-\u007e]{5}$/.test(s) || /^[\u0020-\u007e]{13}$/.test(s)) return null
  return 'WEP 密码需 5/13 位字符或 10/26 位十六进制'
}

const IPV4_SEG = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/

export const isIpv4 = (v: string): boolean => {
  const parts = (v ?? '').split('.')
  return parts.length === 4 && parts.every((p) => IPV4_SEG.test(p))
}

export const isIpv6 = (v: string): boolean => {
  const s = (v ?? '').trim()
  if (!s || s.length > 45) return false
  return /^[0-9a-fA-F:]+$/.test(s) && s.includes(':')
}

export const validateIp: Validator = (v) => (isIpv4(v ?? '') ? null : '请输入合法的 IPv4 地址')

export const validateIpByVer = (v: string, ver: '4' | '6' = '4'): string | null => {
  if (ver === '6') return isIpv6(v) ? null : '请输入合法的 IPv6 地址'
  return validateIp(v)
}

export const validateLanIp: Validator = (v) => {
  const err = validateIp(v)
  if (err) return err
  return (v ?? '').endsWith('.1') ? null : '建议使用网段内的 .1 地址（如 192.168.0.1）'
}

export const validateNetmask: Validator = (v) => {
  const err = validateIp(v)
  if (err) return err
  const bin = (v ?? '')
    .split('.')
    .map((n) => Number(n).toString(2).padStart(8, '0'))
    .join('')
  return /^1*0*$/.test(bin) ? null : '子网掩码格式不合法'
}

export const validateApn: Validator = (v) => {
  const s = v ?? ''
  if (!s) return '请输入 APN'
  if (/[\s,]/.test(s)) return 'APN 不能含空格或逗号'
  if (s.length > 63) return 'APN 过长'
  return null
}

export const validateProfileName: Validator = (v) => {
  const s = v ?? ''
  if (!s) return '请输入名称'
  if (s.length > 32) return '名称最多 32 字符'
  return null
}

export const MAC_RE = /^([0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}$/

export const validateMac: Validator = (v) =>
  MAC_RE.test((v ?? '').trim()) ? null : 'MAC 格式应为 AA:BB:CC:DD:EE:FF'

export function normalizeMac(input: string): string | null {
  const hex = (input ?? '').replace(/[^0-9a-fA-F]/g, '')
  if (hex.length !== 12) return null
  return (hex.match(/.{2}/g) ?? []).join(':').toUpperCase()
}

export const validatePort = (v: string): string | null => {
  const s = (v ?? '').trim()
  if (!/^\d+$/.test(s)) return '请输入合法端口号'
  const n = Number.parseInt(s, 10)
  if (n < 1 || n > 65535) return '端口范围 1~65535'
  return null
}

export const validatePortRange = (start: string, end: string): string | null => {
  const s1 = (start ?? '').trim()
  const s2 = (end ?? '').trim()
  if (!/^\d+$/.test(s1) || !/^\d+$/.test(s2)) return '请输入合法端口号'
  const a = Number.parseInt(s1, 10)
  const b = Number.parseInt(s2, 10)
  if (a < 1 || b > 65535) return '端口范围 1~65535'
  if (a > b) return '起始端口不能大于结束端口'
  return null
}

export const validateAdminPassword = (v: string, oldPassword = 'admin'): string | null => {
  const s = v ?? ''
  if (!s) return '请输入密码'
  if (s.length < 8) return '密码至少 8 位'
  if (s.length > 63) return '密码最多 63 位'
  if (s === oldPassword) return '新密码不能与当前密码相同'
  if (/[^\u0020-\u007e]/.test(s)) return '密码只能用可见 ASCII 字符'
  return null
}

export const validatePin: Validator = (v) => {
  const s = v ?? ''
  if (!/^\d{4,8}$/.test(s)) return 'PIN 码为 4~8 位数字'
  return null
}

export const validatePuk: Validator = (v) =>
  /^\d{8}$/.test(v ?? '') ? null : 'PUK 码为 8 位数字'

export const validateImei: Validator = (v) => {
  const s = (v ?? '').trim()
  if (!/^\d{15}$/.test(s)) return 'IMEI 应为 15 位数字'
  let sum = 0
  for (let i = 0; i < 15; i++) {
    let d = Number(s[14 - i])
    if (i % 2 === 1) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
  }
  return sum % 10 === 0 ? null : 'IMEI 校验位不正确'
}

export const validateWpsPin: Validator = (v) =>
  /^\d{8}$/.test(v ?? '') ? null : 'WPS PIN 为 8 位数字'

export const validateHost: Validator = (v) => {
  const s = (v ?? '').trim()
  if (!s) return '请输入地址'
  if (isIpv4(s)) return null
  if (/^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/.test(s)) {
    return null
  }
  return '地址格式不合法'
}

export const validateUrlFilter: Validator = (v) => {
  const s = (v ?? '').trim()
  if (!s) return '请输入要过滤的网址'
  if (/[\s;,'"]/.test(s)) return '不能含空格或分号等特殊字符'
  if (/^https?:\/\//i.test(s)) return '不要带 http:// 前缀'
  if (s.length > 128) return '过长'
  return null
}

export const required = (label: string): Validator => (v) =>
  (v ?? '').trim() ? null : `请输入${label}`

export const sameAs = (other: string, label: string): Validator => (v) =>
  (v ?? '') === (other ?? '') ? null : `两次输入的${label}不一致`
