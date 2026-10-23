import type { Component } from 'vue'
import type { IconName } from '@/components/icons'

import TrafficPage from '@/pages/network/TrafficPage.vue'
import SmsPage from '@/pages/network/SmsPage.vue'
import DialPage from '@/pages/network/DialPage.vue'
import ApnPage from '@/pages/network/ApnPage.vue'
import SelectPage from '@/pages/network/SelectPage.vue'
import RfRadarPage from '@/pages/network/RfRadarPage.vue'
import WifiBasicPage from '@/pages/wifi/WifiBasicPage.vue'
import AdvancePage from '@/pages/wifi/AdvancePage.vue'
import MacFilterPage from '@/pages/wifi/MacFilterPage.vue'
import WpsPage from '@/pages/wifi/WpsPage.vue'
import SleepPage from '@/pages/wifi/SleepPage.vue'
import GuestPage from '@/pages/wifi/GuestPage.vue'
import RelayPage from '@/pages/wifi/RelayPage.vue'
import ClientsPage from '@/pages/wifi/ClientsPage.vue'
import DmzPage from '@/pages/security/DmzPage.vue'
import PortForwardPage from '@/pages/security/PortForwardPage.vue'
import PortMapPage from '@/pages/security/PortMapPage.vue'
import PortFilterPage from '@/pages/security/PortFilterPage.vue'
import UrlFilterPage from '@/pages/security/UrlFilterPage.vue'
import FirewallPage from '@/pages/security/FirewallPage.vue'
import ParentalPage from '@/pages/security/ParentalPage.vue'
import PinPage from '@/pages/device/PinPage.vue'
import SimPage from '@/pages/device/SimPage.vue'
import AtToolPage from '@/pages/device/AtToolPage.vue'
import ImeiPage from '@/pages/device/ImeiPage.vue'
import PasswordPage from '@/pages/device/PasswordPage.vue'
import DisplayPage from '@/pages/device/DisplayPage.vue'
import LanPage from '@/pages/device/LanPage.vue'
import DangerPage from '@/pages/more/DangerPage.vue'
import AboutPage from '@/pages/more/AboutPage.vue'
import ThemePage from '@/pages/more/ThemePage.vue'

export interface PageDef {

  path: string

  name: string
  icon: IconName

  desc?: string

  group?: string

  phase?: 'P1' | 'P2' | 'P3'

  component?: Component
}

export interface TabDef {
  key: string

  path: string
  name: string
  icon: IconName
  pages: PageDef[]
}

export const TABS: TabDef[] = [
  {
    key: 'home',
    path: '/home',
    name: '首页',
    icon: 'home',
    pages: [],
  },
  {
    key: 'network',
    path: '/network',
    name: '网络',
    icon: 'signal',
    pages: [
      {
        path: 'radar',
        name: '射频与信号雷达',
        icon: 'target',
        desc: 'Wi-Fi 探测 · 基站邻区全景',
        component: RfRadarPage,
      },
      {
        path: 'select',
        name: '网络设置',
        icon: 'radio-tower',
        desc: '模式 · 锁频段 · 锁小区 · 选网',
        component: SelectPage,
      },
      {
        path: 'traffic',
        name: '流量管理',
        icon: 'activity',
        desc: '套餐限额 · 用量统计',
        component: TrafficPage,
      },
      {
        path: 'sms',
        name: '短信与转发',
        icon: 'mail',
        desc: '收发 · 提取验证码 · Webhook 推送',
        component: SmsPage,
      },
      {
        path: 'dial',
        name: '拨号设置',
        icon: 'zap',
        desc: '自动拨号与漫游',
        component: DialPage,
      },
      { path: 'apn', name: 'APN 设置', icon: 'globe', desc: '接入点与拨号参数', component: ApnPage },
    ],
  },
  {
    key: 'wifi',
    path: '/wifi',
    name: 'WiFi',
    icon: 'wifi',
    pages: [
      {
        path: 'basic',
        name: 'WiFi 基本设置',
        icon: 'wifi',
        desc: 'SSID · 密码 · 信道',
        component: WifiBasicPage,
      },
      {
        path: 'radar',
        name: '周边信号雷达',
        icon: 'target',
        desc: '声呐探测 · 信道拥挤度',
        component: RfRadarPage,
      },
      {
        path: 'advance',
        name: '频段与高级',
        icon: 'sliders',
        desc: '频段 · 带宽 · 发射功率',
        component: AdvancePage,
      },
      {
        path: 'guest',
        name: '副 SSID / 访客',
        icon: 'user-plus',
        desc: '独立 SSID 与隔离',
        component: GuestPage,
      },
      { path: 'relay', name: '无线中继', icon: 'repeat', desc: '中继上游热点', component: RelayPage },
      {
        path: 'clients',
        name: '已连设备与限速',
        icon: 'smartphone',
        desc: '在线设备 · 逐台限速',
        component: ClientsPage,
      },
      {
        path: 'macfilter',
        name: 'MAC 黑名单',
        icon: 'shield-alert',
        desc: '接入控制',
        component: MacFilterPage,
      },
      { path: 'wps', name: 'WPS', icon: 'fingerprint', desc: '一键配对', component: WpsPage },
      {
        path: 'sleep',
        name: 'WiFi 休眠',
        icon: 'moon',
        desc: '定时与空闲自动关闭',
        component: SleepPage,
      },
    ],
  },
  {
    key: 'settings',
    path: '/settings',
    name: '设置',
    icon: 'settings',
    pages: [
      { path: 'sim', name: 'SIM 卡管理', icon: 'sim-card', desc: '槽位 · 切卡 · 双击', group: '设备', component: SimPage },
      { path: 'display', name: '显示管理', icon: 'monitor', desc: '背景 · 动画 · 组件', group: '设备', component: DisplayPage },
      { path: 'at', name: 'AT 工具', icon: 'terminal', desc: '下发 AT 指令', group: '设备', component: AtToolPage },
      { path: 'imei', name: 'IMEI', icon: 'id-card', desc: '查看与修改', group: '设备', component: ImeiPage },
      { path: 'password', name: '管理员密码', icon: 'lock', desc: '登录密码', group: '设备', component: PasswordPage },
      { path: 'pin', name: 'PIN 码', icon: 'key', desc: 'SIM 卡锁', group: '设备', component: PinPage },
      { path: 'lan', name: 'LAN 设置', icon: 'network', desc: '管理地址 · 网段', group: '设备', component: LanPage },

      { path: 'firewall', name: '防火墙', icon: 'shield', desc: 'WAN 管理 · Ping', group: '安全', component: FirewallPage },
      { path: 'portmap', name: '端口映射', icon: 'external-link', desc: '内网服务对外', group: '安全', component: PortMapPage },
      {
        path: 'portforward',
        name: '端口转发',
        icon: 'share-2',
        desc: '转发规则',
        group: '安全',
        component: PortForwardPage,
      },
      { path: 'portfilter', name: '端口过滤', icon: 'ban', desc: '按端口拦截', group: '安全', component: PortFilterPage },
      { path: 'urlfilter', name: 'URL 过滤', icon: 'link-2-off', desc: '按网址拦截', group: '安全', component: UrlFilterPage },
      { path: 'dmz', name: 'DMZ', icon: 'target', desc: '全端口开放给某台设备', group: '安全', component: DmzPage },
      { path: 'parental', name: '家长控制', icon: 'clock', desc: '上网时段', group: '安全', component: ParentalPage },

      { path: 'theme', name: '主题与动效', icon: 'sun', desc: '自定义壁纸 · 液态玻璃 · 动效', group: '关于', component: ThemePage },
      { path: 'about', name: '关于与版本', icon: 'info', desc: '固件 · 硬件版本', group: '关于', component: AboutPage },
      { path: 'danger', name: '危险操作', icon: 'flame', desc: '重启 · 恢复出厂', group: '关于', component: DangerPage },
    ],
  },
]

export const TAB_KEYS = TABS.map((t) => t.key)

export function findTab(key: string): TabDef | undefined {
  return TABS.find((t) => t.key === key)
}

export function findPage(tabKey: string, pagePath: string): PageDef | undefined {
  return findTab(tabKey)?.pages.find((p) => p.path === pagePath)
}

export function pageRoute(tab: TabDef, page: PageDef): string {
  return `${tab.path}/${page.path}`
}

export const TOTAL_PAGES = TABS.reduce((n, t) => n + t.pages.length, 0)

export const IMPLEMENTED_PAGES = TABS.reduce(
  (n, t) => n + t.pages.filter((p) => p.component).length,
  0,
)
