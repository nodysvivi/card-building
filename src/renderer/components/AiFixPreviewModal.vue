<template>
  <div v-if="visible" class="ai-fix-mask" @click.self="onCancel">
    <div class="ai-fix-modal">
      <div class="ai-fix-modal__header">
        <h3>Xem trước AI viết lại · {{ field || '?' }}</h3>
        <button class="ai-fix-modal__close" @click="onCancel">×</button>
      </div>

      <div class="ai-fix-modal__body">
        <div v-if="conflictDesc" class="ai-fix-modal__conflict">
          <strong>Vấn đề: </strong>{{ conflictDesc }}
        </div>

        <div v-if="loading" class="ai-fix-modal__loading">
          AI đang viết lại...
        </div>

        <div v-else class="ai-fix-modal__cols">
          <div class="ai-fix-col">
            <div class="ai-fix-col__title">
              Nội dung gốc
              <span class="hint ai-fix-col__meta">{{ original.length }} từ</span>
            </div>
            <textarea class="ai-fix-col__area" :value="original" readonly></textarea>
          </div>
          <div class="ai-fix-col">
            <div class="ai-fix-col__title">
              AI viết lại
              <span class="hint ai-fix-col__meta">{{ rewrittenLocal.length }} từ (có thể chỉnh sửa thủ công)</span>
            </div>
            <textarea class="ai-fix-col__area ai-fix-col__area--editable"
              v-model="rewrittenLocal"></textarea>
          </div>
        </div>
      </div>

      <div class="ai-fix-modal__footer">
        <button class="btn btn--secondary" @click="onCancel" :disabled="loading">Hủy</button>
        <button class="btn btn--secondary" @click="$emit('regenerate')" :disabled="loading">
          Viết lại lần nữa
        </button>
        <button class="btn btn--primary" @click="onApply" :disabled="loading || !rewrittenLocal.trim()">
          Áp dụng bản viết lại này
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';

const props = defineProps({
  visible: { type: Boolean, default: false },
  field: { type: String, default: '' },
  original: { type: String, default: '' },
  rewritten: { type: String, default: '' },
  conflictDesc: { type: String, default: '' },
  loading: { type: Boolean, default: false }
});

const emit = defineEmits(['apply', 'cancel', 'regenerate']);

const rewrittenLocal = ref('');

watch(() => props.rewritten, (v) => { rewrittenLocal.value = v || ''; }, { immediate: true });
watch(() => props.visible, (v) => { if (v) rewrittenLocal.value = props.rewritten || ''; });

function onApply() {
  emit('apply', rewrittenLocal.value);
}
function onCancel() {
  emit('cancel');
}
</script>

<style scoped>
.ai-fix-mask {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, 0.55);
  z-index: 9000;
  display: flex; align-items: center; justify-content: center;
  padding: 20px;
}

.ai-fix-modal {
  background: var(--cf-bg-secondary);
  border: 1px solid var(--cf-border);
  border-radius: var(--cf-radius);
  width: min(1100px, 100%);
  max-height: 90vh;
  display: flex; flex-direction: column;
  box-shadow: 0 16px 60px rgba(0, 0, 0, 0.5);
}

.ai-fix-modal__header {
  padding: 12px 16px;
  border-bottom: 1px solid var(--cf-border);
  display: flex; align-items: center; justify-content: space-between;
}
.ai-fix-modal__header h3 { margin: 0; font-size: 14px; }
.ai-fix-modal__close {
  background: transparent; border: none;
  color: var(--cf-text-muted); font-size: 22px; cursor: pointer;
  padding: 0 6px; line-height: 1;
}
.ai-fix-modal__close:hover { color: var(--cf-text-primary); }

.ai-fix-modal__body {
  padding: 14px 16px;
  flex: 1; overflow: auto;
  display: flex; flex-direction: column; gap: 12px;
}

.ai-fix-modal__conflict {
  padding: 8px 10px;
  background: rgba(251, 191, 36, 0.08);
  border-left: 3px solid var(--cf-warning);
  border-radius: var(--cf-radius-sm);
  font-size: 12px; line-height: 1.6;
  color: var(--cf-text-secondary);
}
.ai-fix-modal__conflict strong { color: var(--cf-warning); }

.ai-fix-modal__loading {
  text-align: center;
  padding: 80px 20px;
  color: var(--cf-text-muted);
  font-size: 13px;
}

.ai-fix-modal__cols {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  flex: 1; min-height: 320px;
}

.ai-fix-col { display: flex; flex-direction: column; gap: 6px; min-height: 320px; }
.ai-fix-col__title {
  display: flex; justify-content: space-between; align-items: center;
  font-size: 12px; font-weight: 500;
  color: var(--cf-text-secondary);
}
.ai-fix-col__meta { font-weight: 400; }
.ai-fix-col__area {
  flex: 1;
  padding: 10px 12px;
  background: var(--cf-bg-tertiary);
  border: 1px solid var(--cf-border);
  border-radius: var(--cf-radius-sm);
  color: var(--cf-text-primary);
  font-family: var(--cf-font-mono);
  font-size: 12px;
  line-height: 1.7;
  resize: none;
  min-height: 320px;
}
.ai-fix-col__area--editable {
  background: var(--cf-bg-primary);
  border-color: var(--cf-primary);
}
.ai-fix-col__area:focus { outline: none; border-color: var(--cf-primary); }

.ai-fix-modal__footer {
  padding: 12px 16px;
  border-top: 1px solid var(--cf-border);
  display: flex; justify-content: flex-end; gap: 8px;
}

@media (max-width: 720px) {
  .ai-fix-modal__cols { grid-template-columns: 1fr; }
}
</style>