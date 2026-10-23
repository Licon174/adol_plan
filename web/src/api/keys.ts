import type { StatusKey } from './types'

export const BAND_5G = 'a'
export const BAND_2G = 'b'

export function is5g(wifiBand: string | undefined): boolean {
  return (wifiBand ?? '').trim() === BAND_5G
}

export function readBandKey(
  s: Record<string, string>,
  key: string,
  wifiBand: string | undefined,
): string {
  if (is5g(wifiBand)) {
    const v5 = s[`${key}_5g`]
    if (v5 !== undefined && v5 !== '') return v5
  }
  return s[key] ?? ''
}

export function readBandKeyStrict(
  s: Record<string, string>,
  key: string,
  wifiBand: string | undefined,
): string {
  return is5g(wifiBand) ? (s[`${key}_5g`] ?? '') : (s[key] ?? '')
}

export function bandForWrite(wifiBand: string | undefined): string {
  const v = (wifiBand ?? '').trim()
  if (v === BAND_5G || v === BAND_2G) return v
  return is5g(v) ? BAND_5G : BAND_2G
}

export const LEGACY_NOISE = ['Language', 'update_type', 'show_advance_setting'] as const

export const NETWORK_INFO_KEYS = [
  'network_type',
  'network_provider',
  'network_operator',
  'rssi',
  'lte_rsrp',
  'nv_rsrp',
  'nv_sinr',
  'nv_rsrq',
  'nv_pci',
  'nv_arfcn',
  'nv_cellid',
  'nv_globecellid',
  'cell_id',
  'lte_band',
  'work_lte_band',
  'ping_google',
  'cr_version',
  'imei',
  'sim_imsi',
  'imsi',
  'ziccid',
] as const satisfies readonly StatusKey[]

export const APN_KEYS = [
  ...Array.from({ length: 20 }, (_, i) => `APN_configtmp${i}` as StatusKey),
  ...Array.from({ length: 20 }, (_, i) => `ipv6_APN_configtmp${i}` as StatusKey),
  'apn_index',
  'm_profile_name',
  'profile_name',
  'wan_dial',
  'pdp_type',
  'pdp_select',
  'index',
  'Current_index',
  'apn_auto_config',
  'ipv6_apn_auto_config',
  'apn_mode',
  'wan_apn',
  'ppp_auth_mode',
  'ppp_username',
  'ppp_passtmp',
  'ipv6_wan_apn',
  'ipv6_pdp_type',
  'ipv6_ppp_auth_mode',
  'ipv6_ppp_username',
  'ipv6_ppp_passtmp',
  'apn_num_preset',
] as const

export const NETWORK_SELECT_KEYS = [
  'current_network_mode',
  'm_netselect_save',
  'net_select_mode',
  'm_netselect_contents',
  'net_select',
  'ppp_status',
  'modem_main_state',
] as const satisfies readonly StatusKey[]

export const DIAL_KEYS = ['dial_mode', 'roam_setting_option'] as const satisfies readonly StatusKey[]

export const TRAFFIC_KEYS = [
  'data_volume_limit_switch',
  'data_volume_limit_unit',
  'data_volume_limit_size',
  'data_volume_alert_percent',
  'monthly_tx_bytes',
  'monthly_rx_bytes',
  'monthly_time',
  'traffic_alined_delta',
] as const satisfies readonly StatusKey[]

export const TRAFFIC_REALTIME_KEYS = [
  'realtime_tx_bytes',
  'realtime_rx_bytes',

  'realtime_tx_thrpt',
  'realtime_rx_thrpt',
  'monthly_tx_bytes',
  'monthly_rx_bytes',
] as const satisfies readonly StatusKey[]

export const WIFI_MAIN_KEYS = [
  'm_ssid_enable',
  'wifi_cur_state',
  'NoForwarding',
  'm_NoForwarding',
  'NoForwarding_5g',
  'm_NoForwarding_5g',
  'WPAPSK1_encode',
  'm_WPAPSK1_encode',
  'WPAPSK1_encode_5g',
  'm_WPAPSK1_encode_5g',
  'MAX_Station_num',
  'SSID1',
  'AuthMode',
  'HideSSID',
  'MAX_Access_num',
  'show_qrcode_flag',
  'EncrypType',
  'Key1Str1',
  'Key2Str1',
  'Key3Str1',
  'Key4Str1',
  'DefaultKeyID',
  'm_SSID',
  'm_AuthMode',
  'm_HideSSID',
  'm_MAX_Access_num',
  'm_EncrypType',
  'm_show_qrcode_flag',
  'm_DefaultKeyID',
  'm_Key1Str1',
  'm_Key2Str1',
  'm_Key3Str1',
  'm_Key4Str1',
  'rotationFlag',
  'wifi_sta_connection',
  'SSID1_5g',
  'AuthMode_5g',
  'HideSSID_5g',
  'MAX_Access_num_5g',
  'show_qrcode_flag_5g',
  'EncrypType_5g',
  'Key1Str1_5g',
  'Key2Str1_5g',
  'Key3Str1_5g',
  'Key4Str1_5g',
  'DefaultKeyID_5g',
  'm_SSID_5g',
  'm_AuthMode_5g',
  'm_HideSSID_5g',
  'm_MAX_Access_num_5g',
  'm_EncrypType_5g',
  'm_show_qrcode_flag_5g',
  'm_DefaultKeyID_5g',
  'm_Key1Str1_5g',
  'm_Key2Str1_5g',
  'm_Key3Str1_5g',
  'm_Key4Str1_5g',
  'wifi_band',
] as const

export const WIFI_RADIO_KEYS = [
  'WirelessMode',
  'WirelessMode_5g',
  'CountryCode',
  'Channel',
  'Channel_5g',
  'HT_MCS',
  'wifi_band',
  'wifi_11n_cap',
  'wifi_11n_cap_5g',
  'MAX_Access_num',
  'm_MAX_Access_num',
  'MAX_Station_num',
  'wifi_sta_connection',
] as const

export const MAC_FILTER_KEYS = [
  'ACL_mode',
  'wifi_mac_black_list',
  'wifi_hostname_black_list',
  'wifi_cur_state',
  'user_ip_addr',
  'client_mac_address',
  'wifi_mac_white_list',
] as const satisfies readonly StatusKey[]

export const STATION_KEYS = ['hostNameList'] as const satisfies readonly StatusKey[]

export const RELAY_KEYS = [
  'wifi_sta_connection',
  'sta_ip_status',

  'wan_ipaddr',
  'wifi_profile_num',
  'wifi_profile',
  ...Array.from({ length: 10 }, (_, i) => `wifi_profile${i}` as StatusKey),
  'scan_finish',
  'EX_APLIST',
  'EX_APLIST1',
] as const satisfies readonly StatusKey[]

export const WPS_KEYS = [
  'wifi_wps_index',
  'WscModeOption',
  'AuthMode',
  'wifi_cur_state',
  'EncrypType',
  'wps_mode',
  'WPS_SSID',
  'm_ssid_enable',
  'SSID1',
  'm_SSID',
  'm_EncrypType',
  'm_AuthMode',
  'wifi_sta_connection',
  'AuthMode_5g',
  'EncrypType_5g',
  'SSID1_5g',
  'm_SSID_5g',
  'm_EncrypType_5g',
  'm_AuthMode_5g',

  'HideSSID',
  'HideSSID_5g',
  'm_HideSSID',
  'm_HideSSID_5g',
  'wifi_band',
] as const satisfies readonly StatusKey[]

export const WIFI_SLEEP_KEYS = [
  'openEnable',
  'closeEnable',
  'openTime',
  'closeTime',
  'Sleep_interval',
] as const satisfies readonly StatusKey[]

export const PORT_MAP_KEYS = [
  'PortMapEnable',
  ...Array.from({ length: 10 }, (_, i) => `PortMapRules_${i}` as StatusKey),
] as const

export const PORT_FORWARD_KEYS = [
  'PortForwardEnable',
  ...Array.from({ length: 10 }, (_, i) => `PortForwardRules_${i}` as StatusKey),
] as const

export const PORT_FILTER_KEYS = [
  'IPPortFilterEnable',
  'DefaultFirewallPolicy',
  ...Array.from({ length: 10 }, (_, i) => `IPPortFilterRules_${i}` as StatusKey),
  ...Array.from({ length: 10 }, (_, i) => `IPPortFilterRulesv6_${i}` as StatusKey),
] as const

export const URL_FILTER_KEYS = ['websURLFilters'] as const satisfies readonly StatusKey[]

export const DMZ_KEYS = ['DMZEnable', 'DMZIPAddress'] as const satisfies readonly StatusKey[]

export const PARENTAL_KEYS = [
  'hostNameList',
  'childGroupList',
  'get_user_mac_addr',
] as const satisfies readonly StatusKey[]

export const PIN_KEYS = ['pinnumber', 'pin_status', 'puknumber'] as const satisfies readonly StatusKey[]

export const SIM_KEYS = [
  'alk_sim_current',
  'alk_iccid0',
  'alk_iccid1',
  'alk_iccid2',
  'alk_iccid3',
  'ziccid',
  'alk_sim_mode',
  'sim_imsi',
  'network_provider',
] as const satisfies readonly StatusKey[]

export const IMEI_KEYS = ['imei'] as const satisfies readonly StatusKey[]

export const FIREWALL_KEYS = ['RemoteManagement', 'WANPingFilter'] as const satisfies readonly StatusKey[]

export const PAGE_KEYS = {
  networkInfo: NETWORK_INFO_KEYS,
  apn: APN_KEYS,
  networkSelect: NETWORK_SELECT_KEYS,
  dial: DIAL_KEYS,
  traffic: [...TRAFFIC_KEYS, ...TRAFFIC_REALTIME_KEYS],
  wifiBasic: [...WIFI_MAIN_KEYS, ...WIFI_RADIO_KEYS],
  wifiAdvance: [...WIFI_RADIO_KEYS, ...WIFI_MAIN_KEYS],
  wifiGuest: [...WIFI_MAIN_KEYS, ...WIFI_RADIO_KEYS],
  wifiRelay: RELAY_KEYS,

  wifiClients: [...STATION_KEYS, ...MAC_FILTER_KEYS],
  wifiMacFilter: [...MAC_FILTER_KEYS, ...WIFI_MAIN_KEYS],
  wifiWps: [...WPS_KEYS, ...WIFI_MAIN_KEYS],
  wifiSleep: WIFI_SLEEP_KEYS,

  firewall: FIREWALL_KEYS,
  portMap: PORT_MAP_KEYS,
  portForward: PORT_FORWARD_KEYS,
  portFilter: PORT_FILTER_KEYS,
  urlFilter: URL_FILTER_KEYS,
  dmz: DMZ_KEYS,
  parental: PARENTAL_KEYS,
  pin: PIN_KEYS,
  sim: SIM_KEYS,
  imei: IMEI_KEYS,
} as const

export function uniqKeys(keys: readonly string[]): string[] {
  return [...new Set(keys)]
}
