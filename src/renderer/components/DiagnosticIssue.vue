<template>
  <div class="diag-issue" :class="`diag-issue--${issue.severity}`">
    <div class="diag-issue__header">
      <span class="diag-issue__severity">{{ severityLabel }}</span>
      <span class="diag-issue__title">{{ issue.title }}</span>
      <button v-if="issue.fixable" class="btn btn--primary btn--sm" @click="$emit('fix')">
        Sửa nhanh 1 chạm
      </button>
    </div>
    <div v-if="issue.description" class="diag-issue__desc">{{ issue.description }}</div>
    <div v-if="issue.location" class="diag-issue__loc">Vị trí: {{ issue.location }}</div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  issue: { type: Object, required: true }
});

defineEmits(['fix']);

const severityLabel = computed(() => {
  switch (props.issue.severity) {
    case 'error': return 'Lỗi';
    case 'warning': return 'Cảnh báo';
    case 'info': return 'Gợi ý';
    default: return 'Thông tin';
  }
});
</script>

<style scoped>
.diag-issue {
  background: var(--cf-bg-secondary);
  border: 1px solid var(--cf-border);
  border-left-width: 3px;
  border-radius: var(--cf-radius-sm);
  padding: 10px 12px;
  margin-bottom: 8px;
  font-size: 13px;
}
.diag-issue--error { border-left-color: var(--cf-danger); }
.diag-issue--warning { border-left-color: var(--cf-warning); }
.diag-issue--info { border-left-color: var(--cf-info); }

.diag-issue__header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.diag-issue__severity {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: var(--cf-font-mono);
}
.diag-issue--error .diag-issue__severity {
  background: rgba(248, 113, 113, 0.15);
  color: var(--cf-danger);
}
.diag-issue--warning .diag-issue__severity {
  background: rgba(251, 191, 36, 0.15);
  color: var(--cf-warning);
}
.diag-issue--info .diag-issue__severity {
  background: rgba(96, 165, 250, 0.15);
  color: var(--cf-info);
}

.diag-issue__title {
  flex: 1;
  color: var(--cf-text-primary);
  font-weight: 500;
}

.diag-issue__desc {
  color: var(--cf-text-secondary);
  font-size: 12px;
  margin-top: 4px;
  line-height: 1.6;
}

.diag-issue__loc {
  color: var(--cf-text-muted);
  font-size: 11px;
  margin-top: 4px;
  font-family: var(--cf-font-mono);
}
</style>