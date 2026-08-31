<template>
  <div class="page">
    <div class="page__header flex-between">
      <div>
        <h1>Mẫu đối thoại &amp; Phỏng vấn nhân vật</h1>
        <p>AI giúp bạn tạo mẫu đối thoại và thiết lập nhân vật chuyên sâu</p>
      </div>
    </div>

    <div class="card mb-md">
      <div class="card__body hint" style="line-height:1.8">
        · <strong>Mẫu đối thoại</strong> — AI giúp bạn viết mes_example (mẫu đối thoại), dạy AI nắm bắt phong cách nói chuyện và thói quen cử chỉ của nhân vật<br>
        · <strong>Phỏng vấn nhân vật</strong> — AI đóng vai phóng viên phỏng vấn nhân vật, khai thác chiều sâu tính cách, kết quả có thể bổ sung vào description hoặc mes_example<br>
        · Trước khi tạo vui lòng điền tên nhân vật và tính cách cơ bản trong mục "Thông tin cơ bản" và "Thiết lập nhân vật"
      </div>
    </div>

    <div class="tabs">
      <div :class="['tabs__item', { active: tab === 'sample' }]" @click="tab = 'sample'">Tạo mẫu đối thoại</div>
      <div :class="['tabs__item', { active: tab === 'interview' }]" @click="tab = 'interview'">Phỏng vấn nhân vật</div>
    </div>

    <!-- Mẫu đối thoại -->
    <div v-if="tab === 'sample'">
      <div class="card mb-md">
        <div class="card__header"><h3>Tạo mẫu đối thoại</h3></div>
        <div class="card__body">
          <p class="hint mb-md">AI sẽ dựa trên tính cách và cách nói chuyện của nhân vật để tự động tạo mẫu đối thoại (mes_example), giúp AI học được cảm giác ngữ điệu của nhân vật</p>
          <div class="grid-2">
            <div class="form-group">
              <label>Số lượng bối cảnh tạo</label>
              <select class="select" v-model="sampleCount">
                <option :value="3">3 bối cảnh</option>
                <option :value="5">5 bối cảnh</option>
                <option :value="8">8 bối cảnh</option>
              </select>
            </div>
            <div class="form-group">
              <label>Loại bối cảnh</label>
              <div style="display:flex;flex-wrap:wrap;gap:8px">
                <label class="toggle-label" v-for="s in sceneTypes" :key="s.value">
                  <input type="checkbox" v-model="selectedScenes" :value="s.value"> {{ s.label }}
                </label>
              </div>
            </div>
          </div>
          <div class="form-group">
            <label>Yêu cầu bổ sung</label>
            <input class="input" v-model="sampleExtra" placeholder="VD: Thể hiện tính cách tsundere, có đối thoại trong cảnh chiến đấu...">
          </div>
          <button class="btn btn--primary" style="width:100%" :disabled="generating || !cardStore.cardData.name"
            @click="generateSamples">
            {{ generating ? 'Đang tạo...' : 'Tạo mẫu đối thoại' }}
          </button>
        </div>
      </div>

      <div v-if="sampleResult" class="card">
        <div class="card__header flex-between">
          <h3>Kết quả tạo</h3>
          <button class="btn btn--primary btn--sm" @click="injectSamples">Ghi vào mes_example</button>
        </div>
        <div class="card__body">
          <pre class="result-text selectable">{{ sampleResult }}</pre>
        </div>
      </div>
    </div>

    <!-- Phỏng vấn nhân vật -->
    <div v-if="tab === 'interview'">
      <div class="card mb-md">
        <div class="card__header"><h3>Phỏng vấn nhân vật chuyên sâu</h3></div>
        <div class="card__body">
          <p class="hint mb-md">AI sẽ đóng vai phóng viên phỏng vấn nhân vật, nhân vật trả lời theo đúng tính cách của mình. Dùng để khai thác chiều sâu tính cách, nội dung tạo ra có thể bổ sung vào description hoặc mes_example</p>
          <div class="grid-2">
            <div class="form-group">
              <label>Độ sâu phỏng vấn</label>
              <select class="select" v-model="interviewDepth">
                <option value="light">Nhẹ (5 câu hỏi) — Sở thích thường ngày, thái độ cơ bản</option>
                <option value="medium">Vừa (10 câu hỏi) — Gồm thế giới nội tâm, trải nghiệm quá khứ</option>
                <option value="deep">Sâu (15 câu hỏi) — Gồm suy nghĩ triết học, bí mật, mâu thuẫn</option>
              </select>
            </div>
            <div class="form-group">
              <label>Chủ đề phỏng vấn</label>
              <div style="display:flex;flex-wrap:wrap;gap:8px">
                <label class="toggle-label" v-for="t in interviewTopics" :key="t.value">
                  <input type="checkbox" v-model="selectedTopics" :value="t.value"> {{ t.label }}
                </label>
              </div>
            </div>
          </div>
          <button class="btn btn--primary" style="width:100%" :disabled="generating || !cardStore.cardData.name"
            @click="generateInterview">
            {{ generating ? 'Đang phỏng vấn...' : 'Bắt đầu phỏng vấn nhân vật' }}
          </button>
        </div>
      </div>

      <div v-if="interviewResult" class="card">
        <div class="card__header flex-between">
          <h3>Biên bản phỏng vấn</h3>
          <div class="flex-row">
            <button class="btn btn--secondary btn--sm" @click="injectToDescription">Bổ sung vào description</button>
            <button class="btn btn--primary btn--sm" @click="injectToMesExample">Bổ sung vào mes_example</button>
          </div>
        </div>
        <div class="card__body">
          <pre class="result-text selectable">{{ interviewResult }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useCardStore } from '../stores/card.js';
import { useApiStore } from '../stores/api.js';
import { useAppStore } from '../stores/app.js';

const cardStore = useCardStore();
const apiStore = useApiStore();
const appStore = useAppStore();

const tab = ref('sample');
const generating = ref(false);

// Mẫu đối thoại
const sampleCount = ref(5);
const sampleExtra = ref('');
const sampleResult = ref('');
const selectedScenes = ref(['daily', 'emotion', 'conflict']);
const sceneTypes = [
  { value: 'daily', label: 'Trò chuyện thường nhật' },
  { value: 'emotion', label: 'Tương tác cảm xúc' },
  { value: 'conflict', label: 'Mâu thuẫn xung đột' },
  { value: 'humor', label: 'Hài hước hóm hỉnh' },
  { value: 'serious', label: 'Nghiêm túc trang trọng' },
  { value: 'secret', label: 'Bí mật / Riêng tư' },
  { value: 'action', label: 'Hành động / Chiến đấu' },
  { value: 'romance', label: 'Lãng mạn mập mờ' }
];

// Phỏng vấn nhân vật
const interviewDepth = ref('medium');
const interviewResult = ref('');
const selectedTopics = ref(['personality', 'daily', 'relationship']);
const interviewTopics = [
  { value: 'personality', label: 'Tính cách nội tâm' },
  { value: 'daily', label: 'Thói quen thường nhật' },
  { value: 'relationship', label: 'Quan hệ nhân sinh' },
  { value: 'past', label: 'Trải nghiệm quá khứ' },
  { value: 'dream', label: 'Ước mơ và nỗi sợ' },
  { value: 'philosophy', label: 'Quan điểm giá trị' },
  { value: 'secret', label: 'Bí mật và mâu thuẫn' },
  { value: 'combat', label: 'Năng lực chiến đấu' }
];

async function generateSamples() {
  if (!apiStore.isConfigured) { appStore.toastError('Vui lòng cấu hình API Key trong cài đặt trước'); return; }
  const d = cardStore.cardData;
  if (!d.name) { appStore.toastError('Vui lòng điền tên nhân vật trước'); return; }

  generating.value = true;
  try {
    const scenes = selectedScenes.value.map(v => sceneTypes.find(s => s.value === v)?.label).filter(Boolean);
    const prompt = `Bạn là chuyên gia về mẫu đối thoại của thẻ nhân vật SillyTavern. Hãy tạo ${sampleCount.value} nhóm đối thoại mẫu cho nhân vật sau.

Tên nhân vật: ${d.name}
Tính cách: ${d.personality || '(Chưa điền)'}
Mô tả: ${(d.description || '').slice(0, 500) || '(Chưa điền)'}
Bối cảnh: ${d.scenario || '(Chưa điền)'}

Yêu cầu:
1. Tạo ${sampleCount.value} nhóm đối thoại ở các bối cảnh khác nhau
2. Các loại bối cảnh bao gồm: ${scenes.join('、')}
3. Mỗi nhóm phân cách bằng <START>
4. Sử dụng {{user}} đại diện cho người dùng, {{char}} đại diện cho nhân vật
5. Lời đáp của {{char}} cần kèm miêu tả động tác (bọc trong dấu *sao*) đan xen với lời thoại
6. Mỗi nhóm {{user}} nói 1 câu, {{char}} đáp lại 3-5 câu
7. Thể hiện rõ nét phong cách nói chuyện, đặc trưng tính cách và cử chỉ nhỏ của nhân vật
${sampleExtra.value ? '8. Yêu cầu bổ sung: ' + sampleExtra.value : ''}

Chỉ xuất ra nội dung đối thoại bằng tiếng Việt, không kèm bất kỳ giải thích nào.`;

    const result = await apiStore.chat([
      { role: 'system', content: 'Bạn là chuyên gia viết mẫu đối thoại thẻ nhân vật. Xuất trực tiếp mẫu đối thoại.' },
      { role: 'user', content: prompt }
    ], { temperature: 0.85, maxTokens: apiStore.getModelMaxTokens(apiStore.activeProvider?.model) });

    sampleResult.value = result;
    appStore.toastSuccess('Đã hoàn tất tạo mẫu đối thoại');
  } catch (e) {
    appStore.toastError('Tạo thất bại: ' + e.message);
  } finally { generating.value = false; }
}

async function generateInterview() {
  if (!apiStore.isConfigured) { appStore.toastError('Vui lòng cấu hình API Key trong cài đặt trước'); return; }
  const d = cardStore.cardData;
  if (!d.name) { appStore.toastError('Vui lòng điền tên nhân vật trước'); return; }

  generating.value = true;
  try {
    const topics = selectedTopics.value.map(v => interviewTopics.find(t => t.value === v)?.label).filter(Boolean);
    const qCount = interviewDepth.value === 'light' ? 5 : interviewDepth.value === 'medium' ? 10 : 15;

    const prompt = `Bạn là một phóng viên phỏng vấn nhân vật. Bây giờ bạn sẽ phỏng vấn một nhân vật hư cấu để tìm hiểu sâu về thế giới nội tâm của họ.

Tên nhân vật: ${d.name}
Tính cách đã biết: ${d.personality || '(Chưa điền)'}
Mô tả đã biết: ${(d.description || '').slice(0, 500) || '(Chưa điền)'}
Bối cảnh: ${d.scenario || '(Chưa điền)'}

Hãy thực hiện phỏng vấn với ${qCount} câu hỏi, chủ đề bao quát: ${topics.join('、')}

Yêu cầu định dạng:
- Mỗi lượt hỏi đáp bắt đầu bằng "Q:" cho câu hỏi và "A:" cho câu trả lời
- Nhân vật trả lời phải giữ trọn vẹn tính cách và cách nói chuyện của mình
- Câu trả lời kèm miêu tả động tác (bọc trong dấu *sao*)
- Lời đáp tự nhiên chân thực như một buổi phỏng vấn thực thụ
- Qua các câu trả lời, khai thác những thông tin mới chưa có trong description (thói quen nhỏ, suy nghĩ ẩn giấu, khía cạnh ít ai biết)
- Các câu hỏi nâng cao dần mức độ sâu sắc từ nhẹ nhàng đến riêng tư

Chỉ xuất ra nội dung phỏng vấn bằng tiếng Việt.`;

    const result = await apiStore.chat([
      { role: 'system', content: 'Bạn là phóng viên phỏng vấn nhân vật chuyên nghiệp. Chỉ xuất nội dung phỏng vấn.' },
      { role: 'user', content: prompt }
    ], { temperature: 0.9, maxTokens: apiStore.getModelMaxTokens(apiStore.activeProvider?.model) });

    interviewResult.value = result;
    appStore.toastSuccess('Đã hoàn tất phỏng vấn nhân vật');
  } catch (e) {
    appStore.toastError('Phỏng vấn thất bại: ' + e.message);
  } finally { generating.value = false; }
}

function injectSamples() {
  if (!sampleResult.value) return;
  const existing = cardStore.cardData.mes_example || '';
  cardStore.cardData.mes_example = existing + (existing ? '\n\n' : '') + sampleResult.value;
  cardStore.markDirty();
  appStore.toastSuccess('Đã ghi vào mes_example');
}

function injectToDescription() {
  if (!interviewResult.value) return;
  const existing = cardStore.cardData.description || '';
  cardStore.cardData.description = existing + (existing ? '\n\n' : '') + '【Bổ sung từ phỏng vấn nhân vật】\n' + interviewResult.value;
  cardStore.markDirty();
  appStore.toastSuccess('Đã bổ sung vào description');
}

function injectToMesExample() {
  if (!interviewResult.value) return;
  const lines = interviewResult.value.split('\n');
  let converted = '';
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('Q:') || trimmed.startsWith('Q：')) {
      converted += '\n<START>\n{{user}}: ' + trimmed.replace(/^Q[：:]\s*/, '') + '\n';
    } else if (trimmed.startsWith('A:') || trimmed.startsWith('A：')) {
      converted += '{{char}}: ' + trimmed.replace(/^A[：:]\s*/, '') + '\n';
    } else if (trimmed && converted) {
      converted += trimmed + '\n';
    }
  }
  const existing = cardStore.cardData.mes_example || '';
  cardStore.cardData.mes_example = existing + (existing ? '\n' : '') + converted.trim();
  cardStore.markDirty();
  appStore.toastSuccess('Đã chuyển đổi và ghi vào mes_example');
}
</script>

<style scoped>
.toggle-label {
  display: flex; align-items: center; gap: 6px;
  font-size: 12px; cursor: pointer; color: var(--cf-text-secondary);
  input { accent-color: var(--cf-accent); }
}
.result-text {
  font-size: 13px; line-height: 1.8; color: var(--cf-text-primary);
  white-space: pre-wrap; word-wrap: break-word;
  font-family: var(--cf-font); background: none; border: none; margin: 0;
  max-height: 500px; overflow-y: auto;
}
</style>