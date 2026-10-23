<script setup lang="ts">import { computed, ref, watch } from 'vue'
import { confirmState, settleConfirm } from './confirm'

const typed = ref('')

watch(
  () => confirmState.open,
  (open) => {
    if (open) typed.value = ''
  },
)

const canConfirm = computed(
  () => !confirmState.requireText || typed.value.trim() === confirmState.requireText,
)

function onCancel() {
  settleConfirm(false)
}

function onConfirm() {
  if (!canConfirm.value) return
  settleConfirm(true)
}
</script>

<template>
  <Transition name="fade">
    <div v-if="confirmState.open" class="mask" @click.self="onCancel">
      <div class="dialog" role="dialog" aria-modal="true">
        <p class="dialog-title">{{ confirmState.title }}</p>
        <p v-if="confirmState.message" class="dialog-msg">{{ confirmState.message }}</p>

        <div v-if="confirmState.requireText" class="dialog-verify">
          <input
            v-model="typed"
            class="verify-input num"
            type="text"
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
            :placeholder="confirmState.requireText"
            @keyup.enter="onConfirm"
          />
        </div>

        <div class="dialog-actions">
          <button type="button" class="btn btn-ghost" @click="onCancel">
            {{ confirmState.cancelText }}
          </button>
          <button
            type="button"
            class="btn"
            :class="confirmState.danger ? 'btn-danger' : 'btn-primary'"
            :disabled="!canConfirm"
            @click="onConfirm"
          >
            {{ confirmState.confirmText }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.mask {
  position: fixed;
  inset: 0;
  z-index: var(--z-dialog);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--sp-5);
  background: var(--c-mask);
}

.dialog {
  width: 100%;
  max-width: 320px;
  padding: var(--sp-5);
  background: var(--c-surface);
  border-radius: var(--r-lg);
}

.dialog-title {
  font-size: var(--fs-h2);
  font-weight: 500;
  text-align: center;
}

.dialog-msg {
  margin-top: var(--sp-2);
  font-size: var(--fs-sub);
  color: var(--c-text-2);
  text-align: center;
}

.dialog-verify {
  margin-top: var(--sp-4);
}

.verify-hint {
  font-size: var(--fs-cap);
  color: var(--c-text-3);
  margin-bottom: var(--sp-2);
}

.verify-input {
  width: 100%;
  min-height: var(--tap);
  padding: 0 var(--sp-3);
  background: var(--c-surface-2);
  border: 1px solid transparent;
  border-radius: var(--r-sm);
  outline: none;
}

.verify-input:focus {
  border-color: var(--c-primary-400);
  background: var(--c-surface);
}

.dialog-actions {
  display: flex;
  gap: var(--sp-3);
  margin-top: var(--sp-5);
}

.dialog-actions .btn {
  flex: 1;
}
</style>
