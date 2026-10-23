import { b64encode } from './proc'

export const GOFORM = {

  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  REBOOT_DEVICE: 'REBOOT_DEVICE',
  RESTORE_FACTORY_SETTINGS: 'RESTORE_FACTORY_SETTINGS',

  APN_PROC_EX: 'APN_PROC_EX',
  SET_NETWORK: 'SET_NETWORK',
  SCAN_NETWORK: 'SCAN_NETWORK',
  UNLOCK_NETWORK: 'UNLOCK_NETWORK',
  SET_CONNECTION_MODE: 'SET_CONNECTION_MODE',
  CONNECT_NETWORK: 'CONNECT_NETWORK',
  DISCONNECT_NETWORK: 'DISCONNECT_NETWORK',
  SET_FREQ_BAND: 'SET_FREQ_BAND',
  SET_BEARER_PREFERENCE: 'SET_BEARER_PREFERENCE',
  LOCK_ZONE: 'LOCK_ZONE',
  ALK_SET_NET_MODE: 'ALK_SET_NET_MODE',
  FLOW_CALIBRATION_MANUAL: 'FLOW_CALIBRATION_MANUAL',

  SET_WIFI_INFO: 'SET_WIFI_INFO',
  SET_WIFI_SSID1_SETTINGS: 'SET_WIFI_SSID1_SETTINGS',
  SET_WIFI_SSID2_SETTINGS: 'SET_WIFI_SSID2_SETTINGS',
  SET_WIFI_SECURITY_INFO: 'SET_WIFI_SECURITY_INFO',
  SET_WIFI_COVERAGE: 'SET_WIFI_COVERAGE',
  SET_WIFI_SLEEP_INFO: 'SET_WIFI_SLEEP_INFO',

  SAVE_TSW: 'SAVE_TSW',
  WIFI_MAC_FILTER: 'WIFI_MAC_FILTER',
  WIFI_WPS_SET: 'WIFI_WPS_SET',
  WIFI_M_WPS_SET: 'WIFI_M_WPS_SET',
  WIFI_STA_CONTROL: 'WIFI_STA_CONTROL',
  MGMT_CONTROL_POWER_ON_SPEED: 'MGMT_CONTROL_POWER_ON_SPEED',

  ADD_DEVICE: 'ADD_DEVICE',
  DEL_DEVICE: 'DEL_DEVICE',
  EDIT_HOSTNAME: 'EDIT_HOSTNAME',

  WLAN_SET_STA_CON: 'WLAN_SET_STA_CON',
  WLAN_SET_STA_DISCON: 'WLAN_SET_STA_DISCON',
  WLAN_SET_STA_REFRESH: 'WLAN_SET_STA_REFRESH',
  WIFI_SPOT_PROFILE_UPDATE: 'WIFI_SPOT_PROFILE_UPDATE',

  FW_SYS: 'FW_SYS',
  DMZ_SETTING: 'DMZ_SETTING',
  FW_FORWARD_ADD: 'FW_FORWARD_ADD',
  FW_FORWARD_DEL: 'FW_FORWARD_DEL',
  ADD_PORT_MAP: 'ADD_PORT_MAP',
  DEL_PORT_MAP: 'DEL_PORT_MAP',
  ADD_WHITE_SITE: 'ADD_WHITE_SITE',
  REMOVE_WHITE_SITE: 'REMOVE_WHITE_SITE',
  ADD_IP_PORT_FILETER_V4V6: 'ADD_IP_PORT_FILETER_V4V6',
  DEL_IP_PORT_FILETER_V4V6: 'DEL_IP_PORT_FILETER_V4V6',
  URL_FILTER_ADD: 'URL_FILTER_ADD',
  URL_FILTER_DELETE: 'URL_FILTER_DELETE',
  SAVE_TIME_LIMITED: 'SAVE_TIME_LIMITED',

  BASIC_SETTING: 'BASIC_SETTING',
  DHCP_SETTING: 'DHCP_SETTING',
  CHANGE_PASSWORD: 'CHANGE_PASSWORD',
  ENABLE_PIN: 'ENABLE_PIN',
  DISABLE_PIN: 'DISABLE_PIN',
  ENTER_PIN: 'ENTER_PIN',
  ENTER_PUK: 'ENTER_PUK',
  PIN_LOCK_V4_ENCODE: 'PIN_LOCK_V4_ENCODE',
  ALK_WRITE_IMEI: 'ALK_WRITE_IMEI',
  ALK_SIM_SELECT_WITH_PWD: 'ALK_SIM_SELECT_WITH_PWD',
  EXECUTE_AT_COMMAND: 'EXECUTE_AT_COMMAND',

  ALK_EXC_SYSTEM_CMD: 'ALK_EXC_SYSTEM_CMD',
  ALK_EXC_AT_CMD1: 'ALK_EXC_AT_CMD1',
} as const

export type GoformId = (typeof GOFORM)[keyof typeof GOFORM]

export interface WifiInfoPayload {

  wifiMode?: string

  countryCode?: string

  MAX_Access_num?: string

  m_MAX_Access_num?: string

  wifi_band?: string

  selectedChannel?: string

  wifiEnabled?: string

  ap_station_enable?: string

  m_ssid_enable?: string
}

export function wifiInfo(p: WifiInfoPayload): Record<string, string> {
  const out: Record<string, string> = { goformId: GOFORM.SET_WIFI_INFO }
  for (const [k, v] of Object.entries(p)) {
    if (v !== undefined) out[k] = v
  }
  return out
}

export interface Ssid1Payload {

  ssid: string

  broadcastSsidEnabled?: string

  MAX_Access_num?: string

  security_mode?: string

  cipher?: string

  NoForwarding?: string

  show_qrcode_flag?: string

  passPhrase?: string
}

const PSK_MODES = ['WPAPSK', 'WPA2PSK', 'WPAPSKWPA2PSK', 'WPA3Personal', 'WPA2WPA3']

export function cipherCode(encrypType: string): string {
  switch ((encrypType || '').toUpperCase()) {
    case 'TKIP':
      return '0'
    case 'AES':
    case 'CCMP':
      return '1'
    case 'TKIPAES':
    case 'TKIPCCMP':
    case 'AESTKIP':
      return '2'
    default:
      return '1'
  }
}

export function ssid1Settings(p: Ssid1Payload): Record<string, string> {
  const out: Record<string, string> = {
    goformId: GOFORM.SET_WIFI_SSID1_SETTINGS,
    ssid: p.ssid,
  }
  if (p.broadcastSsidEnabled !== undefined) out.broadcastSsidEnabled = p.broadcastSsidEnabled
  if (p.MAX_Access_num !== undefined) out.MAX_Access_num = p.MAX_Access_num
  if (p.security_mode !== undefined) out.security_mode = p.security_mode

  const cc = p.cipher !== undefined ? cipherCode(p.cipher) : undefined
  if (cc !== undefined) out.cipher = cc
  if (p.NoForwarding !== undefined) out.NoForwarding = p.NoForwarding
  if (p.show_qrcode_flag !== undefined) out.show_qrcode_flag = p.show_qrcode_flag

  if (p.passPhrase !== undefined && p.security_mode && PSK_MODES.includes(p.security_mode)) {
    out.security_shared_mode = cc ?? '1'
    out.passphrase = b64encode(p.passPhrase)
  }

  if (p.security_mode === 'OPEN') out.security_shared_mode = 'NONE'
  return out
}

export const DEPRECATED_WIFI_SECURITY_INFO = 'SET_WIFI_SECURITY_INFO'

export interface Ssid2Payload {

  m_SSID: string

  m_HideSSID?: string

  m_MAX_Access_num?: string

  m_AuthMode?: string

  cipher?: string

  m_NoForwarding?: string

  m_show_qrcode_flag?: string

  passPhrase?: string
}

export function ssid2Settings(p: Ssid2Payload): Record<string, string> {
  const out: Record<string, string> = {
    goformId: GOFORM.SET_WIFI_SSID2_SETTINGS,
    m_SSID: p.m_SSID,
  }
  if (p.m_HideSSID !== undefined) out.m_HideSSID = p.m_HideSSID
  if (p.m_MAX_Access_num !== undefined) out.m_MAX_Access_num = p.m_MAX_Access_num
  if (p.m_AuthMode !== undefined) out.m_AuthMode = p.m_AuthMode

  const cc = p.cipher !== undefined ? cipherCode(p.cipher) : undefined
  if (cc !== undefined) out.cipher = cc
  if (p.m_NoForwarding !== undefined) out.m_NoForwarding = p.m_NoForwarding
  if (p.m_show_qrcode_flag !== undefined) out.m_show_qrcode_flag = p.m_show_qrcode_flag
  if (p.passPhrase !== undefined && p.m_AuthMode && p.m_AuthMode !== 'OPEN') {
    out.m_EncrypType = cc ?? '1'
    out.m_WPAPSK1 = b64encode(p.passPhrase)
  }
  if (p.m_AuthMode === 'OPEN') {
    out.m_EncrypType = 'NONE'
  }
  return out
}

export function wifiCoverage(wifiRangeMode: string): Record<string, string> {
  return { goformId: GOFORM.SET_WIFI_COVERAGE, wifi_coverage: wifiRangeMode }
}

export function wifiSleep(sysIdleTimeToSleep: string): Record<string, string> {
  return { goformId: GOFORM.SET_WIFI_SLEEP_INFO, sysIdleTimeToSleep }
}

export function saveTsw(p: {
  openEnable: string
  closeEnable: string
  openTime?: string
  closeTime?: string
}): Record<string, string> {
  const out: Record<string, string> = {
    goformId: GOFORM.SAVE_TSW,
    openEnable: p.openEnable,
    closeEnable: p.closeEnable,
  }
  if (p.openEnable === '1') {
    if (p.openTime !== undefined) out.openTime = p.openTime
    if (p.closeTime !== undefined) out.closeTime = p.closeTime
  }
  return out
}

export function wpsSet(p: {
  WPS_SSID: string
  wps_mode: string
  wifi_wps_index: string
  wps_pin?: string
}): Record<string, string> {
  const out: Record<string, string> = {
    goformId: GOFORM.WIFI_WPS_SET,
    WPS_SSID: p.WPS_SSID,
    wps_mode: p.wps_mode,
    wifi_wps_index: p.wifi_wps_index,
  }

  if (p.wps_mode === 'PIN' && p.wps_pin !== undefined) out.wps_pin = p.wps_pin
  return out
}

export function macFilter(p: {
  ACL_mode: string

  wifi_mac_black_list?: string
  wifi_mac_white_list?: string

  wifi_hostname_black_list?: string
}): Record<string, string> {
  const out: Record<string, string> = { goformId: GOFORM.WIFI_MAC_FILTER, ACL_mode: p.ACL_mode }
  if (p.wifi_mac_black_list !== undefined) out.wifi_mac_black_list = p.wifi_mac_black_list
  if (p.wifi_mac_white_list !== undefined) out.wifi_mac_white_list = p.wifi_mac_white_list
  if (p.wifi_hostname_black_list !== undefined) out.wifi_hostname_black_list = p.wifi_hostname_black_list
  return out
}

export const MAC_LIST_SEP = ';'

export function joinMacList(macs: readonly string[]): string {
  return macs.filter(Boolean).join(MAC_LIST_SEP)
}

export function apnSwitchMode(apnMode: string): Record<string, string> {
  return { goformId: GOFORM.APN_PROC_EX, apn_mode: apnMode }
}

export function apnSaveProfile(p: {
  profileName: string
  pdpType: string
  index: string
  wanApn?: string
  pppAuthMode?: string
  pppUsername?: string
  pppPassword?: string
  ipv6WanApn?: string
  ipv6PdpType?: string
  ipv6PppAuthMode?: string
  ipv6PppUsername?: string
  ipv6PppPassword?: string
}): Record<string, string> {
  const out: Record<string, string> = {
    goformId: GOFORM.APN_PROC_EX,
    apn_action: 'save',
    apn_mode: 'manual',
    profile_name: p.profileName,
    wan_dial: '*99#',
    pdp_type: p.pdpType,
    pdp_select: 'auto',
    index: p.index,
  }
  if (p.wanApn !== undefined) out.wan_apn = p.wanApn
  if (p.pppAuthMode !== undefined) out.ppp_auth_mode = p.pppAuthMode
  if (p.pppUsername !== undefined) out.ppp_username = p.pppUsername
  if (p.pppPassword !== undefined) out.ppp_passtmp = p.pppPassword
  if (p.ipv6WanApn !== undefined) out.ipv6_wan_apn = p.ipv6WanApn
  if (p.ipv6PdpType !== undefined) out.ipv6_pdp_type = p.ipv6PdpType
  if (p.ipv6PppAuthMode !== undefined) out.ipv6_ppp_auth_mode = p.ipv6PppAuthMode
  if (p.ipv6PppUsername !== undefined) out.ipv6_ppp_username = p.ipv6PppUsername
  if (p.ipv6PppPassword !== undefined) out.ipv6_ppp_passtmp = p.ipv6PppPassword
  return out
}

export function apnSetDefault(p: { apnMode: string; pdpType: string; index: string }): Record<
  string,
  string
> {
  return {
    goformId: GOFORM.APN_PROC_EX,
    apn_mode: p.apnMode,
    apn_action: 'set_default',
    set_default_flag: '1',
    pdp_type: p.pdpType,
    index: p.index,
  }
}

export function setConnectionMode(p: {

  ConnectionMode: string

  roam_setting_option: string
}): Record<string, string> {
  return {
    goformId: GOFORM.SET_CONNECTION_MODE,
    ConnectionMode: p.ConnectionMode,
    roam_setting_option: p.roam_setting_option,
  }
}

export function flowCalibration(p: {
  way: 'data' | 'time'
  value: string
}): Record<string, string> {
  return {
    goformId: GOFORM.FLOW_CALIBRATION_MANUAL,
    calibration_way: p.way,
    time: p.way === 'time' ? p.value : '0',
    data: p.way === 'data' ? p.value : '0',
  }
}

export function setFreqBand(p: {
  work_lte_band: string
  ping_google?: string
}): Record<string, string> {
  const out: Record<string, string> = {
    goformId: GOFORM.SET_FREQ_BAND,
    work_lte_band: p.work_lte_band,
  }
  if (p.ping_google !== undefined) out.ping_google = p.ping_google
  return out
}

export function atCmd1(cmd: string): Record<string, string> {
  return { goformId: GOFORM.ALK_EXC_AT_CMD1, AT_CMD1: cmd }
}

export function setBearerPreference(strBearerPreference: string): Record<string, string> {
  return {
    goformId: GOFORM.SET_BEARER_PREFERENCE,
    BearerPreference: strBearerPreference,
  }
}

export function setNetwork(p: {
  NetworkNumber: string
  Rat: string
  nSubrat: string
}): Record<string, string> {
  return {
    goformId: GOFORM.SET_NETWORK,
    NetworkNumber: p.NetworkNumber,
    Rat: p.Rat,
    nSubrat: p.nSubrat,
  }
}

export function scanNetwork(): Record<string, string> {
  return { goformId: GOFORM.SCAN_NETWORK }
}

export function unlockNetwork(unlockNetworkCode: string): Record<string, string> {
  return {
    goformId: GOFORM.UNLOCK_NETWORK,
    notCallback: 'true',
    unlock_network_code: unlockNetworkCode,
  }
}

export interface RelayConnectPayload {

  EX_SSID1: string
  EX_AuthMode: string
  EX_EncrypType: string
  EX_DefaultKeyID?: string
  EX_WEPKEY?: string
  EX_WPAPSK1?: string

  EX_wifi_profile: string
  EX_mac?: string
}

export function relayConnect(p: RelayConnectPayload): Record<string, string> {
  const out: Record<string, string> = { goformId: GOFORM.WLAN_SET_STA_CON }
  for (const [k, v] of Object.entries(p)) {
    if (v !== undefined) out[k] = v
  }
  return out
}

export function relayDisconnect(): Record<string, string> {
  return { goformId: GOFORM.WLAN_SET_STA_DISCON }
}

export function relayRefresh(): Record<string, string> {
  return { goformId: GOFORM.WLAN_SET_STA_REFRESH }
}

export function relayProfileUpdate(p: {

  wifiProfileNum: string

  wifiUpdateProfile: string
  action: 'add' | 'modify' | 'delete'

  groups: Record<string, string>
}): Record<string, string> {
  return {
    goformId: GOFORM.WIFI_SPOT_PROFILE_UPDATE,
    wifi_profile_num: p.wifiProfileNum,
    wifi_update_profile: p.wifiUpdateProfile,
    action: p.action,
    ...p.groups,
  }
}

function sanitizeQosName(name: string): string {
  const s = (name ?? '').replace(/['";|\\`\r\n]/g, '').trim()
  return s === '' ? '-' : s
}

function sanitizeKbps(v: string | number): string {
  const s = String(v ?? '').replace(/[^0-9]/g, '')
  return s === '' ? '0' : s
}

export function qosSetShell(mac: string, downKbps: string | number, upKbps: string | number, name: string): string {
  const m = normalizeMacForShell(mac)
  return `sh /mnt/userdata/qos/qos.sh set ${m} ${sanitizeKbps(downKbps)} ${sanitizeKbps(
    upKbps,
  )} '${sanitizeQosName(name)}'`
}

export function qosDelShell(mac: string): string {
  return `sh /mnt/userdata/qos/qos.sh del ${normalizeMacForShell(mac)}`
}

function normalizeMacForShell(mac: string): string {
  const cleaned = (mac ?? '').replace(/[^0-9a-fA-F:-]/g, '').replace(/-/g, ':')
  if (!/^([0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}$/.test(cleaned)) {
    throw new Error(`MAC 不合法：${mac}`)
  }
  return cleaned.toUpperCase()
}

export function fwSys(p: { RemoteManagement?: string; WANPingFilter?: string }): Record<string, string> {
  const out: Record<string, string> = { goformId: GOFORM.FW_SYS }
  if (p.RemoteManagement !== undefined) out.RemoteManagement = p.RemoteManagement
  if (p.WANPingFilter !== undefined) out.WANPingFilter = p.WANPingFilter
  return out
}

export function dmzSetting(p: { enabled: string; ipAddress: string }): Record<string, string> {
  return {
    goformId: GOFORM.DMZ_SETTING,
    DMZEnabled: p.enabled,
    DMZIPAddress: p.ipAddress,
  }
}

export function portForwardAdd(p: {
  enable: string
  ipAddress: string
  portStart: string
  portEnd: string
  protocol: string
  comment?: string
}): Record<string, string> {
  return {
    goformId: GOFORM.FW_FORWARD_ADD,
    PortForwardEnable: p.enable,
    ipAddress: p.ipAddress,
    portStart: p.portStart,
    portEnd: p.portEnd,
    protocol: p.protocol,
    comment: p.comment ?? '',
  }
}

export function portForwardDel(deleteId: string): Record<string, string> {
  return { goformId: GOFORM.FW_FORWARD_DEL, delete_id: deleteId }
}

export function portMapAdd(p: {
  portMapEnabled: string
  fromPort?: string
  ipAddress?: string
  toPort?: string
  protocol?: string
  comment?: string
}): Record<string, string> {
  const out: Record<string, string> = { goformId: GOFORM.ADD_PORT_MAP, portMapEnabled: p.portMapEnabled }
  if (p.fromPort !== undefined) out.fromPort = p.fromPort
  if (p.ipAddress !== undefined) out.ip_address = p.ipAddress
  if (p.toPort !== undefined) out.toPort = p.toPort
  if (p.protocol !== undefined) out.protocol = p.protocol
  if (p.comment !== undefined) out.comment = p.comment
  return out
}

export function portMapDel(deleteId: string): Record<string, string> {
  return { goformId: GOFORM.DEL_PORT_MAP, delete_id: deleteId }
}

export function portFilterBasic(p: {
  portFilterEnabled: string
  defaultFirewallPolicy: string
}): Record<string, string> {
  return {
    goformId: GOFORM.BASIC_SETTING,
    portFilterEnabled: p.portFilterEnabled,
    defaultFirewallPolicy: p.defaultFirewallPolicy,
  }
}

export function portFilterAdd(p: {
  ipVersion: string
  macAddress?: string
  destIp?: string
  sourceIp?: string
  destPortStart?: string
  destPortEnd?: string
  sourcePortStart?: string
  sourcePortEnd?: string
  action: string
  protocol: string
  comment?: string
}): Record<string, string> {
  const out: Record<string, string> = {
    goformId: GOFORM.ADD_IP_PORT_FILETER_V4V6,
    ip_version: p.ipVersion,
    action: p.action,
    protocol: p.protocol,
  }
  const set = (k: string, v?: string) => {
    if (v !== undefined && v !== '') out[k] = v
  }
  set('mac_address', p.macAddress)
  set('dip_address', p.destIp)
  set('sip_address', p.sourceIp)
  set('dFromPort', p.destPortStart)
  set('dToPort', p.destPortEnd)
  set('sFromPort', p.sourcePortStart)
  set('sToPort', p.sourcePortEnd)
  set('comment', p.comment)
  return out
}

export function portFilterDel(idsV4: string[], idsV6: string[] = []): Record<string, string> {
  const j = (a: string[]) => (a.length ? a.join(';') + ';' : '')
  return {
    goformId: GOFORM.DEL_IP_PORT_FILETER_V4V6,
    delete_id: j(idsV4),
    delete_id_v6: j(idsV6),
  }
}

export function dhcpSetting(p: {
  ipAddress: string
  subnetMask: string
  dhcpServerOn: boolean
  dhcpStart?: string
  dhcpEnd?: string
  dhcpLease?: string
  dnsMode?: string
  dnsIp?: string
}): Record<string, string> {
  const type = p.dhcpServerOn ? 'SERVER' : 'DISABLE'
  const out: Record<string, string> = {
    goformId: GOFORM.DHCP_SETTING,
    lanIp: p.ipAddress,
    lanNetmask: p.subnetMask,
    lanDhcpType: type,
    dhcp_reboot_flag: '1',
  }
  if (p.dhcpServerOn) {
    if (p.dhcpStart !== undefined) out.dhcpStart = p.dhcpStart
    if (p.dhcpEnd !== undefined) out.dhcpEnd = p.dhcpEnd
    if (p.dhcpLease !== undefined) out.dhcpLease = p.dhcpLease
  }
  if (p.dnsMode !== undefined) out.lan_dns_mode = p.dnsMode
  if (p.dnsIp !== undefined) out.lan_dns_ip = p.dnsIp
  return out
}

export function selectSim(slot: string | number): Record<string, string> {
  return {
    goformId: GOFORM.ALK_SIM_SELECT_WITH_PWD,
    sim_select: String(slot),
    sim_auto_mode: '1',
  }
}

export function urlFilterAdd(url: string): Record<string, string> {
  return { goformId: GOFORM.URL_FILTER_ADD, addURLFilter: url }
}

export function urlFilterDelete(ids: string[]): Record<string, string> {
  return {
    goformId: GOFORM.URL_FILTER_DELETE,
    url_filter_delete_id: ids.length ? ids.join(';') + ';' : '',
  }
}

export function addWhiteSite(site: string, name?: string): Record<string, string> {
  return { goformId: GOFORM.ADD_WHITE_SITE, site, name: name ?? site }
}

export function removeWhiteSite(ids: string[]): Record<string, string> {
  return { goformId: GOFORM.REMOVE_WHITE_SITE, ids: ids.join(',') }
}

export function saveTimeLimited(timeLimited: string): Record<string, string> {
  return { goformId: GOFORM.SAVE_TIME_LIMITED, time_limited: timeLimited }
}

export function enablePin(oldPin: string): Record<string, string> {
  return { goformId: GOFORM.ENABLE_PIN, OldPinNumber: oldPin }
}

export function disablePin(oldPin: string): Record<string, string> {
  return { goformId: GOFORM.DISABLE_PIN, OldPinNumber: oldPin }
}

export function changePin(oldPin: string, newPin: string): Record<string, string> {
  return { goformId: GOFORM.ENABLE_PIN, OldPinNumber: oldPin, NewPinNumber: newPin }
}

export function enterPin(pinNumber: string): Record<string, string> {
  return { goformId: GOFORM.ENTER_PIN, PinNumber: pinNumber }
}

export function enterPuk(pukNumber: string, newPin: string): Record<string, string> {
  return { goformId: GOFORM.ENTER_PUK, PUKNumber: pukNumber, PinNumber: newPin }
}

export function changePassword(oldPlain: string, newPlain: string): Record<string, string> {
  return {
    goformId: GOFORM.CHANGE_PASSWORD,
    oldPassword: b64encode(oldPlain),
    newPassword: b64encode(newPlain),
  }
}

export function writeImei(imeiString: string): Record<string, string> {
  return { goformId: GOFORM.ALK_WRITE_IMEI, imei_string: imeiString }
}

export function rebootDevice(): Record<string, string> {
  return { goformId: GOFORM.REBOOT_DEVICE }
}

export function restoreFactorySettings(): Record<string, string> {
  return { goformId: GOFORM.RESTORE_FACTORY_SETTINGS }
}

export function addDevice(mac: string): Record<string, string> {
  return { goformId: GOFORM.ADD_DEVICE, mac }
}

export function delDevice(mac: string): Record<string, string> {
  return { goformId: GOFORM.DEL_DEVICE, mac }
}

export function editHostname(mac: string, hostname: string): Record<string, string> {
  return { goformId: GOFORM.EDIT_HOSTNAME, mac, hostname }
}

export function setStationControl(apStationEnable: string): Record<string, string> {
  return { goformId: GOFORM.WIFI_STA_CONTROL, wifi_sta_connection: apStationEnable }
}

export function setPowerOnSpeed(fastbootEnabled: string): Record<string, string> {
  return {
    goformId: GOFORM.MGMT_CONTROL_POWER_ON_SPEED,
    mgmt_quicken_power_on: fastbootEnabled,
  }
}

export function flowLimitNvCmd(p: {
  enabled: string
  unit: 'data' | 'time'
  size: string
  alertPercent: string
}): string {
  const en = p.enabled === '1' ? '1' : '0'
  const un = p.unit === 'time' ? 'time' : 'data'
  const sz = (p.size ?? '').replace(/[^0-9._]/g, '') || '0'
  const ap = (p.alertPercent ?? '').replace(/[^0-9]/g, '') || '80'
  return [
    `nv set data_volume_limit_switch=${en}`,
    `nv set data_volume_limit_unit=${un}`,
    `nv set data_volume_limit_size=${sz}`,
    `nv set data_volume_alert_percent=${ap}`,
    'nv save',
  ].join('; ')
}

export const KNOWN_FALSE_SUCCESS = ['SET_FREQ_BAND', 'DATA_LIMIT_SETTING'] as const
