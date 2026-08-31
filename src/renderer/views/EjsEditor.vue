<template>
  <div class="page">
    <div class="page__header flex-between">
      <div>
        <h1>Trình chỉnh sửa mẫu EJS</h1>
        <p>Viết mã mẫu EJS, giúp các mục Worldbook thay đổi linh hoạt theo biến số</p>
      </div>
      <div class="flex-row">
        <div class="ejs-dropdown">
          <button class="btn btn--accent btn--sm">Tính năng AI ▾</button>
          <div class="ejs-dropdown__menu">
            <button @click="autoGenEjs" :disabled="aiGenerating">{{ aiGenerating ? 'Đang tạo...' : 'AI tạo EJS' }}</button>
            <button @click="showGroupPanel = !showGroupPanel; showEmbedPanel = false">{{ showGroupPanel ? 'Đóng nhóm' : 'Công tắc nhóm' }}</button>
            <button @click="showEmbedPanel = !showEmbedPanel; showGroupPanel = false">{{ showEmbedPanel ? 'Đóng nhúng' : 'AI nhúng điều kiện' }}</button>
          </div>
        </div>
        <div class="ejs-dropdown">
          <button class="btn btn--secondary btn--sm">Chèn mã ▾</button>
          <div class="ejs-dropdown__menu">
            <button @click="insertSnippet('if')">Điều kiện if / else</button>
            <button @click="insertSnippet('getvar')">Đọc biến bằng getvar</button>
            <button @click="insertSnippet('preprocessing')">@@preprocessing</button>
          </div>
        </div>
        <button class="btn btn--primary btn--sm" @click="renderPreview">▶ Xem trước</button>
      </div>
    </div>

    <div class="card mb-md">
      <div class="card__body hint" style="line-height:1.8">
        <strong style="color:var(--cf-text-primary)">EJS dùng để làm gì?</strong><br>
        EJS cho phép bạn viết mã logic bên trong nội dung của mục Worldbook, <strong>công dụng chính là tạo văn bản linh hoạt theo biến số</strong>.<br>
        · <strong>Tình huống 1</strong>: Độ hảo cảm &lt; 30 hiển thị "NPC lạnh lùng quay đầu đi", &gt;= 80 hiển thị "NPC thân mật lại gần"<br>
        · <strong>Tình huống 2</strong>: Xuất ra mô tả môi trường khác nhau dựa trên biến "Vị trí hiện tại"<br>
        · <strong>Tình huống 3</strong>: Dùng <code>activateWorldEntry()</code> / <code>deactivateWorldEntry()</code> để bật tắt các mục khác (đây chỉ là một trong các cách dùng)<br>
        <br>
        <strong style="color:var(--cf-text-primary)">"Xem trước" dùng để làm gì?</strong><br>
        Mã EJS bạn viết = một đoạn chương trình nhỏ xuất ra văn bản. Xem trước là việc chạy đoạn mã này với "giá trị biến giả lập" do bạn đặt, giúp bạn thấy được <strong>văn bản xuất ra trông như thế nào</strong>, đảm bảo logic chuẩn xác trước khi tiêm vào Worldbook.<br>
        <br>
        · <strong>Cột trái</strong>: Viết mã EJS + Thiết lập biến giả lập<br>
        · <strong>Cột phải</strong>: Nhấp "Xem trước" xem văn bản kết xuất, xác nhận xong nhấp "Tiêm vào Worldbook"<br>
        · <strong>Chưa biết viết?</strong> Nhấp "AI tạo EJS" để AI tự động tạo mẫu EJS dựa trên thẻ nhân vật<br>
        · <strong>Không cần dùng EJS?</strong> Thẻ nhân vật đơn giản không cần tính năng này, chỉ dùng khi muốn nội dung Worldbook biến đổi theo dữ liệu
      </div>
    </div>

    <!-- Bảng công tắc nhóm -->
    <div v-if="showGroupPanel" class="card mb-md">
      <div class="card__header flex-between">
        <h3>Quản lý công tắc nhóm</h3>
        <div class="flex-row">
          <button class="btn btn--accent btn--sm" @click="aiAutoGroup" :disabled="aiGrouping">
            {{ aiGrouping ? 'AI đang phân tích...' : 'AI tự động chia nhóm' }}
          </button>
          <button class="btn btn--primary btn--sm" @click="addSwitchGroup">+ Tạo nhóm thủ công</button>
        </div>
      </div>
      <div class="card__body">
        <p class="hint mb-md">
          Gộp các mục Worldbook theo nhóm, tự động tạo mục công tắc <code>getwi()</code>. Khi bật công tắc, nội dung của nhóm đó sẽ được nạp; khi tắt sẽ không nạp. Phù hợp cho các thẻ có nhiều cảnh quan / chuyển đổi khu vực.
        </p>

        <div v-if="switchGroups.length === 0" class="empty-state" style="padding:24px">
          <div class="empty-state__title">Chưa có nhóm nào</div>
          <div class="empty-state__desc">Nhấp "Tạo nhóm thủ công" để bắt đầu tạo công tắc nội dung</div>
        </div>

        <div v-for="(group, gi) in switchGroups" :key="gi" class="switch-group mb-md">
          <div class="switch-group__header">
            <div class="flex-row" style="flex:1">
              <input class="input" v-model="group.name" placeholder="Tên nhóm (VD: Khu vực ngục tối, Bối cảnh tiên giới)" style="width:260px;font-weight:600">
              <label class="toggle-label">
                <input type="checkbox" v-model="group.enabled"> Bật mặc định
              </label>
            </div>
            <div class="flex-row">
              <button class="btn btn--primary btn--sm" @click="generateSwitchEntry(gi)">Tạo mục công tắc</button>
              <button class="btn btn--danger btn--sm" @click="switchGroups.splice(gi, 1)">Xóa nhóm</button>
            </div>
          </div>

          <!-- Lựa chọn mục -->
          <div class="switch-group__body">
            <div class="switch-group__search">
              <input class="input" v-model="group.search" placeholder="Tìm kiếm mục..." style="width:100%">
            </div>
            <div class="switch-group__entries">
              <label v-for="entry in filteredEntriesForGroup(group)" :key="entry.id" class="switch-entry-item">
                <input type="checkbox" :checked="group.entryIds.includes(entry.id)"
                  @change="toggleGroupEntry(group, entry.id)">
                <span class="switch-entry-item__name">{{ entry.comment || '(Chưa đặt tên)' }}</span>
                <span class="switch-entry-item__hint">{{ (entry.content || '').length }} từ</span>
              </label>
              <div v-if="filteredEntriesForGroup(group).length === 0" class="hint" style="text-align:center;padding:16px">
                {{ cardStore.worldEntries.length === 0 ? 'Worldbook không có mục nào' : 'Không có mục phù hợp' }}
              </div>
            </div>
            <div class="hint" style="margin-top:6px">Đã chọn {{ group.entryIds.length }} mục</div>
          </div>

          <!-- Xem trước -->
          <div v-if="group.preview" class="switch-group__preview">
            <div class="flex-between" style="margin-bottom:6px">
              <span class="badge badge--accent">Xem trước mục công tắc được tạo</span>
              <button class="btn btn--ghost btn--sm" @click="group.preview = ''">Đóng xem trước</button>
            </div>
            <pre class="code-preview selectable" style="font-size:11px;max-height:200px;overflow-y:auto">{{ group.preview }}</pre>
          </div>
        </div>
      </div>
    </div>

    <!-- Bảng AI tự động nhúng điều kiện EJS -->
    <div v-if="showEmbedPanel" class="card mb-md">
      <div class="card__header flex-between">
        <h3>AI tự động nhúng điều kiện EJS</h3>
        <button class="btn btn--accent btn--sm" @click="aiEmbedEjs" :disabled="aiEmbedding">
          {{ aiEmbedding ? 'AI đang phân tích...' : 'Bắt đầu phân tích' }}
        </button>
      </div>
      <div class="card__body">
        <p class="hint mb-md">
          AI phân tích các mục Worldbook và biến MVU hiện có, tự động chèn các nhánh điều kiện EJS vào nội dung mục phù hợp. Không tạo mục mới mà chỉnh sửa trực tiếp trường content của mục sẵn có.
        </p>

        <div v-if="embedResults.length === 0 && !aiEmbedding" class="empty-state" style="padding:24px">
          <div class="empty-state__title">Nhấp "Bắt đầu phân tích"</div>
          <div class="empty-state__desc">AI sẽ phân tích xem mục nào phù hợp để thêm nhánh điều kiện và tạo phương án sửa đổi để bạn xác nhận</div>
        </div>

        <!-- Thanh tiến trình -->
        <div v-if="aiEmbedding" class="embed-progress">
          <div class="embed-progress__bar">
            <div class="embed-progress__fill" :style="{ width: embedProgress + '%' }"></div>
          </div>
          <div class="embed-progress__text">Đang phân tích các mục...</div>
        </div>

        <!-- Xem trước phương án sửa đổi -->
        <div v-if="embedResults.length > 0" class="mt-md">
          <div class="flex-between mb-md">
            <span class="badge badge--accent">Tìm thấy {{ embedResults.length }} mục có thể nhúng điều kiện</span>
            <div class="flex-row">
              <button class="btn btn--primary btn--sm" @click="applyEmbedResults">Áp dụng thay đổi đã chọn</button>
              <button class="btn btn--ghost btn--sm" @click="embedResults.forEach(r => r.selected = !r.selected)">Đảo chọn tất cả</button>
            </div>
          </div>

          <div v-for="(result, i) in embedResults" :key="i" class="embed-result mb-md">
            <div class="embed-result__header">
              <input type="checkbox" v-model="result.selected">
              <span class="embed-result__name">{{ result.comment }}</span>
            </div>
            <div class="embed-result__diff">
              <div class="embed-result__before">
                <div class="embed-result__label">Trước khi sửa</div>
                <pre>{{ result.originalContent.slice(0, 300) }}{{ result.originalContent.length > 300 ? '...' : '' }}</pre>
              </div>
              <div class="embed-result__after">
                <div class="embed-result__label">Sau khi sửa</div>
                <pre>{{ result.newContent.slice(0, 400) }}{{ result.newContent.length > 400 ? '...' : '' }}</pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="ejs-layout">
      <!-- Cột trái: Mã nguồn + Biến giả lập -->
      <div class="ejs-left">
        <!-- Soạn thảo mã EJS -->
        <div class="card mb-md">
          <div class="card__header">
            <h3>Mã EJS</h3>
            <span class="badge badge--info">{{ (ejsCode || '').length }} ký tự</span>
          </div>
          <div class="card__body">
            <textarea class="textarea selectable ejs-code" v-model="ejsCode" rows="16"
              placeholder="Viết mã mẫu EJS tại đây...&#10;&#10;Ví dụ:&#10;&lt;%_ const favor = Number(getvar('stat_data.NPC.Độ hảo cảm')) || 0; _%&gt;&#10;&#10;&lt;%_ if (favor >= 80) { _%&gt;&#10;NPC vô cùng tin tưởng {{user}}, sẽ chủ động chia sẻ bí mật.&#10;&lt;%_ } else if (favor >= 40) { _%&gt;&#10;NPC có thiện cảm với {{user}}, sẵn sàng cùng hành động.&#10;&lt;%_ } else { _%&gt;&#10;NPC giữ thái độ lạnh nhạt với {{user}}, duy trì khoảng cách.&#10;&lt;%_ } _%&gt;"></textarea>
          </div>
        </div>

        <!-- Biến giả lập -->
        <div class="card">
          <div class="card__header flex-between">
            <h3>Biến giả lập</h3>
            <button class="btn btn--secondary btn--sm" @click="addVariable">+ Thêm biến</button>
          </div>
          <div class="card__body">
            <p class="hint mb-md">Thiết lập giá trị biến giả lập để xem trước kết quả trả về của getvar() trong EJS</p>
            <div v-for="(v, i) in mockVars" :key="i" class="ejs-var-row">
              <input class="input" v-model="v.path" placeholder="Đường dẫn biến, VD: stat_data.NPC.Độ hảo cảm" style="flex:2">
              <input class="input" v-model="v.value" placeholder="Giá trị, VD: 85" style="flex:1">
              <select class="select" v-model="v.type" style="width:90px">
                <option value="string">Văn bản</option>
                <option value="number">Số</option>
                <option value="boolean">Boolean</option>
                <option value="json">JSON</option>
              </select>
              <button class="btn btn--danger btn--sm" @click="mockVars.splice(i, 1)">×</button>
            </div>
            <div v-if="mockVars.length === 0" class="hint" style="text-align:center;padding:12px">
              Chưa có biến giả lập, nhấp "+ Thêm biến" ở trên
            </div>

            <!-- Mẫu preset -->
            <div class="divider"></div>
            <div class="flex-row" style="flex-wrap:wrap">
              <span style="font-size:12px;color:var(--cf-text-muted)">Preset nhanh:</span>
              <button class="btn btn--ghost btn--sm" @click="loadPreset('xiuxian')">Thế giới tu tiên</button>
              <button class="btn btn--ghost btn--sm" @click="loadPreset('school')">Đời thường học đường</button>
              <button class="btn btn--ghost btn--sm" @click="loadPreset('game')">Chỉ số game</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Cột phải: Xem trước -->
      <div class="ejs-right">
        <div class="card" style="height:100%">
          <div class="card__header flex-between">
            <h3>Kết quả kết xuất</h3>
            <div class="flex-row">
              <button class="btn btn--ghost btn--sm" @click="copyResult" v-if="renderResult">Sao chép</button>
              <button class="btn btn--ghost btn--sm" @click="injectToWorldBook" v-if="renderResult">
                Tiêm vào Worldbook
              </button>
            </div>
          </div>
          <div class="card__body">
            <div v-if="renderError" class="ejs-error">
              <strong>Lỗi kết xuất:</strong>
              <pre>{{ renderError }}</pre>
            </div>
            <div v-else-if="renderResult" class="ejs-result selectable">
              <pre>{{ renderResult }}</pre>
            </div>
            <div v-else class="empty-state" style="padding:40px 20px">
              <div class="empty-state__icon"></div>
              <div class="empty-state__title">Nhấp "Xem trước" để xem kết quả</div>
              <div class="empty-state__desc">
                Sau khi viết mã EJS và đặt biến giả lập ở cột trái,<br>nhấp nút xem trước để kiểm tra nội dung xuất ra
              </div>
            </div>
          </div>
        </div>

        <!-- Tra cứu cú pháp EJS -->
        <div class="card mt-md">
          <div class="card__header">
            <h3>Tra cứu cú pháp EJS</h3>
          </div>
          <div class="card__body ejs-cheatsheet">
            <div class="ejs-cheat-item">
              <code>&lt;%_ code _%&gt;</code>
              <span>Thực thi mã JS (không xuất ra)</span>
            </div>
            <div class="ejs-cheat-item">
              <code>&lt;%= value %&gt;</code>
              <span>Xuất giá trị (có escape HTML)</span>
            </div>
            <div class="ejs-cheat-item">
              <code>&lt;%- value -%&gt;</code>
              <span>Xuất giá trị (không escape)</span>
            </div>
            <div class="ejs-cheat-item">
              <code>getvar('đường dẫn')</code>
              <span>Đọc biến MVU trong EJS (dùng trong &lt;%_ %&gt;)</span>
            </div>
            <div class="ejs-cheat-item">
              <code>getvar('đường dẫn', {defaults: 'giá trị mặc định'})</code>
              <span>Đọc biến kèm giá trị mặc định</span>
            </div>
            <div class="ejs-cheat-item">
              <code v-pre>{{get_message_variable::đường dẫn}}</code>
              <span>Đọc biến trong content thông thường (không phải EJS, viết trực tiếp)</span>
            </div>
            <div class="ejs-cheat-item">
              <code v-pre>{{format_message_variable::stat_data}}</code>
              <span>Tiêm toàn bộ giá trị biến cho AI đọc (dùng cho mục thường trực)</span>
            </div>
            <div class="ejs-cheat-item">
              <code>getChatMessages('-3')</code>
              <span>Lấy 3 tin nhắn gần nhất</span>
            </div>
            <div class="ejs-cheat-item">
              <code>activateWorldEntry('tên mục')</code>
              <span>Kích hoạt mục Worldbook động</span>
            </div>
            <div class="ejs-cheat-item">
              <code>deactivateWorldEntry('tên mục')</code>
              <span>Tắt mục Worldbook động</span>
            </div>
            <div class="ejs-cheat-item">
              <code>matchChatMessages(['từ 1','từ 2'])</code>
              <span>Kiểm tra tin nhắn gần nhất có chứa từ khóa không</span>
            </div>
            <div class="ejs-cheat-item">
              <code>print('văn bản')</code>
              <span>Xuất văn bản trong khối mã (thay thế cấu trúc if/else phức tạp)</span>
            </div>
            <div class="ejs-cheat-item">
              <code>await getwi('tên mục')</code>
              <span>Lấy nội dung của mục Worldbook khác</span>
            </div>
            <div class="ejs-cheat-item">
              <code>@@preprocessing</code>
              <span>Viết ở đầu mục, thực thi trước tất cả các mục (dùng cho bộ điều khiển động)</span>
            </div>
          </div>
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
import { buildCardContext } from '../utils/card-context.js';
import { parseAiJsonArray } from '../utils/json-repair.js';

const cardStore = useCardStore();
const apiStore = useApiStore();
const appStore = useAppStore();
const aiGenerating = ref(false);
const aiGrouping = ref(false);
const aiEmbedding = ref(false);
const embedProgress = ref(0);
const showGroupPanel = ref(false);
const showEmbedPanel = ref(false);
const embedResults = ref([]);
const switchGroups = ref([]);

function addSwitchGroup() {
  switchGroups.value.push({
    name: '',
    enabled: true,
    entryIds: [],
    search: '',
    preview: ''
  });
}

function filteredEntriesForGroup(group) {
  const entries = cardStore.worldEntries;
  if (!group.search) return entries;
  const q = group.search.toLowerCase();
  return entries.filter(e => {
    const comment = (e.comment || '').toLowerCase();
    const content = (e.content || '').toLowerCase();
    return comment.includes(q) || content.includes(q);
  });
}

function toggleGroupEntry(group, entryId) {
  const idx = group.entryIds.indexOf(entryId);
  if (idx === -1) {
    group.entryIds.push(entryId);
  } else {
    group.entryIds.splice(idx, 1);
  }
}

function generateSwitchEntry(gi) {
  const group = switchGroups.value[gi];
  if (!group.name.trim()) {
    appStore.toastError('Vui lòng điền tên nhóm');
    return;
  }
  if (group.entryIds.length === 0) {
    appStore.toastError('Vui lòng chọn ít nhất một mục');
    return;
  }

  const entries = cardStore.worldEntries;
  const lines = [];
  for (const id of group.entryIds) {
    const entry = entries.find(e => e.id === id);
    if (entry && entry.comment) {
      lines.push(`<%- await getwi(null, '${entry.comment}') -%>`);
    }
  }
  const content = lines.join('\n');

  group.preview = content;

  appStore.confirmAction(
    `Sẽ tạo mục công tắc cho nhóm "${group.name}", bao gồm tham chiếu đến ${group.entryIds.length} mục. Các mục được tham chiếu sẽ tự động chuyển thành disabled. Xác nhận?`,
    () => {
      const switchEntry = cardStore.addWorldEntry();
      switchEntry.comment = `Công tắc điều khiển nội dung-${group.name}`;
      switchEntry.content = content;
      switchEntry.constant = true;
      switchEntry.enabled = group.enabled;
      switchEntry.position = 'before_char';

      for (const id of group.entryIds) {
        const entry = entries.find(e => e.id === id);
        if (entry) {
          entry.enabled = false;
          entry.constant = false;
        }
      }

      cardStore.markDirty();
      appStore.toastSuccess(`Đã tạo mục công tắc "Công tắc điều khiển nội dung-${group.name}", ${group.entryIds.length} mục đã được đặt thành disabled`);
      group.preview = '';
    }
  );
}

async function aiEmbedEjs() {
  if (!apiStore.isConfigured) { appStore.toastError('Vui lòng cấu hình API Key trước'); return; }
  const entries = cardStore.worldEntries;
  if (entries.length === 0) { appStore.toastError('Worldbook không có mục nào'); return; }

  const hasMvu = cardStore.tavernScripts.some(s => s.content && s.content.includes('MagVarUpdate'));
  if (!hasMvu) { appStore.toastError('Vui lòng cấu hình hệ thống biến MVU trước (điều kiện EJS cần biến để đánh giá)'); return; }

  const initEntry = entries.find(e => {
    const c = (e.comment || '').toLowerCase();
    return c.includes('initvar') || c.includes('khởi tạo biến') || c.includes('变量初始化');
  });
  const varInfo = initEntry ? initEntry.content.slice(0, 800) : '(Không tìm thấy mục khởi tạo biến)';

  aiEmbedding.value = true;
  embedProgress.value = 10;
  embedResults.value = [];

  try {
    const candidates = entries.filter(e => {
      const comment = (e.comment || '').toLowerCase();
      const content = e.content || '';
      if (content.includes('<%')) return false;
      if (comment.includes('mvu_update') || comment.includes('quy tắc cập nhật') || comment.includes('định dạng xuất') || comment.includes('变量更新') || comment.includes('变量输出')) return false;
      if (comment.includes('initvar') || comment.includes('khởi tạo biến') || comment.includes('变量初始化')) return false;
      if (comment.includes('công tắc') || comment.includes('控制开关')) return false;
      if (content.length < 30) return false;
      return true;
    });

    if (candidates.length === 0) {
      appStore.toastError('Không tìm thấy mục phù hợp để nhúng EJS');
      return;
    }

    embedProgress.value = 30;

    const candidateList = candidates.map(e => ({
      id: e.id,
      comment: e.comment || '(Chưa đặt tên)',
      content: e.content.slice(0, 300)
    }));

    const prompt = `Bạn là chuyên gia về mẫu EJS của SillyTavern. Hãy phân tích danh sách mục Worldbook và danh sách biến dưới đây để xác định mục nào phù hợp thêm nhánh điều kiện EJS và tạo nội dung sau khi sửa đổi.

【Biến khả dụng】
${varInfo}

【Mục ứng viên】
${JSON.stringify(candidateList, null, 2)}

【Yêu cầu】
- Chỉ chọn những mục thực sự phù hợp để thêm nhánh điều kiện (ví dụ: miêu tả nhân vật thay đổi theo độ hảo cảm, miêu tả địa điểm thay đổi theo thời gian...)
- Không sửa đổi các mục mang tính quy tắc / hệ thống
- Sử dụng getvar('stat_data.Nhóm.Tên biến') để đọc biến
- Giữ nguyên nội dung gốc, chèn các nhánh điều kiện <%_ if ... _%> vào vị trí thích hợp
- Trả về mảng JSON, mỗi phần tử có định dạng: {"id": id_mục, "comment": "tên mục", "newContent": "nội dung đầy đủ sau khi sửa"}
- Sửa đổi tự nhiên, không ép buộc mục nào cũng phải thêm điều kiện
- Toàn bộ nội dung bằng tiếng Việt

Chỉ trả về mảng JSON, không kèm bất kỳ giải thích nào.`;

    embedProgress.value = 50;

    const result = await apiStore.chat([
      { role: 'system', content: 'Bạn là chuyên gia nhúng điều kiện EJS. Chỉ trả về mảng JSON bằng tiếng Việt.' },
      { role: 'user', content: prompt }
    ], { temperature: 0.4, maxTokens: apiStore.getModelMaxTokens(apiStore.activeProvider?.model) });

    embedProgress.value = 80;

    let modifications;
    try {
      modifications = parseAiJsonArray(result);
    } catch (e) {
      appStore.toastError('Định dạng AI trả về không bình thường, vui lòng thử lại');
      return;
    }

    if (!Array.isArray(modifications) || modifications.length === 0) {
      appStore.toastError('AI không tìm thấy mục nào phù hợp để nhúng EJS');
      return;
    }

    embedResults.value = modifications.map(mod => {
      const entry = entries.find(e => e.id === mod.id);
      return {
        id: mod.id,
        comment: mod.comment || (entry ? entry.comment : ''),
        originalContent: entry ? entry.content : '',
        newContent: mod.newContent || '',
        selected: true
      };
    }).filter(r => r.originalContent && r.newContent && r.newContent !== r.originalContent);

    embedProgress.value = 100;
    appStore.toastSuccess(`AI phân tích hoàn tất, tìm thấy ${embedResults.value.length} mục có thể nhúng EJS. Vui lòng kiểm tra phương án sửa đổi rồi nhấp "Áp dụng".`);
  } catch (e) {
    appStore.toastError('Phân tích nhúng AI thất bại: ' + e.message);
  } finally {
    aiEmbedding.value = false;
  }
}

function applyEmbedResults() {
  const entries = cardStore.worldEntries;
  let applied = 0;
  for (const result of embedResults.value) {
    if (!result.selected) continue;
    const entry = entries.find(e => e.id === result.id);
    if (entry) {
      entry.content = result.newContent;
      applied++;
    }
  }
  cardStore.markDirty();
  appStore.toastSuccess(`Đã áp dụng chỉnh sửa EJS cho ${applied} mục`);
  embedResults.value = [];
}

async function aiAutoGroup() {
  if (!apiStore.isConfigured) { appStore.toastError('Vui lòng cấu hình API Key trước'); return; }
  const entries = cardStore.worldEntries;
  if (entries.length < 3) { appStore.toastError('Worldbook quá ít mục (tối thiểu 3 mục), không thể tự động chia nhóm'); return; }

  aiGrouping.value = true;
  try {
    const entryList = entries.map(e => ({
      id: e.id,
      comment: e.comment || '(Chưa đặt tên)',
      contentPreview: (e.content || '').slice(0, 150)
    }));

    const prompt = `Bạn là chuyên gia về Worldbook SillyTavern. Hãy phân tích danh sách mục Worldbook sau đây và tự động chia nhóm chúng theo chủ đề / cảnh quan / khu vực.

【Danh sách mục】
${JSON.stringify(entryList, null, 2)}

【Yêu cầu】
- Gộp các mục liên quan vào cùng một nhóm (ví dụ các mục cùng thuộc một địa điểm, cùng liên quan đến một nhân vật, cùng thuộc một hệ thống)
- Không cần gom tất cả các mục vào nhóm, chỉ chia những mục phù hợp để làm công tắc điều khiển
- Các mục mang tính quy tắc / hệ thống / chỉ lệnh AI thì không chia nhóm (chúng nên luôn thường trực)
- Mỗi nhóm tối thiểu 2 mục
- Trả về mảng JSON, mỗi phần tử có định dạng: {"name": "tên nhóm", "entryIds": [mảng id mục], "enabled": true/false}
- Tên nhóm ngắn gọn, rõ ràng
- Toàn bộ nội dung bằng tiếng Việt

Chỉ trả về mảng JSON, không kèm bất kỳ giải thích nào.`;

    const result = await apiStore.chat([
      { role: 'system', content: 'Bạn là chuyên gia phân nhóm Worldbook. Chỉ trả về mảng JSON bằng tiếng Việt.' },
      { role: 'user', content: prompt }
    ], { temperature: 0.3, maxTokens: apiStore.getModelMaxTokens(apiStore.activeProvider?.model) });

    let groups;
    try {
      groups = parseAiJsonArray(result);
    } catch (e) {
      appStore.toastError('Định dạng AI trả về không bình thường, vui lòng thử lại');
      return;
    }

    if (!Array.isArray(groups) || groups.length === 0) {
      appStore.toastError('AI không tìm thấy nhóm phù hợp');
      return;
    }

    switchGroups.value = groups.map(g => ({
      name: g.name || '',
      enabled: g.enabled !== false,
      entryIds: (g.entryIds || []).filter(id => entries.some(e => e.id === id)),
      search: '',
      preview: ''
    })).filter(g => g.entryIds.length >= 2);

    appStore.toastSuccess(`AI phân tích hoàn tất, đề xuất ${switchGroups.value.length} nhóm. Vui lòng kiểm tra rồi nhấp "Tạo mục công tắc".`);
  } catch (e) {
    appStore.toastError('AI tự động chia nhóm thất bại: ' + e.message);
  } finally { aiGrouping.value = false; }
}

async function autoGenEjs() {
  if (!apiStore.isConfigured) { appStore.toastError('Vui lòng cấu hình API Key trước'); return; }
  aiGenerating.value = true;
  try {
    const context = buildCardContext(cardStore, '', { modelContextTokens: apiStore.getModelContextTokens(apiStore.activeProvider?.model) });
    const hasWorldBook = cardStore.worldEntries.length > 0;
    const hasMvu = cardStore.tavernScripts.some(s => s.content && s.content.includes('MagVarUpdate'));

    const prompt = `Bạn là chuyên gia về mẫu EJS của SillyTavern. Hãy phân tích thông tin thẻ nhân vật sau để tự động phán đoán cần mẫu EJS nào và sinh mã tương ứng.

【Thông tin thẻ nhân vật】
${context}

【Trạng thái hiện tại】
- Đã có mục Worldbook: ${hasWorldBook ? 'Có (' + cardStore.worldEntries.length + ' mục)' : 'Chưa'}
- Đã có hệ thống biến MVU: ${hasMvu ? 'Có' : 'Chưa'}

Hãy phán đoán logic EJS phù hợp nhất cho thẻ này. Ví dụ các tình huống phổ biến:
- Có độ hảo cảm NPC → Hiển thị thái độ / hành vi khác nhau theo độ hảo cảm
- Có hệ thống vị trí → Kích hoạt các mục Worldbook khác nhau theo vị trí
- Có cốt truyện phân giai đoạn → Hiển thị nội dung giai đoạn theo giá trị biến
- Có bộ điều khiển động → @@preprocessing quản lý mục động

Tạo một đoạn mã mẫu EJS hoàn chỉnh có thể dùng ngay. Sử dụng getvar('stat_data.Nhóm.Tên biến') để đọc biến.
Chỉ xuất ra mã EJS, không kèm bất kỳ giải thích nào.`;

    const result = await apiStore.chat([
      { role: 'system', content: 'Bạn là chuyên gia mẫu EJS. Chỉ xuất mã EJS dùng được ngay bằng tiếng Việt.' },
      { role: 'user', content: prompt }
    ], { temperature: 0.7, maxTokens: apiStore.getModelMaxTokens(apiStore.activeProvider?.model) });

    let code = result;
    const m = result.match(/```(?:ejs|html)?\s*([\s\S]*?)```/);
    if (m) code = m[1];
    ejsCode.value = code.trim();

    const entry = cardStore.addWorldEntry();
    entry.comment = 'Mục mẫu EJS động (AI tự động tạo)';
    entry.content = ejsCode.value;
    entry.constant = false;
    entry.enabled = true;
    entry.position = 'before_char';
    appStore.toastSuccess('AI đã tự động tạo mẫu EJS và tiêm vào Worldbook');
  } catch (e) {
    appStore.toastError('Tự động tạo thất bại: ' + e.message);
  } finally { aiGenerating.value = false; }
}

const ejsCode = ref('');
const renderResult = ref('');
const renderError = ref('');

const mockVars = ref([
  { path: 'stat_data.NPC.Độ hảo cảm', value: '50', type: 'number' },
]);

function addVariable() {
  mockVars.value.push({ path: '', value: '', type: 'string' });
}

function buildMockGetvar() {
  const vars = {};
  for (const v of mockVars.value) {
    if (!v.path) continue;
    let val = v.value;
    if (v.type === 'number') val = Number(val) || 0;
    else if (v.type === 'boolean') val = val === 'true';
    else if (v.type === 'json') {
      try { val = JSON.parse(val); } catch (e) { val = {}; }
    }
    const parts = v.path.split('.');
    let obj = vars;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!obj[parts[i]]) obj[parts[i]] = {};
      obj = obj[parts[i]];
    }
    obj[parts[parts.length - 1]] = val;
  }
  return vars;
}

function getNestedValue(obj, path) {
  return path.split('.').reduce((o, k) => (o && o[k] !== undefined) ? o[k] : undefined, obj);
}

function renderPreview() {
  renderError.value = '';
  renderResult.value = '';

  if (!ejsCode.value.trim()) {
    renderError.value = 'Vui lòng viết mã EJS trước';
    return;
  }

  try {
    const allVars = buildMockGetvar();
    let code = ejsCode.value;

    const getvar = (path, opts) => {
      const val = getNestedValue(allVars, path);
      if (val !== undefined) return val;
      if (opts && opts.defaults !== undefined) return opts.defaults;
      return '';
    };

    const getMessageVar = getvar;
    const getChatMessages = () => [{ message: '(Nội dung tin nhắn giả lập)' }];
    const getLastMessageId = () => 10;
    const activateWorldEntry = () => {};
    const deactivateWorldEntry = () => {};

    code = code.replace(/^@@preprocessing\s*/m, '');
    code = code.replace(/\{\{user\}\}/g, '(Tên người dùng)');
    code = code.replace(/\{\{char\}\}/g, '(Tên nhân vật)');

    let output = '';
    const segments = code.split(/(<%-[\s\S]*?-%>|<%=[\s\S]*?%>|<%_[\s\S]*?_%>|<%-[\s\S]*?%>|<%[\s\S]*?%>)/);

    let jsCode = 'let __output = "";\n';
    for (const seg of segments) {
      if (seg.startsWith('<%_') && seg.endsWith('_%>')) {
        jsCode += seg.slice(3, -3) + '\n';
      } else if (seg.startsWith('<%-') && (seg.endsWith('-%>') || seg.endsWith('%>'))) {
        const expr = seg.startsWith('<%-') ? seg.slice(3) : seg.slice(3);
        const clean = expr.replace(/-%>$|%>$/, '');
        jsCode += `__output += String(${clean});\n`;
      } else if (seg.startsWith('<%=') && seg.endsWith('%>')) {
        jsCode += `__output += String(${seg.slice(3, -2)});\n`;
      } else if (seg.startsWith('<%') && seg.endsWith('%>')) {
        jsCode += seg.slice(2, -2) + '\n';
      } else {
        jsCode += `__output += ${JSON.stringify(seg)};\n`;
      }
    }
    jsCode += 'return __output;';

    const fn = new Function(
      'getvar', 'getMessageVar', 'getChatMessages', 'getLastMessageId',
      'activateWorldEntry', 'deactivateWorldEntry', 'Number', 'Math', 'JSON',
      'String', 'Array', 'Object', 'parseInt', 'parseFloat', 'console',
      jsCode
    );

    const safeConsole = { log: () => {}, warn: () => {}, error: () => {}, info: () => {} };
    renderResult.value = fn(
      getvar, getMessageVar, getChatMessages, getLastMessageId,
      activateWorldEntry, deactivateWorldEntry, Number, Math, JSON,
      String, Array, Object, parseInt, parseFloat, safeConsole
    );

  } catch (e) {
    renderError.value = e.message;
  }
}

function insertSnippet(type) {
  const snippets = {
    'if': `<%_ const value = Number(getvar('stat_data.Nhóm.Tên biến')) || 0; _%>

<%_ if (value >= 80) { _%>
Nội dung hiển thị khi giá trị cao
<%_ } else if (value >= 40) { _%>
Nội dung hiển thị khi giá trị trung bình
<%_ } else { _%>
Nội dung hiển thị khi giá trị thấp
<%_ } _%>`,
    'getvar': `<%_ const myVar = getvar('stat_data.Nhóm.Tên biến', { defaults: 'Giá trị mặc định' }); _%>
Giá trị hiện tại: <%= myVar %>`,
    'preprocessing': `@@preprocessing
<%_
// Mã tiền xử lý - thực thi trước khi xử lý tất cả các mục
const currentLocation = getvar('stat_data.Thế giới.Vị trí', { defaults: 'Không rõ' });
const playerLevel = Number(getvar('stat_data.Nhân vật chính.Cấp độ')) || 1;

// Kích hoạt/vô hiệu hóa mục Worldbook theo điều kiện
if (playerLevel >= 10) {
  activateWorldEntry('Mục khu vực cao cấp');
}
_%>`
  };
  ejsCode.value = (ejsCode.value ? ejsCode.value + '\n\n' : '') + snippets[type];
}

function loadPreset(type) {
  const presets = {
    xiuxian: [
      { path: 'stat_data.Định vị thế giới.Đại vực hiện tại', value: 'Trung Thần Châu', type: 'string' },
      { path: 'stat_data.Thông tin người dùng.Cảnh giới', value: 'Kim Đan kỳ', type: 'string' },
      { path: 'stat_data.Thông tin người dùng.Tiến độ tu luyện', value: '65', type: 'number' },
      { path: 'stat_data.Thông tin người dùng.Linh thạch', value: '3500', type: 'number' },
      { path: 'stat_data.Nhân vật hiện diện.Ân Đông Tuyết', value: '{"Độ hảo cảm": 72, "Vị trí": "Tông môn"}', type: 'json' },
    ],
    school: [
      { path: 'stat_data.Hệ thống.Ngày', value: '15 tháng 4', type: 'string' },
      { path: 'stat_data.Hệ thống.Thời gian', value: '12:30', type: 'string' },
      { path: 'stat_data.Hệ thống.Vị trí', value: 'Lớp học', type: 'string' },
      { path: 'stat_data.Nhân vật.Độ hảo cảm', value: '45', type: 'number' },
      { path: 'stat_data.Hệ thống.Độ khả nghi của nhân vật chính', value: '25', type: 'number' },
    ],
    game: [
      { path: 'stat_data.Nhân vật chính.HP', value: '80', type: 'number' },
      { path: 'stat_data.Nhân vật chính.MP', value: '50', type: 'number' },
      { path: 'stat_data.Nhân vật chính.Cấp độ', value: '15', type: 'number' },
      { path: 'stat_data.Nhân vật chính.Tiền vàng', value: '12000', type: 'number' },
      { path: 'stat_data.Thế giới.Thời tiết', value: 'Nắng', type: 'string' },
    ]
  };
  mockVars.value = presets[type] || [];
}

function copyResult() {
  navigator.clipboard.writeText(renderResult.value);
  appStore.toastSuccess('Đã sao chép vào bộ nhớ tạm');
}

function injectToWorldBook() {
  const entry = cardStore.addWorldEntry();
  entry.comment = 'Mục mẫu EJS';
  entry.content = ejsCode.value;
  entry.constant = false;
  entry.enabled = true;
  entry.position = 'before_char';
  appStore.toastSuccess('Đã tiêm vào Worldbook (mã EJS gốc)');
}
</script>

<style scoped>
.ejs-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--cf-gap-md);
  align-items: start;
}

.ejs-code {
  font-family: var(--cf-font-mono);
  font-size: 12px;
  line-height: 1.7;
  tab-size: 2;
}

.ejs-var-row {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
  align-items: center;
}

.ejs-result {
  background: rgba(0, 0, 0, 0.15);
  border-radius: var(--cf-radius-sm);
  padding: 16px;
  max-height: 400px;
  overflow-y: auto;
}
.ejs-result pre {
  font-family: var(--cf-font);
  font-size: 13px;
  line-height: 1.7;
  white-space: pre-wrap;
  word-wrap: break-word;
  color: var(--cf-text-primary);
  margin: 0;
}

.ejs-error {
  background: rgba(248, 113, 113, 0.1);
  border: 1px solid rgba(248, 113, 113, 0.3);
  border-radius: var(--cf-radius-sm);
  padding: 16px;
  color: var(--cf-danger);
}
.ejs-error pre {
  font-family: var(--cf-font-mono);
  font-size: 12px;
  margin-top: 8px;
  white-space: pre-wrap;
}

.ejs-cheatsheet {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.ejs-cheat-item {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
}
.ejs-cheat-item code {
  background: rgba(0, 229, 255, 0.08);
  color: #00e5ff;
  padding: 2px 8px;
  border-radius: 4px;
  font-family: var(--cf-font-mono);
  font-size: 11px;
  white-space: nowrap;
}
.ejs-cheat-item span {
  color: var(--cf-text-secondary);
}

.ejs-dropdown {
  position: relative;
}
.ejs-dropdown__menu {
  display: none;
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 4px;
  background: var(--cf-bg-card, #1a1a2e);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--cf-radius-sm, 6px);
  padding: 4px;
  min-width: 160px;
  z-index: 100;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
}
.ejs-dropdown:hover .ejs-dropdown__menu,
.ejs-dropdown:focus-within .ejs-dropdown__menu {
  display: block;
}
.ejs-dropdown__menu button {
  display: block;
  width: 100%;
  text-align: left;
  padding: 8px 12px;
  border: none;
  background: transparent;
  color: var(--cf-text-primary, #e2e8f0);
  font-size: 13px;
  border-radius: 4px;
  cursor: pointer;
  font-family: inherit;
}
.ejs-dropdown__menu button:hover {
  background: rgba(255, 255, 255, 0.06);
}
.ejs-dropdown__menu button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.switch-group {
  background: rgba(0, 0, 0, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: var(--cf-radius-md);
  overflow: hidden;
}
.switch-group__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  background: rgba(0, 0, 0, 0.1);
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  gap: 8px;
}
.switch-group__body {
  padding: 10px 14px;
}
.switch-group__search {
  margin-bottom: 8px;
}
.switch-group__entries {
  max-height: 240px;
  overflow-y: auto;
  border: 1px solid rgba(255, 255, 255, 0.04);
  border-radius: var(--cf-radius-sm);
  background: rgba(0, 0, 0, 0.1);
  padding: 4px;
}
.switch-entry-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  transition: background 0.15s;
}
.switch-entry-item:hover {
  background: rgba(255, 255, 255, 0.04);
}
.switch-entry-item__name {
  flex: 1;
  color: var(--cf-text-primary);
}
.switch-entry-item__hint {
  font-size: 11px;
  color: var(--cf-text-muted);
}
.switch-group__preview {
  padding: 10px 14px;
  border-top: 1px solid rgba(255, 255, 255, 0.04);
  background: rgba(0, 0, 0, 0.1);
}

.embed-progress {
  margin: 16px 0;
}
.embed-progress__bar {
  width: 100%;
  height: 8px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 4px;
  overflow: hidden;
  position: relative;
}
.embed-progress__fill {
  height: 100%;
  border-radius: 4px;
  background: linear-gradient(90deg, var(--cf-accent), #06b6d4);
  transition: width 0.5s ease;
  position: relative;
}
.embed-progress__fill::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
  animation: progressShine 1.5s infinite;
}
@keyframes progressShine {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}
.embed-progress__text {
  margin-top: 6px;
  font-size: 12px;
  color: var(--cf-text-muted);
  text-align: center;
}

.embed-result {
  background: rgba(0, 0, 0, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: var(--cf-radius-md);
  overflow: hidden;
}
.embed-result__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: rgba(0, 0, 0, 0.1);
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}
.embed-result__name {
  font-weight: 600;
  color: var(--cf-text-primary);
  font-size: 13px;
}
.embed-result__diff {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1px;
  background: rgba(255, 255, 255, 0.04);
}
.embed-result__before,
.embed-result__after {
  padding: 10px 14px;
  background: rgba(0, 0, 0, 0.08);
}
.embed-result__before { background: rgba(248, 113, 113, 0.03); }
.embed-result__after { background: rgba(52, 211, 153, 0.03); }
.embed-result__label {
  font-size: 11px;
  font-weight: 600;
  margin-bottom: 6px;
  color: var(--cf-text-muted);
}
.embed-result__before .embed-result__label { color: #f87171; }
.embed-result__after .embed-result__label { color: #34d399; }
.embed-result__diff pre {
  font-family: var(--cf-font-mono);
  font-size: 11px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-wrap: break-word;
  color: var(--cf-text-secondary);
  margin: 0;
  max-height: 200px;
  overflow-y: auto;
}
</style>