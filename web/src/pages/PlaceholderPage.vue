<script setup lang="ts">import { computed } from 'vue'
import { findPage, findTab } from '@/router/pages'
import PageShell from '@/layouts/PageShell.vue'
import Card from '@/components/Card.vue'
import Icon from '@/components/Icon.vue'

const props = defineProps<{ tabKey: string; pagePath: string }>()

const tab = computed(() => findTab(props.tabKey))
const page = computed(() => findPage(props.tabKey, props.pagePath))
</script>

<template>
  <PageShell :title="page?.name ?? '未命名页面'">
    <Card>
      <div class="ph">
        <span class="ph-icon"><Icon :name="page?.icon ?? 'info'" :size="26" /></span>
        <p class="ph-name">{{ page?.name }}</p>
        <p class="ph-desc">{{ page?.desc }}</p>
      </div>
    </Card>

    <Card title="实现状态">
      <p class="t-cap" style="margin-top: 8px">
        路由 <span class="num">{{ tab?.path }}/{{ page?.path }}</span> 已接通，
        页面注册表里的条目可直接替换为真实组件。
      </p>
    </Card>
  </PageShell>
</template>

<style scoped>
.ph {
  text-align: center;
  padding: var(--sp-3) 0;
}

.ph-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  border-radius: var(--r-md);
  color: var(--c-primary-600);
  background: var(--c-primary-50);
}

.ph-name {
  margin-top: var(--sp-3);
  font-size: var(--fs-h2);
  font-weight: 500;
}

.ph-desc {
  margin-top: 2px;
  font-size: var(--fs-sub);
  color: var(--c-text-3);
}
</style>
