<template>
  <div class="page">
    <div class="page__header flex-between">
      <div>
        <h1>Trích xuất tiểu thuyết sang Worldbook</h1>
        <p>Trích xuất toàn bộ tiểu thuyết thành các mục Worldbook có cấu trúc (5 bước phân loại: Nhân vật / Tuyến sự kiện / Dòng thời gian / Thiết lập / Quỹ đạo vật phẩm)</p>
      </div>
      <div class="tabs">
        <div :class="['tabs__item', { active: tab === 'auto' }]" @click="tab = 'auto'">Tự động hoàn toàn</div>
        <div :class="['tabs__item', { active: tab === 'focused' }]" @click="tab = 'focused'">Mở rộng trọng điểm</div>
        <div :class="['tabs__item', { active: tab === 'ide' }]" @click="tab = 'ide'">IDE có hướng dẫn</div>
      </div>
    </div>

    <div class="grid-2">
      <!-- ============ Cột trái: Cấu hình + Nhập liệu ============ -->
      <div>
        <!-- Bảng cấu hình -->
        <div class="card mb-md">
          <div class="card__header"><h3>Cấu hình phần tiểu thuyết</h3></div>
          <div class="card__body">
            <div class="grid-2">
              <div class="form-group">
                <label>Tên tiểu thuyết</label>
                <input class="input" v-model="config.novelName" placeholder="VD: Tên tiểu thuyết của bạn">
              </div>
              <div class="form-group">
                <label>Tên phần (dùng làm tiền tố mục)</label>
                <input class="input" v-model="config.chapterName" placeholder="VD: Phần 1 / Phần mở đầu / Phần tu luyện">
              </div>
            </div>
            <div class="grid-2">
              <div class="form-group">
                <label>Họ tên nhân vật chính <span class="badge badge--danger">Bắt buộc</span></label>
                <input class="input" v-model="config.protagonistName" placeholder="VD: Trần Dật / Họ tên nhân vật chính">
              </div>
              <div class="form-group">
                <label>Thân phận người chơi</label>
                <select class="select" v-model="config.userMode">
                  <option v-for="m in PROTAGONIST_MODES" :key="m.value" :value="m.value">{{ m.label }}</option>
                </select>
                <div class="hint">{{ currentModeDesc }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Nguyên tác tiểu thuyết -->
        <div class="card mb-md">
          <div class="card__header flex-between">
            <h3>Nguyên tác tiểu thuyết</h3>
            <div class="flex-row">
              <button class="btn btn--secondary btn--sm" @click="importNovel">Nhập file txt</button>
              <button class="btn btn--ghost btn--sm" @click="novelText = ''" :disabled="!novelText">Xóa trống</button>
            </div>
          </div>
          <div class="card__body">
            <textarea class="textarea" v-model="novelText" rows="10"
              placeholder="Dán nội dung tiểu thuyết gốc hoặc nhấp 'Nhập file txt' ở trên"></textarea>
            <div class="hint">{{ novelText.length }} từ · Ước tính {{ estimatedTokens }} token</div>
          </div>
        </div>

        <!-- Xem trước phân đoạn -->
        <div v-if="novelText.trim().length > 0" class="card mb-md">
          <div class="card__header"><h3>Xem trước phân đoạn</h3></div>
          <div class="card__body">
            <div class="grid-3">
              <div class="form-group">
                <label>Chiến lược phân đoạn</label>
                <select class="select" v-model="config.chunkStrategy">
                  <option value="auto">Tự động (Ưu tiên theo chương + Dự phòng theo số từ)</option>
                  <option value="chapter">Bắt buộc theo chương</option>
                  <option value="words">Bắt buộc theo số từ</option>
                </select>
              </div>
              <div class="form-group" v-if="config.chunkStrategy !== 'words'">
                <label>Số chương mỗi đoạn</label>
                <input class="input" type="number" v-model.number="config.chaptersPerChunk" min="1" max="20">
              </div>
              <div class="form-group" v-if="config.chunkStrategy !== 'chapter'">
                <label>Số từ mỗi đoạn</label>
                <input class="input" type="number" v-model.number="config.wordsPerChunk" min="1000" step="1000">
              </div>
            </div>

            <div class="chunk-preview">
              <div class="flex-between">
                <span class="badge" :class="chunkInfo.strategy === 'chapter' ? 'badge--success' : 'badge--warning'">
                  {{ chunkInfo.strategy === 'chapter' ? 'Cắt theo chương' : 'Cắt theo số từ' }}
                </span>
                <span v-if="chunkInfo.fallback" class="hint" style="color:var(--cf-warning)">
                  Chưa nhận diện được ≥3 tiêu đề chương trong nguyên tác, đã chuyển sang cắt theo số từ
                </span>
              </div>
              <div class="hint mt-sm">
                <strong>{{ chunkInfo.totalChapters > 0 ? `Đã nhận diện ${chunkInfo.totalChapters} chương` : 'Chưa nhận diện chương' }}</strong>
                · Cắt thành <strong>{{ chunkInfo.chunks.length }} đoạn</strong>
                · 5 bước phân loại = <strong>{{ totalCalls }} lượt gọi AI</strong>
                · Ước tính <strong>{{ formatTime(estimatedSeconds) }}</strong>
              </div>
              <div v-if="novelText.length > 300000" class="warning-box mt-sm">
                Lưu ý: Nguyên tác {{ Math.round(novelText.length / 10000) }} vạn từ, vượt quá ngưỡng 30 vạn từ. Khuyến nghị chia theo từng phần (mỗi lần 50-100 chương).
              </div>
            </div>

            <!-- Giới hạn N đoạn đầu -->
            <div v-if="chunkInfo.chunks.length > 1" class="form-group mt-md">
              <label>Chỉ chạy N đoạn đầu (0 = Tất cả)</label>
              <input class="input" type="number" v-model.number="config.chapterRangeEnd"
                min="0" :max="chunkInfo.chunks.length" placeholder="0 = Tất cả">
              <div class="hint">Chạy thử vài đoạn đầu để xem hiệu quả trước khi chạy toàn bộ (tiết kiệm token)</div>
            </div>
          </div>
        </div>

        <!-- Cài đặt nâng cao -->
        <div class="card mb-md">
          <details>
            <summary class="card__header" style="cursor:pointer;list-style:none">
              <h3>▶ Cài đặt nâng cao</h3>
            </summary>
            <div class="card__body">
              <label class="toggle-label mb-md">
                <input type="checkbox" v-model="config.enableR2DoubleCheck">
                <strong>Chạy kép R1+R2</strong> (Trích xuất mỗi loại 2 lần độc lập rồi gộp lại, độ bao phủ cao hơn nhưng token +50%, thời gian +50%)
              </label>
              <label class="toggle-label mb-md">
                <input type="checkbox" v-model="config.enableContinuationSummary">
                <strong>Tóm tắt liên kết giữa các phần</strong> (Tự động tạo tóm tắt nối tiếp sau khi hoàn thành để dùng cho phần tiếp theo)
              </label>
              <label class="toggle-label mb-md">
                <input type="checkbox" v-model="config.enableSelfCheck">
                <strong>AI tự kiểm tra sau mỗi loại trích xuất</strong> (Thêm 5 lượt gọi AI, nâng cao chất lượng)
              </label>
            </div>
          </details>
        </div>

        <!-- Nội dung theo tab -->
        <div class="card">
          <div class="card__body">
            <!-- Tab tự động hoàn toàn -->
            <div v-if="tab === 'auto'">
              <p class="hint mb-md">Chạy chuỗi 5 bước trích xuất 1 chạm, hoàn toàn tự động không cần can thiệp. Có thể tạm dừng / tiếp tục giữa chừng.</p>
              <button class="btn btn--primary btn--lg" style="width:100%"
                :disabled="!canStart"
                @click="startAuto">
                {{ running ? 'Đang trích xuất...' : 'Bắt đầu trích xuất tự động' }}
              </button>
            </div>

            <!-- Tab mở rộng trọng điểm -->
            <div v-if="tab === 'focused'">
              <p class="hint mb-md">Chỉ trích xuất các loại bạn chọn, không lãng phí token cho phần không cần thiết.</p>
              <div class="form-group">
                <label>Trích xuất các loại sau:</label>
                <div style="display:flex;flex-direction:column;gap:8px;margin-top:8px">
                  <label v-for="t in EXTRACTION_TYPES" :key="t.key" class="toggle-label">
                    <input type="checkbox" :value="t.key" v-model="config.selectedTypes">
                    <strong>{{ t.label }}</strong>
                    <span class="hint" style="margin-left:auto">{{ t.desc }}</span>
                  </label>
                </div>
              </div>
              <button class="btn btn--primary btn--lg" style="width:100%;margin-top:12px"
                :disabled="!canStart || config.selectedTypes.length === 0"
                @click="startFocused">
                {{ running ? 'Đang trích xuất...' : `Trích xuất ${config.selectedTypes.length} loại đã chọn` }}
              </button>
            </div>

            <!-- Tab IDE có hướng dẫn -->
            <div v-if="tab === 'ide'">
              <p class="hint mb-md">
                Chạy thủ công từng loại, xem kết quả sau khi hoàn thành và có thể thử lại riêng lẻ. Chế độ kiểm soát chi tiết nhất.
              </p>
              <div v-for="t in EXTRACTION_TYPES" :key="t.key" class="ide-step">
                <div class="flex-between">
                  <div>
                    <strong>{{ t.label }}</strong>
                    <span class="hint" style="margin-left:8px">{{ getStepStatus(t.key) }}</span>
                  </div>
                  <div class="flex-row">
                    <button class="btn btn--primary btn--sm"
                      :disabled="!canStart || progress[t.key]?.running"
                      @click="runSingleType(t.key)">
                      {{ progress[t.key]?.done > 0 ? 'Trích xuất lại' : 'Bắt đầu trích xuất' }}
                    </button>
                  </div>
                </div>
                <div v-if="progress[t.key]?.total > 0" class="ide-step__progress">
                  <div class="ide-step__bar" :style="{ width: getPercent(t.key) + '%' }"></div>
                </div>
              </div>
            </div>

            <button v-if="running" class="btn btn--danger btn--sm mt-md" style="width:100%"
              @click="stopExtraction">
              Dừng trích xuất hiện tại
            </button>
          </div>
        </div>
      </div>

      <!-- ============ Cột phải: Tiến độ + Xem trước + Tiêm ============ -->
      <div>
        <!-- Cây tiến độ -->
        <div v-if="running || hasAnyResult" class="card mb-md">
          <div class="card__header"><h3>Tiến độ trích xuất</h3></div>
          <div class="card__body">
            <div class="progress-tree">
              <div class="progress-tree__row" :class="{ done: chunkInfo.chunks.length > 0 }">
                Tiền xử lý phân đoạn
                <span class="hint" style="margin-left:auto">
                  {{ chunkInfo.chunks.length > 0 ? `Đã cắt ${chunkInfo.chunks.length} đoạn` : 'Chờ nguyên tác' }}
                </span>
              </div>
              <div class="progress-tree__row">
                5 bước trích xuất
                <span class="hint" style="margin-left:auto">{{ overallProgress }}</span>
              </div>
              <div v-for="t in EXTRACTION_TYPES" :key="t.key" class="progress-tree__sub"
                :class="{
                  active: progress[t.key]?.running,
                  done: progress[t.key]?.done >= (progress[t.key]?.total || 0) && progress[t.key]?.done > 0
                }">
                <span style="margin-right:8px">{{ getProgressIcon(t.key) }}</span>
                {{ t.label }}
                <span class="hint" style="margin-left:auto">
                  {{ progress[t.key]?.done || 0 }} / {{ progress[t.key]?.total || 0 }} đoạn
                  <span v-if="getResultCount(t.key) > 0">· Trích xuất {{ getResultCount(t.key) }} mục</span>
                </span>
              </div>
              <div class="progress-tree__row" :class="{ done: previewEntries.length > 0 }">
                Xem trước khi tiêm
                <span class="hint" style="margin-left:auto">
                  {{ previewEntries.length > 0 ? `${previewEntries.length} mục chờ tiêm` : 'Chờ trích xuất xong' }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Đánh giá chất lượng -->
        <div v-if="hasAnyResult" class="card mb-md">
          <div class="card__header flex-between">
            <h3>Đánh giá chất lượng</h3>
            <span class="quality-score" :class="getScoreClass()">{{ qualitySummary.score }} / 100</span>
          </div>
          <div class="card__body">
            <div v-if="qualitySummary.suggestions.length === 0" class="hint" style="color:var(--cf-success)">
              ✓ Chưa phát hiện vấn đề chất lượng rõ ràng
            </div>
            <ul v-else style="margin:0;padding-left:20px">
              <li v-for="(s, i) in qualitySummary.suggestions" :key="i" class="hint">{{ s }}</li>
            </ul>
            <button v-if="hasAnyResult && !running" class="btn btn--secondary btn--sm mt-md"
              @click="runAiSelfCheckAll">
              {{ selfChecking ? 'Đang tự kiểm tra...' : 'Tự kiểm tra AI toàn bộ loại 1 chạm' }}
            </button>
          </div>
        </div>

        <!-- Xem trước khi tiêm -->
        <div class="card" style="min-height:300px">
          <div class="card__header flex-between">
            <h3>Xem trước khi tiêm ({{ previewEntries.length }})</h3>
            <div class="flex-row" v-if="previewEntries.length > 0">
              <button class="btn btn--ghost btn--sm" @click="selectAllPreview(true)">Chọn tất cả</button>
              <button class="btn btn--ghost btn--sm" @click="selectAllPreview(false)">Bỏ chọn tất cả</button>
              <button class="btn btn--primary btn--sm" @click="injectSelected"
                :disabled="selectedPreviewCount === 0">
                Tiêm {{ selectedPreviewCount }} mục đã chọn vào Worldbook
              </button>
            </div>
          </div>
          <div class="card__body" style="overflow-y:auto;max-height:calc(100vh - 200px)">
            <div v-if="previewEntries.length === 0" class="empty-state">
              <div class="empty-state__title">Chờ trích xuất</div>
              <div class="empty-state__desc">Điền cấu hình + dán tiểu thuyết rồi nhấp bắt đầu</div>
            </div>
            <WorldEntryCard v-for="(entry, i) in previewEntries" :key="i"
              :entry="entry"
              mode="preview"
              :expanded="previewExpanded.has(i)"
              :selected="entry._selected !== false"
              @toggle-expand="togglePreviewExpand(i)"
              @toggle-select="entry._selected = entry._selected === false"
              @delete="previewEntries.splice(i, 1)" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue';
import { useCardStore } from '../stores/card.js';
import { useApiStore } from '../stores/api.js';
import { useAppStore } from '../stores/app.js';
import { chatForJsonArray } from '../utils/json-repair.js';
import WorldEntryCard from '../components/WorldEntryCard.vue';
import {
  EXTRACTION_TYPES, PROTAGONIST_MODES,
  WRITING_RULES_BASE, buildProtagonistRule,
  EXTRACT_CHARACTER_PROMPT, EXTRACT_EVENTLINE_PROMPT, EXTRACT_TIMELINE_PROMPT,
  EXTRACT_SETTING_PROMPT, EXTRACT_ITEM_TRAJECTORY_PROMPT,
  R2_OFFSET_PROMPT
} from '../utils/novel-extract-rules.js';
import {
  emptyExtraction, emptyExtractConfig,
  chunkNovel, extractionToWorldEntries,
  normalizeExtractionArray, estimateTotalCalls, estimateTotalTime, estimateTokens
} from '../utils/novel-extract-format.js';
import { aiSelfCheckExtraction, mergeR1R2, mergeSameNameByAI, summarizeExtractionQuality } from '../utils/novel-extract-checker.js';

const cardStore = useCardStore();
const apiStore = useApiStore();
const appStore = useAppStore();

const tab = ref('auto');
const novelText = ref('');
const config = reactive({ ...emptyExtractConfig(), enableSelfCheck: false });
const running = ref(false);
const stopFlag = ref(false);
const selfChecking = ref(false);
const extraction = reactive(emptyExtraction());
const previewEntries = ref([]);
const previewExpanded = ref(new Set());

const progress = reactive({
  character: { done: 0, total: 0, running: false },
  eventline: { done: 0, total: 0, running: false },
  timeline: { done: 0, total: 0, running: false },
  setting: { done: 0, total: 0, running: false },
  item_trajectory: { done: 0, total: 0, running: false }
});

const currentModeDesc = computed(() => PROTAGONIST_MODES.find(m => m.value === config.userMode)?.desc || '');

const chunkInfo = computed(() => {
  if (!novelText.value.trim()) return { strategy: 'words', chunks: [], totalChapters: 0, fallback: false };
  return chunkNovel(novelText.value, {
    strategy: config.chunkStrategy,
    chaptersPerChunk: config.chaptersPerChunk,
    wordsPerChunk: config.wordsPerChunk
  });
});

const effectiveChunks = computed(() => {
  const all = chunkInfo.value.chunks;
  const limit = config.chapterRangeEnd > 0 ? Math.min(config.chapterRangeEnd, all.length) : all.length;
  return all.slice(0, limit);
});

const totalCalls = computed(() => {
  return estimateTotalCalls(effectiveChunks.value.length, config.selectedTypes, config.enableR2DoubleCheck)
    + (config.enableSelfCheck ? config.selectedTypes.length : 0);
});

const estimatedSeconds = computed(() => estimateTotalTime(totalCalls.value));
const estimatedTokens = computed(() => estimateTokens(novelText.value));

const canStart = computed(() => {
  return !running.value
    && novelText.value.trim().length > 0
    && config.protagonistName.trim().length > 0
    && effectiveChunks.value.length > 0
    && apiStore.isConfigured;
});

const hasAnyResult = computed(() => {
  return extraction.characters.length > 0
    || extraction.eventlines.length > 0
    || extraction.timeline.length > 0
    || extraction.settings.length > 0
    || extraction.item_trajectories.length > 0;
});

const overallProgress = computed(() => {
  let done = 0, total = 0;
  for (const t of EXTRACTION_TYPES) {
    done += progress[t.key].done;
    total += progress[t.key].total;
  }
  return total > 0 ? `${done} / ${total} đoạn` : 'Chờ bắt đầu';
});

const qualitySummary = computed(() => summarizeExtractionQuality(extraction));
const selectedPreviewCount = computed(() => previewEntries.value.filter(e => e._selected !== false).length);

const STORAGE_KEY = 'cf_novel_extract_state';

function saveState() {
  try {
    const state = { config: JSON.parse(JSON.stringify(config)), extraction: JSON.parse(JSON.stringify(extraction)), novelText: novelText.value };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {}
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const state = JSON.parse(raw);
    if (state.config) Object.assign(config, state.config);
    if (state.extraction) Object.assign(extraction, state.extraction);
    if (state.novelText) novelText.value = state.novelText;
    rebuildPreview();
  } catch (e) {}
}

watch([extraction, () => config.chapterName, () => config.userMode], () => { saveState(); }, { deep: true });
onMounted(() => { loadState(); });

function importNovel() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.txt,.text,.md';
  input.onchange = async e => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      novelText.value = await file.text();
      appStore.toastSuccess(`Đã nhập "${file.name}" (${novelText.value.length} từ)`);
    } catch (err) {
      appStore.toastError('Nhập file thất bại: ' + err.message);
    }
  };
  input.click();
}

function formatTime(seconds) {
  if (seconds < 60) return `${seconds} giây`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} phút`;
  return `${(seconds / 3600).toFixed(1)} giờ`;
}

function getStepStatus(typeKey) {
  const p = progress[typeKey];
  if (p.running) return `Đang thực hiện ${p.done}/${p.total}`;
  if (p.done > 0 && p.done >= p.total) return `Đã hoàn thành (${getResultCount(typeKey)} mục)`;
  if (p.done > 0) return `Đã hoàn thành một phần ${p.done}/${p.total}`;
  return 'Chưa bắt đầu';
}

function getResultCount(typeKey) {
  const map = {
    character: 'characters', eventline: 'eventlines', timeline: 'timeline',
    setting: 'settings', item_trajectory: 'item_trajectories'
  };
  return extraction[map[typeKey]]?.length || 0;
}

function getProgressIcon(typeKey) {
  const p = progress[typeKey];
  if (p.running) return '·';
  if (p.done > 0 && p.done >= p.total) return '·';
  return '·';
}

function getPercent(typeKey) {
  const p = progress[typeKey];
  return p.total > 0 ? Math.round(p.done / p.total * 100) : 0;
}

function getScoreClass() {
  const s = qualitySummary.value.score;
  if (s >= 80) return 'quality-score--good';
  if (s >= 60) return 'quality-score--mid';
  return 'quality-score--bad';
}

const TYPE_PROMPT_MAP = {
  character: EXTRACT_CHARACTER_PROMPT,
  eventline: EXTRACT_EVENTLINE_PROMPT,
  timeline: EXTRACT_TIMELINE_PROMPT,
  setting: EXTRACT_SETTING_PROMPT,
  item_trajectory: EXTRACT_ITEM_TRAJECTORY_PROMPT
};

const TYPE_RESULT_KEY = {
  character: 'characters',
  eventline: 'eventlines',
  timeline: 'timeline',
  setting: 'settings',
  item_trajectory: 'item_trajectories'
};

async function runChunkExtract(chunk, type, withR2 = false) {
  const sysMsg = 'Bạn là chuyên gia tạo thẻ nhân vật SillyTavern. ' + WRITING_RULES_BASE + '\n\n' + buildProtagonistRule(config.userMode, config.protagonistName);
  const userPrompt = TYPE_PROMPT_MAP[type]
    + (withR2 ? '\n\n' + R2_OFFSET_PROMPT : '')
    + `\n\n## Đoạn trích nguyên tác tiểu thuyết\n\n${chunk}`;

  const result = await chatForJsonArray(apiStore, [
    { role: 'system', content: sysMsg },
    { role: 'user', content: userPrompt }
  ], {
    temperature: 0.7,
    maxTokens: apiStore.getModelMaxTokens(apiStore.activeProvider?.model)
  });
  return normalizeExtractionArray(result, type);
}

async function runTypeForAllChunks(type) {
  const chunks = effectiveChunks.value;
  progress[type].running = true;
  progress[type].total = chunks.length;
  progress[type].done = 0;

  const r1Results = [];
  for (let i = 0; i < chunks.length; i++) {
    if (stopFlag.value) break;
    try {
      const items = await runChunkExtract(chunks[i], type, false);
      r1Results.push(...items);
    } catch (e) {
      appStore.toastWarning(`Đoạn ${i + 1} [${type}] xảy ra lỗi: ${e.message}`);
    }
    progress[type].done = i + 1;
    if (i < chunks.length - 1) await sleep(13000);
  }

  let finalResults = r1Results;

  if (!stopFlag.value && finalResults.length > 1) {
    appStore.toastInfo(`[${type}] Đang gộp các mục trùng tên giữa các đoạn...`);
    finalResults = await mergeSameNameByAI(apiStore, finalResults, type);
  }

  if (config.enableR2DoubleCheck && !stopFlag.value) {
    let r2Results = [];
    progress[type].done = 0;
    appStore.toastInfo(`[${type}] Bắt đầu chạy kép R2...`);
    for (let i = 0; i < chunks.length; i++) {
      if (stopFlag.value) break;
      try {
        const items = await runChunkExtract(chunks[i], type, true);
        r2Results.push(...items);
      } catch (e) {}
      progress[type].done = i + 1;
      if (i < chunks.length - 1) await sleep(13000);
    }
    if (!stopFlag.value && r2Results.length > 1) {
      appStore.toastInfo(`[${type}] R2 đang gộp các mục trùng tên giữa các đoạn...`);
      r2Results = await mergeSameNameByAI(apiStore, r2Results, type);
    }
    if (!stopFlag.value) {
      finalResults = await mergeR1R2(apiStore, finalResults, r2Results, type);
    }
  }

  if (config.enableSelfCheck && !stopFlag.value) {
    appStore.toastInfo(`[${type}] AI đang tự kiểm tra...`);
    finalResults = await aiSelfCheckExtraction(apiStore, finalResults, type);
  }

  extraction[TYPE_RESULT_KEY[type]] = finalResults;
  progress[type].running = false;
  rebuildPreview();
}

async function startAuto() {
  config.selectedTypes = ['character', 'eventline', 'timeline', 'setting', 'item_trajectory'];
  await runTypes(config.selectedTypes);
}

async function startFocused() {
  if (config.selectedTypes.length === 0) {
    appStore.toastError('Vui lòng chọn ít nhất một loại');
    return;
  }
  await runTypes(config.selectedTypes);
}

async function runSingleType(type) {
  await runTypes([type]);
}

async function runTypes(types) {
  if (!canStart.value) return;
  running.value = true;
  stopFlag.value = false;
  try {
    for (const type of types) {
      if (stopFlag.value) break;
      await runTypeForAllChunks(type);
    }
    if (!stopFlag.value) {
      appStore.toastSuccess(`Trích xuất hoàn tất (${types.length} loại)`);
    } else {
      appStore.toastInfo('Đã dừng trích xuất');
    }
  } catch (e) {
    appStore.toastError(`Trích xuất thất bại: ${e.message}`);
  } finally {
    running.value = false;
    stopFlag.value = false;
  }
}

function stopExtraction() {
  stopFlag.value = true;
  appStore.toastInfo('Đã nhận tín hiệu dừng, sẽ dừng sau khi đoạn hiện tại hoàn tất');
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function runAiSelfCheckAll() {
  if (!apiStore.isConfigured) return;
  selfChecking.value = true;
  try {
    for (const t of EXTRACTION_TYPES) {
      const key = TYPE_RESULT_KEY[t.key];
      if (extraction[key].length === 0) continue;
      extraction[key] = await aiSelfCheckExtraction(apiStore, extraction[key], t.key);
      await sleep(13000);
    }
    rebuildPreview();
    appStore.toastSuccess('Toàn bộ quá trình tự kiểm tra đã hoàn tất');
  } catch (e) {
    appStore.toastError('Tự kiểm tra thất bại: ' + e.message);
  } finally {
    selfChecking.value = false;
  }
}

function rebuildPreview() {
  const entries = extractionToWorldEntries(extraction, config);
  for (const e of entries) e._selected = true;
  previewEntries.value = entries;
}

function togglePreviewExpand(idx) {
  if (previewExpanded.value.has(idx)) previewExpanded.value.delete(idx);
  else previewExpanded.value.add(idx);
  previewExpanded.value = new Set(previewExpanded.value);
}

function selectAllPreview(val) {
  for (const e of previewEntries.value) e._selected = val;
}

function injectSelected() {
  const selected = previewEntries.value.filter(e => e._selected !== false);
  if (selected.length === 0) {
    appStore.toastWarning('Vui lòng chọn ít nhất một mục');
    return;
  }
  let count = 0;
  for (const e of selected) {
    const entry = cardStore.addWorldEntry();
    entry.comment = e.comment;
    entry.keys = e.keys;
    entry.secondary_keys = e.secondary_keys || [];
    entry.content = e.content;
    entry.constant = e.constant;
    entry.selective = e.selective;
    entry.enabled = e.enabled !== false;
    entry.position = e.position;
    entry.insertion_order = e.insertion_order || 100;
    Object.assign(entry.extensions, e.extensions || {});
    count++;
  }
  appStore.toastSuccess(`Đã tiêm ${count} mục vào Worldbook`);
  previewEntries.value = [];
}
</script>

<style scoped>
.tabs { display: flex; gap: 4px; }
.tabs__item {
  padding: 8px 16px; cursor: pointer; font-size: 13px;
  color: var(--cf-text-secondary); border-bottom: 2px solid transparent;
  transition: all var(--cf-transition);
}
.tabs__item:hover { color: var(--cf-text-primary); }
.tabs__item.active { color: var(--cf-accent); border-bottom-color: var(--cf-accent); }

.toggle-label {
  display: flex; align-items: center; gap: 8px;
  font-size: 13px; cursor: pointer; color: var(--cf-text-secondary);
}
.toggle-label input { accent-color: var(--cf-accent); }

.chunk-preview {
  background: var(--cf-bg-tertiary);
  border-radius: var(--cf-radius-sm);
  padding: 12px;
  margin-top: 12px;
}

.warning-box {
  background: rgba(251,191,36,0.1);
  border: 1px solid rgba(251,191,36,0.3);
  color: var(--cf-warning);
  padding: 8px 10px;
  border-radius: var(--cf-radius-sm);
  font-size: 12px;
}

.ide-step {
  padding: 12px;
  background: var(--cf-bg-tertiary);
  border-radius: var(--cf-radius-sm);
  margin-bottom: 8px;
}
.ide-step__progress {
  height: 4px; background: var(--cf-bg-secondary);
  border-radius: 2px; margin-top: 8px; overflow: hidden;
}
.ide-step__bar {
  height: 100%; background: var(--cf-accent);
  transition: width 0.3s;
}

.progress-tree__row {
  padding: 8px 12px;
  display: flex; align-items: center; gap: 8px;
  font-size: 13px; color: var(--cf-text-secondary);
}
.progress-tree__row.done { color: var(--cf-success); }
.progress-tree__sub {
  padding: 6px 12px 6px 32px;
  display: flex; align-items: center;
  font-size: 12px; color: var(--cf-text-muted);
}
.progress-tree__sub.active { color: var(--cf-info); font-weight: 500; }
.progress-tree__sub.done { color: var(--cf-success); }

.quality-score {
  font-size: 18px; font-weight: 600;
  padding: 4px 12px; border-radius: 4px;
}
.quality-score--good { color: var(--cf-success); background: rgba(74,222,128,0.1); }
.quality-score--mid { color: var(--cf-warning); background: rgba(251,191,36,0.1); }
.quality-score--bad { color: var(--cf-danger); background: rgba(248,113,113,0.1); }

.flex-row { display: flex; align-items: center; gap: 8px; }
.mt-md { margin-top: var(--cf-gap-md); }
.mt-sm { margin-top: var(--cf-gap-sm); }
.mb-md { margin-bottom: var(--cf-gap-md); }
</style>