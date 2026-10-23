<script setup lang="ts">defineProps<{
  label: string
  hint?: string
  error?: string
  required?: boolean
}>()
</script>

<template>
  <div class="field" :class="{ 'is-error': !!error }">
    <p class="field-label">
      {{ label }}<em v-if="required" class="req">*</em>
    </p>
    <slot />
    <p v-if="hint && !error" class="field-hint">{{ hint }}</p>
    <p v-if="error" class="field-error">{{ error }}</p>
  </div>
</template>

<style scoped>
.field + .field {
  margin-top: var(--sp-4);
}

.field-label {
  font-size: var(--fs-sub);
  color: var(--c-text-2);
  margin-bottom: var(--sp-2);
}

.req {
  color: var(--c-danger);
  font-style: normal;
  margin-left: 2px;
}

.field-hint {
  font-size: var(--fs-cap);
  color: var(--c-text-3);
  margin-top: var(--sp-1);
}

.field-error {
  font-size: var(--fs-cap);
  color: var(--c-danger);
  margin-top: var(--sp-1);
}

.field :deep(input),
.field :deep(select),
.field :deep(textarea) {
  width: 100%;
  min-height: var(--tap);
  padding: 0 var(--sp-3);
  background-color: var(--c-surface-2);
  border: 1px solid var(--c-line);
  border-radius: var(--r-md);
  outline: none;
  appearance: none;
  color: var(--c-text-1);
  font-size: var(--fs-body);
  transition: border-color 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease;
}

.field :deep(select) {
  padding-right: 32px;
}

.field :deep(textarea) {
  padding: var(--sp-3);
  min-height: 88px;
  resize: vertical;
}

.field :deep(input:focus),
.field :deep(select:focus),
.field :deep(textarea:focus) {
  border-color: var(--c-primary-400);
  background-color: var(--c-surface);
  box-shadow: 0 0 0 3px rgba(28, 165, 123, 0.16);
}

.is-error :deep(input),
.is-error :deep(select),
.is-error :deep(textarea) {
  border-color: var(--c-danger);
}
</style>
