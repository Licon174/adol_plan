export interface StatusValues {

  network_type: string
  sub_network_type: string
  network_provider: string
  signal_strength: string
  signalbar: string
  rssi: string
  rscp: string
  lte_rsrp: string
  lte_sinr: string
  nv_sinr: string
  nv_rsrq: string
  nv_pci: string
  cell_id: string
  nv_globecellid: string
  nv_arfcn: string
  lte_band: string
  simcard_roam: string
  wifi_coverage: string
  wifi_cur_state: string
  MAX_Access_num: string
  ppp_status: string
  sta_ip_status: string
  rj45_state: string
  ethwan_mode: string
  wan_ipaddr: string
  static_wan_ipaddr: string
  ipv6_wan_ipaddr: string
  pdp_type: string
  ipv6_pdp_type: string
  lan_ipaddr: string
  lan_netmask: string
  mac_address: string
  wan_mac: string
  LocalDomain: string
  msisdn: string
  imei: string
  imsi: string
  sim_imsi: string
  ziccid: string
  cr_version: string
  hw_version: string
  dev_sn: string
  up_time: string
  login_need: string

  SSID1: string
  AuthMode: string
  WPAPSK1_encode: string
  ssid: string
  m_ssid_enable: string
  m_SSID: string
  m_AuthMode: string
  m_HideSSID: string
  m_WPAPSK1_encode: string
  m_MAX_Access_num: string

  battery_vol_percent: string
  alk_battery_percent: string
  battery_pers: string
  battery_charging: string
  realtime_tx_bytes: string
  realtime_rx_bytes: string
  realtime_time: string
  realtime_tx_thrpt: string
  realtime_rx_thrpt: string
  monthly_rx_bytes: string
  monthly_tx_bytes: string
  monthly_time: string
  traffic_alined_delta: string
  date_month: string
  data_volume_limit_switch: string
  data_volume_limit_size: string
  data_volume_alert_percent: string
  data_volume_limit_unit: string
  roam_setting_option: string
  spn_name_data: string
  spn_b1_flag: string
  spn_b2_flag: string
  dial_mode: string
  default_wan_name: string
  upg_roam_switch: string
  fota_package_already_download: string

  cell_id_list: string
  global_cell_id: string
  cell_not_correct: string
  csq: string
  wifi_channel: string
  channel_5g: string

  alk_sim_current: string
  alk_sim_mode: string
  alk_check_runsta: string
  sim_select: string
  alk_iccid0: string
  alk_iccid1: string
  alk_iccid2: string
  alk_iccid3: string
  alk_operator0: string
  alk_operator1: string
  alk_operator2: string
  alk_operator3: string
  alk_esim_lock_netflag: string

  opms_wan_auto_mode: string
  ethwan_dialmode: string
  pppoe_username: string
  pppoe_cc: string
  static_wan_netmask: string
  static_wan_gateway: string
  static_wan_primary_dns: string
  static_wan_secondary_dns: string

  sntp_year: string
  sntp_month: string
  sntp_day: string
  sntp_hour: string
  sntp_minute: string
  sntp_second: string
  sntp_timezone: string
  sntp_time_set_mode: string
  sntp_process_result: string

  alk_vpn_server: string
  alk_vpn_type: string
  alk_vpn_status: string
  vpn_channel: string

  station_list: string
  lan_station_list: string
  wifi_sta_connection: string

  network_operator: string
  nv_rsrp: string
  nv_cellid: string
  work_lte_band: string
  ping_google: string
  EX_SSID1: string
  EX_wifi_profile: string

  scan_finish: string

  EX_APLIST: string
  EX_APLIST1: string

  ConnectionMode: string
  current_network_mode: string
  m_netselect_save: string
  m_netselect_status: string
  net_select_mode: string
  m_netselect_contents: string
  net_select: string
  modem_main_state: string

  NoForwarding: string
  m_NoForwarding: string
  NoForwarding_5g: string
  m_NoForwarding_5g: string
  HideSSID: string
  EncrypType: string
  Key1Str1: string
  Key2Str1: string
  Key3Str1: string
  Key4Str1: string
  DefaultKeyID: string
  m_EncrypType: string
  m_DefaultKeyID: string
  m_Key1Str1: string
  m_Key2Str1: string
  m_Key3Str1: string
  m_Key4Str1: string
  rotationFlag: string
  show_qrcode_flag: string
  m_show_qrcode_flag: string
  MAX_Station_num: string
  WPAPSK1_encode_5g: string
  m_WPAPSK1_encode_5g: string

  SSID1_5g: string
  AuthMode_5g: string
  HideSSID_5g: string
  MAX_Access_num_5g: string
  show_qrcode_flag_5g: string
  EncrypType_5g: string
  Key1Str1_5g: string
  Key2Str1_5g: string
  Key3Str1_5g: string
  Key4Str1_5g: string
  DefaultKeyID_5g: string
  m_SSID_5g: string
  m_AuthMode_5g: string
  m_HideSSID_5g: string
  m_MAX_Access_num_5g: string
  m_EncrypType_5g: string
  m_show_qrcode_flag_5g: string
  m_DefaultKeyID_5g: string
  m_Key1Str1_5g: string
  m_Key2Str1_5g: string
  m_Key3Str1_5g: string
  m_Key4Str1_5g: string

  wifi_band: string
  mgmt_quicken_power_on: string
  WirelessMode: string
  WirelessMode_5g: string
  CountryCode: string
  Channel: string
  Channel_5g: string
  HT_MCS: string
  wifi_11n_cap: string
  wifi_11n_cap_5g: string

  ACL_mode: string
  wifi_mac_black_list: string
  wifi_hostname_black_list: string
  wifi_mac_white_list: string
  user_ip_addr: string
  client_mac_address: string
  hostNameList: string

  wifi_wps_index: string
  WscModeOption: string
  wps_mode: string
  WPS_SSID: string

  openEnable: string
  closeEnable: string
  openTime: string
  closeTime: string

  Language: string
  Sleep_interval: string
  update_type: string
  show_advance_setting: string
  super_user: string
  pin_status: string
  loginfo: string
  fota_new_version_state: string
  fota_current_upgrade_state: string
  fota_upgrade_selector: string
  is_mandatory: string
  sta_count: string
  m_sta_count: string
  pswan_priority: string
  wifiwan_priority: string
  ethwan_priority: string

  [key: `APN_configtmp${number}`]: string
  [key: `ipv6_APN_configtmp${number}`]: string

  [key: `wifi_profile${number}`]: string

  apn_index: string
  m_profile_name: string
  profile_name: string
  wan_dial: string
  pdp_select: string
  index: string
  Current_index: string
  apn_auto_config: string
  ipv6_apn_auto_config: string
  apn_mode: string
  wan_apn: string
  ppp_auth_mode: string
  ppp_username: string
  ppp_passtmp: string
  ipv6_wan_apn: string
  ipv6_ppp_auth_mode: string
  ipv6_ppp_username: string
  ipv6_ppp_passtmp: string
  apn_num_preset: string
  wifi_profile_num: string
  wifi_profile: string

  PortMapEnable: string
  PortForwardEnable: string
  IPPortFilterEnable: string
  DefaultFirewallPolicy: string
  websURLFilters: string
  DMZEnable: string
  DMZEnabled: string
  DMZIPAddress: string
  childGroupList: string
  get_user_mac_addr: string
  pinnumber: string
  puknumber: string

  time_limited: string

  RemoteManagement: string
  WANPingFilter: string

  dhcpEnabled: string
  dhcpStart: string
  dhcpEnd: string
  dhcpLease_hour: string
  lan_dns_mode: string
  lan_dns_ip: string

  time_to_live: string

  [key: `PortMapRules_${number}`]: string

  [key: `PortForwardRules_${number}`]: string

  [key: `IPPortFilterRules_${number}`]: string
  [key: `IPPortFilterRulesv6_${number}`]: string
}

export type StatusKey = keyof StatusValues

export type StatusResult<K extends StatusKey = StatusKey> = Record<K, string>

export const HOME_KEYS = [

  'network_type',
  'sub_network_type',
  'network_provider',

  'spn_name_data',

  'alk_sim_current',
  'alk_operator0',
  'alk_operator1',
  'alk_operator2',
  'alk_operator3',

  'sim_imsi',
  'ziccid',
  'rssi',
  'lte_rsrp',
  'rscp',
  'signalbar',
  'simcard_roam',
  'battery_vol_percent',
  'alk_battery_percent',
  'battery_pers',
  'battery_charging',

  'realtime_tx_thrpt',
  'realtime_rx_thrpt',
  'realtime_tx_bytes',
  'realtime_rx_bytes',
  'monthly_rx_bytes',
  'monthly_tx_bytes',
  'data_volume_limit_switch',
  'data_volume_limit_size',
  'data_volume_limit_unit',
  'data_volume_alert_percent',
  'MAX_Access_num',
  'MAX_Access_num_5g',

  'sta_count',
  'ppp_status',
  'lte_band',
  'wifi_band',

  'SSID1',
  'SSID1_5g',
  'AuthMode',
  'AuthMode_5g',
  'WPAPSK1_encode',
  'WPAPSK1_encode_5g',
  'lan_ipaddr',
] as const satisfies readonly StatusKey[]

export const CELL_DETAIL_KEYS = [
  'nv_pci',
  'nv_arfcn',
  'lte_band',
  'nv_sinr',
  'nv_rsrq',
  'lte_rsrp',
  'rssi',
  'nv_globecellid',
  'cell_id',
  'global_cell_id',
  'cell_not_correct',
  'cr_version',
  'hw_version',
  'imei',
  'sim_imsi',
] as const satisfies readonly StatusKey[]

export const SESSION_PROBE_KEYS = [
  'lan_ipaddr',
  'SSID1',
  'rssi',
  'lte_rsrp',
  'station_list',
] as const

export interface CellularInfo {

  networkType: string

  operator: string

  signalDbm: number | null

  signalBars: number

  roaming: boolean

  connected: boolean
}

export interface BatteryInfo {

  present: boolean
  percent: number | null
  charging: boolean

  temp: number | null

  voltage: number | null

  health: string

  chipType: string

  exist: boolean

  powerSource: string
}

export interface TrafficInfo {

  monthlyUsed: number

  monthlyLimit: number | null

  txRate: number

  rxRate: number
}

export interface WifiShareInfo {
  ssid: string

  password: string
  authMode: string

  qrcodeUrl: string
}
