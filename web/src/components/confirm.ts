import { reactive } from 'vue'

export interface ConfirmOptions {
  title: string
  message?: string
  confirmText?: string
  cancelText?: string

  danger?: boolean

  requireText?: string
}

interface ConfirmState extends Required<Omit<ConfirmOptions, 'message' | 'requireText'>> {
  open: boolean
  message: string
  requireText: string
  resolve: ((v: boolean) => void) | null
}

export const confirmState = reactive<ConfirmState>({
  open: false,
  title: '',
  message: '',
  confirmText: '确定',
  cancelText: '取消',
  danger: false,
  requireText: '',
  resolve: null,
})

export function confirm(opts: ConfirmOptions): Promise<boolean> {

  confirmState.resolve?.(false)

  confirmState.open = true
  confirmState.title = opts.title
  confirmState.message = opts.message ?? ''
  confirmState.confirmText = opts.confirmText ?? '确定'
  confirmState.cancelText = opts.cancelText ?? '取消'
  confirmState.danger = opts.danger ?? false
  confirmState.requireText = opts.requireText ?? ''

  return new Promise<boolean>((resolve) => {
    confirmState.resolve = resolve
  })
}

export function settleConfirm(v: boolean): void {
  const r = confirmState.resolve
  confirmState.resolve = null
  confirmState.open = false
  r?.(v)
}
