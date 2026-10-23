<script setup lang="ts">import { computed, ref } from 'vue'
import {
  URL_FILTER_KEYS,
  addWhiteSite,
  getStatus,
  post,
  urlFilterAdd,
  urlFilterDelete,
} from '@/api'
import { toast } from '@/components/toast'
import { confirm } from '@/components/confirm'
import { withLoading } from '@/components/loading'
import { validateUrlFilter } from '@/utils/validators'
import PageForm from '@/layouts/PageForm.vue'
import Card from '@/components/Card.vue'
import Icon from '@/components/Icon.vue'

const rawText = ref('')
const loading = ref(true)
const error = ref('')
const busy = ref(false)
const newUrl = ref('')
const newSite = ref('')

async function load(): Promise<void> {
  loading.value = true
  try {
    const s = (await getStatus(URL_FILTER_KEYS)) as Record<string, string>
    rawText.value = s.websURLFilters ?? ''
    error.value = ''
  } catch (e) {
    error.value = e instanceof Error ? e.message : '读取失败'
  } finally {
    loading.value = false
  }
}
void load()

const urls = computed(() =>
  (rawText.value ?? '')
    .split(/[;\r\n]+/)
    .map((x) => x.trim())
    .filter(Boolean),
)

async function add(): Promise<void> {
  const u = newUrl.value.trim()
  const err = validateUrlFilter(u)
  if (err) {
    toast(err, 'error')
    return
  }
  if (urls.value.includes(u)) {
    toast('该项已存在', 'error')
    return
  }
  busy.value = true
  try {
    await withLoading(async () => {
      const res = await post(urlFilterAdd(u))
      if (res.result !== 'success') throw new Error(res.result || '添加失败')
    }, '正在添加…')
    toast('已添加', 'success')
    newUrl.value = ''
    await load()
  } catch (e) {
    toast(e instanceof Error ? e.message : '添加失败', 'error')
  } finally {
    busy.value = false
  }
}

async function remove(index: number): Promise<void> {
  const ok = await confirm({
    title: '删除过滤项',
    message: `删除「${urls.value[index]}」？`,
    danger: true,
  })
  if (!ok) return
  busy.value = true
  try {
    await withLoading(async () => {
      const res = await post(urlFilterDelete([String(index)]))
      if (res.result !== 'success') throw new Error(res.result || '删除失败')
    }, '正在删除…')
    toast('已删除', 'success')
    await load()
  } catch (e) {
    toast(e instanceof Error ? e.message : '删除失败', 'error')
  } finally {
    busy.value = false
  }
}

async function addSite(): Promise<void> {
  const s = newSite.value.trim()
  if (!s) {
    toast('请输入白名单网址', 'error')
    return
  }
  const err = validateUrlFilter(s)
  if (err) {
    toast(err, 'error')
    return
  }
  busy.value = true
  try {
    await withLoading(async () => {
      const res = await post(addWhiteSite(s))
      if (res.result !== 'success') throw new Error(res.result || '添加失败')
    }, '正在添加…')
    toast('已加入白名单（无法回显列表，添加即生效）', 'success')
    newSite.value = ''
    await load()
  } catch (e) {
    toast(e instanceof Error ? e.message : '添加失败', 'error')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <PageForm title="URL 过滤" :loading="loading" :error="error" :savable="false">

    <Card>
      <div class="url-hero">
        <div class="url-hero-left">
          <div class="url-hero-icon" :class="{ 'is-active': urls.length > 0 }">
            <Icon name="globe" :size="22" />
          </div>
          <div class="url-hero-meta">
            <div class="url-title-row">
              <span class="url-name">域名与网址访问拦截</span>
              <span class="status-pill" :class="urls.length > 0 ? 'pill-on' : 'pill-off'">
                {{ urls.length > 0 ? `黑名单规则 ${urls.length} 项` : '未配置拦截项' }}
              </span>
            </div>
            <span class="t-cap">
              {{ urls.length > 0 ? '路由器 DNS / HTTP 引擎将对命中黑名单的域名请求直接拒绝解析' : '所有终端网页访问请求默认放行' }}
            </span>
          </div>
        </div>
      </div>
    </Card>

    <Card :title="`拦截黑名单 (${urls.length})`">
      <div class="add-bar">
        <input
          v-model="newUrl"
          type="text"
          class="add-input"
          autocomplete="off"
          spellcheck="false"
          placeholder="输入要拦截的域名，如 example.com"
          @keyup.enter="add"
        />
        <button type="button" class="btn-add" :disabled="busy || !newUrl.trim()" @click="add">
          <Icon name="plus" :size="14" />
          <span>添加拦截</span>
        </button>
      </div>

      <div v-if="urls.length" class="url-list">
        <div v-for="(u, i) in urls" :key="`${u}-${i}`" class="url-item">
          <div class="url-item-left">
            <Icon name="ban" :size="14" class="ban-ic" />
            <span class="num url-text">{{ u }}</span>
          </div>
          <button type="button" class="btn-del" :disabled="busy" title="删除" @click="remove(i)">
            <Icon name="trash" :size="15" />
          </button>
        </div>
      </div>
      <div v-else class="empty-box">
        <p class="empty-title">当前暂无网址拦截项</p>
        <p class="t-cap">在上方输入域名并添加，即可禁止局域网终端访问指定站点</p>
      </div>
    </Card>

    <Card title="网址特许白名单">
      <div class="firmware-notice">
        <Icon name="info" :size="15" class="notice-ic" />
        <span class="t-cap notice-text">
          说明：本型号设备底层白名单为「只进不出」文件流机制（添加会直接写入设备 white_site_file 特许规则库生效，但固件不提供回显读回接口）。
        </span>
      </div>

      <div class="add-bar">
        <input
          v-model="newSite"
          type="text"
          class="add-input"
          autocomplete="off"
          spellcheck="false"
          placeholder="输入要特许放行的白名单域名"
          @keyup.enter="addSite"
        />
        <button type="button" class="btn-add-white" :disabled="busy || !newSite.trim()" @click="addSite">
          <span>写入白名单</span>
        </button>
      </div>
    </Card>
  </PageForm>
</template>

<style scoped>
.url-hero { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-3); }
.url-hero-left { display: flex; align-items: center; gap: var(--sp-3); min-width: 0; }
.url-hero-icon { width: 44px; height: 44px; border-radius: var(--r-md); background: var(--c-surface-2); color: var(--c-text-3); display: flex; align-items: center; justify-content: center; flex: none; transition: all 0.2s ease; }
.url-hero-icon.is-active { background: var(--c-primary-50); color: var(--c-primary-400); }
[data-theme='dark'] .url-hero-icon.is-active { background: var(--c-primary-100); color: var(--c-primary-600); }

.url-hero-meta { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.url-title-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.url-name { font-size: var(--fs-h2); font-weight: 700; color: var(--c-text-1); }
.status-pill { font-size: 11px; font-weight: 600; padding: 1px 7px; border-radius: var(--r-sm); }
.pill-on { background: var(--c-primary-50); color: var(--c-primary-600); }
[data-theme='dark'] .pill-on { background: rgba(34, 181, 134, 0.2); color: var(--c-primary-400); }
.pill-off { background: var(--c-surface-2); color: var(--c-text-3); }

.add-bar { display: flex; gap: var(--sp-2); margin-bottom: var(--sp-3); }
.add-input { flex: 1; height: 38px; padding: 0 var(--sp-3); background: var(--c-surface-2); border: 1px solid var(--c-line); border-radius: var(--r-sm); color: var(--c-text-1); font-size: 13px; outline: none; }
.add-input:focus { border-color: var(--c-primary-400); }
.btn-add { display: inline-flex; align-items: center; gap: 4px; padding: 0 16px; border-radius: var(--r-sm); background: var(--c-primary-400); color: #fff; border: none; font-size: 13px; font-weight: 600; cursor: pointer; flex: none; }
.btn-add:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-add-white { display: inline-flex; align-items: center; padding: 0 16px; border-radius: var(--r-sm); background: var(--c-surface-2); color: var(--c-text-1); border: 1px solid var(--c-line); font-size: 13px; font-weight: 600; cursor: pointer; flex: none; }
.btn-add-white:hover:not(:disabled) { border-color: var(--c-primary-400); }

.url-list { display: flex; flex-direction: column; gap: var(--sp-2); }
.url-item { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border-radius: var(--r-sm); background: var(--c-surface); border: 1px solid var(--c-line); }
.url-item-left { display: flex; align-items: center; gap: var(--sp-2); min-width: 0; }
.ban-ic { color: var(--c-danger); flex: none; }
.url-text { font-size: 13px; font-weight: 600; color: var(--c-text-1); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.btn-del { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: var(--r-sm); background: transparent; color: var(--c-text-3); border: none; cursor: pointer; flex: none; }
.btn-del:hover { background: var(--c-danger-bg); color: var(--c-danger); }

.firmware-notice { display: flex; align-items: flex-start; gap: 8px; margin-bottom: var(--sp-3); padding: 8px 12px; border-radius: var(--r-sm); background: var(--c-surface-2); color: var(--c-text-2); }
.notice-ic { flex: none; margin-top: 2px; color: var(--c-primary-400); }
.notice-text { color: inherit !important; line-height: 1.4; }

.empty-box { text-align: center; padding: var(--sp-4) 0; }
.empty-title { font-size: 13px; font-weight: 600; color: var(--c-text-2); margin-bottom: 2px; }
</style>
