<template>
  <div class="page">
    <div class="page__header flex-between">
      <div>
        <h1>Chẩn đoán thẻ nhân vật</h1>
        <p>7 kiểm tra thuần frontend + 3 kiểm tra AI, tìm vấn đề, đưa ra đề xuất, xem trước so sánh sửa đổi</p>
      </div>
      <div class="flex-row">
        <button class="btn btn--primary" @click="runDiagnostic" :disabled="running || aiRunning">
          {{ running ? 'Đang chẩn đoán...' : (results.length === 0 ? 'Bắt đầu chẩn đoán' : 'Chẩn đoán lại') }}
        </button>
        <button class="btn btn--accent" @click="runAiDiagnostic"
          :disabled="running || aiRunning || !apiStore.isConfigured"
          :title="!apiStore.isConfigured ? 'Vui lòng cấu hình API trong cài đặt trước' : 'Kiểm tra AI mất khoảng 30~60 giây, có tiêu tốn token'">
          {{ aiRunning ? `Đang kiểm tra AI (${aiProgress.current}/${aiProgress.total})` : 'Chạy kiểm tra AI (3 mục)' }}
        </button>
        <button v-if="results.length > 0 && fixableCount > 0" class="btn btn--accent" @click="fixAll">
          Sửa nhanh tất cả ({{ fixableCount }})
        </button>
        <button v-if="undoSize > 0" class="btn btn--secondary btn--sm" @click="undo">
          Hoàn tác gần nhất ({{ undoSize }})
        </button>
      </div>
    </div>

    <div v-if="results.length === 0 && !running" class="card">
      <div class="card__body" style="text-align:center;padding:60px 20px">
        <div class="hint" style="font-size:14px;line-height:1.8">
          Nhấp "Bắt đầu chẩn đoán" ở trên để chạy 7 kiểm tra thuần frontend (có kết quả ngay lập tức, không tốn token):<br><br>
          <strong v-for="(c, i) in CHECK_METADATA" :key="c.key">
            {{ i + 1 }}. {{ c.name }}<br>
          </strong>
          <br>
          Sau đó nhấp "Chạy kiểm tra AI" để bổ sung 3 kiểm tra chuyên sâu (tiêu tốn token, mất khoảng 30~60 giây):<br><br>
          <strong v-for="(c, i) in AI_CHECK_METADATA" :key="c.key">
            {{ i + 8 }}. {{ c.name }} —— {{ c.desc }}<br>
          </strong>
        </div>
      </div>
    </div>

    <div v-if="results.length > 0" class="card mb-md">
      <div class="card__body">
        <div class="flex-between">
          <div>
            <strong>Chẩn đoán hoàn tất</strong> ·
            <span :style="{ color: 'var(--cf-success)' }">Đạt {{ passedCount }} mục</span> /
            <span :style="{ color: 'var(--cf-warning)' }">{{ totalIssues }} vấn đề</span>
            (Trong đó {{ fixableCount }} mục có thể sửa nhanh · {{ aiFixableCount }} mục cần AI viết lại)
          </div>
          <div class="hint">Thời gian chẩn đoán lần cuối: {{ lastRunTime }}</div>
        </div>
      </div>
    </div>

    <div v-if="frontendResults.length > 0" class="diag-section-title">Kiểm tra frontend</div>
    <div v-for="result in frontendResults" :key="result.key" class="card mb-md diag-check"
      :class="{ 'diag-check--passed': result.passed, 'diag-check--has-issues': result.issues.length > 0 }">
      <div class="card__header diag-check__header" @click="toggleExpand(result.key)">
        <div class="flex-row">
          <span class="diag-check__expand">{{ expanded.has(result.key) ? '▼' : '▶' }}</span>
          <h3>{{ result.name }}</h3>
          <span v-if="result.passed" class="badge badge--success">Đạt</span>
          <span v-else class="badge badge--warning">{{ result.issues.length }} vấn đề</span>
        </div>
        <div class="hint diag-check__summary">{{ result.summary }}</div>
      </div>

      <div v-if="expanded.has(result.key)" class="card__body">
        <div v-if="result.issues.length === 0" class="hint" style="text-align:center;padding:16px">
          Kiểm tra đạt, không có vấn đề
        </div>
        <DiagnosticIssue v-for="(issue, i) in result.issues" :key="i"
          :issue="issue"
          @fix="onFixIssue(result, i)" />

        <div v-if="result.stats?.top5" class="diag-stats">
          <div class="diag-stats__title">Top 5 mục chiếm dụng token:</div>
          <div v-for="t in result.stats.top5" :key="t.id" class="diag-stats__row">
            <span>#{{ t.id }} {{ t.comment }}</span>
            <span class="hint">{{ t.tokens }} token{{ t.constant ? ' (Đèn xanh thường trực)' : '' }}</span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="aiResults.length > 0" class="diag-section-title">Kiểm tra AI</div>
    <div v-for="result in aiResults" :key="result.key" class="card mb-md diag-check diag-check--ai"
      :class="{ 'diag-check--passed': result.passed, 'diag-check--has-issues': result.issues.length > 0 }">
      <div class="card__header diag-check__header" @click="toggleExpand(result.key)">
        <div class="flex-row">
          <span class="diag-check__expand">{{ expanded.has(result.key) ? '▼' : '▶' }}</span>
          <h3>{{ result.name }} <span class="diag-check__ai-tag">AI</span></h3>
          <span v-if="result.passed" class="badge badge--success">Đạt</span>
          <span v-else class="badge badge--warning">{{ result.issues.length }} vấn đề</span>
        </div>
        <div class="hint diag-check__summary">{{ result.summary }}</div>
      </div>

      <div v-if="expanded.has(result.key)" class="card__body">
        <div v-if="result.issues.length === 0" class="hint" style="text-align:center;padding:16px">
          Kiểm tra đạt, không có vấn đề
        </div>
        <DiagnosticIssue v-for="(issue, i) in result.issues" :key="i"
          :issue="issue"
          @fix="onFixIssue(result, i)" />
      </div>
    </div>

    <AiFixPreviewModal
      :visible="modalVisible"
      :field="modalField"
      :original="modalOriginal"
      :rewritten="modalRewritten"
      :conflict-desc="modalConflictDesc"
      :loading="modalLoading"
      @apply="onModalApply"
      @cancel="onModalCancel"
      @regenerate="onModalRegenerate" />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useCardStore } from '../stores/card.js';
import { useAppStore } from '../stores/app.js';
import { useApiStore } from '../stores/api.js';
import { runAllChecks, CHECK_METADATA } from '../utils/diagnostic-checks.js';
import { applyFix, applyAllFixes, undoLastFix, getUndoStackSize } from '../utils/diagnostic-fix.js';
import { runAllAiChecks, aiFixField, applyAiFix, AI_CHECK_METADATA } from '../utils/diagnostic-ai-checks.js';
import DiagnosticIssue from '../components/DiagnosticIssue.vue';
import AiFixPreviewModal from '../components/AiFixPreviewModal.vue';

const cardStore = useCardStore();
const appStore = useAppStore();
const apiStore = useApiStore();

const results = ref([]);
const running = ref(false);
const aiRunning = ref(false);
const aiProgress = ref({ current: 0, total: 3 });
const expanded = ref(new Set());
const lastRunTime = ref('');
const undoSize = ref(0);

const AI_KEYS = AI_CHECK_METADATA.map(c => c.key);
const frontendResults = computed(() => results.value.filter(r => !AI_KEYS.includes(r.key)));
const aiResults = computed(() => results.value.filter(r => AI_KEYS.includes(r.key)));

const totalIssues = computed(() => results.value.reduce((s, r) => s + r.issues.length, 0));
const fixableCount = computed(() => results.value.reduce(
  (s, r) => s + r.issues.filter(i => i.fixable && i.fixId !== 'ai_fix_field').length, 0));
const aiFixableCount = computed(() => results.value.reduce(
  (s, r) => s + r.issues.filter(i => i.fixId === 'ai_fix_field').length, 0));
const passedCount = computed(() => results.value.filter(r => r.passed).length);

// Trạng thái modal
const modalVisible = ref(false);
const modalLoading = ref(false);
const modalField = ref('');
const modalOriginal = ref('');
const modalRewritten = ref('');
const modalConflictDesc = ref('');
const modalSuggestion = ref('');

function runDiagnostic(keepAi = false) {
  running.value = true;
  setTimeout(() => {
    try {
      const fe = runAllChecks(cardStore);
      const oldAi = keepAi ? results.value.filter(r => AI_KEYS.includes(r.key)) : [];
      results.value = [...fe, ...oldAi];
      stampTime();
      expanded.value = new Set(results.value.filter(r => r.issues.length > 0).map(r => r.key));
      undoSize.value = getUndoStackSize();
      appStore.toastSuccess(`Chẩn đoán hoàn tất: ${totalIssues.value} vấn đề`);
    } catch (e) {
      appStore.toastError('Chẩn đoán thất bại: ' + e.message);
    } finally {
      running.value = false;
    }
  }, 100);
}

async function runAiDiagnostic() {
  if (!apiStore.isConfigured) {
    appStore.toastWarning('Vui lòng cấu hình API trong cài đặt trước');
    return;
  }
  if (frontendResults.value.length === 0) {
    runDiagnostic();
    await new Promise(r => setTimeout(r, 200));
  }
  aiRunning.value = true;
  aiProgress.value = { current: 0, total: 3 };
  try {
    const aiR = await runAllAiChecks(apiStore, cardStore, (i, total, name) => {
      aiProgress.value = { current: i + 1, total };
      appStore.toastInfo?.(`AI đang kiểm tra ${i + 1}/${total}: ${name}`);
    });
    const fe = results.value.filter(r => !AI_KEYS.includes(r.key));
    results.value = [...fe, ...aiR];
    stampTime();
    aiR.forEach(r => { if (r.issues.length > 0) expanded.value.add(r.key); });
    expanded.value = new Set(expanded.value);
    appStore.toastSuccess(`Kiểm tra AI hoàn tất: ${aiR.reduce((s, r) => s + r.issues.length, 0)} đề xuất`);
  } catch (e) {
    appStore.toastError('Kiểm tra AI thất bại: ' + e.message);
  } finally {
    aiRunning.value = false;
  }
}

function stampTime() {
  const now = new Date();
  lastRunTime.value = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
}

function toggleExpand(key) {
  const newSet = new Set(expanded.value);
  if (newSet.has(key)) newSet.delete(key);
  else newSet.add(key);
  expanded.value = newSet;
}

function onFixIssue(result, issueIdx) {
  const issue = result.issues[issueIdx];
  if (!issue.fixable || !issue.fixId) return;
  if (issue.fixId === 'ai_fix_field') {
    openAiFixModal(issue);
  } else {
    const ok = applyFix(cardStore, issue.fixId, issue.fixPayload);
    if (ok) {
      appStore.toastSuccess('Đã sửa');
      undoSize.value = getUndoStackSize();
      runDiagnostic(true);
    } else {
      appStore.toastError('Sửa thất bại');
    }
  }
}

function fixAll() {
  const nonAi = results.value.map(r => ({
    ...r,
    issues: r.issues.filter(i => i.fixId !== 'ai_fix_field')
  }));
  const { fixed, skipped } = applyAllFixes(cardStore, nonAi);
  if (fixed === 0) {
    appStore.toastWarning('Không có vấn đề nào có thể sửa nhanh (AI viết lại cần xem trước từng mục)');
    return;
  }
  appStore.toastSuccess(`Đã sửa ${fixed} mục${skipped > 0 ? ', bỏ qua ' + skipped + ' mục' : ''}`);
  undoSize.value = getUndoStackSize();
  runDiagnostic(true);
}

function undo() {
  const result = undoLastFix(cardStore);
  if (result) {
    appStore.toastSuccess(`Đã hoàn tác: ${result.label}`);
    undoSize.value = getUndoStackSize();
    runDiagnostic(true);
  } else {
    appStore.toastWarning('Không có thao tác nào để hoàn tác');
  }
}

// ========== Quy trình xem trước AI sửa lỗi ==========

async function openAiFixModal(issue) {
  const payload = issue.fixPayload || {};
  if (!payload.field) {
    appStore.toastError('AI sửa lỗi thiếu thông tin field');
    return;
  }
  modalField.value = payload.field;
  modalOriginal.value = cardStore.cardData[payload.field] || '';
  modalConflictDesc.value = payload.conflictDesc || '';
  modalSuggestion.value = payload.suggestion || '';
  modalRewritten.value = '';
  modalVisible.value = true;
  modalLoading.value = true;
  try {
    const r = await aiFixField(apiStore, cardStore, payload.field, payload.suggestion, payload.conflictDesc);
    modalRewritten.value = r.rewritten;
  } catch (e) {
    appStore.toastError('AI viết lại thất bại: ' + e.message);
    modalVisible.value = false;
  } finally {
    modalLoading.value = false;
  }
}

function onModalApply(newValue) {
  applyAiFix(cardStore, modalField.value, newValue);
  appStore.toastSuccess(`Đã áp dụng AI viết lại: ${modalField.value}`);
  modalVisible.value = false;
  runDiagnostic(true);
}

function onModalCancel() {
  modalVisible.value = false;
}

async function onModalRegenerate() {
  modalLoading.value = true;
  modalRewritten.value = '';
  try {
    const r = await aiFixField(apiStore, cardStore, modalField.value, modalSuggestion.value, modalConflictDesc.value);
    modalRewritten.value = r.rewritten;
  } catch (e) {
    appStore.toastError('Tạo lại thất bại: ' + e.message);
  } finally {
    modalLoading.value = false;
  }
}
</script>

<style scoped>
.diag-section-title {
  font-size: 12px;
  font-weight: 500;
  color: var(--cf-text-muted);
  margin: 4px 0 8px 4px;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.diag-check__header {
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 4px;
}
.diag-check__header:hover { background: var(--cf-bg-hover); }
.diag-check__expand { color: var(--cf-text-muted); font-size: 11px; margin-right: 4px; }
.diag-check__summary {
  margin-left: 24px;
  font-size: 12px;
}

.diag-check--passed { border-left: 3px solid var(--cf-success); }
.diag-check--has-issues { border-left: 3px solid var(--cf-warning); }
.diag-check--ai.diag-check--has-issues { border-left-color: var(--cf-info, #60a5fa); }

.diag-check__ai-tag {
  display: inline-block;
  padding: 1px 6px;
  margin-left: 6px;
  font-size: 10px;
  font-weight: 500;
  background: rgba(96, 165, 250, 0.15);
  color: var(--cf-info, #60a5fa);
  border-radius: 3px;
  vertical-align: middle;
}

.diag-stats {
  margin-top: 12px;
  padding: 10px 12px;
  background: var(--cf-bg-tertiary);
  border-radius: var(--cf-radius-sm);
  font-size: 12px;
}
.diag-stats__title {
  color: var(--cf-text-secondary);
  margin-bottom: 6px;
  font-weight: 500;
}
.diag-stats__row {
  display: flex;
  justify-content: space-between;
  padding: 3px 0;
  color: var(--cf-text-primary);
}
</style>