<script setup lang="ts">import { useRouter } from 'vue-router'

const props = defineProps<{ title?: string; to?: string }>()
const router = useRouter()

function go(): void {
  if (props.to) void router.push(props.to)
}
</script>

<template>
  <section class="card" :class="{ 'card-to': !!to }" :role="to ? 'link' : undefined" :tabindex="to ? 0 : undefined"
    @click="go" @keyup.enter="go">
    <div v-if="$slots.header" class="card-custom-header">
      <slot name="header" />
    </div>
    <div v-else-if="(title && to) || (title && ($slots.action || $slots.right)) || $slots.action || $slots.right" class="card-title-row">
      <p v-if="title" class="card-title">{{ title }}</p>
      <span v-if="to" class="card-go" aria-hidden="true">›</span>
      <div v-else-if="$slots.action || $slots.right" class="card-action-slot">
        <slot name="action" />
        <slot name="right" />
      </div>
    </div>
    <p v-else-if="title" class="card-title">{{ title }}</p>
    <slot />
  </section>
</template>

<style scoped>
.card-to {
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.card-to:active {
  opacity: 0.85;
}
.card-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-2);
}
.card-title-row .card-title {
  margin-bottom: 0;
}
.card-action-slot {
  display: flex;
  align-items: center;
}
.card-go {
  font-size: 18px;
  line-height: 1;
  color: var(--c-text-3);
  margin-bottom: var(--sp-2);
}
</style>
