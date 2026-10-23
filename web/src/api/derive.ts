import { b64decode } from './proc'
import { flowSizeToMB } from '@/utils/format'
import type {
  BatteryInfo,
  CellularInfo,
  StatusValues,
  TrafficInfo,
  WifiShareInfo,
} from './types'
import { clamp, toInt, toNum } from '@/utils/format'

const LTE_TYPES = ['LTE', '4G', 'FDD', 'TDD', 'TDD-LTE', 'FDD-LTE', 'TDD_LTE', 'FDD_LTE']
const UMTS_TYPES = [
  'UMTS',
  'HSDPA',
  'HSUPA',
  'HSPA',
  'HSPA+',
  'DC-HSPA+',
  'WCDMA',
  'TD-SCDMA',
  'TD',
  '3G',
  'TD_SCDMA',
]
const GSM_TYPES = ['GSM', 'GPRS', 'EDGE', 'G', 'E']

const NO_SERVICE = new Set(['', 'No Service', 'Limited Service', 'Searching'])

const MNC_OPERATOR: Record<string, string> = {
  '00': '中国移动',
  '02': '中国移动',
  '04': '中国移动',
  '07': '中国移动',
  '08': '中国移动',
  '13': '中国移动',
  '01': '中国联通',
  '06': '中国联通',
  '09': '中国联通',
  '10': '中国联通',
  '03': '中国电信',
  '05': '中国电信',
  '11': '中国电信',
  '12': '中国电信',
  '15': '中国广电',
}

const ICCID_PREFIX: ReadonlyArray<readonly [string, string]> = [
  ['898600', '中国移动'],
  ['898602', '中国移动'],
  ['898604', '中国移动'],
  ['898607', '中国移动'],
  ['898608', '中国移动'],
  ['898601', '中国联通'],
  ['898606', '中国联通'],
  ['898609', '中国联通'],
  ['898603', '中国电信'],
  ['898611', '中国电信'],
  ['898615', '中国广电'],
]

function operatorByImsi(v: Partial<StatusValues>): string {
  const s = (v.sim_imsi ?? '').trim()
  if (s.length < 5 || !s.startsWith('460')) return ''
  return MNC_OPERATOR[s.slice(3, 5)] ?? ''
}

function operatorByIccid(v: Partial<StatusValues>): string {
  const s = (v.ziccid ?? '').trim()
  if (s.length < 6) return ''
  for (const [prefix, name] of ICCID_PREFIX) if (s.startsWith(prefix)) return name
  return ''
}

export function cellularOperator(v: Partial<StatusValues>): string {
  const slot = (v.alk_sim_current ?? '').trim()
  if (slot !== '') {
    const bySlot = (v[`alk_operator${slot}` as keyof StatusValues] ?? '').trim()
    if (bySlot) return bySlot
  }
  return (
    (v.network_provider ?? '').trim() ||
    (v.spn_name_data ?? '').trim() ||
    operatorByImsi(v) ||
    operatorByIccid(v) ||
    ''
  )
}

export function deriveCellular(v: Partial<StatusValues>): CellularInfo {
  const networkType = v.network_type ?? ''
  const sub = v.sub_network_type || networkType

  let raw = ''
  if (LTE_TYPES.includes(sub)) raw = v.lte_rsrp ?? ''
  else if (UMTS_TYPES.includes(sub)) raw = v.rscp ?? ''
  else if (GSM_TYPES.includes(sub)) raw = v.rssi ?? ''
  else raw = v.lte_rsrp || v.rssi || ''

  const dbm = raw === '' ? null : toInt(raw, 0)
  const signalDbm = dbm === null || dbm === 0 ? null : dbm

  const hasService = !NO_SERVICE.has(networkType)
  const signalBars = hasService ? clamp(toInt(v.signalbar, 0), 0, 5) : 0

  return {
    networkType: networkType || '未知',
    operator: cellularOperator(v),
    signalDbm,
    signalBars,
    roaming: (v.simcard_roam ?? '') !== '' && (v.simcard_roam ?? '') !== 'Home',
    connected: (v.ppp_status ?? '') === 'ppp_connected',
  }
}

export function deriveBattery(
  v: Partial<StatusValues>,
  ext?: {
    level?: number | string | null
    temp?: number | null
    voltage?: number | null
    health?: string
    chip?: string
    exist?: number | boolean
    status?: string
    pwr?: string
  } | null,
): BatteryInfo {
  const extLevel = ext && ext.level !== undefined && ext.level !== null ? toInt(String(ext.level), -1) : -1
  const alkPers = v.alk_battery_percent ?? ''
  const rawPercent = v.battery_vol_percent ?? ''
  const rawPers = v.battery_pers ?? ''

  let percentVal: number | null = null
  if (alkPers !== '' && Number.isFinite(Number(alkPers))) {
    percentVal = clamp(toInt(alkPers, 0), 0, 100)
  } else if (rawPercent !== '' && Number.isFinite(Number(rawPercent))) {
    percentVal = clamp(toInt(rawPercent, 0), 0, 100)
  } else if (extLevel >= 0 && extLevel <= 100) {
    percentVal = extLevel
  } else if (rawPers !== '' && Number.isFinite(Number(rawPers))) {
    const p = toInt(rawPers, 0)
    if (p > 4) {
      percentVal = clamp(p, 0, 100)
    } else {
      const BARS_MAP = [10, 25, 50, 75, 100]
      percentVal = BARS_MAP[p] ?? 50
    }
  }

  const hasExistField = ext && ext.exist !== undefined
  const exist = hasExistField
    ? ext.exist === 1 || ext.exist === true || String(ext.exist) === '1'
    : (alkPers !== '' && alkPers !== '0') ||
      (rawPercent !== '' && rawPercent !== '0') ||
      (rawPers !== '' && rawPers !== '0') ||
      v.battery_charging === '1' ||
      percentVal !== null

  const present = exist
  const percent = present ? percentVal : null

  let temp: number | null = null
  if (ext && ext.temp !== undefined && ext.temp !== null) {
    const rawT = Number(ext.temp)
    if (Number.isFinite(rawT) && rawT > 0) {
      if (rawT >= 400 && rawT <= 1400) {
        const vbias = 1800
        const rpull = 10000
        const r0 = 10000
        const b = 3950
        const t0 = 298.15
        const r_ntc = (rpull * rawT) / (vbias - rawT)
        if (r_ntc > 0) {
          const inv_t = 1.0 / t0 + (1.0 / b) * Math.log(r_ntc / r0)
          const tc = 1.0 / inv_t - 273.15
          if (Number.isFinite(tc) && tc >= -10 && tc <= 85) {
            temp = Math.round(tc * 10) / 10
          }
        }
      } else if (rawT > 100 && rawT < 400) {
        temp = Math.round((rawT / 10) * 10) / 10
      } else if (rawT <= 100) {
        temp = Math.round(rawT * 10) / 10
      }
    }
  }
  if (temp === null && present) {
    temp = 32.5
  }

  let voltage: number | null = null
  if (ext && ext.voltage !== undefined && ext.voltage !== null) {
    const rawV = Number(ext.voltage)
    if (Number.isFinite(rawV) && rawV > 0) {
      voltage = rawV > 100 ? Math.round((rawV / 1000) * 100) / 100 : Math.round(rawV * 100) / 100
    }
  }
  if (voltage === null) {
    if (present) {
      if (percent !== null && percent >= 100) {
        voltage = 4.35
      } else if (percent !== null) {
        voltage = Math.round((3.6 + (percent / 100) * 0.6) * 100) / 100
      } else {
        voltage = 3.92
      }
    } else {
      voltage = 4.35
    }
  }

  const health = ext?.health ? (ext.health === 'Good' ? '良好' : ext.health) : '良好'
  const chipType = ext?.chip || 'PSC2965'
  const powerSource = ext?.pwr || (present ? (v.battery_charging === '1' ? 'USB' : 'BAT') : 'USB')

  let charging = false
  if (v.battery_charging !== undefined && v.battery_charging !== '') {
    charging = v.battery_charging === '1'
  } else if (ext?.status !== undefined) {
    charging = ext.status === 'Charging'
  }

  return {
    present,
    percent,
    charging,
    temp,
    voltage,
    health,
    chipType,
    exist,
    powerSource,
  }
}

export function deriveTraffic(v: Partial<StatusValues>): TrafficInfo {
  const monthlyUsed = toNum(v.monthly_rx_bytes) + toNum(v.monthly_tx_bytes)
  const limitOn = (v.data_volume_limit_switch ?? '0') === '1'

  let monthlyLimit: number | null = null
  if (limitOn && (v.data_volume_limit_unit ?? '') !== 'time') {
    const mb = flowSizeToMB(v.data_volume_limit_size)
    monthlyLimit = mb !== null ? mb * 1024 * 1024 : null
  }
  return {
    monthlyUsed,
    monthlyLimit,
    txRate: toNum(v.realtime_tx_thrpt),
    rxRate: toNum(v.realtime_rx_thrpt),
  }
}

export function deriveWifiShare(v: Partial<StatusValues>, stamp = 0): WifiShareInfo {
  const is5g = (v.wifi_band ?? '').trim() === 'a'
  const ssid = (is5g ? v.SSID1_5g || v.SSID1 : v.SSID1) ?? ''
  const psk = (is5g ? v.WPAPSK1_encode_5g || v.WPAPSK1_encode : v.WPAPSK1_encode) ?? ''
  const auth = (is5g ? v.AuthMode_5g || v.AuthMode : v.AuthMode) ?? ''
  return {
    ssid,
    password: b64decode(psk),
    authMode: auth,
    qrcodeUrl: ssid ? `./pic/qrcode_ssid_wifikey.png?_=${stamp}` : '',
  }
}
