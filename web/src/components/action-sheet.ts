import { reactive } from 'vue'

export interface SheetAction {
  label: string
  value: string
  danger?: boolean
}

interface SheetState {
  open: boolean
  title: string
  actions: SheetAction[]
  resolve: ((v: string | null) => void) | null
}

export const sheetState = reactive<SheetState>({
  open: false,
  title: '',
  actions: [],
  resolve: null,
})

export function actionSheet(title: string, actions: SheetAction[]): Promise<string | null> {
  sheetState.resolve?.(null)
  sheetState.open = true
  sheetState.title = title
  sheetState.actions = actions
  return new Promise<string | null>((resolve) => {
    sheetState.resolve = resolve
  })
}

export function settleSheet(value: string | null): void {
  const r = sheetState.resolve
  sheetState.resolve = null
  sheetState.open = false
  r?.(value)
}
