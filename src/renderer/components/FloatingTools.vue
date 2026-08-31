<template>
  <div class="ft-root" :style="ballStyle">
    <!-- Trạng thái thu gọn: Quả cầu -->
    <button v-if="!expanded" class="ft-ball"
      @mousedown="onStart"
      @touchstart.passive="onStart"
      @click="onBallClick"
      :class="{ 'ft-ball--dragging': dragging }"
      title="Bộ công cụ (Kéo để di chuyển)">
      <span class="ft-ball__icon">⚒</span>
    </button>

    <!-- Trạng thái mở rộng: Bảng công cụ -->
    <div v-else class="ft-panel" :style="panelStyle">
      <div class="ft-panel__header"
        @mousedown="onStart"
        @touchstart.passive="onStart">
        <span class="ft-panel__title">Bộ công cụ</span>
        <button class="ft-panel__close" type="button" @click.stop="closePanel">×</button>
      </div>

      <div class="ft-panel__tabs">
        <button v-for="t in availableTools" :key="t.key"
          :class="['ft-tab', activeTool === t.key ? 'ft-tab--active' : '']"
          @click="switchTool(t.key)">{{ t.short }}</button>
      </div>

      <div class="ft-panel__body">
        <!-- Viết lời mở đầu -->
        <div v-if="activeTool === 'greeting'">
          <div class="hint mb-sm">Dựa trên description / personality / scenario của thẻ hiện tại để AI viết lời mở đầu mới</div>
          <div class="form-group">
            <label>Thiên hướng phong cách</label>
            <input class="input" v-model="greetingStyle" placeholder="VD: Lạnh lùng kiềm chế / Nhiệt tình chủ động / Bí ẩn gợi mở (có thể để trống)">
          </div>
          <div class="form-group">
            <label>Độ dài ước tính</label>
            <select class="select" v-model="greetingLen">
              <option value="200">Ngắn (200 từ)</option>
              <option value="400">Vừa (400 từ)</option>
              <option value="800">Dài (800 từ)</option>
            </select>
          </div>
          <button class="btn btn--primary btn--sm" :disabled="loading" @click="runGreeting">
            {{ loading ? 'Đang tạo...' : 'Tạo lời mở đầu' }}
          </button>
          <div v-if="aiResult" class="ft-result">
            <div class="ft-result__head">
              <span>Kết quả ({{ aiResult.length }} từ)</span>
              <div class="flex-row">
                <button class="btn btn--ghost btn--sm" @click="copyResult">Sao chép</button>
                <button class="btn btn--accent btn--sm" @click="applyGreeting">Áp dụng vào first_mes</button>
              </div>
            </div>
            <textarea class="ft-result__text" v-model="aiResult" rows="10"></textarea>
          </div>
        </div>

        <!-- Tối ưu hóa mục đã chọn (Chỉ ở /worldbook) -->
        <div v-if="activeTool === 'optimize_entry'">
          <div class="hint mb-sm">Chọn một mục Worldbook từ danh sách thả xuống, AI sẽ viết lại theo định hướng</div>
          <div class="form-group">
            <label>Mục Worldbook</label>
            <input class="input mb-sm" v-model="entrySearch" placeholder="Tìm tiêu đề / từ khóa / nội dung / #id">
            <select class="select" v-model="entrySelectedId">
              <option value="">— Chọn mục ({{ filteredEntries.length }} / {{ worldEntries.length }}) —</option>
              <option v-for="e in filteredEntries" :key="e.id" :value="e.id">
                #{{ e.id }} {{ e.comment || '(Chưa đặt tên)' }}
              </option>
            </select>
          </div>
          <div class="form-group">
            <label>Định hướng tối ưu</label>
            <input class="input" v-model="entryDirection" placeholder="VD: Bỏ miêu tả mỹ nhân khuôn mẫu / Thêm chi tiết cảm giác / Rút ngắn 30%">
          </div>
          <button class="btn btn--primary btn--sm" :disabled="loading || !entrySelectedId" @click="runOptimizeEntry">
            {{ loading ? 'Đang viết lại...' : 'Viết lại' }}
          </button>
          <div v-if="aiResult" class="ft-result">
            <div class="ft-result__head">
              <span>Kết quả viết lại</span>
              <div class="flex-row">
                <button class="btn btn--ghost btn--sm" @click="copyResult">Sao chép</button>
                <button class="btn btn--accent btn--sm" @click="applyEntryRewrite">Áp dụng vào mục này</button>
              </div>
            </div>
            <textarea class="ft-result__text" v-model="aiResult" rows="10"></textarea>
          </div>
        </div>

        <!-- Đặt tên NPC -->
        <div v-if="activeTool === 'npc_name'">
          <div class="hint mb-sm">Cung cấp phong cách và giới tính cho AI, nhận danh sách tên đề xuất (chỉ hiển thị, không sửa thẻ)</div>
          <div class="form-group">
            <label>Số lượng</label>
            <input class="input" type="number" min="1" max="10" v-model.number="npcCount">
          </div>
          <div class="form-group">
            <label>Giới tính</label>
            <select class="select" v-model="npcGender">
              <option value="女">Nữ</option>
              <option value="男">Nam</option>
              <option value="不限">Không giới hạn</option>
            </select>
          </div>
          <div class="form-group">
            <label>Phong cách</label>
            <input class="input" v-model="npcStyle" placeholder="VD: Tiên hiệp / Nhật hiện đại / Quý tộc Tây huyễn / Cyberpunk">
          </div>
          <button class="btn btn--primary btn--sm" :disabled="loading" @click="runNpcName">
            {{ loading ? 'Đang đặt tên...' : 'Đặt tên' }}
          </button>
          <div v-if="aiResult" class="ft-result">
            <div class="ft-result__head">
              <span>Kết quả</span>
              <button class="btn btn--ghost btn--sm" @click="copyResult">Sao chép</button>
            </div>
            <textarea class="ft-result__text" v-model="aiResult" rows="8"></textarea>
          </div>
        </div>

        <!-- Giải thích mã -->
        <div v-if="activeTool === 'explain_code'">
          <div class="hint mb-sm">Dán Regex / EJS / JS / Zod schema, AI sẽ giải thích dễ hiểu (không sửa đổi mã gốc)</div>
          <div class="form-group">
            <label>Mã nguồn</label>
            <textarea class="textarea" v-model="codeInput" rows="6" placeholder="Dán mã vào đây..."></textarea>
          </div>
          <button class="btn btn--primary btn--sm" :disabled="loading || !codeInput.trim()" @click="runExplainCode">
            {{ loading ? 'Đang phân tích...' : 'Giải thích' }}
          </button>
          <div v-if="aiResult" class="ft-result">
            <div class="ft-result__head">
              <span>Nội dung giải thích</span>
              <button class="btn btn--ghost btn--sm" @click="copyResult">Sao chép</button>
            </div>
            <textarea class="ft-result__text" v-model="aiResult" rows="10"></textarea>
          </div>
        </div>

        <!-- Bổ sung description -->
        <div v-if="activeTool === 'enrich_desc'">
          <div class="hint mb-sm">Dựa trên description hiện có, AI tìm chỗ thiếu để bổ sung (ngoại hình / thói quen / bối cảnh), không phá vỡ nội dung cũ</div>
          <div class="form-group">
            <label>description hiện tại ({{ (cardStore.cardData.description || '').length }} từ)</label>
            <textarea class="textarea" rows="4" :value="(cardStore.cardData.description || '').slice(0, 400) + ((cardStore.cardData.description || '').length > 400 ? '...' : '')" readonly></textarea>
          </div>
          <div class="form-group">
            <label>Trọng tâm bổ sung (có thể để trống để AI tự phán đoán)</label>
            <input class="input" v-model="enrichFocus" placeholder="VD: Chi tiết cảm giác / Thói quen thường nhật / Phục bút tuổi thơ">
          </div>
          <button class="btn btn--primary btn--sm" :disabled="loading || !cardStore.cardData.description" @click="runEnrichDesc">
            {{ loading ? 'Đang mở rộng...' : 'Mở rộng' }}
          </button>
          <div v-if="aiResult" class="ft-result">
            <div class="ft-result__head">
              <span>Sau khi mở rộng ({{ aiResult.length }} từ)</span>
              <div class="flex-row">
                <button class="btn btn--ghost btn--sm" @click="copyResult">Sao chép</button>
                <button class="btn btn--accent btn--sm" @click="applyEnrichedDesc">Áp dụng vào description</button>
              </div>
            </div>
            <textarea class="ft-result__text" v-model="aiResult" rows="12"></textarea>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useCardStore } from '../stores/card.js';
import { useApiStore } from '../stores/api.js';
import { useAppStore } from '../stores/app.js';
import { buildCardContext } from '../utils/card-context.js';

const cardStore = useCardStore();
const apiStore = useApiStore();
const appStore = useAppStore();
const route = useRoute();
const router = useRouter();

const POS_KEY = 'cf_floating_tools_pos';
const pos = reactive({ x: window.innerWidth - 80, y: window.innerHeight - 120 });
try {
  const saved = JSON.parse(localStorage.getItem(POS_KEY) || 'null');
  if (saved && typeof saved.x === 'number' && typeof saved.y === 'number') {
    pos.x = Math.max(0, Math.min(window.innerWidth - 60, saved.x));
    pos.y = Math.max(40, Math.min(window.innerHeight - 60, saved.y));
  }
} catch {}

const expanded = ref(false);
const dragging = ref(false);
let dragOffset = { x: 0, y: 0 };
let dragMoved = false;
let startPos = { x: 0, y: 0 };

function getClientCoords(e) {
  if (e.touches && e.touches.length > 0) {
    return { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }
  return { x: e.clientX, y: e.clientY };
}

function onStart(e) {
  const coords = getClientCoords(e);
  dragging.value = true;
  dragMoved = false;
  startPos = { ...coords };
  dragOffset.x = coords.x - pos.x;
  dragOffset.y = coords.y - pos.y;
}

function onMove(e) {
  if (!dragging.value) return;
  const coords = getClientCoords(e);
  const dx = Math.abs(coords.x - startPos.x);
  const dy = Math.abs(coords.y - startPos.y);
  
  // Tăng ngưỡng nhận diện di chuyển lên 8px để chống rung ngón tay trên mobile
  if (dx > 8 || dy > 8) {
    dragMoved = true;
  }

  const nx = coords.x - dragOffset.x;
  const ny = coords.y - dragOffset.y;
  pos.x = Math.max(0, Math.min(window.innerWidth - 60, nx));
  pos.y = Math.max(40, Math.min(window.innerHeight - 60, ny));
}

function onEnd() {
  if (!dragging.value) return;
  dragging.value = false;
  localStorage.setItem(POS_KEY, JSON.stringify({ x: pos.x, y: pos.y }));
}

function onBallClick() {
  if (!dragMoved) {
    expanded.value = true;
  }
}

function closePanel() {
  expanded.value = false;
  dragMoved = false;
  dragging.value = false;
}

onMounted(() => {
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onEnd);
  document.addEventListener('touchmove', onMove, { passive: true });
  document.addEventListener('touchend', onEnd);
});

onUnmounted(() => {
  document.removeEventListener('mousemove', onMove);
  document.removeEventListener('mouseup', onEnd);
  document.removeEventListener('touchmove', onMove);
  document.removeEventListener('touchend', onEnd);
});

const ballStyle = computed(() => ({
  left: pos.x + 'px',
  top: pos.y + 'px'
}));

const PANEL_W = 360;
const PANEL_H = 500;
const panelStyle = computed(() => {
  let left = pos.x;
  let top = pos.y;
  if (left + PANEL_W > window.innerWidth - 10) left = Math.max(10, window.innerWidth - PANEL_W - 10);
  if (top + PANEL_H > window.innerHeight - 10) top = Math.max(40, window.innerHeight - PANEL_H - 10);
  return { left: left - pos.x + 'px', top: top - pos.y + 'px' };
});

const ALL_TOOLS = [
  { key: 'greeting', short: 'Mở đầu' },
  { key: 'optimize_entry', short: 'Sửa mục', onlyRoute: '/worldbook' },
  { key: 'npc_name', short: 'Tên NPC' },
  { key: 'explain_code', short: 'Giải mã' },
  { key: 'enrich_desc', short: 'Thêm mô tả' },
  { key: 'quick_diag', short: 'Chẩn đoán', isJump: true }
];

const availableTools = computed(() => ALL_TOOLS.filter(t => {
  if (t.onlyRoute && route.path !== t.onlyRoute) return false;
  return true;
}));

const activeTool = ref('greeting');
watch(availableTools, (tools) => {
  if (!tools.find(t => t.key === activeTool.value)) {
    activeTool.value = tools[0]?.key || 'greeting';
  }
});

function switchTool(key) {
  const tool = ALL_TOOLS.find(t => t.key === key);
  if (tool?.isJump) {
    router.push('/diagnostic');
    expanded.value = false;
    return;
  }
  activeTool.value = key;
  aiResult.value = '';
}

const loading = ref(false);
const aiResult = ref('');

async function callAi(systemPrompt, userPrompt, opts = {}) {
  if (!apiStore.isConfigured) {
    appStore.toastError('Vui lòng cấu hình API trong cài đặt trước');
    throw new Error('API chưa cấu hình');
  }
  return await apiStore.chat([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ], {
    temperature: opts.temperature ?? 0.7,
    maxTokens: apiStore.getModelMaxTokens(apiStore.activeProvider?.model)
  });
}

function copyResult() {
  if (!aiResult.value) return;
  navigator.clipboard.writeText(aiResult.value).then(() => {
    appStore.toastSuccess('Đã sao chép');
  }).catch(() => appStore.toastError('Sao chép thất bại'));
}

function cardCtx(matchText = '') {
  return buildCardContext(cardStore, matchText, { modelContextTokens: apiStore.getModelContextTokens(apiStore.activeProvider?.model) });
}

// ========== Công cụ 1: Viết lời mở đầu ==========
const greetingStyle = ref('');
const greetingLen = ref('400');

async function runGreeting() {
  loading.value = true;
  aiResult.value = '';
  try {
    const sys = 'Bạn là chuyên gia viết lời mở đầu (first_mes) cho thẻ nhân vật SillyTavern. Viết theo nguyên tắc "độ không tuyệt đối + khác biệt hóa đặc trưng + cấm gắn nhãn quan hệ". Cấm dùng văn mẫu sáo rỗng (dường như / phảng phất / khóe miệng khẽ nhếch). Miêu tả trực tiếp bối cảnh hành động, không viết độc thoại nội tâm giải thích dài dòng.';
    const matchText = `${greetingStyle.value || ''} ${cardStore.cardData.first_mes || ''}`;
    const usr = `Vui lòng dựa vào thông tin thẻ nhân vật sau để viết một first_mes (lời mở đầu):

${cardCtx(matchText)}

${greetingStyle.value ? `Thiên hướng phong cách: ${greetingStyle.value}` : ''}
Khống chế độ dài: Khoảng ${greetingLen.value} từ

Xuất trực tiếp nội dung chính của lời mở đầu, không thêm tiền tố, không bọc khối mã Markdown, không kèm giải thích.`;
    aiResult.value = await callAi(sys, usr, { temperature: 0.85 });
  } catch (e) {
    appStore.toastError('Tạo thất bại: ' + e.message);
  } finally {
    loading.value = false;
  }
}

function applyGreeting() {
  if (!aiResult.value) return;
  cardStore.cardData.first_mes = aiResult.value;
  cardStore.markDirty?.();
  appStore.toastSuccess('Đã ghi vào first_mes');
}

// ========== Công cụ 2: Tối ưu mục đã chọn ==========
const entrySelectedId = ref('');
const entryDirection = ref('');
const entrySearch = ref('');
const worldEntries = computed(() => cardStore.worldEntries || []);
const filteredEntries = computed(() => {
  const q = entrySearch.value.trim().toLowerCase();
  if (!q) return worldEntries.value;
  return worldEntries.value.filter(e => {
    if (String(e.id).includes(q)) return true;
    if ((e.comment || '').toLowerCase().includes(q)) return true;
    if ((e.content || '').toLowerCase().includes(q)) return true;
    const keys = Array.isArray(e.keys) ? e.keys : [];
    if (keys.some(k => String(k).toLowerCase().includes(q))) return true;
    return false;
  });
});

watch(filteredEntries, (list) => {
  if (entrySelectedId.value && !list.some(e => e.id === entrySelectedId.value)) {
    entrySelectedId.value = '';
  }
});

async function runOptimizeEntry() {
  loading.value = true;
  aiResult.value = '';
  try {
    const entry = worldEntries.value.find(e => e.id === entrySelectedId.value);
    if (!entry) throw new Error('Không tìm thấy mục này');
    const sys = 'Bạn là chuyên gia viết lại mục Worldbook SillyTavern. Viết lại theo nguyên tắc "độ không tuyệt đối + bạch miêu + khác biệt hóa đặc trưng", cấm dùng văn mẫu sáo rỗng. Giữ nguyên thông tin cốt lõi và khung độ dài của mục gốc.';
    const matchText = `${(entry.keys || []).join(' ')} ${entryDirection.value || ''}`;
    const usr = `Vui lòng viết lại mục Worldbook sau đây:

【Tên mục】${entry.comment || '(Chưa đặt tên)'}
【Từ khóa】${(entry.keys || []).join(', ')}
【Nội dung gốc】
${entry.content || ''}

【Định hướng viết lại】
${entryDirection.value || 'Nâng cao chất lượng hành văn, loại bỏ miêu tả theo khuôn mẫu'}

—— Dưới đây là các thiết lập bối cảnh khác của thẻ nhân vật, hãy duy trì sự nhất quán về phong cách và thế giới quan khi viết lại ——
${cardCtx(matchText)}

Xuất trực tiếp toàn bộ nội dung sau khi viết lại, không thêm tiền tố, không kèm giải thích.`;
    aiResult.value = await callAi(sys, usr, { temperature: 0.7 });
  } catch (e) {
    appStore.toastError('Viết lại thất bại: ' + e.message);
  } finally {
    loading.value = false;
  }
}

function applyEntryRewrite() {
  if (!aiResult.value || !entrySelectedId.value) return;
  const entry = worldEntries.value.find(e => e.id === entrySelectedId.value);
  if (!entry) {
    appStore.toastError('Mục này không còn tồn tại');
    return;
  }
  entry.content = aiResult.value;
  cardStore.markDirty?.();
  appStore.toastSuccess(`Đã ghi vào mục: ${entry.comment || entry.id}`);
}

// ========== Công cụ 3: Đặt tên NPC ==========
const npcCount = ref(5);
const npcGender = ref('女');
const npcStyle = ref('');

async function runNpcName() {
  loading.value = true;
  aiResult.value = '';
  try {
    const sys = 'Bạn là chuyên gia đặt tên nhân vật, đưa ra các tên ứng viên theo đúng phong cách và giới tính được yêu cầu. Mỗi tên nằm trên một dòng riêng, kèm theo một dòng ngắn gợi ý tính cách.';
    const genderMap = { '女': 'Nữ', '男': 'Nam', '不限': 'Không giới hạn' };
    const usr = `Vui lòng tạo ${npcCount.value} tên NPC.
Giới tính: ${genderMap[npcGender.value] || npcGender.value}
Phong cách: ${npcStyle.value || 'Tự do sáng tạo theo phong cách tổng thể của thẻ nhân vật hiện tại'}
Tham khảo thẻ nhân vật hiện tại:
${cardCtx(npcStyle.value) || '(Trống)'}

Định dạng: Mỗi tên một dòng, dòng tiếp theo thụt lề viết một câu gợi ý tính cách.
Không đánh số thứ tự, không thêm tiền tố.`;
    aiResult.value = await callAi(sys, usr, { temperature: 0.9 });
  } catch (e) {
    appStore.toastError('Đặt tên thất bại: ' + e.message);
  } finally {
    loading.value = false;
  }
}

// ========== Công cụ 4: Giải thích mã ==========
const codeInput = ref('');

async function runExplainCode() {
  loading.value = true;
  aiResult.value = '';
  try {
    const sys = 'Bạn là chuyên gia kỹ thuật về thẻ nhân vật SillyTavern, hiểu rõ Regex / EJS / JS / Zod schema / script Tavern Helper. Hãy giải thích mã nguồn một cách dễ hiểu, nêu rõ công dụng, tác dụng phụ tiềm ẩn và các bẫy dễ mắc phải. Diễn đạt súc tích.';
    const usr = `Vui lòng giải thích đoạn mã sau:

\`\`\`
${codeInput.value}
\`\`\`

Nội dung xuất ra gồm:
1. Đoạn mã này làm gì (một câu tóm tắt)
2. Phân tích logic then chốt
3. Lưu ý / Bẫy tiềm ẩn (nếu có)`;
    aiResult.value = await callAi(sys, usr, { temperature: 0.4 });
  } catch (e) {
    appStore.toastError('Giải thích thất bại: ' + e.message);
  } finally {
    loading.value = false;
  }
}

// ========== Công cụ 5: Bổ sung description ==========
const enrichFocus = ref('');

async function runEnrichDesc() {
  loading.value = true;
  aiResult.value = '';
  try {
    const desc = cardStore.cardData.description || '';
    if (!desc.trim()) throw new Error('description hiện tại đang trống');
    const sys = 'Bạn là chuyên gia viết description cho thẻ nhân vật SillyTavern. Bổ sung thông tin theo nguyên tắc "độ không tuyệt đối + khác biệt hóa đặc trưng + cấm gắn nhãn quan hệ". Cấm dùng văn mẫu sáo rỗng. Giữ tối đa nội dung ban đầu, chỉ bù đắp các chi tiết còn thiếu.';
    const matchText = `${enrichFocus.value || ''} ${desc.slice(0, 500)}`;
    const usr = `Vui lòng bù đắp các chi tiết còn thiếu dựa trên description hiện có, xuất ra phiên bản hoàn chỉnh mới (bao gồm nội dung ban đầu + phần bổ sung):

【description hiện tại】
${desc}

${enrichFocus.value ? `【Trọng tâm bổ sung】\n${enrichFocus.value}` : 'Hãy tự phán đoán xem khía cạnh phổ biến nào còn thiếu (đặc trưng ngoại hình / thói quen thường nhật / mối quan hệ / phục bút bối cảnh...)'}

—— Dưới đây là các thiết lập bối cảnh khác của thẻ nhân vật, hãy duy trì sự nhất quán về phong cách và thế giới quan khi bổ sung ——
${cardCtx(matchText)}

Xuất ra description hoàn chỉnh, không thêm tiền tố, không kèm giải thích, không bọc khối mã Markdown.`;
    aiResult.value = await callAi(sys, usr, { temperature: 0.75 });
  } catch (e) {
    appStore.toastError('Mở rộng thất bại: ' + e.message);
  } finally {
    loading.value = false;
  }
}

function applyEnrichedDesc() {
  if (!aiResult.value) return;
  cardStore.cardData.description = aiResult.value;
  cardStore.markDirty?.();
  appStore.toastSuccess('Đã ghi vào description');
}
</script>

<style scoped>
.ft-root {
  position: fixed;
  z-index: 8500;
  user-select: none;
}

/* ── Quả cầu ── */
.ft-ball {
  width: 48px; height: 48px;
  border-radius: 50%;
  background: linear-gradient(135deg, #f7b267, #d97706);
  color: #fff;
  border: 2px solid rgba(255, 255, 255, 0.25);
  cursor: grab;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(0, 0, 0, 0.2);
  display: flex; align-items: center; justify-content: center;
  font-size: 20px;
  transition: transform 0.15s, box-shadow 0.15s;
  touch-action: none;
}
.ft-ball:hover {
  transform: scale(1.06);
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.5);
}
.ft-ball--dragging { cursor: grabbing; transform: scale(1.1); }
.ft-ball__icon { line-height: 1; pointer-events: none; }

/* ── Bảng công cụ ── */
.ft-panel {
  position: absolute;
  width: 360px;
  max-width: calc(100vw - 20px);
  height: 500px;
  max-height: calc(100vh - 80px);
  background: rgba(20, 22, 35, 0.92);
  backdrop-filter: blur(14px) saturate(140%);
  -webkit-backdrop-filter: blur(14px) saturate(140%);
  border: 1px solid var(--cf-border-light);
  border-radius: var(--cf-radius-lg);
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.55);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.ft-panel__header {
  padding: 8px 12px;
  background: var(--cf-bg-tertiary);
  border-bottom: 1px solid var(--cf-border);
  display: flex; justify-content: space-between; align-items: center;
  cursor: grab;
  touch-action: none;
}
.ft-panel__header:active { cursor: grabbing; }
.ft-panel__title { font-size: 13px; font-weight: 600; pointer-events: none; }
.ft-panel__close {
  background: transparent; border: none;
  color: var(--cf-text-muted); cursor: pointer;
  font-size: 18px; line-height: 1; padding: 0 6px;
}
.ft-panel__close:hover { color: var(--cf-text-primary); }

.ft-panel__tabs {
  display: flex;
  gap: 2px;
  padding: 6px 8px;
  background: var(--cf-bg-tertiary);
  border-bottom: 1px solid var(--cf-border);
  overflow-x: auto;
  flex-wrap: nowrap;
}
.ft-tab {
  background: transparent;
  border: 1px solid transparent;
  color: var(--cf-text-secondary);
  padding: 4px 8px;
  font-size: 11px;
  border-radius: 4px;
  cursor: pointer;
  white-space: nowrap;
}
.ft-tab:hover { background: var(--cf-bg-hover); color: var(--cf-text-primary); }
.ft-tab--active {
  background: var(--cf-accent);
  color: #fff;
  border-color: var(--cf-accent);
}

.ft-panel__body {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}
.ft-panel__body .form-group { margin-bottom: 8px; }
.ft-panel__body label { font-size: 11px; color: var(--cf-text-muted); display: block; margin-bottom: 3px; }
.ft-panel__body .input,
.ft-panel__body .select,
.ft-panel__body .textarea {
  font-size: 12px;
  padding: 4px 8px;
  width: 100%;
}

.ft-result {
  margin-top: 10px;
  border-top: 1px dashed var(--cf-border);
  padding-top: 8px;
}
.ft-result__head {
  display: flex; justify-content: space-between; align-items: center;
  font-size: 11px; color: var(--cf-text-muted);
  margin-bottom: 4px;
}
.ft-result__text {
  width: 100%;
  padding: 6px 8px;
  background: var(--cf-bg-tertiary);
  border: 1px solid var(--cf-border);
  border-radius: var(--cf-radius-sm);
  color: var(--cf-text-primary);
  font-family: var(--cf-font-mono);
  font-size: 11px;
  line-height: 1.6;
  resize: vertical;
}

.hint { color: var(--cf-text-muted); font-size: 11px; line-height: 1.5; }
.mb-sm { margin-bottom: 8px; }
.flex-row { display: flex; align-items: center; gap: 6px; }
</style>