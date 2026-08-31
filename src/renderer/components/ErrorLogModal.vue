<template>
  <div v-if="visible" class="cf-confirm-overlay" @click.self="close">
    <div class="cf-log-dialog">
      <div class="cf-log-header">
        <div class="cf-log-title">Log lỗi <span class="cf-log-count">({{ entries.length }})</span></div>
        <button class="cf-log-close" @click="close">x</button>
      </div>

      <div class="cf-log-toolbar">
        <input class="input cf-log-search" v-model="filter" placeholder="Lọc từ khóa (loại / thông điệp / nguồn)" />
        <button class="btn btn--secondary btn--sm" @click="reload" :disabled="loading">{{ loading ? '...' : 'Làm mới' }}</button>
        <button class="btn btn--secondary btn--sm" @click="copyAll" :disabled="!entries.length">Sao chép tất cả</button>
        <button class="btn btn--secondary btn--sm" @click="exportTxt" :disabled="!entries.length">Xuất file txt</button>
        <button v-if="isElectron" class="btn btn--secondary btn--sm" @click="openFolder">Mở thư mục</button>
        <button class="btn btn--danger btn--sm" @click="confirmClear" :disabled="!entries.length">Xóa sạch</button>
      </div>

      <div v-if="logDir" class="cf-log-path">Vị trí log: {{ logDir }}</div>

      <div class="cf-log-list">
        <div v-if="!filteredEntries.length" class="cf-log-empty">
          {{ entries.length === 0 ? 'Chưa có log lỗi nào' : 'Không có log phù hợp' }}
        </div>
        <div v-for="(e, i) in filteredEntries" :key="i" class="cf-log-item" :class="'cf-log-item--' + e.source">
          <div class="cf-log-item-head">
            <span class="cf-log-time">{{ formatTime(e.time) }}</span>
            <span class="cf-log-source">{{ e.source }}</span>
            <span class="cf-log-type">{{ e.type }}</span>
          </div>
          <div class="cf-log-msg">{{ e.message }}</div>
          <pre v-if="e.stack" class="cf-log-stack">{{ e.stack }}</pre>
          <div v-if="e.extra" class="cf-log-extra">{{ formatExtra(e.extra) }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useAppStore } from '../stores/app.js';
import errorLogger from '../utils/error-logger.js';
import { isElectron } from '../utils/platform.js';

const props = defineProps({
  visible: { type: Boolean, default: false }
});
const emit = defineEmits(['close']);

const appStore = useAppStore();
const entries = ref([]);
const logDir = ref('');
const filter = ref('');
const loading = ref(false);

const filteredEntries = computed(() => {
  const q = filter.value.trim().toLowerCase();
  if (!q) return entries.value;
  return entries.value.filter(e =>
    (e.message || '').toLowerCase().includes(q) ||
    (e.type || '').toLowerCase().includes(q) ||
    (e.source || '').toLowerCase().includes(q) ||
    (e.stack || '').toLowerCase().includes(q)
  );
});

watch(() => props.visible, (v) => { if (v) reload(); });

async function reload() {
  loading.value = true;
  try {
    const res = await window.cardForgeAPI.readErrorLog();
    if (res && res.success) {
      const fileEntries = res.entries || [];
      // Gộp nội dung trong buffer chưa kịp ghi vào đĩa
      const buffer = errorLogger.getBuffer();
      const all = [...fileEntries, ...buffer];
      // Khử trùng lặp theo thứ tự thời gian giảm dần (dùng time + message làm key)
      const seen = new Set();
      const dedup = [];
      for (const e of all.sort((a, b) => (b.time || '').localeCompare(a.time || ''))) {
        const k = (e.time || '') + '|' + (e.message || '');
        if (seen.has(k)) continue;
        seen.add(k);
        dedup.push(e);
      }
      entries.value = dedup;
      logDir.value = res.dir || '';
    } else {
      appStore.toastError('Đọc log thất bại: ' + (res?.error || 'Lỗi không xác định'));
    }
  } catch (e) {
    appStore.toastError('Đọc log thất bại: ' + e.message);
  } finally {
    loading.value = false;
  }
}

function close() { emit('close'); }

function formatTime(t) {
  if (!t) return '-';
  try {
    const d = new Date(t);
    return d.toLocaleString('vi-VN', { hour12: false });
  } catch (e) { return t; }
}

function formatExtra(extra) {
  try { return typeof extra === 'string' ? extra : JSON.stringify(extra); }
  catch (e) { return String(extra); }
}

function buildText() {
  return filteredEntries.value.map(e => {
    let s = `[${formatTime(e.time)}] [${e.source}] [${e.type}] ${e.message}`;
    if (e.stack) s += '\n' + e.stack;
    if (e.extra) s += '\n  extra: ' + formatExtra(e.extra);
    return s;
  }).join('\n\n');
}

async function copyAll() {
  try {
    await navigator.clipboard.writeText(buildText());
    appStore.toastSuccess('Đã sao chép vào bộ nhớ tạm');
  } catch (e) {
    appStore.toastError('Sao chép thất bại: ' + e.message);
  }
}

function openFolder() {
  try {
    window.cardForgeAPI.openLogFolder();
  } catch (e) {
    appStore.toastError('Mở thư mục thất bại: ' + e.message);
  }
}

async function exportTxt() {
  try {
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const defaultName = `cardbuilding-error-log-${ts}.txt`;
    const filePath = await window.cardForgeAPI.saveFile({
      defaultPath: defaultName,
      filters: [{ name: 'File văn bản', extensions: ['txt'] }]
    });
    if (!filePath) return;
    const res = await window.cardForgeAPI.writeFile(filePath, buildText(), 'utf-8');
    if (res && res.success) {
      appStore.toastSuccess('Đã xuất: ' + filePath);
    } else {
      appStore.toastError('Xuất thất bại: ' + (res?.error || 'Lỗi không xác định'));
    }
  } catch (e) {
    appStore.toastError('Xuất thất bại: ' + e.message);
  }
}

function confirmClear() {
  appStore.confirmAction('Xác nhận xóa sạch toàn bộ log lỗi? Thao tác này sẽ xóa đồng thời file log (không thể khôi phục)', async () => {
    try {
      const res = await window.cardForgeAPI.clearErrorLog();
      if (res && res.success) {
        errorLogger.clearBuffer();
        entries.value = [];
        appStore.toastSuccess('Log đã được xóa sạch');
      } else {
        appStore.toastError('Xóa thất bại: ' + (res?.error || 'Lỗi không xác định'));
      }
    } catch (e) {
      appStore.toastError('Xóa thất bại: ' + e.message);
    }
  });
}
</script>

<style lang="scss" scoped>
.cf-log-dialog {
  background: var(--cf-bg-card, #1a1f2e);
  border: 1px solid var(--cf-border, rgba(255,255,255,0.1));
  border-radius: 12px;
  padding: 16px;
  width: 90vw;
  max-width: 1000px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
}
.cf-log-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.cf-log-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--cf-text-primary, #e6edf3);
}
.cf-log-count {
  font-size: 13px;
  color: var(--cf-text-muted, #8b95a7);
  font-weight: normal;
}
.cf-log-close {
  background: transparent;
  border: 1px solid var(--cf-border);
  color: var(--cf-text-primary);
  width: 28px;
  height: 28px;
  border-radius: 6px;
  cursor: pointer;
  &:hover { background: rgba(255,255,255,0.08); }
}
.cf-log-toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
  align-items: center;
}
.cf-log-search {
  flex: 1;
  min-width: 0;
}
.cf-log-path {
  font-size: 11px;
  color: var(--cf-text-muted);
  margin-bottom: 8px;
  word-break: break-all;
}
.cf-log-list {
  flex: 1;
  overflow-y: auto;
  border: 1px solid var(--cf-border, rgba(255,255,255,0.08));
  border-radius: 8px;
  padding: 8px;
  background: rgba(0,0,0,0.2);
}
.cf-log-empty {
  text-align: center;
  color: var(--cf-text-muted);
  padding: 40px 20px;
  font-size: 13px;
}
.cf-log-item {
  border: 1px solid rgba(255,255,255,0.06);
  border-left: 3px solid #f87171;
  border-radius: 6px;
  padding: 8px 10px;
  margin-bottom: 8px;
  background: rgba(255,255,255,0.02);
}
.cf-log-item--main { border-left-color: #fbbf24; }
.cf-log-item--renderer { border-left-color: #f87171; }
.cf-log-item--unknown { border-left-color: #94a3b8; }
.cf-log-item-head {
  display: flex;
  gap: 10px;
  font-size: 12px;
  color: var(--cf-text-muted);
  margin-bottom: 4px;
}
.cf-log-time { color: var(--cf-text-muted); }
.cf-log-source {
  background: rgba(255,255,255,0.08);
  padding: 1px 6px;
  border-radius: 4px;
  font-family: monospace;
}
.cf-log-type {
  background: rgba(248,113,113,0.15);
  color: #fca5a5;
  padding: 1px 6px;
  border-radius: 4px;
  font-family: monospace;
}
.cf-log-msg {
  font-size: 13px;
  color: var(--cf-text-primary, #e6edf3);
  word-break: break-word;
  white-space: pre-wrap;
}
.cf-log-stack {
  margin-top: 6px;
  padding: 6px 8px;
  background: rgba(0,0,0,0.4);
  border-radius: 4px;
  font-size: 11px;
  color: var(--cf-text-muted, #94a3b8);
  font-family: monospace;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 200px;
  overflow-y: auto;
}
.cf-log-extra {
  margin-top: 4px;
  font-size: 11px;
  color: var(--cf-text-muted);
  font-family: monospace;
  word-break: break-all;
}
</style>