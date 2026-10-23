<script setup lang="ts">import { computed, onMounted, onUnmounted, ref } from 'vue'
import { execSystem, getStatus, post } from '@/api'
import { toast } from '@/components/toast'
import { confirm } from '@/components/confirm'
import PageForm from '@/layouts/PageForm.vue'
import Card from '@/components/Card.vue'
import Icon from '@/components/Icon.vue'
import FormField from '@/components/FormField.vue'
import Toggle from '@/components/Toggle.vue'

interface RawSmsItem {
  id: string
  number: string
  content: string
  date: string
  tag: string
  received_all_concat_sms?: string
}

interface SmsItem {
  id: string
  number: string
  rawContent: string
  text: string
  date: string
  isUnread: boolean
  code: string | null
}

interface WebhookConfig {
  enabled: boolean
  onlyCode: boolean
  channel: 'bark' | 'wxpusher' | 'ntfy' | 'telegram' | 'dingtalk' | 'wecom' | 'feishu' | 'custom'
  keyword: string
  barkUrl: string
  wxpusherSpt: string
  wxpusherAppToken: string
  wxpusherUid: string
  ntfyTopic: string
  ntfyServer: string
  tgBotToken: string
  tgChatId: string
  dingtalkToken: string
  feishuUrl: string
  wecomKey: string
  customUrl: string
}

const DEFAULT_WEBHOOK: WebhookConfig = {
  enabled: false,
  onlyCode: false,
  channel: 'bark',
  keyword: 'a豆',
  barkUrl: '',
  wxpusherSpt: '',
  wxpusherAppToken: '',
  wxpusherUid: '',
  ntfyTopic: '',
  ntfyServer: 'https://ntfy.sh',
  tgBotToken: '',
  tgChatId: '',
  dingtalkToken: '',
  feishuUrl: '',
  wecomKey: '',
  customUrl: '',
}

const messages = ref<SmsItem[]>([])
const loading = ref(true)
const busy = ref(false)
const error = ref('')
const maxSeenId = ref<number>(0)

const showCompose = ref(false)
const sendNumber = ref('')
const sendText = ref('')
const sending = ref(false)

const webhook = ref<WebhookConfig>({ ...DEFAULT_WEBHOOK })
const testingPush = ref(false)

function decodeSms(hex: string): string {
  if (!hex) return ''

  if (!/^[0-9a-fA-F]+$/.test(hex)) return hex
  let out = ''
  for (let i = 0; i < hex.length; i += 4) {
    const chunk = hex.slice(i, i + 4)
    if (chunk.length < 4) break
    const c = parseInt(chunk, 16)
    if (!Number.isNaN(c) && c !== 0 && c !== 9) {
      out += String.fromCharCode(c)
    }
  }
  return out
}

function encodeSms(text: string): string {
  if (!text) return ''
  let out = ''
  for (let i = 0; i < text.length; i++) {
    out += text.charCodeAt(i).toString(16).toUpperCase().padStart(4, '0')
  }
  return out
}

function extractCode(content: string): string | null {
  if (!content) return null

  const m1 = content.match(/(?:验证码|校验码|动态码|确认码|随机码|认证码|code|Code|CODE)[^\d]{0,12}(\d{4,8})/)
  if (m1 && m1[1]) return m1[1]

  const m2 = content.match(/(?<!\d)(\d{6})(?!\d)/)
  if (m2 && m2[1]) return m2[1]
  return null
}

function formatDate(raw: string): string {
  if (!raw) return '—'

  const p = raw.split(',')
  if (p.length >= 5) {
    const y = p[0].length === 2 ? '20' + p[0] : p[0]
    return `${y}-${p[1]}-${p[2]} ${p[3]}:${p[4]}`
  }
  return raw
}

function getNowSmsTime(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const y = String(d.getFullYear()).slice(-2)
  return `${y},${pad(d.getMonth() + 1)},${pad(d.getDate())},${pad(d.getHours())},${pad(d.getMinutes())},${pad(d.getSeconds())},+32`
}

async function loadMessages(quiet = false): Promise<void> {
  if (!quiet) loading.value = true
  try {
    const res = (await getStatus([
      'sms_data_total' as any,
    ])) as unknown as Record<string, any>

    let list: RawSmsItem[] = []
    if (res && res.messages && Array.isArray(res.messages)) {
      list = res.messages
    }

    const parsed: SmsItem[] = list.map((m) => {
      const text = decodeSms(m.content)
      return {
        id: String(m.id),
        number: String(m.number || '未知号码'),
        rawContent: m.content,
        text,
        date: formatDate(m.date),
        isUnread: String(m.tag) === '1',
        code: extractCode(text),
      }
    })

    if (maxSeenId.value > 0 && parsed.length > 0) {
      for (const item of parsed) {
        const idNum = parseInt(item.id, 10)
        if (idNum > maxSeenId.value) {
          onNewSmsReceived(item)
        }
      }
    }

    if (parsed.length > 0) {
      const maxId = Math.max(...parsed.map((x) => parseInt(x.id, 10) || 0))
      maxSeenId.value = Math.max(maxSeenId.value, maxId)
    }

    messages.value = parsed
    error.value = ''
  } catch (e) {
    if (!quiet) error.value = e instanceof Error ? e.message : '获取短信失败'
  } finally {
    if (!quiet) loading.value = false
  }
}

const unreadCount = computed(() => messages.value.filter((m) => m.isUnread).length)

async function copyCode(code: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(code)
    toast(`已复制验证码: ${code}`, 'success')
  } catch {
    toast(`复制失败，验证码为: ${code}`, 'error')
  }
}

async function markRead(item: SmsItem): Promise<void> {
  busy.value = true
  try {
    await post({ goformId: 'SET_MSG_READ', msg_id: `${item.id};`, tag: '0' })
    item.isUnread = false
    toast('已标记为已读', 'success')
  } catch (e) {
    toast(e instanceof Error ? e.message : '操作失败', 'error')
  } finally {
    busy.value = false
  }
}

async function deleteOne(item: SmsItem): Promise<void> {
  const ok = await confirm({
    title: '删除短信',
    message: `确定要删除来自 ${item.number} 的短信吗？`,
    danger: true,
  })
  if (!ok) return
  busy.value = true
  try {
    await post({ goformId: 'DELETE_SMS', msg_id: `${item.id};` })
    messages.value = messages.value.filter((x) => x.id !== item.id)
    toast('短信已删除', 'success')
  } catch (e) {
    toast(e instanceof Error ? e.message : '删除失败', 'error')
  } finally {
    busy.value = false
  }
}

async function deleteAll(): Promise<void> {
  if (messages.value.length === 0) return
  const ok = await confirm({
    title: '清空全部短信',
    message: '确定要删除设备内的所有短信吗？此操作不可撤销。',
    danger: true,
  })
  if (!ok) return
  busy.value = true
  try {
    await post({ goformId: 'ALL_DELETE_SMS', mem_store: '1' })
    messages.value = []
    toast('所有短信已清空', 'success')
  } catch (e) {
    toast(e instanceof Error ? e.message : '清空失败', 'error')
  } finally {
    busy.value = false
  }
}

function reply(item: SmsItem): void {
  sendNumber.value = item.number
  sendText.value = ''
  showCompose.value = true
}

async function doSend(): Promise<void> {
  const num = sendNumber.value.trim()
  const txt = sendText.value.trim()
  if (!num) {
    toast('请输入接收号码', 'error')
    return
  }
  if (!txt) {
    toast('请输入短信内容', 'error')
    return
  }
  sending.value = true
  try {
    const payload = {
      goformId: 'SEND_SMS',
      notCallback: 'true',
      Number: num,
      sms_time: getNowSmsTime(),
      MessageBody: encodeSms(txt),
      encode_type: 'UNICODE',
    }
    const res = await post(payload)
    if (res.result === 'failure') {
      toast('发送失败，请确认 SIM 卡是否支持短信功能', 'error')
    } else {
      toast('短信发送指令已提交', 'success')
      showCompose.value = false
      sendText.value = ''
      await loadMessages(true)
    }
  } catch (e) {
    toast(e instanceof Error ? e.message : '发送失败', 'error')
  } finally {
    sending.value = false
  }
}

function buildPushContent(
  cfg: WebhookConfig,
  item: { number: string; text: string; code: string | null },
): {
  title: string
  body: string
} {
  const kw = cfg.keyword?.trim() || 'a豆'
  const codePart = item.code ? `【验证码: ${item.code}】` : ''
  const title = `【${kw}】收到新短信 ${codePart}`.trim()
  const body = `来自: ${item.number}\n内容: ${item.text}`
  return { title, body }
}

async function triggerWebhook(
  cfg: WebhookConfig,
  msg: { number: string; text: string; code: string | null },
): Promise<{ ok: boolean; error?: string }> {
  const { title, body } = buildPushContent(cfg, msg)
  try {
    if (cfg.channel === 'bark') {
      let url = cfg.barkUrl.trim()
      if (!url.startsWith('http')) {
        url = `https://api.day.app/${url}`
      }
      url = url.replace(/\/+$/, '')
      const postUrl = `${url}/`
      const r = await fetch(postUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          body,
          group: cfg.keyword?.trim() || '随身WiFi短信',
          copy: msg.code || undefined,
        }),
      })
      return { ok: r.ok }
    }

    if (cfg.channel === 'wxpusher') {
      const spt = (cfg.wxpusherSpt || '').trim()
      const appToken = (cfg.wxpusherAppToken || '').trim()
      const uid = (cfg.wxpusherUid || '').trim()
      const summary = msg.code ? `【验证码: ${msg.code}】` : title
      const content = `${title}\n来自: ${msg.number}\n时间: ${new Date().toLocaleString()}\n\n${msg.text}`

      if (spt) {
        const r = await fetch('https://wxpusher.zjiecode.com/api/send/message/simple-push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            spt,
            content,
            summary,
            contentType: 1,
          }),
        })
        const data = await r.json()
        return { ok: data.code === 1000, error: data.msg }
      }

      if (appToken && uid) {
        const r = await fetch('https://wxpusher.zjiecode.com/api/send/message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            appToken,
            content,
            summary,
            contentType: 1,
            uids: [uid],
          }),
        })
        const data = await r.json()
        return { ok: data.code === 1000, error: data.msg }
      }

      return { ok: false, error: '请填入 WxPusher SPT' }
    }

    if (cfg.channel === 'ntfy') {
      const server = (cfg.ntfyServer.trim() || 'https://ntfy.sh').replace(/\/+$/, '')
      const topic = cfg.ntfyTopic.trim()
      const r = await fetch(server, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          title,
          message: body,
          tags: msg.code ? ['key', 'envelope'] : ['envelope'],
          priority: 4,
        }),
      })
      return { ok: r.ok }
    }

    if (cfg.channel === 'telegram') {
      const token = cfg.tgBotToken.trim()
      const chatId = cfg.tgChatId.trim()
      const url = `https://api.telegram.org/bot${token}/sendMessage`
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: `🔔 *${title}*\n\n${body}`,
          parse_mode: 'Markdown',
        }),
      })
      return { ok: r.ok }
    }

    if (cfg.channel === 'dingtalk') {
      let url = cfg.dingtalkToken.trim()
      if (!url.startsWith('http')) {
        url = `https://oapi.dingtalk.com/robot/send?access_token=${url}`
      }
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          msgtype: 'text',
          text: { content: `${title}\n${body}` },
        }),
      })
      return { ok: r.ok }
    }

    if (cfg.channel === 'feishu') {
      const url = cfg.feishuUrl.trim()
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          msg_type: 'text',
          content: { text: `${title}\n${body}` },
        }),
      })
      return { ok: r.ok }
    }

    if (cfg.channel === 'wecom') {
      let url = cfg.wecomKey.trim()
      if (!url.startsWith('http')) {
        url = `https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=${url}`
      }
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          msgtype: 'text',
          text: { content: `${title}\n${body}` },
        }),
      })
      return { ok: r.ok }
    }

    if (cfg.channel === 'custom') {
      const r = await fetch(cfg.customUrl.trim(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, from: msg.number, content: msg.text, code: msg.code }),
      })
      return { ok: r.ok }
    }

    return { ok: false, error: '未知推送渠道' }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '网络请求失败' }
  }
}

function onNewSmsReceived(item: SmsItem): void {

  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(`新短信 (${item.number})`, {
      body: item.code ? `【验证码: ${item.code}】${item.text}` : item.text,
      icon: './favicon.ico',
    })
  }

  if (webhook.value.enabled) {
    if (webhook.value.onlyCode && !item.code) return
    void triggerWebhook(webhook.value, item).then((res) => {
      if (res.ok) {
        toast(`新短信已自动推送转发 (${item.number})`, 'success')
      }
    })
  }
}

async function testPush(): Promise<void> {
  testingPush.value = true
  try {
    const testData = {
      number: '10086',
      text: '【测试通知】您的随身WiFi短信推送转发通道配置成功！验证码为 889922，请勿泄露。',
      code: '889922',
    }
    const res = await triggerWebhook(webhook.value, testData)
    if (res.ok) {
      toast('测试通知推送成功！请检查手机客户端是否收到弹窗', 'success')
    } else {
      toast(`推送失败: ${res.error || '请检查配置地址与网络'}`, 'error')
    }
  } finally {
    testingPush.value = false
  }
}

function loadConfig(): void {
  try {
    const s = localStorage.getItem('adol_sms_webhook')
    if (s) {
      webhook.value = { ...DEFAULT_WEBHOOK, ...JSON.parse(s) }
    }
  } catch {

  }
}

function saveConfig(): void {
  try {
    localStorage.setItem('adol_sms_webhook', JSON.stringify(webhook.value))

    const jsonStr = JSON.stringify(webhook.value).replace(/'/g, "'\\''")
    void execSystem(`mkdir -p /mnt/userdata/adol; printf '%s' '${jsonStr}' > /mnt/userdata/adol/sms_webhook.json`)
    toast('转发设置已保存', 'success')
  } catch {
    toast('保存失败', 'error')
  }
}

let pollTimer: number | null = null

onMounted(() => {
  loadConfig()
  void loadMessages()
  if ('Notification' in window && Notification.permission === 'default') {
    void Notification.requestPermission()
  }
  pollTimer = window.setInterval(() => {
    void loadMessages(true)
  }, 6000)
})

onUnmounted(() => {
  if (pollTimer !== null) {
    clearInterval(pollTimer)
    pollTimer = null
  }
})
</script>

<template>
  <PageForm title="短信中心" :loading="loading" :error="error" :savable="false">
    <template #right>
      <button type="button" class="icon-btn" aria-label="刷新" :disabled="busy" @click="loadMessages(false)">
        <Icon name="refresh" :size="20" />
      </button>
    </template>

    <div class="sms-container">

      <Card v-if="showCompose" title="编写新短信">
        <div class="compose-box">
          <FormField label="接收号码">
            <input
              v-model="sendNumber"
              type="tel"
              placeholder="如 10086 / 13800000000"
              :disabled="sending"
            />
          </FormField>
          <FormField label="短信内容">
            <textarea
              v-model="sendText"
              rows="3"
              placeholder="输入短信文本内容…"
              :disabled="sending"
            />
          </FormField>
          <div class="btn-row mt">
            <button
              type="button"
              class="btn btn-ghost flex-1"
              :disabled="sending"
              @click="showCompose = false"
            >
              取消
            </button>
            <button
              type="button"
              class="btn btn-primary flex-1"
              :disabled="sending || !sendNumber || !sendText"
              @click="doSend"
            >
              <Icon name="send" :size="16" />
              <span>{{ sending ? '正在发送…' : '发送短信' }}</span>
            </button>
          </div>
        </div>
      </Card>

      <Card title="短信收件箱">
        <div class="inbox-header">
          <div class="inbox-meta">
            <span class="num t-cap">共 {{ messages.length }} 条短信</span>
            <span v-if="unreadCount > 0" class="badge-unread">{{ unreadCount }} 未读</span>
          </div>
          <div class="inbox-actions">
            <button
              type="button"
              class="btn btn-secondary btn-compact"
              :disabled="busy"
              @click="showCompose = true"
            >
              <Icon name="plus" :size="14" />
              <span>写短信</span>
            </button>
            <button
              v-if="messages.length > 0"
              type="button"
              class="btn btn-danger btn-compact"
              :disabled="busy"
              @click="deleteAll"
            >
              清空
            </button>
          </div>
        </div>

        <div v-if="messages.length === 0" class="empty-box">
          <Icon name="mail" :size="40" class="t-cap" />
          <p class="empty-txt">收件箱暂无短信</p>
        </div>

        <div v-else class="sms-list">
          <div
            v-for="item in messages"
            :key="item.id"
            class="sms-card"
            :class="{ 'is-unread': item.isUnread }"
          >
            <div class="sms-top">
              <div class="sms-from">
                <span class="sender num">{{ item.number }}</span>
                <span v-if="item.isUnread" class="badge-unread">未读</span>
              </div>
              <span class="sms-date t-cap num">{{ item.date }}</span>
            </div>

            <div v-if="item.code" class="code-banner">
              <div class="code-info">
                <span class="code-tag">提取到验证码</span>
                <span class="code-num num">{{ item.code }}</span>
              </div>
              <button
                type="button"
                class="btn btn-primary btn-compact copy-btn"
                @click="copyCode(item.code)"
              >
                <Icon name="copy" :size="14" />
                <span>复制验证码</span>
              </button>
            </div>

            <div class="sms-body">
              <p class="sms-text">{{ item.text || '（空内容）' }}</p>
            </div>

            <div class="sms-actions">
              <button
                v-if="item.isUnread"
                type="button"
                class="btn-text"
                :disabled="busy"
                @click="markRead(item)"
              >
                标为已读
              </button>
              <button
                type="button"
                class="btn-text"
                :disabled="busy"
                @click="reply(item)"
              >
                回复
              </button>
              <button
                type="button"
                class="btn-text t-danger"
                :disabled="busy"
                @click="deleteOne(item)"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      </Card>

      <Card title="Webhook 自动转发">
        <div class="switch-row">
          <div class="wh-status-head">
            <span class="switch-title">新短信自动推送</span>
            <span class="wh-badge" :class="{ 'is-on': webhook.enabled }">
              {{ webhook.enabled ? `● 已启用 (${webhook.channel.toUpperCase()})` : '未启用' }}
            </span>
          </div>
          <Toggle v-model="webhook.enabled" label="启用转发" />
        </div>

        <Transition name="fade">
          <div v-if="webhook.enabled" class="webhook-settings mt">
            <div class="switch-row" style="margin-bottom: 14px">
              <span class="t-sub">仅转发含验证码短信</span>
              <Toggle v-model="webhook.onlyCode" label="仅验证码" />
            </div>

            <FormField label="推送渠道">
              <select v-model="webhook.channel">
                <option value="bark">Bark (iOS)</option>
                <option value="wxpusher">WxPusher (微信)</option>
                <option value="ntfy">ntfy.sh</option>
                <option value="telegram">Telegram</option>
                <option value="dingtalk">钉钉机器人</option>
                <option value="wecom">企业微信</option>
                <option value="feishu">飞书机器人</option>
                <option value="custom">自定义 POST</option>
              </select>
            </FormField>

            <div class="wh-fields">
              <FormField v-if="webhook.channel === 'bark'" label="Bark Key / URL">
                <input
                  v-model="webhook.barkUrl"
                  type="text"
                  placeholder="https://api.day.app/... 或 Key"
                />
              </FormField>

              <FormField v-if="webhook.channel === 'wxpusher'" label="WxPusher SPT">
                <input
                  v-model="webhook.wxpusherSpt"
                  class="num"
                  type="text"
                  placeholder="SPT_xxxxxxxx"
                />
              </FormField>

              <template v-if="webhook.channel === 'ntfy'">
                <FormField label="Topic">
                  <input
                    v-model="webhook.ntfyTopic"
                    class="num"
                    type="text"
                    placeholder="topic_name"
                  />
                </FormField>
                <FormField label="服务器">
                  <input
                    v-model="webhook.ntfyServer"
                    type="url"
                    placeholder="https://ntfy.sh"
                  />
                </FormField>
              </template>

              <template v-if="webhook.channel === 'telegram'">
                <FormField label="Bot Token">
                  <input
                    v-model="webhook.tgBotToken"
                    class="num"
                    type="text"
                    placeholder="Token"
                  />
                </FormField>
                <FormField label="Chat ID">
                  <input
                    v-model="webhook.tgChatId"
                    class="num"
                    type="text"
                    placeholder="Chat ID"
                  />
                </FormField>
              </template>

              <FormField
                v-if="webhook.channel === 'dingtalk' || webhook.channel === 'feishu' || webhook.channel === 'wecom'"
                label="安全关键词"
              >
                <input
                  v-model="webhook.keyword"
                  type="text"
                  placeholder="匹配关键词"
                />
              </FormField>

              <FormField v-if="webhook.channel === 'dingtalk'" label="Webhook / Token">
                <input
                  v-model="webhook.dingtalkToken"
                  type="text"
                  placeholder="Webhook URL"
                />
              </FormField>

              <FormField v-if="webhook.channel === 'feishu'" label="Webhook URL">
                <input
                  v-model="webhook.feishuUrl"
                  type="text"
                  placeholder="Webhook URL"
                />
              </FormField>

              <FormField v-if="webhook.channel === 'wecom'" label="Webhook / Key">
                <input
                  v-model="webhook.wecomKey"
                  type="text"
                  placeholder="Webhook URL"
                />
              </FormField>

              <FormField v-if="webhook.channel === 'custom'" label="POST URL">
                <input
                  v-model="webhook.customUrl"
                  type="url"
                  placeholder="https://domain.com/hook"
                />
              </FormField>
            </div>

            <div class="wh-actions mt-3">
              <button
                type="button"
                class="btn btn-secondary flex-1"
                :disabled="testingPush"
                @click="testPush"
              >
                {{ testingPush ? '测试中…' : '测试推送' }}
              </button>
              <button
                type="button"
                class="btn btn-primary flex-1"
                @click="saveConfig"
              >
                保存配置
              </button>
            </div>
          </div>
        </Transition>
      </Card>
    </div>
  </PageForm>
</template>

<style scoped>
.sms-container {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  padding-bottom: calc(var(--tabbar-h) + var(--sp-6));
}

.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: var(--r-sm);
  color: var(--c-text-2);
}

.inbox-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-2);
  margin-bottom: var(--sp-3);
}

.inbox-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.badge-unread {
  font-size: var(--fs-cap);
  color: #ffffff;
  background: var(--c-danger, #e53e3e);
  padding: 1px 6px;
  border-radius: var(--r-full);
  font-weight: 600;
}

.empty-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--sp-6) 0;
  color: var(--c-text-3);
  gap: var(--sp-2);
}

.empty-txt {
  font-size: var(--fs-sub);
}

.sms-list {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}

.sms-card {
  padding: var(--sp-4);
  border: 1px solid var(--glass-border, var(--c-line));
  border-radius: var(--r-lg);
  background: var(--glass-bg, var(--c-surface));
  backdrop-filter: blur(12px);
  box-shadow: var(--shadow-sm);
  transition: all 0.15s ease;
}

.sms-card.is-unread {
  border-left: 4px solid var(--c-primary-400);
  background: var(--c-primary-50);
}

[data-theme='dark'] .sms-card.is-unread {
  background: rgba(34, 181, 134, 0.14);
}

.sms-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--sp-2);
}

.sms-from {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sender {
  font-size: var(--fs-body);
  font-weight: 600;
  color: var(--c-text-1);
}

.code-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-2);
  padding: 10px 14px;
  background: var(--c-surface-2);
  border: 1px dashed var(--c-primary-400);
  border-radius: var(--r-md);
  margin-bottom: var(--sp-2);
}

.code-info {
  display: flex;
  flex-direction: column;
}

.code-tag {
  font-size: 11px;
  color: var(--c-text-3);
}

.code-num {
  font-size: var(--fs-h2);
  font-weight: 700;
  color: var(--c-primary-400);
  letter-spacing: 2px;
}

.copy-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.sms-body {
  margin-bottom: var(--sp-2);
}

.sms-text {
  font-size: var(--fs-sub);
  color: var(--c-text-1);
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

.sms-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--sp-3);
  border-top: 1px solid var(--c-line-subtle, rgba(0, 0, 0, 0.05));
  padding-top: 6px;
}

.btn-text {
  background: none;
  border: none;
  font-size: var(--fs-cap);
  color: var(--c-primary-600);
  cursor: pointer;
  padding: 4px 6px;
}

.btn-text.t-danger {
  color: var(--c-danger, #e53e3e);
}

.switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
}

.switch-title {
  font-size: var(--fs-body);
  font-weight: 600;
}

.wh-status-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.wh-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: var(--r-full);
  background: var(--c-surface-2);
  color: var(--c-text-3);
}

.wh-badge.is-on {
  background: var(--c-primary-50);
  color: var(--c-primary-600);
}

[data-theme='dark'] .wh-badge.is-on {
  background: rgba(34, 181, 134, 0.2);
  color: var(--c-primary-400);
}

.webhook-settings {
  padding-top: var(--sp-3);
  border-top: 1px solid var(--c-line);
}

.channel-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
  margin-bottom: var(--sp-4);
}

.ch-pill {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 8px 4px;
  border-radius: var(--r-md);
  background: var(--c-surface-2);
  border: 1px solid var(--c-line);
  transition: all 0.15s ease;
}

.ch-pill:active {
  transform: scale(0.95);
}

.ch-pill.is-on {
  border-color: var(--c-primary-400);
  background: var(--c-primary-50);
  box-shadow: 0 0 8px rgba(28, 165, 123, 0.18);
}

[data-theme='dark'] .ch-pill.is-on {
  background: rgba(34, 181, 134, 0.16);
}

.ch-name {
  font-size: 12px;
  font-weight: 700;
  color: var(--c-text-1);
}

.ch-pill.is-on .ch-name {
  color: var(--c-primary-600);
}

[data-theme='dark'] .ch-pill.is-on .ch-name {
  color: var(--c-primary-400);
}

.ch-sub {
  font-size: 10px;
  color: var(--c-text-3);
  margin-top: 1px;
}

.wh-fields {
  margin-top: var(--sp-2);
}

.btn-row {
  display: flex;
  gap: var(--sp-2);
}

.flex-1 {
  flex: 1;
}

.mt {
  margin-top: var(--sp-3);
}

.btn-compact {
  min-height: 32px;
  padding: 0 var(--sp-3);
  font-size: var(--fs-cap);
}
</style>
