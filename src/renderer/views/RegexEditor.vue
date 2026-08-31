<template>
  <div class="page">
    <div class="page__header flex-between">
      <div>
        <h1>Trình chỉnh sửa script Regex</h1>
        <p>Cấu hình script Regex — markdownOnly/promptOnly, kiểm soát độ sâu tầng tin nhắn</p>
      </div>
      <div class="flex-row">
        <button class="btn btn--accent" @click="autoGenRegex" :disabled="aiGenerating">
          {{ aiGenerating ? 'Đang tạo tự động...' : 'AI tạo tự động hoàn toàn' }}
        </button>
        <button class="btn btn--ghost" @click="toggleBatchMode" v-if="scripts.length > 0">
          {{ batchMode ? 'Thoát thao tác hàng loạt' : 'Thao tác hàng loạt' }}
        </button>
        <button class="btn btn--primary" @click="store.addRegexScript()">+ Tạo script Regex mới</button>
      </div>
    </div>

    <!-- Kho mẫu -->
    <div class="card mb-md">
      <div class="card__header"><h3>Thêm nhanh mẫu Regex thường dùng 1 chạm</h3></div>
      <div class="card__body hint" style="border-bottom:1px solid var(--cf-border);padding-bottom:12px;margin-bottom:8px">
        Script Regex dùng để làm đẹp nội dung AI xuất ra hoặc làm sạch nội dung gửi cho AI.<br>
        · <strong>Bộ 3 cơ bản</strong> = Thu gọn biến (lớp hiển thị) + Làm sạch biến (lớp AI) + Ẩn chuỗi tư duy — <em>Phần lớn trường hợp chỉ cần chọn bộ này</em><br>
        · <strong>Bộ đầy đủ</strong> = 6 script MVU tiêu chuẩn, không xung đột nhau — <em>Chọn bộ này khi thẻ có dùng hệ thống biến MVU</em><br>
        · <strong>Thanh trạng thái</strong> đã được chuyển sang trang "Bàn làm việc thanh trạng thái", tại đó có thể tạo tùy chỉnh bằng AI<br>
        · <strong>markdownOnly</strong> = Chỉ sửa đổi những gì người dùng nhìn thấy | <strong>promptOnly</strong> = Chỉ sửa đổi những gì gửi cho AI
      </div>
      <div class="card__body flex-row" style="flex-wrap:wrap;gap:8px">
        <button class="btn btn--secondary" @click="addAllEssentials">Thêm bộ 3 cơ bản 1 chạm</button>
        <button class="btn btn--secondary" @click="addFullSet">Thêm bộ đầy đủ 1 chạm</button>
        <button class="btn btn--ghost btn--sm" @click="showTemplateLib = !showTemplateLib">
          {{ showTemplateLib ? 'Thu gọn kho mẫu' : 'Mở rộng thêm mẫu' }}
        </button>
      </div>
      <div v-if="showTemplateLib" class="card__body" style="border-top:1px solid var(--cf-border);padding-top:12px">
        <div class="hint mb-md">Thêm riêng từng mẫu (người dùng nâng cao):</div>
        <div class="flex-row" style="flex-wrap:wrap;gap:6px">
          <button class="btn btn--ghost btn--sm" v-for="t in regexTemplates" :key="t.name"
            @click="addTemplate(t)">{{ t.name }}</button>
        </div>
      </div>
    </div>

    <!-- Thanh thao tác hàng loạt -->
    <div v-if="batchMode && scripts.length > 0" class="card mb-md batch-bar">
      <div class="card__body flex-between">
        <div class="flex-row">
          <label class="toggle-label">
            <input type="checkbox" :checked="selectedAll" @change="toggleSelectAll"> Chọn tất cả
          </label>
          <span style="font-size:12px;color:var(--cf-text-muted)">Đã chọn {{ selectedIds.size }} / {{ scripts.length }}</span>
        </div>
        <div class="flex-row">
          <button class="btn btn--secondary btn--sm" @click="batchEnable(true)" :disabled="selectedIds.size === 0">Bật hàng loạt</button>
          <button class="btn btn--secondary btn--sm" @click="batchEnable(false)" :disabled="selectedIds.size === 0">Tắt hàng loạt</button>
          <button class="btn btn--danger btn--sm" @click="batchDelete" :disabled="selectedIds.size === 0">Xóa hàng loạt</button>
        </div>
      </div>
    </div>

    <div v-if="scripts.length === 0" class="card">
      <div class="empty-state">
        <div class="empty-state__icon"></div>
        <div class="empty-state__title">Chưa có script Regex nào</div>
        <div class="empty-state__desc">Script Regex có thể làm đẹp nội dung AI xuất ra, ẩn tag, hiển thị thanh trạng thái HTML</div>
      </div>
    </div>

    <div v-for="(script, i) in scripts" :key="script.id" class="card mb-md"
      :class="{ 'regex--dragging': dragSourceId === script.id, 'regex--dragover': dragOverId === script.id }"
      :draggable="dragEnabledId === script.id"
      @dragstart="onDragStart($event, script.id)"
      @dragover.prevent="onDragOver($event, script.id)"
      @dragleave="onDragLeave(script.id)"
      @drop.prevent="onDrop($event, script.id)"
      @dragend="onDragEnd">
      <div class="card__header">
        <div class="flex-row">
          <label v-if="batchMode" class="toggle-label" style="margin-right:4px">
            <input type="checkbox" :checked="selectedIds.has(script.id)"
              @change="toggleSelect(script.id)">
          </label>
          <span class="regex-drag-handle"
            @mousedown="dragEnabledId = script.id"
            @mouseup="dragEnabledId = null"
            @mouseleave="dragEnabledId = null"
            title="Kéo thả để sắp xếp">&#x22EE;&#x22EE;</span>
          <span class="badge badge--info">#{{ i + 1 }}</span>
          <input class="input" style="width:300px;font-weight:600" v-model="script.scriptName" @input="store.markDirty()">
          <label class="toggle-label">
            <input type="checkbox" :checked="!script.disabled"
              @change="script.disabled = !$event.target.checked; store.markDirty()"> Bật
          </label>
        </div>
        <button class="btn btn--danger btn--sm" @click="appStore.confirmAction('Xóa script Regex này?', () => store.removeRegexScript(script.id))">Xóa</button>
      </div>
      <div class="card__body">
        <div class="grid-2">
          <div class="form-group">
            <label>Regex tìm kiếm (findRegex)</label>
            <textarea class="textarea" style="font-family:var(--cf-font-mono);font-size:12px"
              v-model="script.findRegex" rows="3" placeholder="Biểu thức Regex" @input="store.markDirty()"></textarea>
          </div>
          <div class="form-group">
            <label>Nội dung thay thế (replaceString)</label>
            <textarea class="textarea" style="font-family:var(--cf-font-mono);font-size:12px"
              v-model="script.replaceString" rows="3" placeholder="Thay thế thành..." @input="store.markDirty()"></textarea>
          </div>
        </div>

        <div class="grid-3">
          <div class="form-group">
            <label>Phạm vi áp dụng (placement)</label>
            <div class="flex-row" style="flex-wrap:wrap">
              <label class="toggle-label" v-for="opt in placementOpts" :key="opt.val">
                <input type="checkbox" :checked="script.placement.includes(opt.val)"
                  @change="togglePlacement(script, opt.val)"> {{ opt.label }}
              </label>
            </div>
          </div>
          <div class="form-group">
            <label>Chế độ</label>
            <div>
              <label class="toggle-label mb-md">
                <input type="checkbox" v-model="script.markdownOnly"
                  @change="if(script.markdownOnly) script.promptOnly=false; store.markDirty()">
                markdownOnly (Chỉ lớp hiển thị)
              </label>
              <label class="toggle-label">
                <input type="checkbox" v-model="script.promptOnly"
                  @change="if(script.promptOnly) script.markdownOnly=false; store.markDirty()">
                promptOnly (Chỉ lớp AI)
              </label>
            </div>
          </div>
          <div class="form-group">
            <label>Kiểm soát độ sâu tầng tin nhắn</label>
            <div class="grid-2">
              <div>
                <label style="font-size:11px">minDepth</label>
                <input class="input" type="number" v-model.number="script.minDepth"
                  placeholder="null" @input="store.markDirty()">
              </div>
              <div>
                <label style="font-size:11px">maxDepth</label>
                <input class="input" type="number" v-model.number="script.maxDepth"
                  placeholder="null" @input="store.markDirty()">
              </div>
            </div>
          </div>
        </div>

        <label class="toggle-label">
          <input type="checkbox" v-model="script.runOnEdit" @change="store.markDirty()"> Chạy cả khi chỉnh sửa tin nhắn
        </label>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useCardStore } from '../stores/card.js';
import { useApiStore } from '../stores/api.js';
import { useAppStore } from '../stores/app.js';
import { buildCardContext } from '../utils/card-context.js';
import { chatForJsonArray } from '../utils/json-repair.js';

const store = useCardStore();
const apiStore = useApiStore();
const appStore = useAppStore();
const scripts = computed(() => store.regexScripts);
const aiGenerating = ref(false);
const showTemplateLib = ref(false);
const batchMode = ref(false);
const selectedIds = ref(new Set());

const dragSourceId = ref(null);
const dragOverId = ref(null);
const dragEnabledId = ref(null);

function onDragStart(e, id) {
  dragSourceId.value = id;
  e.dataTransfer.effectAllowed = 'move';
}
function onDragOver(e, id) {
  if (id === dragSourceId.value) return;
  dragOverId.value = id;
  e.dataTransfer.dropEffect = 'move';
}
function onDragLeave(id) {
  if (dragOverId.value === id) dragOverId.value = null;
}
function onDrop(e, id) {
  const sourceId = dragSourceId.value;
  if (sourceId && id !== sourceId) {
    store.reorderRegexScript(sourceId, id);
  }
  dragSourceId.value = null;
  dragOverId.value = null;
  dragEnabledId.value = null;
}
function onDragEnd() {
  dragSourceId.value = null;
  dragOverId.value = null;
  dragEnabledId.value = null;
}

const selectedAll = computed(() =>
  scripts.value.length > 0 && selectedIds.value.size === scripts.value.length
);

function toggleBatchMode() {
  batchMode.value = !batchMode.value;
  selectedIds.value = new Set();
}

function toggleSelect(id) {
  const s = new Set(selectedIds.value);
  if (s.has(id)) s.delete(id); else s.add(id);
  selectedIds.value = s;
}

function toggleSelectAll() {
  if (selectedAll.value) {
    selectedIds.value = new Set();
  } else {
    selectedIds.value = new Set(scripts.value.map(s => s.id));
  }
}

function batchEnable(enabled) {
  for (const script of scripts.value) {
    if (selectedIds.value.has(script.id)) {
      script.disabled = !enabled;
    }
  }
  store.markDirty();
  appStore.toastSuccess(`Đã ${enabled ? 'bật' : 'tắt'} ${selectedIds.value.size} script Regex`);
}

function batchDelete() {
  const count = selectedIds.value.size;
  appStore.confirmAction(`Xác nhận xóa ${count} script Regex đã chọn?`, () => {
    for (const id of selectedIds.value) {
      store.removeRegexScript(id);
    }
    selectedIds.value = new Set();
    appStore.toastSuccess(`Đã xóa ${count} script Regex`);
  });
}

async function autoGenRegex() {
  if (!apiStore.isConfigured) { appStore.toastError('Vui lòng cấu hình API Key trong cài đặt trước'); return; }
  aiGenerating.value = true;
  try {
    const context = buildCardContext(store, '', { modelContextTokens: apiStore.getModelContextTokens(apiStore.activeProvider?.model) });
    const hasWorldBook = store.worldEntries.length > 0;
    const hasMvu = store.tavernScripts.some(s => s.content && s.content.includes('MagVarUpdate'));

    const prompt = `Bạn là chuyên gia về script Regex của SillyTavern. Dựa trên thông tin thẻ nhân vật sau, hãy tự động phán đoán cần những script Regex nào và sinh mã tương ứng.

【Thông tin thẻ nhân vật】
${context}

【Trạng thái hiện tại】
- Đã có mục Worldbook: ${hasWorldBook ? 'Có' : 'Chưa'}
- Đã có hệ thống biến MVU: ${hasMvu ? 'Có' : 'Chưa'}
- Số lượng script Regex hiện có: ${store.regexScripts.length}

Vui lòng tự động phán đoán tổ hợp script Regex cần thiết theo loại thẻ nhân vật. Các nhu cầu phổ biến:
- Có MVU → Cần thu gọn biến + làm sạch biến + ẩn chuỗi tư duy
- Có Worldbook phức tạp → Cần làm sạch tag
- Có placeholder thanh trạng thái → Cần kết xuất thanh trạng thái + dọn dẹp tầng cũ

Xuất mảng JSON: [{ "scriptName": "Tên script", "findRegex": "Regex", "replaceString": "Thay thế", "markdownOnly": bool, "promptOnly": bool, "minDepth": null hoặc số, "maxDepth": null hoặc số }]

Chỉ xuất các script thực sự cần thiết, không tạo trùng lặp với script đã có. Chỉ xuất JSON.`;

    const generated = await chatForJsonArray(apiStore, [
      { role: 'system', content: 'Bạn là chuyên gia script Regex. Chỉ xuất mảng JSON hợp lệ bằng tiếng Việt.' },
      { role: 'user', content: prompt }
    ], { temperature: 0.7, maxTokens: apiStore.getModelMaxTokens(apiStore.activeProvider?.model) });
    for (const s of generated) {
      store.addRegexScript({
        ...store.createEmptyRegexScript(),
        scriptName: s.scriptName || 'Script mới',
        findRegex: s.findRegex || '',
        replaceString: s.replaceString || '',
        markdownOnly: s.markdownOnly || false,
        promptOnly: s.promptOnly || false,
        minDepth: s.minDepth ?? null,
        maxDepth: s.maxDepth ?? null
      });
    }
    appStore.toastSuccess(`AI đã tự động tạo ${generated.length} script Regex`);
  } catch (e) {
    appStore.toastError('Tạo tự động thất bại: ' + e.message);
  } finally { aiGenerating.value = false; }
}

// Kho mẫu Regex
// Tất cả mẫu tùy chọn (người dùng tự thêm riêng lẻ)
const regexTemplates = [
  // --- Bộ 3 cơ bản ---
  {
    name: 'Thu gọn cập nhật biến (Lớp hiển thị)', essential: true,
    scriptName: '[Thu gọn] Cập nhật biến', findRegex: '/<UpdateVariable>[\\s\\S]*?<\\/UpdateVariable>/gs',
    replaceString: '<details><summary>Cập nhật biến</summary>$&</details>',
    markdownOnly: true, promptOnly: false, minDepth: null, maxDepth: null
  },
  {
    name: 'Làm sạch cập nhật biến (Lớp AI)', essential: true,
    scriptName: '[Làm sạch] Loại bỏ cập nhật biến', findRegex: '/<UpdateVariable>[\\s\\S]*?<\\/UpdateVariable>/gm',
    replaceString: '',
    markdownOnly: false, promptOnly: true, minDepth: null, maxDepth: null
  },
  {
    name: 'Ẩn chuỗi tư duy (Lớp hiển thị)', essential: true,
    scriptName: '[Ẩn] Chuỗi tư duy', findRegex: '/<Analysis>[\\s\\S]*?<\\/Analysis>/gs',
    replaceString: '<details><summary>Chuỗi tư duy</summary>$&</details>',
    markdownOnly: true, promptOnly: false, minDepth: null, maxDepth: null
  },
  // --- Tùy chọn riêng lẻ (Phương án thay thế) ---
  {
    name: 'Làm sạch chuỗi tư duy (Lớp AI)',
    scriptName: '[Làm sạch] Loại bỏ chuỗi tư duy', findRegex: '/<Analysis>[\\s\\S]*?<\\/Analysis>/gm',
    replaceString: '',
    markdownOnly: false, promptOnly: true, minDepth: null, maxDepth: null
  },
  {
    name: 'Ẩn placeholder thanh trạng thái (Lớp AI)',
    scriptName: '[Ẩn] Placeholder thanh trạng thái', findRegex: '/<StatusPlaceHolderImpl\\s*\\/>/g',
    replaceString: '',
    markdownOnly: false, promptOnly: true, minDepth: null, maxDepth: null
  },
  {
    name: 'Dọn dẹp HTML tầng cũ',
    scriptName: '[Dọn dẹp] Tầng cũ', findRegex: '/<StatusPlaceHolderImpl\\s*\\/>/g',
    replaceString: '',
    markdownOnly: true, promptOnly: false, minDepth: 3, maxDepth: null
  },
  {
    name: 'Làm đẹp biến (Lớp hiển thị)',
    scriptName: '[Làm đẹp] Cập nhật biến hoàn tất', findRegex: '/<UpdateVariable>([\\s\\S]*?)<\\/UpdateVariable>/gs',
    replaceString: '<details style="background:rgba(0,0,0,0.15);border:1px solid rgba(255,255,255,0.06);border-radius:6px;padding:8px;margin:4px 0;font-size:12px"><summary style="cursor:pointer;color:#888">Cập nhật biến</summary><pre style="white-space:pre-wrap;color:#aaa;margin:4px 0">$1</pre></details>',
    markdownOnly: true, promptOnly: false, minDepth: null, maxDepth: null
  },
  {
    name: 'Làm đẹp khi đang cập nhật biến (Stream)',
    scriptName: '[Làm đẹp] Đang cập nhật biến', findRegex: '/<UpdateVariable>(?![\\s\\S]*<\\/UpdateVariable>)([\\s\\S]*)/gs',
    replaceString: '<details open style="background:rgba(0,0,0,0.15);border:1px solid rgba(100,200,255,0.15);border-radius:6px;padding:8px;margin:4px 0;font-size:12px"><summary style="cursor:pointer;color:#60a5fa">Đang cập nhật biến...</summary><pre style="white-space:pre-wrap;color:#aaa;margin:4px 0">$1</pre></details>',
    markdownOnly: true, promptOnly: false, minDepth: null, maxDepth: null
  },
  {
    name: 'Ẩn cập nhật biến (Không hiển thị)',
    scriptName: '[Ẩn] Cập nhật biến', findRegex: '/<UpdateVariable>[\\s\\S]*?<\\/UpdateVariable>/gs',
    replaceString: '',
    markdownOnly: true, promptOnly: false, minDepth: null, maxDepth: null
  },
  {
    name: 'Dọn dẹp biến tầng cũ (Lớp AI minDepth 6)',
    scriptName: '[Không gửi] Loại bỏ biến cũ', findRegex: '/<UpdateVariable>[\\s\\S]*?<\\/UpdateVariable>/gm',
    replaceString: '',
    markdownOnly: false, promptOnly: true, minDepth: 6, maxDepth: null
  }
];

// Bộ đầy đủ = 6 script tiêu chuẩn (Bộ không xung đột nhau)
const fullSetTemplates = [
  { scriptName: '[Không gửi] Loại bỏ biến cũ', findRegex: '/<UpdateVariable>[\\s\\S]*?<\\/UpdateVariable>/gm',
    replaceString: '', markdownOnly: false, promptOnly: true, minDepth: 6, maxDepth: null },
  { scriptName: '[Không gửi] Loại bỏ chuỗi tư duy', findRegex: '/<Analysis>[\\s\\S]*?<\\/Analysis>/gm',
    replaceString: '', markdownOnly: false, promptOnly: true, minDepth: null, maxDepth: null },
  { scriptName: '[Không gửi] Placeholder giao diện', findRegex: '/<StatusPlaceHolderImpl\\s*\\/>/g',
    replaceString: '', markdownOnly: false, promptOnly: true, minDepth: null, maxDepth: null },
  { scriptName: '[Làm đẹp] Cập nhật biến hoàn tất', findRegex: '/<UpdateVariable>([\\s\\S]*?)<\\/UpdateVariable>/gs',
    replaceString: '<details style="background:rgba(0,0,0,0.15);border:1px solid rgba(255,255,255,0.06);border-radius:6px;padding:8px;margin:4px 0;font-size:12px"><summary style="cursor:pointer;color:#888">Cập nhật biến</summary><pre style="white-space:pre-wrap;color:#aaa;margin:4px 0">$1</pre></details>',
    markdownOnly: true, promptOnly: false, minDepth: null, maxDepth: null },
  { scriptName: '[Làm đẹp] Đang cập nhật biến', findRegex: '/<UpdateVariable>(?![\\s\\S]*<\\/UpdateVariable>)([\\s\\S]*)/gs',
    replaceString: '<details open style="background:rgba(0,0,0,0.15);border:1px solid rgba(100,200,255,0.15);border-radius:6px;padding:8px;margin:4px 0;font-size:12px"><summary style="cursor:pointer;color:#60a5fa">Đang cập nhật biến...</summary><pre style="white-space:pre-wrap;color:#aaa;margin:4px 0">$1</pre></details>',
    markdownOnly: true, promptOnly: false, minDepth: null, maxDepth: null },
  { scriptName: '[Dọn dẹp] Tầng cũ', findRegex: '/<StatusPlaceHolderImpl\\s*\\/>/g',
    replaceString: '', markdownOnly: true, promptOnly: false, minDepth: 3, maxDepth: null }
];

function addTemplate(t) {
  store.addRegexScript({
    ...store.createEmptyRegexScript(),
    scriptName: t.scriptName,
    findRegex: t.findRegex,
    replaceString: t.replaceString,
    markdownOnly: t.markdownOnly,
    promptOnly: t.promptOnly,
    minDepth: t.minDepth,
    maxDepth: t.maxDepth
  });
  appStore.toastSuccess('Đã thêm: ' + t.scriptName);
}

function addAllEssentials() {
  const essentials = regexTemplates.filter(t => t.essential);
  essentials.forEach(t => addTemplate(t));
  appStore.toastSuccess('Đã thêm bộ 3 cơ bản (' + essentials.length + ' script)');
}

function addFullSet() {
  for (const t of fullSetTemplates) {
    store.addRegexScript({
      ...store.createEmptyRegexScript(),
      scriptName: t.scriptName,
      findRegex: t.findRegex,
      replaceString: t.replaceString,
      markdownOnly: t.markdownOnly,
      promptOnly: t.promptOnly,
      minDepth: t.minDepth,
      maxDepth: t.maxDepth
    });
  }
  appStore.toastSuccess('Đã thêm bộ đầy đủ (' + fullSetTemplates.length + ' script)');
}

const placementOpts = [
  { val: 1, label: 'Tin nhắn người dùng' },
  { val: 2, label: 'Tin nhắn AI' },
  { val: 3, label: 'Đầu ra lệnh gạch chéo' },
  { val: 4, label: 'Nội dung Worldbook' }
];

function togglePlacement(script, val) {
  const idx = script.placement.indexOf(val);
  if (idx === -1) script.placement.push(val);
  else script.placement.splice(idx, 1);
  store.markDirty();
}
</script>

<style scoped>
.toggle-label {
  display: flex; align-items: center; gap: 6px;
  font-size: 13px; cursor: pointer; color: var(--cf-text-secondary);
  input { accent-color: var(--cf-accent); }
}
.batch-bar {
  border: 1px solid rgba(96, 165, 250, 0.2);
  background: rgba(96, 165, 250, 0.04);
}
.regex-drag-handle {
  cursor: grab;
  padding: 0 6px;
  color: var(--cf-text-muted);
  font-size: 14px;
  letter-spacing: -2px;
  user-select: none;
  &:active { cursor: grabbing; }
}
.regex--dragging {
  opacity: 0.4;
}
.regex--dragover {
  border-color: var(--cf-accent) !important;
  box-shadow: 0 0 8px rgba(96, 165, 250, 0.3);
}
</style>