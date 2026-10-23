<script setup lang="ts">import { onMounted, onUnmounted } from 'vue'
import ToastHost from '@/components/ToastHost.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import ActionSheet from '@/components/ActionSheet.vue'
import LoadingMask from '@/components/LoadingMask.vue'
import { isAuthed, probeSession } from '@/api'
import { toast } from '@/components/toast'

const PERIOD = 20_000
let timer: number | null = null

async function check(): Promise<void> {
  if (document.hidden) return
  const was = isAuthed()
  try {
    const alive = await probeSession()
    if (!alive && was) toast('登录已失效，请重新登录', 'error')
  } catch {

  }
}

onMounted(() => {
  timer = window.setInterval(() => void check(), PERIOD)
})

onUnmounted(() => {
  if (timer !== null) {
    window.clearInterval(timer)
    timer = null
  }
})
</script>

<template>
  <RouterView />
  <ToastHost />
  <ConfirmDialog />
  <ActionSheet />
  <LoadingMask />
</template>
