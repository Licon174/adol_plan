<script setup lang="ts">const props = defineProps<{ modelValue: boolean; disabled?: boolean; label?: string }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>()

function toggle() {
  if (props.disabled) return
  emit('update:modelValue', !props.modelValue)
}
</script>

<template>
  <button
    type="button"
    class="toggle"
    :class="{ 'is-on': modelValue }"
    :disabled="disabled"
    role="switch"
    :aria-checked="modelValue"
    :aria-label="label"
    @click="toggle"
  >
    <span class="knob" />
  </button>
</template>

<style scoped>
.toggle {
  position: relative;
  flex: none;
  width: 50px;
  height: 28px;
  padding: 0;
  border-radius: var(--r-full);
  background: var(--c-line-strong);
  transition: background-color 0.25s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.25s ease;
  cursor: pointer;
}

.toggle:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.toggle:active:not(:disabled) .knob {
  width: 25px;
}

.toggle.is-on {
  background: var(--c-primary-400);
  box-shadow: 0 0 10px rgba(28, 165, 123, 0.35);
}

.knob {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #ffffff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
  transition: transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1), width 0.15s ease;
}

.toggle.is-on .knob {
  transform: translateX(22px);
}
</style>
