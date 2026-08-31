<template>
  <div class="page">
    <div class="page__header">
      <h1>Lời mở đầu</h1>
      <p>Thiết kế tin nhắn đầu tiên của nhân vật — Câu chuyện bắt đầu từ đây</p>
    </div>

    <!-- AI tạo lời mở đầu -->
    <div class="card mb-md">
      <div class="card__header"><h3>AI tạo lời mở đầu</h3></div>
      <div class="card__body">
        <button class="btn-gold" style="width:100%;margin-bottom:12px;padding:10px" :disabled="aiGenerating || !store.cardData.name"
          @click="autoGenerateGreeting">
          {{ aiGenerating ? 'Đang tạo tự động...' : 'AI tạo tự động hoàn toàn' }}
        </button>
        <div class="grid-2">
          <div class="form-group">
            <label>Phong cách mở đầu</label>
            <select class="select" v-model="greetingStyle">
              <option value="narrative">Văn phong tự sự (Đời thường / Học đường)</option>
              <option value="atmosphere">Tự sự bầu không khí (Có thế giới quan)</option>
              <option value="event">Nhập vai tình huống (Mở đầu biến cố mạnh)</option>
              <option value="menu">Dạng menu / Hệ thống (Nhiều lựa chọn)</option>
            </select>
          </div>
          <div class="form-group">
            <label>Dung lượng</label>
            <select class="select" v-model="greetingLength">
              <option value="short">Ngắn (300-500 từ)</option>
              <option value="medium">Tiêu chuẩn (500-800 từ)</option>
              <option value="long">Chi tiết (800-1500 từ)</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label>Yêu cầu bổ sung</label>
          <input class="input" v-model="greetingExtra" placeholder="VD: Cần có bầu không khí trời mưa, nhân vật đang nấu ăn, mở đầu bằng cảnh giao tranh...">
        </div>

        <!-- Tùy chọn làm đẹp -->
        <div class="form-group" style="border-top:1px solid var(--cf-border);padding-top:12px;margin-top:8px">
          <label class="toggle-label mb-md">
            <input type="checkbox" v-model="autoBeautify"> Tự động làm đẹp sang HTML sau khi tạo
          </label>
          <div v-if="autoBeautify">
            <div class="flex-row mb-md" style="flex-wrap:wrap;gap:4px">
              <button class="btn btn--ghost btn--sm" @click="beautifyReq = 'Phong cách thẻ tối màu bán trong suốt, bo góc, nền gradient'">Thẻ tối màu</button>
              <button class="btn btn--ghost btn--sm" @click="beautifyReq = 'Phong cách Cyberpunk, màu neon, viền phát sáng, font monospace'">Cyberpunk</button>
              <button class="btn btn--ghost btn--sm" @click="beautifyReq = 'Phong cách thủy mặc cổ phong, nền màu giấy tuyên, font nét cọ, trang trí ấn triện'">Thủy mặc cổ phong</button>
              <button class="btn btn--ghost btn--sm" @click="beautifyReq = 'Phong cách học đường tươi sáng, nền màu sáng, thẻ bo góc, phối màu dịu mắt'">Học đường tươi sáng</button>
              <button class="btn btn--ghost btn--sm" @click="beautifyReq = 'Phong cách kỳ ảo phiêu lưu, nền giấy da cừu, viền vàng kim, font thời Trung cổ'">Kỳ ảo phiêu lưu</button>
            </div>
            <input class="input" v-model="beautifyReq" placeholder="Hoặc yêu cầu phong cách làm đẹp tùy chỉnh...">
          </div>
        </div>

        <button class="btn-gold btn-gold--regen" style="width:100%;padding:10px" :disabled="aiGenerating || !store.cardData.name"
          @click="generateGreeting">
          {{ aiGenerating ? 'Đang tạo...' : 'AI tạo lời mở đầu' }}
        </button>

        <!-- Xem trước bản tạo -->
        <div v-if="greetingPreview" class="greeting-preview mt-md">
          <div class="flex-between mb-md">
            <span style="font-size:13px;color:var(--cf-text-muted)">Xem trước bản tạo · {{ greetingPreview.length }} từ</span>
            <div class="flex-row">
              <button class="btn-gold" @click="applyGreetingPreview">Chọn bản này</button>
              <button class="btn-gold btn-gold--regen" @click="lastGenMode === 'auto' ? autoGenerateGreeting() : generateGreeting()" :disabled="aiGenerating">
                {{ aiGenerating ? 'Đang tạo...' : 'Tạo lại' }}
              </button>
            </div>
          </div>
          <pre class="greeting-preview__text selectable">{{ greetingPreview }}</pre>
        </div>

        <!-- Xem trước làm đẹp -->
        <div v-if="showHtmlPreview && htmlPreview" class="html-preview mt-md">
          <div class="card__header flex-between">
            <span style="font-size:12px;color:var(--cf-text-muted)">Xem trước làm đẹp HTML</span>
            <div class="flex-row">
              <button class="btn-gold" @click="applyHtml">Chọn bản này</button>
              <button class="btn-gold btn-gold--regen" @click="beautifyGreeting" :disabled="beautifying">
                {{ beautifying ? 'Đang tạo...' : 'Tạo lại' }}
              </button>
            </div>
          </div>
          <iframe class="html-render-iframe" :srcdoc="htmlPreview" sandbox="allow-same-origin"></iframe>
          <details class="mt-md">
            <summary style="font-size:12px;color:var(--cf-text-muted);cursor:pointer">Xem mã nguồn HTML</summary>
            <pre class="html-source selectable">{{ htmlPreview }}</pre>
          </details>
        </div>
      </div>
    </div>

    <!-- Lời mở đầu chính -->
    <div class="card mb-md">
      <div class="card__header flex-between">
        <div class="flex-row">
          <h3>Lời mở đầu chính (first_mes)</h3>
          <span class="badge badge--danger">Bắt buộc</span>
        </div>
      </div>
      <div class="card__body">
        <textarea class="textarea" v-model="d.first_mes" rows="14"
          placeholder="Tin nhắn đầu tiên của nhân vật. Miêu tả bối cảnh, trạng thái nhân vật, mở ra gợi ý để người dùng tiếp lời." @input="store.markDirty()"></textarea>
        <div class="hint">
          Số từ: {{ (d.first_mes || '').length }} | Token ước tính: ~{{ Math.round((d.first_mes || '').length * 1.3) }}<br>
          Gợi ý: Nếu dùng hệ thống biến MVU, hãy thêm &lt;StatusPlaceHolderImpl/&gt; ở cuối lời mở đầu để thanh trạng thái hiển thị.<br>
          Gợi ý: Có thể dùng tag &lt;initvar&gt; trong lời mở đầu để thiết lập giá trị biến khởi tạo riêng cho bối cảnh mở màn này, ghi đè giá trị mặc định trong Worldbook.
        </div>
      </div>
    </div>

    <!-- Lời mở đầu dự phòng -->
    <div class="card mb-md">
      <div class="card__header flex-between">
        <h3>Lời mở đầu dự phòng (alternate_greetings)</h3>
        <button class="btn btn--primary btn--sm" @click="store.addGreeting()">+ Thêm lời mở đầu</button>
      </div>
      <div class="card__body">
        <p class="hint mb-md">Nhiều lời mở đầu giúp người dùng lựa chọn các hướng bắt đầu câu chuyện khác nhau (vuốt trái phải để chuyển đổi)</p>

        <div v-if="(d.alternate_greetings || []).length === 0" class="empty-state" style="padding:30px">
          <div class="empty-state__icon"></div>
          <div class="empty-state__title">Chưa có lời mở đầu dự phòng</div>
          <div class="empty-state__desc">Có thể thiết lập lời mở đầu cho các bối cảnh, giai đoạn quan hệ khác nhau</div>
        </div>

        <div v-for="(g, i) in d.alternate_greetings" :key="i" class="greeting-item mb-md">
          <div class="flex-between mb-md">
            <span class="badge badge--info">Lời mở đầu {{ i + 2 }}</span>
            <button class="btn btn--danger btn--sm" @click="appStore.confirmAction('Xóa lời mở đầu này?', () => store.removeGreeting(i))">Xóa</button>
          </div>
          <textarea class="textarea" v-model="d.alternate_greetings[i]" rows="10"
            placeholder="Nội dung lời mở đầu dự phòng" @input="store.markDirty()"></textarea>
          <div class="hint">Số từ: {{ (g || '').length }}</div>
        </div>
      </div>
    </div>

    <!-- Chế độ thay thế trang chủ -->
    <div class="card">
      <div class="card__header flex-between">
        <h3>Chế độ thay thế trang chủ</h3>
        <span class="badge badge--info">Nâng cao</span>
      </div>
      <div class="card__body">
        <p class="hint mb-md">
          Cách dùng nâng cao: first_mes chỉ viết một tag (VD: "【Trang chủ】"), script Regex sẽ thay thế nó thành trang chủ HTML hoàn chỉnh.<br>
          Nhấp nút bên dưới để thiết lập 1 chạm.
        </p>
        <div class="form-group">
          <label>Nội dung HTML trang chủ</label>
          <textarea class="textarea" v-model="homepageHtml" rows="6"
            placeholder="Dán hoặc viết mã HTML trang chủ của bạn... hoặc nhấp AI tạo bên dưới"></textarea>
        </div>
        <div class="flex-row">
          <button class="btn btn--secondary btn--sm" @click="aiGenerateHomepage" :disabled="aiGenerating">
            {{ aiGenerating ? 'Đang tạo...' : 'AI tạo HTML trang chủ' }}
          </button>
          <button class="btn btn--primary btn--sm" @click="applyHomepageMode" :disabled="!homepageHtml">
            Áp dụng chế độ thay thế trang chủ
          </button>
        </div>
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

const store = useCardStore();
const apiStore = useApiStore();
const appStore = useAppStore();
const d = computed(() => store.cardData);

const homepageHtml = ref('');
const beautifying = ref(false);
const htmlPreview = ref('');
const showHtmlPreview = ref(false);
const aiGenerating = ref(false);
const greetingStyle = ref('narrative');
const greetingLength = ref('medium');
const greetingExtra = ref('');
const beautifyReq = ref('');
const greetingPreview = ref('');
const lastGenMode = ref('auto');
const autoBeautify = ref(false);

async function autoGenerateGreeting() {
  if (!apiStore.isConfigured) { appStore.toastError('Vui lòng cấu hình API Key trong cài đặt trước'); return; }
  if (!store.cardData.name) { appStore.toastError('Vui lòng điền tên nhân vật trong thông tin cơ bản trước'); return; }

  aiGenerating.value = true;
  try {
    const context = buildCardContext(store, '', { modelContextTokens: apiStore.getModelContextTokens(apiStore.activeProvider?.model) });
    const prompt = `Bạn là chuyên gia viết lời mở đầu cho thẻ nhân vật SillyTavern. Hãy dựa trên thông tin thẻ nhân vật sau để tự động phán đoán phong cách và dung lượng phù hợp nhất, tạo ra một đoạn lời mở đầu chất lượng cao.

【Thông tin thẻ nhân vật】
${context}

Yêu cầu:
- Tự động chọn phong cách phù hợp nhất theo loại thẻ nhân vật (văn phong tự sự / bầu không khí / tình huống / menu hệ thống)
- Dung lượng 500-800 từ
- Bao gồm 3 yếu tố: Bối cảnh (ở đâu, thời gian nào), Nhân vật (đang làm gì), Điểm gợi mở (mở ra cơ hội để người dùng tiếp lời)
- Sử dụng {{user}} đại diện cho người dùng, {{char}} đại diện cho nhân vật
- Miêu tả động tác biểu cảm bọc trong dấu *sao*

Chỉ xuất ra nội dung lời mở đầu, không kèm bất kỳ giải thích nào.`;

    const result = await apiStore.chat([
      { role: 'system', content: 'Bạn là chuyên gia viết lời mở đầu cho thẻ nhân vật. Xuất trực tiếp lời mở đầu bằng tiếng Việt, không kèm giải thích.' },
      { role: 'user', content: prompt }
    ], { temperature: 0.85, maxTokens: apiStore.getModelMaxTokens(apiStore.activeProvider?.model) });

    greetingPreview.value = result;
    lastGenMode.value = 'auto';
    appStore.toastSuccess('Lời mở đầu đã được tạo, vui lòng xem trước rồi nhấp "Chọn bản này" để áp dụng');
  } catch (e) {
    appStore.toastError('Tạo thất bại: ' + e.message);
  } finally { aiGenerating.value = false; }
}

async function generateGreeting() {
  if (!apiStore.isConfigured) { appStore.toastError('Vui lòng cấu hình API Key trong cài đặt trước'); return; }
  if (!store.cardData.name) { appStore.toastError('Vui lòng điền tên nhân vật trong thông tin cơ bản trước'); return; }

  aiGenerating.value = true;
  try {
    const context = buildCardContext(store, '', { modelContextTokens: apiStore.getModelContextTokens(apiStore.activeProvider?.model) });
    const styleDesc = {
      narrative: 'Văn phong tự sự — Dùng ngôn ngữ như văn xuôi để miêu tả bối cảnh và nhân vật, trực tiếp đưa người dùng vào câu chuyện',
      atmosphere: 'Tự sự bầu không khí — Miêu tả nhiều chi tiết môi trường để tạo cảm giác không gian và chiều sâu thế giới',
      event: 'Nhập vai tình huống — Mở đầu bằng một biến cố hoặc tình huống tương phản mạnh mẽ để tạo sự tò mò',
      menu: 'Dạng menu / Hệ thống — Hiển thị các tùy chọn hoặc giao diện hệ thống, phù hợp cốt truyện phân nhánh'
    };
    const lenDesc = { short: '300-500 từ', medium: '500-800 từ', long: '800-1500 từ' };

    const prompt = `Bạn là chuyên gia viết lời mở đầu cho thẻ nhân vật SillyTavern. Hãy tạo lời mở đầu dựa trên thông tin thẻ nhân vật sau.

【Thông tin thẻ nhân vật hiện có】
${context}

【Yêu cầu lời mở đầu】
- Phong cách: ${styleDesc[greetingStyle.value]}
- Dung lượng: ${lenDesc[greetingLength.value]}
- Lời mở đầu chuẩn cần có 3 yếu tố: Bối cảnh (ở đâu, thời gian nào), Nhân vật (đang làm gì), Điểm gợi mở (gợi ý để người dùng tiếp lời)
- Sử dụng {{user}} đại diện cho người dùng, {{char}} đại diện cho nhân vật
- Miêu tả động tác biểu cảm bọc trong dấu *sao*
${greetingExtra.value ? '- Yêu cầu bổ sung: ' + greetingExtra.value : ''}

Chỉ xuất ra nội dung lời mở đầu, không kèm bất kỳ giải thích nào.`;

    const result = await apiStore.chat([
      { role: 'system', content: 'Bạn là chuyên gia viết lời mở đầu cho thẻ nhân vật. Xuất trực tiếp lời mở đầu bằng tiếng Việt, không kèm giải thích.' },
      { role: 'user', content: prompt }
    ], { temperature: 0.85, maxTokens: apiStore.getModelMaxTokens(apiStore.activeProvider?.model) });

    greetingPreview.value = result;
    lastGenMode.value = 'custom';
    appStore.toastSuccess('Lời mở đầu đã được tạo, vui lòng xem trước rồi nhấp "Chọn bản này" để áp dụng');
  } catch (e) {
    appStore.toastError('Tạo thất bại: ' + e.message);
  } finally { aiGenerating.value = false; }
}

function applyGreetingPreview() {
  if (!greetingPreview.value) return;
  d.value.first_mes = greetingPreview.value;
  store.markDirty();
  greetingPreview.value = '';

  if (autoBeautify.value) {
    appStore.toastSuccess('Đã điền vào lời mở đầu chính, bắt đầu tự động làm đẹp...');
    beautifyGreeting();
  } else {
    appStore.toastSuccess('Đã điền vào lời mở đầu chính');
  }
}

async function beautifyGreeting() {
  if (!apiStore.isConfigured) { appStore.toastError('Vui lòng cấu hình API Key trong cài đặt trước'); return; }
  if (!d.value.first_mes) { appStore.toastError('Vui lòng viết lời mở đầu trước'); return; }

  beautifying.value = true;
  try {
    const prompt = `Bạn là nhà thiết kế frontend HTML/CSS. Hãy chuyển đổi lời mở đầu dạng văn bản thuần sau đây thành giao diện HTML đẹp mắt.

Lời mở đầu gốc:
${d.value.first_mes}

Yêu cầu:
1. Dùng HTML + CSS nội tuyến để làm đẹp, tạo ra một đoạn HTML độc lập
2. Phong cách thiết kế: ${beautifyReq.value || 'Tông màu tối, bán trong suốt, thẻ bo góc, nền gradient'}
3. Lời đối thoại dùng phong cách dấu ngoặc kép nổi bật, miêu tả động tác dùng chữ nghiêng
4. Miêu tả bối cảnh dùng chữ nhỏ màu xám nhạt
5. Có thể thêm đường phân cách, biểu tượng trang trí
6. Toàn bộ CSS dùng style nội tuyến hoặc thẻ <style>, không tham chiếu tài nguyên bên ngoài
7. Giữ nguyên toàn bộ nội dung văn bản gốc, chỉ làm đẹp bố cục và định dạng
8. Chiều rộng tự co giãn, nền bán trong suốt

Chỉ xuất ra mã HTML, không có bất kỳ văn bản giải thích nào khác.`;

    const result = await apiStore.chat([
      { role: 'system', content: 'Bạn là nhà thiết kế frontend chuyên nghiệp. Chỉ xuất ra mã HTML.' },
      { role: 'user', content: prompt }
    ], { temperature: 0.7, maxTokens: apiStore.getModelMaxTokens(apiStore.activeProvider?.model) });

    let html = result;
    const codeMatch = result.match(/```html?\s*([\s\S]*?)```/);
    if (codeMatch) html = codeMatch[1];

    htmlPreview.value = html.trim();
    showHtmlPreview.value = true;
    appStore.toastSuccess('Làm đẹp HTML hoàn tất, vui lòng xem trước để xác nhận');
  } catch (e) {
    appStore.toastError('Làm đẹp thất bại: ' + e.message);
  } finally { beautifying.value = false; }
}

function applyHtml() {
  if (!htmlPreview.value) return;
  d.value.first_mes = htmlPreview.value;
  store.markDirty();
  showHtmlPreview.value = false;
  htmlPreview.value = '';
  appStore.toastSuccess('Đã thay thế bằng phiên bản HTML');
}

async function aiGenerateHomepage() {
  if (!apiStore.isConfigured) { appStore.toastError('Vui lòng cấu hình API Key trong cài đặt trước'); return; }
  aiGenerating.value = true;
  try {
    const context = buildCardContext(store, '', { modelContextTokens: apiStore.getModelContextTokens(apiStore.activeProvider?.model) });
    const result = await apiStore.chat([
      { role: 'system', content: 'Bạn là nhà thiết kế frontend. Tạo giao diện trang chủ thẻ nhân vật theo phong cách kính mờ, tối màu, bán trong suốt. Chỉ xuất ra mã HTML.' },
      { role: 'user', content: `Dựa trên thông tin thẻ nhân vật sau, hãy tạo giao diện trang chủ HTML đẹp mắt.\n\n${context}\n\nYêu cầu:\n1. Nền tối màu bán trong suốt, thẻ bo góc, màu gradient\n2. Hiển thị tên thẻ nhân vật, tóm tắt giới thiệu, khu vực nút chức năng\n3. Toàn bộ CSS viết nội tuyến, không tham chiếu tài nguyên ngoài\n4. Chiều rộng tự co giãn\n5. Chỉ xuất ra mã HTML` }
    ], { temperature: 0.7, maxTokens: apiStore.getModelMaxTokens(apiStore.activeProvider?.model) });
    let html = result;
    const m = result.match(/```html?\s*([\s\S]*?)```/);
    if (m) html = m[1];
    homepageHtml.value = html.trim();
    appStore.toastSuccess('Đã tạo mã HTML trang chủ');
  } catch (e) {
    appStore.toastError('Tạo thất bại: ' + e.message);
  } finally { aiGenerating.value = false; }
}

function applyHomepageMode() {
  if (!homepageHtml.value) return;
  d.value.first_mes = '【Trang chủ】';
  store.addRegexScript({
    ...store.createEmptyRegexScript(),
    scriptName: 'Thay thế trang chủ',
    findRegex: '/【Trang chủ】|【首页】/g',
    replaceString: homepageHtml.value,
    markdownOnly: true,
    promptOnly: false,
    maxDepth: 1
  });
  store.addRegexScript({
    ...store.createEmptyRegexScript(),
    scriptName: '[Dọn dẹp] Tag trang chủ',
    findRegex: '/【Trang chủ】|【首页】/g',
    replaceString: '',
    markdownOnly: false,
    promptOnly: true
  });
  store.markDirty();
  appStore.toastSuccess('Đã áp dụng chế độ thay thế trang chủ: first_mes="【Trang chủ】" + 2 script Regex');
}
</script>

<style scoped>
.toggle-label {
  display: flex; align-items: center; gap: 6px;
  font-size: 13px; cursor: pointer; color: var(--cf-text-secondary);
  input { accent-color: var(--cf-accent); }
}
.html-preview {
  background: rgba(0, 0, 0, 0.15);
  border: 1px solid var(--cf-border);
  border-radius: var(--cf-radius-sm);
  padding: var(--cf-gap-md);
}
.html-render-iframe {
  width: 100%;
  height: 500px;
  border: 1px solid var(--cf-border);
  border-radius: var(--cf-radius-sm);
  background: rgba(0, 0, 0, 0.2);
  display: block;
}
.html-source {
  font-size: 11px;
  font-family: var(--cf-font-mono);
  line-height: 1.5;
  white-space: pre-wrap;
  word-wrap: break-word;
  color: var(--cf-text-secondary);
  max-height: 300px;
  overflow-y: auto;
  margin-top: 8px;
}
.greeting-item {
  background: rgba(0, 0, 0, 0.1);
  border: 1px solid var(--cf-border);
  border-radius: var(--cf-radius-sm);
  padding: var(--cf-gap-md);
}
.greeting-preview {
  background: rgba(0, 0, 0, 0.12);
  border: 1px solid rgba(255, 215, 0, 0.25);
  border-radius: var(--cf-radius-sm);
  padding: var(--cf-gap-md);
}
.greeting-preview__text {
  font-family: var(--cf-font);
  font-size: 13px;
  line-height: 1.8;
  color: var(--cf-text-primary);
  white-space: pre-wrap;
  word-wrap: break-word;
  background: none;
  border: none;
  margin: 0;
  max-height: 400px;
  overflow-y: auto;
}
</style>