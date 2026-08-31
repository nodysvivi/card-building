<template>
  <div class="page">
    <div class="page__header flex-between">
      <div>
        <h1>Trình chỉnh sửa Worldbook</h1>
        <p>Quản lý các mục Worldbook của thẻ nhân vật — Hiện có {{ entries.length }} mục</p>
        <input class="input" v-model="bookName" placeholder="Tên Worldbook (mặc định là “Chưa đặt tên”)" style="max-width:320px;margin-top:4px"/>
      </div>
      <div class="flex-row">
        <button class="btn btn--secondary btn--sm" @click="showAiPanel = !showAiPanel; showRefNovelPanel = false">
          {{ showAiPanel ? 'Tắt AI tạo' : 'AI tạo mục' }}
        </button>
        <button class="btn btn--secondary btn--sm" @click="showRefNovelPanel = !showRefNovelPanel; showAiPanel = false"
          :class="{ 'btn--accent': refNovel.length > 0 }">
          Tiểu thuyết tham khảo{{ refNovel.length > 0 ? ' ✓' : '' }}
        </button>
        <button class="btn btn--secondary btn--sm" @click="handleFilter">
          {{ filterText ? 'Xóa bộ lọc' : 'Lọc' }}
        </button>
        <button class="btn btn--ghost" @click="toggleBatchMode" v-if="entries.length > 0">
          {{ batchMode ? 'Thoát thao tác hàng loạt' : 'Thao tác hàng loạt' }}
        </button>
        <button class="btn btn--primary" @click="handleAdd">+ Thêm mục mới</button>
      </div>
    </div>

    <!-- Bảng AI tạo Worldbook -->
    <div v-if="showAiPanel" class="card mb-md ai-panel">
      <div class="card__header">
        <h3>AI tạo Worldbook</h3>
        <span class="badge badge--info">Mô tả thế giới quan của bạn, AI sẽ tự động tạo các mục Worldbook</span>
      </div>
      <div class="card__body">
        <div class="form-group">
          <label>Mô tả thế giới quan <span class="badge badge--danger">Bắt buộc</span></label>
          <textarea class="textarea" v-model="aiWorldDesc" rows="6"
            placeholder="Mô tả chi tiết thiết lập thế giới quan của bạn, càng cụ thể càng tốt. Ví dụ:&#10;&#10;Đây là một thế giới tu tiên, lấy linh khí làm nền tảng tu luyện. Cảnh giới tu vi chia thành: Phàm nhân → Luyện Khí → Trúc Cơ → Kim Đan → Nguyên Anh → Hóa Thần. Trong thế giới có nhiều tông môn thế lực, nhân vật chính thuộc một trong số đó. Hệ thống tiền tệ sử dụng linh thạch (hạ phẩm / trung phẩm / thượng phẩm)..."></textarea>
        </div>

        <div class="grid-3">
          <div class="form-group">
            <label>Loại mục tạo</label>
            <div class="ai-checks">
              <label class="toggle-label" v-for="opt in entryTypeOpts" :key="opt.value">
                <input type="checkbox" v-model="aiEntryTypes" :value="opt.value"> {{ opt.label }}
              </label>
            </div>
          </div>
          <div class="form-group">
            <label>Mục tiêu số lượng mục</label>
            <select class="select" v-model="aiTargetCount">
              <option value="minimal">Tối giản (5-15 mục) Phù hợp thẻ nhập vai thuần túy</option>
              <option value="small">Nhỏ (20-35 mục) Phù hợp thẻ đời thường / học đường</option>
              <option value="medium">Vừa (40-70 mục) Phù hợp thẻ có thế giới quan</option>
              <option value="large">Lớn (80-150 mục) Phù hợp thế giới mở / thẻ game</option>
              <option value="massive">Siêu lớn (150-300 mục) Phù hợp thế giới quan sử thi</option>
              <option value="extreme">Cực hạn (300-500 mục) Thế giới mở quy mô sử thi</option>
            </select>
          </div>
          <div class="form-group">
            <label>Phong cách mô tả</label>
            <select class="select" v-model="aiDescStyle">
              <option value="auto">Tự động chọn (AI tự khớp phong cách tốt nhất theo loại mục)</option>
              <option value="concise">Mệnh lệnh ngắn gọn (Tiết kiệm token)</option>
              <option value="narrative">Văn phong tự sự (Ngôn ngữ tự nhiên)</option>
              <option value="yaml">Cấu trúc YAML</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label>Yêu cầu bổ sung (tùy chọn)</label>
          <input class="input" v-model="aiExtraReq"
            placeholder="VD: NPC cần có mâu thuẫn cốt lõi, địa điểm cần có gợi ý tương tác, cần chứa quy tắc chiến đấu...">
        </div>

        <div class="flex-row mb-md" style="gap:16px">
          <label class="toggle-label">
            <input type="checkbox" v-model="wbStreamMode"> Tạo dạng stream
          </label>
          <label class="toggle-label">
            <input type="checkbox" v-model="wbAutoContinue"> Tự động tiếp tục đợt sau
          </label>
        </div>

        <button class="btn btn--primary btn--lg" style="width:100%" :disabled="aiGenerating || !aiWorldDesc.trim()"
          @click="handleAiGenerate">
          {{ aiGenerating ? `AI đang tạo... (${aiResults.length} mục)` : 'Bắt đầu tạo Worldbook' }}
        </button>

        <!-- Xem trước văn bản stream -->
        <div v-if="aiGenerating && wbStreamMode && wbStreamText" class="wb-stream-preview mt-md">
          <div class="wb-stream-preview__label">Đang xuất dạng stream...</div>
          <pre class="wb-stream-preview__text">{{ wbStreamText }}</pre>
        </div>

        <!-- Thông báo tạm dừng khi không tự động tiếp tục -->
        <div v-if="wbBatchPaused" class="mt-md flex-row">
          <span class="hint" style="flex:1">Đã tạo {{ aiResults.length }} mục, còn {{ aiBatchTotal - aiBatchCurrent }} đợt chưa hoàn thành</span>
          <button class="btn btn--primary btn--sm" @click="resumeBatch">Tiếp tục đợt sau</button>
          <button class="btn btn--ghost btn--sm" @click="wbBatchPaused = false; aiGenerating = false">Dừng</button>
        </div>

        <!-- Thanh tiến trình tạo -->
        <div v-if="aiGenerating" class="ai-progress mt-md">
          <div class="ai-progress__bar">
            <div class="ai-progress__fill" :style="{ width: aiBatchProgress + '%' }"></div>
          </div>
          <div class="ai-progress__text">Đợt {{ aiBatchCurrent }} / {{ aiBatchTotal }} · Đã tạo {{ aiResults.length }} mục</div>
        </div>

        <!-- Xem trước kết quả tạo -->
        <div v-if="aiResults.length > 0" class="ai-results mt-md">
          <div class="flex-between mb-md">
            <h4>Đã tạo {{ aiResults.length }} mục Worldbook</h4>
            <div class="flex-row">
              <button class="btn btn--secondary btn--sm" @click="selectAllResults(!allSelected)">
                {{ allSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả' }}
              </button>
              <button class="btn btn--primary btn--sm" @click="injectSelectedResults">
                Tiêm mục đã chọn ({{ aiResults.filter(r => r.selected).length }})
              </button>
              <button class="btn btn--secondary btn--sm" @click="continueGenerate" :disabled="aiGenerating">
                {{ aiGenerating ? 'Đang tạo...' : '+ Tiếp tục tạo thêm' }}
              </button>
            </div>
          </div>

          <div v-for="(result, i) in aiResults" :key="i" class="ai-result-item"
            :class="{ 'ai-result-item--selected': result.selected }">
            <div class="flex-between">
              <div class="flex-row">
                <input type="checkbox" v-model="result.selected" style="accent-color:var(--cf-accent)">
                <span class="ai-result-item__name">{{ result.comment }}</span>
                <span class="badge" :class="typeBadgeClass(result.type)">{{ result.type }}</span>
                <span v-if="result.constant" class="badge badge--warning">Thường trực</span>
              </div>
              <div class="flex-row">
                <button class="btn btn--ghost btn--sm" @click.stop="result._editing = !result._editing">{{ result._editing ? 'Thu gọn' : 'Chỉnh sửa' }}</button>
                <button class="btn btn--secondary btn--sm" @click.stop="regenSingleResult(i)" :disabled="aiGenerating">Tạo lại</button>
                <button class="btn btn--danger btn--sm" @click.stop="aiResults.splice(i, 1)">Xóa</button>
              </div>
            </div>
            <!-- Chế độ chỉnh sửa -->
            <div v-if="result._editing" class="ai-result-edit">
              <div class="form-group">
                <label>Tên</label>
                <input class="input" v-model="result.comment">
              </div>
              <div class="form-group">
                <label>Từ khóa (phân tách bằng dấu phẩy)</label>
                <input class="input" :value="(result.keys||[]).join(', ')" @input="result.keys = $event.target.value.split(/[,，]\s*/).filter(Boolean)">
              </div>
              <div class="form-group">
                <label>Nội dung</label>
                <textarea class="textarea" v-model="result.content" rows="8" style="font-size:12px;line-height:1.6"></textarea>
              </div>
              <div class="grid-2">
                <div class="form-group">
                  <label>Vị trí</label>
                  <select class="select" v-model="result.position">
                    <option value="before_char">before_char</option>
                    <option value="after_char">after_char</option>
                  </select>
                </div>
                <div class="form-group">
                  <label>Thứ tự chèn</label>
                  <input class="input" type="number" v-model.number="result.insertion_order">
                </div>
              </div>
              <label class="toggle-label"><input type="checkbox" v-model="result.constant"> Thường trực</label>
            </div>
            <!-- Chế độ xem trước -->
            <pre v-else class="ai-result-item__content selectable">{{ result.content }}</pre>
            <div class="ai-result-item__meta">
              {{ result.position }} | order {{ result.insertion_order }} | {{ (result.content || '').length }} ký tự
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Bảng tiểu thuyết tham khảo -->
    <div v-if="showRefNovelPanel" class="card mb-md">
      <div class="card__header">
        <h3>Tiểu thuyết tham khảo</h3>
        <span class="badge badge--info">Đoạn tiểu thuyết này sẽ tự động thêm vào ngữ cảnh của các thao tác AI</span>
      </div>
      <div class="card__body">
        <p class="hint mb-md">Dùng một đoạn tiểu thuyết làm "tài liệu tham khảo" cho thẻ này. Nó sẽ được lưu kèm theo thẻ (khi xuất/nhập PNG). Khi AI tạo hoặc viết lại mục Worldbook, tài liệu này sẽ được gửi kèm trong prompt để AI tham khảo văn phong, thế giới quan và mối quan hệ nhân vật.</p>
        <div class="form-group">
          <div class="flex-between" style="margin-bottom:4px">
            <label>Nội dung tiểu thuyết</label>
            <div class="flex-row">
              <button class="btn btn--secondary btn--sm" @click="importRefNovelFile">Nhập file txt</button>
              <button class="btn btn--ghost btn--sm" @click="refNovel = ''" :disabled="!refNovel">Xóa trống</button>
            </div>
          </div>
          <textarea class="textarea" v-model="refNovel" rows="14"
            placeholder="Dán một đoạn tiểu thuyết làm tài liệu tham khảo, AI sẽ dựa vào đó khi tạo hoặc viết lại mục"></textarea>
          <div class="hint">{{ (refNovel || '').length }} từ{{ refNovel.length > 30000 ? ' (quá dài có thể khiến AI xử lý chậm hoặc bị cắt bớt, khuyến nghị ≤ 30000 từ)' : '' }}</div>
        </div>
      </div>
    </div>

    <!-- Thanh lọc -->
    <div v-if="showFilter" class="card mb-md">
      <div class="card__body flex-row">
        <input class="input flex-1" v-model="filterText" placeholder="Tìm kiếm tên mục, từ khóa, nội dung...">
        <select class="select" style="width:160px" v-model="filterType">
          <option value="">Tất cả loại</option>
          <option value="constant">Mục thường trực</option>
          <option value="triggered">Mục kích hoạt</option>
          <option value="disabled">Mục đã tắt</option>
        </select>
        <select class="select" style="width:140px" v-model="filterPosition">
          <option value="">Tất cả vị trí</option>
          <option value="before_char">before_char</option>
          <option value="after_char">after_char</option>
        </select>
      </div>
    </div>

    <!-- Thanh thao tác hàng loạt -->
    <div v-if="batchMode && entries.length > 0" class="card mb-md batch-bar">
      <div class="card__body">
        <div class="flex-between mb-md">
          <div class="flex-row">
            <label class="toggle-label">
              <input type="checkbox" :checked="wbSelectedAll" @change="wbToggleSelectAll"> Chọn tất cả
            </label>
            <span style="font-size:12px;color:var(--cf-text-muted)">Đã chọn {{ wbSelectedIds.size }} / {{ filteredEntries.length }}</span>
          </div>
          <div class="flex-row" style="flex-wrap:wrap;gap:6px">
            <button class="btn btn--secondary btn--sm" @click="wbBatchEnable(true)" :disabled="wbSelectedIds.size === 0">Bật</button>
            <button class="btn btn--secondary btn--sm" @click="wbBatchEnable(false)" :disabled="wbSelectedIds.size === 0">Tắt</button>
            <button class="btn btn--secondary btn--sm" @click="wbBatchConstant(true)" :disabled="wbSelectedIds.size === 0">Đặt thành thường trực</button>
            <button class="btn btn--secondary btn--sm" @click="wbBatchConstant(false)" :disabled="wbSelectedIds.size === 0">Hủy thường trực</button>
            <button class="btn btn--secondary btn--sm" @click="wbBatchPosition('before_char')" :disabled="wbSelectedIds.size === 0">Đổi thành before_char</button>
            <button class="btn btn--secondary btn--sm" @click="wbBatchPosition('after_char')" :disabled="wbSelectedIds.size === 0">Đổi thành after_char</button>
            <button class="btn btn--danger btn--sm" @click="wbBatchDelete" :disabled="wbSelectedIds.size === 0">Xóa mục đã chọn</button>
            <button class="btn btn--accent btn--sm" @click="showAiRewrite = true" :disabled="wbSelectedIds.size === 0">AI viết lại mục đã chọn</button>
          </div>

          <!-- Bảng AI viết lại -->
          <div v-if="showAiRewrite && wbSelectedIds.size > 0" class="mt-md">
            <div class="form-group">
              <label>Yêu cầu viết lại</label>
              <input class="input" v-model="aiRewriteReq" placeholder="VD: Chi tiết hơn, đổi sang định dạng YAML, bổ sung chi tiết NPC, rút gọn dưới 200 từ...">
            </div>
            <div class="flex-row">
              <button class="btn btn--accent btn--sm" @click="aiRewriteSelected" :disabled="aiRewriting">
                {{ aiRewriting ? 'AI đang viết lại...' : 'Bắt đầu viết lại (' + wbSelectedIds.size + ' mục)' }}
              </button>
              <button class="btn btn--ghost btn--sm" @click="showAiRewrite = false">Hủy</button>
            </div>

            <!-- Xem trước kết quả viết lại -->
            <div v-if="aiRewriteResults.length > 0" class="mt-md">
              <div class="flex-between mb-md">
                <span class="badge badge--accent">Đã viết lại {{ aiRewriteResults.length }} mục</span>
                <div class="flex-row">
                  <button class="btn btn--primary btn--sm" @click="applyRewriteResults">Áp dụng thay thế</button>
                  <button class="btn btn--ghost btn--sm" @click="aiRewriteResults = []">Hủy bỏ</button>
                </div>
              </div>
              <div v-for="(r, i) in aiRewriteResults" :key="i" class="ai-result-item mb-md">
                <div class="flex-between">
                  <span class="ai-result-item__name">{{ r.comment }}</span>
                  <div class="flex-row">
                    <button class="btn btn--secondary btn--sm" @click="regenRewriteResult(i)" :disabled="aiRewriting">Tạo lại</button>
                    <button class="btn btn--danger btn--sm" @click="aiRewriteResults.splice(i, 1)">Xóa</button>
                  </div>
                </div>
                <pre class="ai-result-item__content selectable">{{ r.newContent }}</pre>
                <details>
                  <summary style="font-size:11px;color:var(--cf-text-muted);cursor:pointer">Xem nội dung gốc</summary>
                  <pre class="ai-result-item__content" style="opacity:0.5">{{ r.oldContent }}</pre>
                </details>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Thanh thống kê -->
    <div class="wb-stats mb-md">
      <span class="badge badge--accent">{{ entries.length }} Tổng cộng</span>
      <span class="badge badge--success">{{ entries.filter(e => e.enabled).length }} Đang bật</span>
      <span class="badge badge--warning">{{ entries.filter(e => e.constant && e.enabled).length }} Thường trực</span>
      <span class="badge badge--info">{{ entries.filter(e => !e.constant && e.enabled).length }} Kích hoạt</span>
      <span class="badge badge--danger">{{ entries.filter(e => !e.enabled).length }} Đã tắt</span>
    </div>

    <!-- Danh sách mục -->
    <div v-if="filteredEntries.length === 0 && !showAiPanel" class="card">
      <div class="empty-state">
        <div class="empty-state__icon"></div>
        <div class="empty-state__title">Chưa có mục Worldbook nào</div>
        <div class="empty-state__desc">Nhấp "AI tạo mục" để AI tự động tạo giúp bạn, hoặc nhấp "Thêm mục mới" để tạo thủ công</div>
      </div>
    </div>

    <div v-else>
      <WorldEntryCard v-for="entry in filteredEntries" :key="entry.id + '_' + listVersion"
        :entry="entry"
        mode="persisted"
        :expanded="expandedIds.has(entry.id)"
        :batch-mode="batchMode"
        :selected="wbSelectedIds.has(entry.id)"
        :is-dragging-me="dragSourceId === entry.id"
        :is-drag-over-me="dragOverId === entry.id"
        @toggle-expand="toggleExpand(entry.id)"
        @toggle-select="wbToggleSelect(entry.id)"
        @delete="deleteEntry(entry.id)"
        @duplicate="store.duplicateWorldEntry(entry.id)"
        @update-order="val => updateOrder(entry, val)"
        @drag-start="onDragStart($event, entry.id)"
        @drag-over="onDragOver($event, entry.id)"
        @drag-leave="onDragLeave(entry.id)"
        @drop="onDrop($event, entry.id)"
        @drag-end="onDragEnd" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, watch } from 'vue';
import { useCardStore } from '../stores/card.js';
import { useApiStore } from '../stores/api.js';
import { useAppStore } from '../stores/app.js';
import { buildCardContext } from '../utils/card-context.js';
import { chatForJsonArray, parseAiJsonArray } from '../utils/json-repair.js';
import WorldEntryCard from '../components/WorldEntryCard.vue';

const store = useCardStore();
const apiStore = useApiStore();
const appStore = useAppStore();
const entries = computed(() => store.worldEntries);

function normalizeAiEntries(parsed) {
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter(item => item && typeof item === 'object' && (
      (item.content && String(item.content).trim()) ||
      (item.comment && String(item.comment).trim())
    ))
    .map(item => ({
      ...item,
      selected: true,
      content: item.content || '',
      keys: item.keys || [],
      constant: item.constant ?? false,
      position: item.position || 'before_char',
      insertion_order: 100
    }));
}

const showFilter = ref(false);
const filterText = ref('');
const filterType = ref('');
const filterPosition = ref('');
const expandedIds = ref(new Set());
const listVersion = ref(0);

const bookName = computed({
  get() { return store.cardData.character_book?.name || ''; },
  set(v) {
    if (!store.cardData.character_book) {
      store.cardData.character_book = { name: '', entries: [] };
    }
    store.cardData.character_book.name = v;
    store.markDirty();
  }
});

const showRefNovelPanel = ref(false);
const refNovel = computed({
  get() { return store.cardData.extensions?.cfReferenceNovel || ''; },
  set(v) {
    if (!store.cardData.extensions) store.cardData.extensions = {};
    store.cardData.extensions.cfReferenceNovel = v;
    store.markDirty();
  }
});

function importRefNovelFile() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.txt,.text,.md';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      refNovel.value = text;
      appStore.toastSuccess(`Đã nhập "${file.name}" (${text.length} từ)`);
    } catch (err) {
      appStore.toastError('Nhập file thất bại: ' + err.message);
    }
  };
  input.click();
}

function buildRefNovelSegment() {
  const novel = (store.cardData.extensions?.cfReferenceNovel || '').trim();
  if (!novel) return '';
  return `\n\n## Tài liệu tiểu thuyết tham khảo (Hãy dựa vào thế giới quan, phong cách nhân vật và văn phong này để tạo / viết lại)\n\n${novel}`;
}

const showAiPanel = ref(false);
const aiWorldDesc = ref('');
const aiEntryTypes = ref(['system', 'world', 'location', 'event']);
const aiTargetCount = ref('small');
const aiDescStyle = ref('auto');
const aiExtraReq = ref('');
const aiGenerating = ref(false);
const aiResults = ref([]);
const aiBatchCurrent = ref(0);
const aiBatchTotal = ref(1);

const wbStreamMode = ref(localStorage.getItem('cf_wb_stream_mode') === 'true');
const wbAutoContinue = ref(localStorage.getItem('cf_wb_auto_continue') !== 'false');
const wbStreamText = ref('');
const wbBatchPaused = ref(false);
let _resumeBatchResolve = null;

watch(wbStreamMode, v => localStorage.setItem('cf_wb_stream_mode', v));
watch(wbAutoContinue, v => localStorage.setItem('cf_wb_auto_continue', v));

function resumeBatch() {
  wbBatchPaused.value = false;
  if (_resumeBatchResolve) { _resumeBatchResolve(); _resumeBatchResolve = null; }
}

async function waitForResume() {
  wbBatchPaused.value = true;
  await new Promise(resolve => { _resumeBatchResolve = resolve; });
}
const aiBatchProgress = computed(() => aiBatchTotal.value > 0 ? Math.round((aiBatchCurrent.value / aiBatchTotal.value) * 100) : 0);

const entryTypeOpts = [
  { value: 'system', label: 'Quy tắc hệ thống' },
  { value: 'world', label: 'Thiết lập thế giới' },
  { value: 'location', label: 'Địa điểm bối cảnh' },
  { value: 'event', label: 'Quy tắc sự kiện' }
];

const allSelected = computed(() => aiResults.value.length > 0 && aiResults.value.every(r => r.selected));

function selectAllResults(val) {
  aiResults.value.forEach(r => r.selected = val);
}

function typeBadgeClass(type) {
  const map = {
    'Quy tắc hệ thống': 'badge--danger', 'Thiết lập thế giới': 'badge--info', 'Nhân vật NPC': 'badge--accent',
    'Địa điểm bối cảnh': 'badge--success', 'Quy tắc sự kiện': 'badge--warning', 'Định dạng xuất': 'badge--info',
    '系统规则': 'badge--danger', '世界设定': 'badge--info', 'NPC角色': 'badge--accent',
    '地点场景': 'badge--success', '事件规则': 'badge--warning', '输出格式': 'badge--info'
  };
  return map[type] || 'badge--info';
}

const countMap = { minimal: '5-15', small: '20-35', medium: '40-70', large: '80-150', massive: '150-300', extreme: '300-500' };
const styleMap = {
  auto: 'Tự động chọn phong cách tốt nhất — Quy tắc hệ thống dùng mệnh lệnh ngắn gọn, NPC dùng văn phong tự sự, hệ thống số liệu dùng cấu trúc YAML',
  concise: 'Mệnh lệnh ngắn gọn, dùng câu ngắn và danh sách để tiết kiệm token. Ví dụ: "- Cấm bay\\n- Không được giao tranh trong thành"',
  narrative: 'Văn phong tự sự tự nhiên như đang kể chuyện',
  yaml: 'Định dạng cấu trúc cặp khóa-giá trị YAML'
};

async function handleAiGenerate() {
  if (!apiStore.isConfigured) {
    appStore.toastError('Vui lòng cấu hình API Key trong cài đặt trước');
    return;
  }

  aiGenerating.value = true;
  aiResults.value = [];

  try {
    const typeLabels = aiEntryTypes.value.map(v => entryTypeOpts.find(o => o.value === v)?.label).filter(Boolean);
    const cardContext = buildCardContext(store);
    const targetRange = countMap[aiTargetCount.value];

    const targetMatch = targetRange.match(/(\d+)\s*[-~]\s*(\d+)/);
    const targetMin = targetMatch ? parseInt(targetMatch[1]) : 5;
    const targetMax = targetMatch ? parseInt(targetMatch[2]) : 15;
    const perBatch = 30;
    const totalBatches = Math.max(1, Math.ceil(targetMax / perBatch));

    aiBatchTotal.value = totalBatches;
    aiBatchCurrent.value = 0;

    const basePrompt = `Bạn là một kiến trúc sư Worldbook (Character Book) chuyên nghiệp cho SillyTavern.

## Thông tin thẻ nhân vật hiện có
${cardContext}

## Mô tả thế giới quan
${aiWorldDesc.value}

## Giải thích loại mục
- Quy tắc hệ thống (constant=true): Quy tắc cốt lõi AI bắt buộc phải luôn tuân thủ. insertion_order=1-10, position=before_char
- Thiết lập thế giới (constant=true hoặc kích hoạt theo từ khóa): Hệ thống kinh tế, văn hóa, luật lệ... insertion_order=5-20, position=before_char
- Nhân vật NPC (kích hoạt theo từ khóa): Mỗi NPC gồm ngoại hình, tính cách, bối cảnh, cách nói chuyện. insertion_order=50-80, position=before_char
- Địa điểm bối cảnh (kích hoạt theo từ khóa): Mô tả địa điểm, bầu không khí, nội dung có thể tương tác. insertion_order=30-50, position=before_char
- Quy tắc sự kiện (kích hoạt theo từ khóa): Quy tắc và quy trình của sự kiện cụ thể. insertion_order=70-90, position=before_char
- Định dạng xuất (constant=true): Hướng dẫn AI trả lời theo định dạng nào. insertion_order=9990-9999, position=after_char

## Định dạng đầu ra
Xuất nghiêm ngặt dưới dạng mảng JSON, mỗi đợt chỉ tạo ${perBatch} mục để đảm bảo JSON hoàn chỉnh không bị ngắt quãng:
[{"comment":"Tên mục","type":"Loại mục","keys":["Từ khóa"],"content":"Nội dung (khống chế trong 200 từ)","constant":bool,"position":"before_char hoặc after_char","insertion_order":số}]
Chỉ xuất ra mảng JSON, không có văn bản giải thích nào khác.${buildRefNovelSegment()}`;

    const sysMsg = 'Bạn là chuyên gia kiến trúc Worldbook SillyTavern. Luôn xuất ra JSON hợp lệ bằng tiếng Việt. Mỗi đợt tạo nghiêm ngặt đúng ' + perBatch + ' mục. Quan trọng: Nếu bên trong chuỗi content có trích dẫn danh hiệu, biệt danh hoặc lời nói trực tiếp, bắt buộc dùng dấu ngoặc kép dạng đóng mở «» hoặc ngoặc vuông [], tuyệt đối không dùng dấu nháy kép trần " vì sẽ làm hỏng cú pháp JSON.';
    const maxTokens = apiStore.getModelMaxTokens(apiStore.activeProvider?.model);
    let rateRetryCount = 0;

    for (let batch = 0; batch < totalBatches; batch++) {
      if (batch > 0) {
        if (!wbAutoContinue.value) {
          await waitForResume();
          if (!aiGenerating.value) break;
        } else {
          await new Promise(r => setTimeout(r, 13000));
        }
      }
      aiBatchCurrent.value = batch + 1;

      if (aiResults.value.length >= targetMin && aiResults.value.length >= targetMax * 0.8) {
        appStore.toastSuccess('Đã đạt số lượng mục tiêu, hoàn thành sớm');
        break;
      }

      const existingNames = aiResults.value.map(r => r.comment).join('、');
      const batchPrompt = batch === 0
        ? `${basePrompt}\n\n## Yêu cầu tạo\n- Loại mục: ${typeLabels.join('、')}\n- Phong cách nội dung: ${styleMap[aiDescStyle.value]}\n${aiExtraReq.value ? `- Yêu cầu bổ sung: ${aiExtraReq.value}\n` : ''}- Đợt này tạo ${perBatch} mục, bao quát các thiết lập quan trọng nhất`
        : `${basePrompt}\n\n## Yêu cầu tạo\n- Loại mục: ${typeLabels.join('、')}\n- Phong cách nội dung: ${styleMap[aiDescStyle.value]}\n${aiExtraReq.value ? `- Yêu cầu bổ sung: ${aiExtraReq.value}\n` : ''}- Các mục đã tạo: ${existingNames}\n- Hãy tạo thêm các mục mới chưa có, không lặp lại mục cũ\n- Đợt này tạo ${perBatch} mục`;

      const msgs = [
        { role: 'system', content: sysMsg },
        { role: 'user', content: batchPrompt }
      ];

      try {
        let parsed;
        if (wbStreamMode.value) {
          wbStreamText.value = '';
          const fullText = await apiStore.chat(msgs, {
            temperature: 0.7,
            maxTokens,
            onChunk: chunk => { wbStreamText.value += chunk; }
          });
          wbStreamText.value = '';
          parsed = parseAiJsonArray(fullText);
        } else {
          parsed = await chatForJsonArray(apiStore, msgs, { temperature: 0.7, maxTokens });
        }

        if (parsed.length === 0) {
          appStore.toastWarning(`Đợt ${batch + 1} không tạo ra mục hợp lệ, dừng quá trình tạo`);
          break;
        }
        const newItems = normalizeAiEntries(parsed);
        if (newItems.length === 0) {
          appStore.toastWarning(`Đợt ${batch + 1} AI trả về toàn đối tượng trống, dừng quá trình tạo`);
          break;
        }
        aiResults.value.push(...newItems);
      } catch (e) {
        const errMsg = String(e?.message || e || '');
        const isRateLimit = /\b429\b/.test(errMsg) || /rate.?limit/i.test(errMsg) || /too many request/i.test(errMsg);
        if (isRateLimit && rateRetryCount < 3) {
          rateRetryCount++;
          appStore.toastWarning(`Đợt ${batch + 1} bị giới hạn tần suất (${rateRetryCount}/3 lần thử lại), tự động thử lại sau 15 giây...`);
          await new Promise(r => setTimeout(r, 15000));
          batch--;
          continue;
        }
        appStore.toastWarning(`Đợt ${batch + 1} xảy ra lỗi: ${e.message}`);
        break;
      }
    }

    appStore.toastSuccess(`Tạo hoàn tất, tổng cộng ${aiResults.value.length} mục Worldbook`);
  } catch (e) {
    appStore.toastError(`Tạo thất bại: ${e.message}`);
  } finally {
    aiGenerating.value = false;
  }
}

async function regenSingleResult(index) {
  if (!apiStore.isConfigured) { appStore.toastError('Vui lòng cấu hình API Key trước'); return; }
  const old = aiResults.value[index];
  if (!old) return;
  aiGenerating.value = true;
  try {
    const cardContext = buildCardContext(store);
    const prompt = `Vui lòng tạo lại mục Worldbook sau đây, giữ nguyên loại và định vị nhưng viết lại nội dung hoàn toàn mới, phong phú và chi tiết hơn.

Tên mục: ${old.comment}
Từ khóa: ${(old.keys || []).join(', ')}
Loại: ${old.constant ? 'Thường trực' : 'Kích hoạt'}
Vị trí chèn: ${old.position}

【Thông tin thẻ nhân vật】
${cardContext}

Chỉ xuất ra MỘT đối tượng JSON (không phải mảng):
{ "comment": "Tên mục", "keys": ["Từ khóa"], "content": "Nội dung mục", "constant": ${old.constant}, "position": "${old.position}", "insertion_order": ${old.insertion_order} }

Chỉ xuất ra JSON, không có văn bản giải thích nào khác.${buildRefNovelSegment()}`;

    const result = await apiStore.chat([
      { role: 'system', content: 'Bạn là chuyên gia kiến trúc Worldbook. Chỉ xuất ra đối tượng JSON hợp lệ bằng tiếng Việt.' },
      { role: 'user', content: prompt }
    ], { temperature: 0.8, maxTokens: apiStore.getModelMaxTokens(apiStore.activeProvider?.model) });

    let cleaned = result.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Định dạng AI trả về không bình thường');
    const parsed = JSON.parse(match[0]);
    aiResults.value[index] = {
      ...parsed,
      selected: true,
      keys: parsed.keys || old.keys,
      constant: parsed.constant ?? old.constant,
      position: parsed.position || old.position,
      insertion_order: parsed.insertion_order || old.insertion_order
    };
    appStore.toastSuccess(`"${parsed.comment || old.comment}" đã được tạo lại`);
  } catch (e) {
    appStore.toastError('Tạo lại thất bại: ' + e.message);
  } finally { aiGenerating.value = false; }
}

async function continueGenerate() {
  if (!apiStore.isConfigured) return;
  aiGenerating.value = true;
  try {
    const existing = aiResults.value.map(r => r.comment).join('、');
    const cardContext = buildCardContext(store);
    const prompt = `Tiếp tục tạo thêm các mục Worldbook.

Các mục đã tạo: ${existing}

【Thông tin thẻ nhân vật】
${cardContext}

【Thế giới quan】
${aiWorldDesc.value}

Hãy tạo thêm các mục mới chưa có (NPC, địa điểm, sự kiện...), không lặp lại mục đã có.
Quan trọng: Nếu đã bao quát hết các thiết lập quan trọng, không còn mục nào cần bổ sung, **hãy xuất trực tiếp mảng rỗng []**, tuyệt đối không dùng đối tượng rỗng {} để lấp chỗ trống.
Xuất theo định dạng mảng JSON như trước. Chỉ xuất ra JSON.${buildRefNovelSegment()}`;

    const parsed = await chatForJsonArray(apiStore, [
      { role: 'system', content: 'Bạn là chuyên gia kiến trúc Worldbook. Tiếp tục bổ sung mục, không trùng lặp. Chỉ xuất ra JSON bằng tiếng Việt.' },
      { role: 'user', content: prompt }
    ], { temperature: 0.7, maxTokens: apiStore.getModelMaxTokens(apiStore.activeProvider?.model) });
    const newItems = normalizeAiEntries(parsed);
    if (newItems.length === 0) {
      appStore.toastWarning('AI trả về đối tượng rỗng, không thể tiếp tục tạo thêm');
      return;
    }
    aiResults.value.push(...newItems);
    appStore.toastSuccess(`Đã tạo thêm ${newItems.length} mục, tổng cộng ${aiResults.value.length} mục`);
  } catch (e) {
    appStore.toastError('Tiếp tục tạo thất bại: ' + e.message);
  } finally { aiGenerating.value = false; }
}

function injectSelectedResults() {
  const selected = aiResults.value.filter(r => r.selected);
  if (selected.length === 0) {
    appStore.toastWarning('Vui lòng chọn ít nhất một mục');
    return;
  }

  for (const item of selected) {
    const entry = store.addWorldEntry();
    entry.comment = item.comment || '';
    entry.keys = item.keys || [];
    entry.content = item.content || '';
    entry.constant = item.constant ?? false;
    entry.position = item.position || 'before_char';
    entry.insertion_order = 100;
    entry.extensions.position = entry.position === 'before_char' ? 0 : 1;
    entry.extensions.exclude_recursion = true;
    entry.extensions.prevent_recursion = !entry.constant;
  }

  appStore.toastSuccess(`Đã tiêm ${selected.length} mục vào Worldbook`);
  aiResults.value = [];
  showAiPanel.value = false;
}

const filteredEntries = computed(() => {
  let result = entries.value;

  if (filterType.value === 'constant') result = result.filter(e => e.constant && e.enabled);
  else if (filterType.value === 'triggered') result = result.filter(e => !e.constant && e.enabled);
  else if (filterType.value === 'disabled') result = result.filter(e => !e.enabled);

  if (filterPosition.value) result = result.filter(e => e.position === filterPosition.value);

  if (filterText.value) {
    const q = filterText.value.toLowerCase();
    result = result.filter(e =>
      (e.comment || '').toLowerCase().includes(q) ||
      (e.content || '').toLowerCase().includes(q) ||
      e.keys.some(k => k.toLowerCase().includes(q))
    );
  }

  return [...result].sort((a, b) => {
    const ai = a.extensions?.cfSortKey ?? 9999999;
    const bi = b.extensions?.cfSortKey ?? 9999999;
    return ai - bi;
  });
});

function handleFilter() {
  if (filterText.value || filterType.value || filterPosition.value) {
    filterText.value = '';
    filterType.value = '';
    filterPosition.value = '';
  }
  showFilter.value = !showFilter.value;
}

function handleAdd() {
  const entry = store.addWorldEntry();
  expandedIds.value.add(entry.id);
  nextTick(() => {
    const el = document.querySelector(`.wb-entry:last-child .input, .wb-entry:last-child .textarea`);
    if (el) el.focus();
  });
}

function toggleExpand(id) {
  if (expandedIds.value.has(id)) expandedIds.value.delete(id);
  else expandedIds.value.add(id);
}

function deleteEntry(id) {
  expandedIds.value.delete(id);
  store.removeWorldEntry(id);
  renumberEntries();
  listVersion.value++;
}

function renumberEntries() {
  const sorted = filteredEntries.value;
  for (let i = 0; i < sorted.length; i++) {
    if (!sorted[i].extensions) sorted[i].extensions = {};
    sorted[i].extensions.cfSortKey = i + 1;
  }
}

function updateOrder(entry, val) {
  const num = Number(val);
  if (!Number.isFinite(num) || num < 1) return;

  const sorted = filteredEntries.value.slice();
  const idx = sorted.findIndex(e => e.id === entry.id);
  if (idx !== -1) sorted.splice(idx, 1);
  const insertAt = Math.min(num - 1, sorted.length);
  sorted.splice(insertAt, 0, entry);
  for (let i = 0; i < sorted.length; i++) {
    if (!sorted[i].extensions) sorted[i].extensions = {};
    sorted[i].extensions.cfSortKey = i + 1;
  }
  store.markDirty();
}

const dragSourceId = ref(null);
const dragOverId = ref(null);
const dragEnabledId = ref(null);

function onDragStart(e, id) {
  dragSourceId.value = id;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', String(id));
}

function onDragOver(e, id) {
  if (id === dragSourceId.value) return;
  dragOverId.value = id;
  e.dataTransfer.dropEffect = 'move';
}

function onDragLeave(id) {
  if (dragOverId.value === id) dragOverId.value = null;
}

function onDrop(e, targetId) {
  const sourceId = dragSourceId.value;
  if (!sourceId || sourceId === targetId) {
    dragSourceId.value = null;
    dragOverId.value = null;
    return;
  }

  const visible = [...filteredEntries.value];
  const sourceIdx = visible.findIndex(e => e.id === sourceId);
  const targetIdx = visible.findIndex(e => e.id === targetId);
  if (sourceIdx === -1 || targetIdx === -1) {
    dragSourceId.value = null;
    dragOverId.value = null;
    return;
  }

  const [moved] = visible.splice(sourceIdx, 1);
  visible.splice(targetIdx, 0, moved);

  for (let i = 0; i < visible.length; i++) {
    if (!visible[i].extensions) visible[i].extensions = {};
    visible[i].extensions.cfSortKey = i + 1;
  }

  store.markDirty();
  dragSourceId.value = null;
  dragOverId.value = null;
  appStore.toastSuccess('Đã sắp xếp lại thứ tự');
}

function onDragEnd() {
  dragSourceId.value = null;
  dragOverId.value = null;
  dragEnabledId.value = null;
}

const batchMode = ref(false);
const wbSelectedIds = ref(new Set());

const wbSelectedAll = computed(() =>
  filteredEntries.value.length > 0 && wbSelectedIds.value.size === filteredEntries.value.length
);

function toggleBatchMode() {
  batchMode.value = !batchMode.value;
  wbSelectedIds.value = new Set();
}

function wbToggleSelect(id) {
  const s = new Set(wbSelectedIds.value);
  if (s.has(id)) s.delete(id); else s.add(id);
  wbSelectedIds.value = s;
}

function wbToggleSelectAll() {
  if (wbSelectedAll.value) {
    wbSelectedIds.value = new Set();
  } else {
    wbSelectedIds.value = new Set(filteredEntries.value.map(e => e.id));
  }
}

function getSelected() {
  return entries.value.filter(e => wbSelectedIds.value.has(e.id));
}

function wbBatchEnable(val) {
  getSelected().forEach(e => { e.enabled = val; });
  store.markDirty();
  appStore.toastSuccess(`Đã ${val ? 'bật' : 'tắt'} ${wbSelectedIds.value.size} mục`);
}

function wbBatchConstant(val) {
  getSelected().forEach(e => { e.constant = val; });
  store.markDirty();
  appStore.toastSuccess(`Đã ${val ? 'đặt thành thường trực' : 'hủy thường trực'} ${wbSelectedIds.value.size} mục`);
}

function wbBatchPosition(pos) {
  getSelected().forEach(e => {
    e.position = pos;
    e.extensions.position = pos === 'before_char' ? 0 : 1;
  });
  store.markDirty();
  appStore.toastSuccess(`Đã sửa vị trí ${wbSelectedIds.value.size} mục`);
}

function wbBatchDelete() {
  const count = wbSelectedIds.value.size;
  appStore.confirmAction(`Xác nhận xóa ${count} mục Worldbook đã chọn?`, () => {
    for (const id of wbSelectedIds.value) {
      expandedIds.value.delete(id);
      store.removeWorldEntry(id);
    }
    wbSelectedIds.value = new Set();
    renumberEntries();
    listVersion.value++;
    appStore.toastSuccess(`Đã xóa ${count} mục Worldbook`);
  });
}

const showAiRewrite = ref(false);
const aiRewriteReq = ref('');
const aiRewriting = ref(false);
const aiRewriteResults = ref([]);

async function aiRewriteSelected() {
  if (!apiStore.isConfigured) { appStore.toastError('Vui lòng cấu hình API Key trước'); return; }
  if (wbSelectedIds.value.size === 0) return;
  aiRewriting.value = true;
  aiRewriteResults.value = [];

  try {
    const selected = entries.value.filter(e => wbSelectedIds.value.has(e.id));
    const entriesData = selected.map(e => ({
      id: e.id,
      comment: e.comment,
      content: e.content,
      keys: e.keys
    }));

    const prompt = `Vui lòng viết lại các mục Worldbook sau theo yêu cầu. Giữ nguyên tên mục và từ khóa của từng mục, chỉ viết lại nội dung content.

【Yêu cầu viết lại】
${aiRewriteReq.value || 'Tối ưu hóa nội dung, làm cho nội dung chi tiết và sinh động hơn'}

【Các mục cần viết lại】
${entriesData.map(e => `Tên mục: ${e.comment}\nTừ khóa: ${(e.keys || []).join(', ')}\nNội dung gốc:\n${e.content}\n---`).join('\n')}

Xuất ra mảng JSON, mỗi đối tượng gồm comment (tên mục) và content (nội dung sau khi viết lại):
[{ "comment": "Tên mục", "content": "Nội dung sau khi viết lại" }]

Mỗi mục content khống chế trong 500 từ. Chỉ xuất ra JSON.${buildRefNovelSegment()}`;

    const parsed = await chatForJsonArray(apiStore, [
      { role: 'system', content: 'Bạn là chuyên gia viết lại Worldbook. Viết lại nội dung mục theo yêu cầu người dùng, giữ nguyên tên mục. Chỉ xuất ra mảng JSON hợp lệ bằng tiếng Việt.' },
      { role: 'user', content: prompt }
    ], { temperature: 0.7, maxTokens: apiStore.getModelMaxTokens(apiStore.activeProvider?.model) });

    aiRewriteResults.value = parsed.map((p, i) => ({
      id: selected[i]?.id,
      comment: p.comment || selected[i]?.comment || '',
      oldContent: selected[i]?.content || '',
      newContent: p.content || ''
    }));

    appStore.toastSuccess(`Đã viết lại ${aiRewriteResults.value.length} mục, vui lòng xem trước rồi nhấp "Áp dụng thay thế"`);
  } catch (e) {
    appStore.toastError('AI viết lại thất bại: ' + e.message);
  } finally { aiRewriting.value = false; }
}

function applyRewriteResults() {
  let count = 0;
  for (const r of aiRewriteResults.value) {
    const entry = entries.value.find(e => e.id === r.id);
    if (entry) {
      entry.content = r.newContent;
      count++;
    }
  }
  store.markDirty();
  aiRewriteResults.value = [];
  showAiRewrite.value = false;
  appStore.toastSuccess(`Đã thay thế ${count} mục Worldbook`);
}

async function regenRewriteResult(index) {
  if (!apiStore.isConfigured) return;
  const r = aiRewriteResults.value[index];
  if (!r) return;
  aiRewriting.value = true;
  try {
    const prompt = `Vui lòng viết lại mục Worldbook sau đây.

【Yêu cầu viết lại】
${aiRewriteReq.value || 'Tối ưu hóa nội dung, làm cho nội dung chi tiết và sinh động hơn'}

Tên mục: ${r.comment}
Nội dung gốc:
${r.oldContent}

Chỉ xuất ra MỘT đối tượng JSON: { "comment": "${r.comment}", "content": "Nội dung sau khi viết lại" }
Chỉ xuất ra JSON.${buildRefNovelSegment()}`;

    const result = await apiStore.chat([
      { role: 'system', content: 'Bạn là chuyên gia viết lại Worldbook. Chỉ xuất ra đối tượng JSON hợp lệ bằng tiếng Việt.' },
      { role: 'user', content: prompt }
    ], { temperature: 0.8, maxTokens: apiStore.getModelMaxTokens(apiStore.activeProvider?.model) });

    let cleaned = result.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Định dạng AI trả về không bình thường');
    const parsed = JSON.parse(match[0]);
    aiRewriteResults.value[index] = { ...r, newContent: parsed.content || r.newContent };
    appStore.toastSuccess(`"${r.comment}" đã được tạo lại`);
  } catch (e) {
    appStore.toastError('Tạo lại thất bại: ' + e.message);
  } finally { aiRewriting.value = false; }
}
</script>

<style scoped>
.wb-stats {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.ai-panel {
  border-color: var(--cf-accent);
  border-width: 1px;
  box-shadow: 0 0 24px var(--cf-accent-dim);
}

.ai-checks {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
}

.ai-results h4 {
  font-size: 14px;
  color: var(--cf-accent);
}

.ai-result-item {
  background: var(--cf-bg-tertiary);
  border: 1px solid var(--cf-border);
  border-radius: var(--cf-radius-sm);
  padding: 12px;
  margin-bottom: 8px;
  transition: var(--cf-transition);
}
.ai-result-item--selected {
  border-color: var(--cf-accent);
  background: var(--cf-accent-dim);
}
.ai-result-item__name {
  font-weight: 600;
  font-size: 13px;
}
.ai-result-item__keys {
  font-size: 11px;
  color: var(--cf-text-muted);
}
.ai-result-item__content {
  font-size: 12px;
  line-height: 1.7;
  color: var(--cf-text-primary);
  white-space: pre-wrap;
  word-wrap: break-word;
  font-family: var(--cf-font);
  background: none;
  border: none;
  margin: 8px 0;
  max-height: 200px;
  overflow-y: auto;
}
.ai-result-item__meta {
  font-size: 11px;
  color: var(--cf-text-muted);
}
.ai-result-edit {
  padding: 10px 0;
  border-top: 1px solid rgba(255, 255, 255, 0.04);
}
.ai-result-edit .form-group {
  margin-bottom: 8px;
}
.ai-result-edit label {
  font-size: 11px;
  color: var(--cf-text-muted);
}

.ai-progress {
  margin: 12px 0;
}
.ai-progress__bar {
  width: 100%;
  height: 8px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 4px;
  overflow: hidden;
}
.ai-progress__fill {
  height: 100%;
  border-radius: 4px;
  background: linear-gradient(90deg, var(--cf-accent), #06b6d4);
  transition: width 0.5s ease;
  position: relative;
}
.ai-progress__fill::after {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
  animation: aiProgressShine 1.5s infinite;
}
@keyframes aiProgressShine {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}
.ai-progress__text {
  margin-top: 6px;
  font-size: 12px;
  color: var(--cf-text-muted);
  text-align: center;
}
.wb-stream-preview {
  background: rgba(0,0,0,0.2);
  border: 1px solid rgba(96,165,250,0.2);
  border-radius: var(--cf-radius-sm);
  padding: 10px;
}
.wb-stream-preview__label {
  font-size: 11px;
  color: var(--cf-accent);
  margin-bottom: 6px;
}
.wb-stream-preview__text {
  font-size: 12px;
  color: var(--cf-text-secondary);
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 200px;
  overflow-y: auto;
  margin: 0;
}

.wb-entry {
  background: var(--cf-bg-secondary);
  border: 1px solid var(--cf-border);
  border-radius: var(--cf-radius-sm);
  margin-bottom: 8px;
  overflow: hidden;
  transition: var(--cf-transition);
}
.wb-entry--disabled { opacity: 0.5; }
.wb-entry--constant { border-left: 3px solid var(--cf-warning); }

.wb-entry__header {
  padding: 10px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  transition: var(--cf-transition);
}
.wb-entry__header:hover { background: var(--cf-bg-hover); }

.wb-entry__expand { font-size: 10px; color: var(--cf-text-muted); width: 16px; }
.wb-entry__id { font-size: 11px; color: var(--cf-text-muted); font-family: var(--cf-font-mono); }
.wb-entry__name { font-weight: 500; font-size: 13px; margin-left: 4px; }
.wb-entry__keys {
  font-size: 11px;
  color: var(--cf-accent);
  background: var(--cf-accent-dim);
  padding: 2px 8px;
  border-radius: 4px;
  margin-left: 8px;
}
.wb-entry__meta { font-size: 11px; color: var(--cf-text-muted); }

.wb-entry__body {
  padding: 16px;
  border-top: 1px solid var(--cf-border);
  background: var(--cf-bg-tertiary);
}

.toggle-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  cursor: pointer;
  color: var(--cf-text-secondary);
  input { accent-color: var(--cf-accent); }
}
.batch-bar {
  border: 1px solid rgba(96, 165, 250, 0.2);
  background: rgba(96, 165, 250, 0.04);
}
.wb-drag-handle {
  display: inline-block;
  width: 14px;
  text-align: center;
  color: var(--cf-text-muted);
  cursor: grab;
  font-weight: bold;
  font-size: 14px;
  user-select: none;
  margin-right: 4px;
  &:hover { color: var(--cf-accent); }
  &:active { cursor: grabbing; }
}
.wb-order-input {
  width: 56px;
  padding: 3px 6px;
  font-size: 12px;
  font-family: var(--cf-font-mono);
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid var(--cf-border);
  border-radius: 3px;
  color: var(--cf-text-primary);
  margin-right: 6px;
  text-align: center;
  &:hover { border-color: var(--cf-border-light); }
  &:focus { border-color: rgba(255, 215, 0, 0.5); outline: none; }
  -moz-appearance: textfield;
  &::-webkit-inner-spin-button,
  &::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
}
.wb-entry--dragging {
  opacity: 0.4;
}
.wb-entry--dragover {
  border-top: 2px solid rgba(255, 215, 0, 0.6);
  box-shadow: 0 -4px 12px rgba(255, 215, 0, 0.15);
}
</style>