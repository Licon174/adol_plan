import { computed, ref, type Ref } from 'vue'
import { getStatus, post, type StatusKey } from '@/api'
import { toast } from '@/components/toast'
import { confirm } from '@/components/confirm'
import { withLoading } from '@/components/loading'

export interface UsePageFormOptions<M> {

  keys: readonly StatusKey[]

  fromStatus: (raw: Record<string, string>) => M

  toPayload: (
    model: M,
    raw: Record<string, string>,
  ) => Record<string, string> | Record<string, string>[] | null

  validate?: (model: M) => Record<string, string> | null

  preflight?: (model: M, raw: Record<string, string>) => string | null

  confirmText?: (model: M) => string | null

  reloadAfterSave?: boolean

  successText?: string
}

export interface PageFormHandle<M> {

  model: Ref<M>

  raw: Ref<Record<string, string>>
  loading: Ref<boolean>
  saving: Ref<boolean>

  error: Ref<string>

  fieldErrors: Ref<Record<string, string>>

  dirty: Ref<boolean>
  load: () => Promise<void>
  save: () => Promise<boolean>

  reset: () => void
}

export function usePageForm<M>(opts: UsePageFormOptions<M>): PageFormHandle<M> {
  const model = ref(opts.fromStatus({})) as Ref<M>
  const raw = ref<Record<string, string>>({})
  const snapshot = ref('')
  const loading = ref(true)
  const saving = ref(false)
  const error = ref('')
  const fieldErrors = ref<Record<string, string>>({})

  const dirty = computed(() => JSON.stringify(model.value) !== snapshot.value)

  async function load(): Promise<void> {
    loading.value = true
    error.value = ''
    try {
      const s = await getStatus(opts.keys)
      raw.value = s as Record<string, string>
      model.value = opts.fromStatus(s as Record<string, string>)
      snapshot.value = JSON.stringify(model.value)
      fieldErrors.value = {}
    } catch (e) {
      error.value = e instanceof Error ? e.message : '读取失败'
    } finally {
      loading.value = false
    }
  }

  function reset(): void {
    try {
      model.value = JSON.parse(snapshot.value) as M
      fieldErrors.value = {}
    } catch {

    }
  }

  async function save(): Promise<boolean> {
    if (saving.value) return false

    const errs = opts.validate?.(model.value) ?? null
    fieldErrors.value = errs ?? {}
    if (errs && Object.keys(errs).length > 0) {
      toast('请先修正表单里的问题', 'error')
      return false
    }

    const payload = opts.toPayload(model.value, raw.value)
    if (!payload || (Array.isArray(payload) && payload.length === 0)) {
      toast('没有需要提交的内容')
      return false
    }

    const block = opts.preflight?.(model.value, raw.value) ?? null
    if (block) {
      toast(block, 'error')
      return false
    }

    const ask = opts.confirmText?.(model.value) ?? null
    if (ask) {
      const ok = await confirm({ title: '确认操作', message: ask, danger: true })
      if (!ok) return false
    }

    saving.value = true
    try {
      await withLoading(async () => {
        const list = Array.isArray(payload) ? payload : [payload]
        for (const body of list) {
          const res = await post(body)
          if (!(res.result === 'success' || res.result === '0' || res.result === '')) {
            throw new Error(res.result || '设备返回失败')
          }
        }
      }, '正在保存…')

      toast(opts.successText ?? '已保存', 'success')
      if (opts.reloadAfterSave !== false) await load()
      else snapshot.value = JSON.stringify(model.value)
      return true
    } catch (e) {
      toast(e instanceof Error ? e.message : '保存失败', 'error')
      return false
    } finally {
      saving.value = false
    }
  }

  return { model, raw, loading, saving, error, fieldErrors, dirty, load, save, reset }
}

export const asString = (v: string | undefined): string => v ?? ''
export const asBool = (v: string | undefined): boolean => (v ?? '0') === '1'
export const asInt = (v: string | undefined, fallback = 0): number => {
  const n = Number.parseInt(v ?? '', 10)
  return Number.isFinite(n) ? n : fallback
}
export const boolToFlag = (b: boolean): string => (b ? '1' : '0')
