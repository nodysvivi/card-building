<template>
  <div v-if="visible" class="inj-mask" @click.self="onCancel">
    <div class="inj-modal">
      <div class="inj-modal__header">
        <h3>Xem trước khi tiêm · Bộ MVU + Thanh trạng thái</h3>
        <button class="inj-modal__close" @click="onCancel" :disabled="busy">×</button>
      </div>

      <div class="inj-modal__body">
        <!-- Nhắc nhở xung đột và chiến lược -->
        <div v-if="conflict.hasMvu || conflict.statusRegexNames.length" class="inj-conflict">
          <div class="inj-conflict__title">Phát hiện các mục liên quan đã tồn tại</div>
          <ul class="inj-conflict__list">
            <li v-if="conflict.hasMvu">Các mục MVU sẵn có (Script / Worldbook / Regex)</li>
            <li v-for="n in conflict.statusRegexNames" :key="n">Regex thanh trạng thái "{{ n }}"</li>
          </ul>
          <div class="inj-strategy">
            <label class="inj-radio">
              <input type="radio" value="replace" v-model="strategyLocal">
              <span><strong>Thay thế</strong> — Xóa các mục cũ nêu trên, dựng lại toàn bộ theo cấu hình hiện tại</span>
            </label>
            <label class="inj-radio">
              <input type="radio" value="merge" v-model="strategyLocal">
              <span><strong>Gộp bổ sung</strong> — Giữ lại các mục cũ, chỉ bù đắp nội dung thiếu và gộp định nghĩa biến</span>
            </label>
          </div>
        </div>
        <div v-else class="inj-clean">Thẻ hiện tại không có mục nào xung đột, sẽ tạo mới hoàn toàn các nội dung sau:</div>

        <!-- Danh sách hành động -->
        <div class="inj-list">
          <div class="inj-list__row" v-for="(line, i) in actionLines" :key="i">
            <span class="inj-badge" :class="'inj-badge--' + line.kind">{{ line.kindLabel }}</span>
            <span class="inj-list__name">{{ line.name }}</span>
            <span class="inj-list__meta">{{ line.meta }}</span>
          </div>
        </div>

        <!-- Xem chi tiết sản phẩm chính -->
        <details class="inj-details">
          <summary>Xem script Zod Schema</summary>
          <pre class="inj-code selectable">{{ kit.scripts.find(s => s.name === 'Zod Schema')?.content }}</pre>
        </details>
        <details class="inj-details">
          <summary>Xem [initvar] Biến khởi tạo</summary>
          <pre class="inj-code selectable">{{ initVarEntry?.content }}</pre>
        </details>
        <details class="inj-details">
          <summary>Xem [mvu_update] Quy tắc cập nhật biến</summary>
          <pre class="inj-code selectable">{{ ruleEntry?.content }}</pre>
        </details>
        <details class="inj-details" v-if="statusHtml">
          <summary>Xem HTML thanh trạng thái</summary>
          <pre class="inj-code selectable">{{ statusHtmlTruncated }}</pre>
        </details>

        <p class="inj-hint">
          Tất cả các mục đều có độ sâu D0, thứ tự 200, không đệ quy; cuối lời mở đầu sẽ bổ sung &lt;StatusPlaceHolderImpl/&gt; (nếu đã có sẽ bỏ qua).
        </p>
      </div>

      <div class="inj-modal__footer">
        <span v-if="error" class="inj-error">{{ error }}</span>
        <button class="btn btn--secondary" @click="onCancel" :disabled="busy">Hủy</button>
        <button class="btn btn--primary" @click="onConfirm" :disabled="busy">
          {{ busy ? 'Đang tiêm...' : (conflict.hasMvu && strategyLocal === 'merge' ? 'Xác nhận tiêm gộp' : 'Xác nhận tiêm') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';

const props = defineProps({
  visible: { type: Boolean, default: false },
  kit: { type: Object, required: true },
  statusHtml: { type: String, default: '' },
  conflict: {
    type: Object,
    default: () => ({ hasMvu: false, statusRegexNames: [] })
  },
  busy: { type: Boolean, default: false },
  error: { type: String, default: '' }
});

const emit = defineEmits(['confirm', 'cancel', 'update:strategy']);

const strategyLocal = ref('replace');
watch(() => props.visible, (v) => {
  if (v) {
    strategyLocal.value = props.conflict?.hasMvu ? 'merge' : 'replace';
    emit('update:strategy', strategyLocal.value);
  }
});
watch(strategyLocal, (v) => emit('update:strategy', v));

const initVarEntry = computed(() =>
  props.kit.entries.find(e => {
    const c = e.comment || '';
    return c.includes('initvar') || c.includes('Khởi tạo biến') || c.includes('变量初始化');
  }));
const ruleEntry = computed(() =>
  props.kit.entries.find(e => {
    const c = e.comment || '';
    return c.includes('Quy tắc cập nhật biến') || c.includes('变量更新规则');
  }));

const actionLines = computed(() => {
  const lines = [];
  const hasOldStatusRegex = props.conflict?.statusRegexNames?.length > 0;
  const kindOf = (name) => {
    if (!props.conflict?.hasMvu) return 'new';
    return 'refresh';
  };
  for (const s of props.kit.scripts) {
    lines.push({
      kind: kindOf(s.name), kindLabel: kindOf(s.name) === 'new' ? 'Tạo mới' : 'Dựng lại',
      name: `Script · ${s.name}`,
      meta: (s.name === 'Hệ thống biến MVU' || s.name === 'MVU 变量系统') ? 'Nạp MagVarUpdate + Nút thao tác' : 'Định nghĩa cấu trúc biến'
    });
  }
  for (const en of props.kit.entries) {
    lines.push({
      kind: kindOf(en.comment), kindLabel: kindOf(en.comment) === 'new' ? 'Tạo mới' : 'Dựng lại',
      name: `Worldbook · ${en.comment}`,
      meta: (en.content || '').length + ' từ'
    });
  }
  for (const rx of props.kit.regexes) {
    lines.push({
      kind: kindOf(rx.scriptName), kindLabel: kindOf(rx.scriptName) === 'new' ? 'Tạo mới' : 'Dựng lại',
      name: `Regex · ${rx.scriptName}`,
      meta: rx.markdownOnly ? 'Chỉ thay thế hiển thị' : (rx.promptOnly ? 'Chỉ gửi cho AI' : '')
    });
  }
  if (hasOldStatusRegex) {
    for (const n of props.conflict.statusRegexNames) {
      lines.push({ kind: 'replace', kindLabel: 'Sẽ thay thế', name: `Regex · ${n}`, meta: '' });
    }
  }
  if (props.statusHtml) {
    lines.push({
      kind: 'new', kindLabel: 'Tạo mới',
      name: 'Regex · Làm đẹp thanh trạng thái',
      meta: 'Placeholder → Render HTML thanh trạng thái'
    });
  }
  lines.push({ kind: 'touch', kindLabel: 'Cập nhật', name: 'Lời mở đầu', meta: 'Bổ sung <StatusPlaceHolderImpl/>' });
  return lines;
});

const statusHtmlTruncated = computed(() => {
  if (!props.statusHtml) return '';
  return props.statusHtml.length > 4000
    ? props.statusHtml.slice(0, 4000) + `\n... (Tổng cộng ${props.statusHtml.length} ký tự, nội dung đầy đủ dựa theo Regex)`
    : props.statusHtml;
});

function onConfirm() {
  emit('confirm', { strategy: strategyLocal.value });
}
function onCancel() {
  emit('cancel');
}
</script>

<style scoped>
.inj-mask {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, 0.55);
  z-index: 9000;
  display: flex; align-items: center; justify-content: center;
  padding: 20px;
}
.inj-modal {
  background: var(--cf-bg-secondary);
  border: 1px solid var(--cf-border);
  border-radius: var(--cf-radius);
  width: min(860px, 100%);
  max-height: 90vh;
  display: flex; flex-direction: column;
  box-shadow: 0 16px 60px rgba(0, 0, 0, 0.5);
}
.inj-modal__header {
  padding: 12px 16px;
  border-bottom: 1px solid var(--cf-border);
  display: flex; align-items: center; justify-content: space-between;
}
.inj-modal__header h3 { margin: 0; font-size: 14px; }
.inj-modal__close {
  background: transparent; border: none;
  color: var(--cf-text-muted); font-size: 22px; cursor: pointer;
  padding: 0 6px; line-height: 1;
}
.inj-modal__close:hover { color: var(--cf-text-primary); }

.inj-modal__body {
  padding: 14px 16px;
  flex: 1; overflow: auto;
  display: flex; flex-direction: column; gap: 10px;
}

.inj-conflict {
  border-left: 3px solid var(--cf-warning);
  background: rgba(251, 191, 36, 0.07);
  border-radius: var(--cf-radius-sm);
  padding: 10px 12px;
  font-size: 12px;
}
.inj-conflict__title { font-weight: 600; color: var(--cf-warning); margin-bottom: 4px; }
.inj-conflict__list { margin: 0 0 8px 0; padding-left: 18px; color: var(--cf-text-secondary); }

.inj-strategy { display: flex; flex-direction: column; gap: 4px; margin-top: 6px; }
.inj-radio {
  display: flex; align-items: flex-start; gap: 6px; cursor: pointer;
  color: var(--cf-text-primary); font-size: 12px; line-height: 1.5;
  input { accent-color: var(--cf-accent); margin-top: 2px; }
}

.inj-clean {
  font-size: 12px; color: var(--cf-accent);
  background: rgba(96, 165, 250, 0.06);
  border-left: 3px solid var(--cf-accent);
  padding: 8px 12px; border-radius: var(--cf-radius-sm);
}

.inj-list { display: flex; flex-direction: column; gap: 4px; }
.inj-list__row {
  display: flex; align-items: center; gap: 8px;
  font-size: 12px; padding: 5px 8px;
  background: rgba(0, 0, 0, 0.15);
  border: 1px solid var(--cf-border);
  border-radius: var(--cf-radius-sm);
}
.inj-list__name { font-weight: 500; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.inj-list__meta { color: var(--cf-text-muted); font-size: 11px; flex-shrink: 0; }

.inj-badge {
  flex-shrink: 0;
  padding: 1px 8px; border-radius: 999px;
  font-size: 10px; font-weight: 600; letter-spacing: 0.5px;
}
.inj-badge--new { background: rgba(96, 165, 250, 0.15); color: #93c5fd; }
.inj-badge--refresh { background: rgba(167, 139, 250, 0.15); color: #c4b5fd; }
.inj-badge--replace { background: rgba(239, 68, 68, 0.15); color: #fca5a5; }
.inj-badge--touch { background: rgba(148, 163, 184, 0.15); color: #cbd5e1; }

.inj-details summary {
  cursor: pointer; font-size: 12px; color: var(--cf-text-secondary);
  padding: 4px 0; user-select: none;
}
.inj-details summary:hover { color: var(--cf-text-primary); }
.inj-code {
  font-family: var(--cf-font-mono); font-size: 11px; line-height: 1.6;
  white-space: pre-wrap; word-break: break-all;
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid var(--cf-border);
  border-radius: var(--cf-radius-sm);
  padding: 10px; margin: 6px 0;
  max-height: 260px; overflow-y: auto;
}

.inj-hint { font-size: 11px; color: var(--cf-text-muted); line-height: 1.7; margin: 0; }
.inj-error { color: var(--cf-danger, #f87171); font-size: 12px; margin-right: auto; }

.inj-modal__footer {
  padding: 12px 16px;
  border-top: 1px solid var(--cf-border);
  display: flex; justify-content: flex-end; align-items: center; gap: 8px;
}
</style>