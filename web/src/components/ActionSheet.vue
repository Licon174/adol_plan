<script setup lang="ts">import { settleSheet, sheetState } from './action-sheet'
</script>

<template>
  <Transition name="fade">
    <div v-if="sheetState.open" class="mask" @click.self="settleSheet(null)">
      <div class="sheet" role="dialog" aria-modal="true">
        <p v-if="sheetState.title" class="sheet-title">{{ sheetState.title }}</p>
        <button
          v-for="a in sheetState.actions"
          :key="a.value"
          type="button"
          class="sheet-item"
          :class="{ 'is-danger': a.danger }"
          @click="settleSheet(a.value)"
        >
          {{ a.label }}
        </button>
        <button type="button" class="sheet-cancel" @click="settleSheet(null)">取消</button>
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
  align-items: flex-end;
  background: var(--c-mask);
}

.sheet {
  width: 100%;
  max-width: var(--content-max);
  margin: 0 auto;
  padding: var(--sp-2) var(--sp-3) calc(var(--sp-3) + var(--safe-b));
  background: var(--c-surface);
  border-radius: var(--r-lg) var(--r-lg) 0 0;
}

.sheet-title {
  padding: var(--sp-3) var(--sp-3) var(--sp-2);
  font-size: var(--fs-cap);
  color: var(--c-text-3);
  text-align: center;
}

.sheet-item,
.sheet-cancel {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: var(--tap);
  font-size: var(--fs-body);
  border-radius: var(--r-sm);
}

.sheet-item:active,
.sheet-cancel:active {
  background: var(--c-surface-2);
}

.sheet-item.is-danger {
  color: var(--c-danger);
}

.sheet-cancel {
  margin-top: var(--sp-2);
  color: var(--c-text-2);
  background: var(--c-surface-2);
}
</style>
