<template>
  <div class="page">
    <div class="page__header flex-between">
      <div>
        <h1>Chỉnh sửa thẻ nhân vật</h1>
        <p>Chỉnh sửa thông tin cơ bản, thiết lập nhân vật, lời mở đầu và tất cả các trường chuẩn V2</p>
      </div>
      <div class="flex-row">
        <button class="btn btn--secondary" @click="handleImportCover">
          {{ coverImagePath ? 'Đổi ảnh bìa' : 'Tải lên ảnh bìa' }}
        </button>
        <button class="btn btn--primary" @click="handleExport">Xuất thẻ</button>
      </div>
    </div>

    <!-- Tab phân trang -->
    <div class="tabs">
      <div :class="['tabs__item', { active: tab === 'basic' }]" @click="tab = 'basic'">Thông tin cơ bản</div>
      <div :class="['tabs__item', { active: tab === 'desc' }]" @click="tab = 'desc'">Mô tả nhân vật</div>
      <div :class="['tabs__item', { active: tab === 'greetings' }]" @click="tab = 'greetings'">Lời mở đầu</div>
      <div :class="['tabs__item', { active: tab === 'prompts' }]" @click="tab = 'prompts'">Prompt</div>
      <div :class="['tabs__item', { active: tab === 'meta' }]" @click="tab = 'meta'">Thông tin meta</div>
    </div>

    <!-- Thông tin cơ bản -->
    <div v-show="tab === 'basic'" class="card">
      <div class="card__body">
        <div class="grid-2">
          <div class="form-group">
            <label>Tên nhân vật (name) <span class="badge badge--danger">Bắt buộc</span></label>
            <input class="input" v-model="d.name" placeholder="Nhập tên nhân vật" @input="markDirty">
          </div>
          <div class="form-group">
            <label>Tóm tắt tính cách (personality)</label>
            <input class="input" v-model="d.personality" placeholder="Vài từ khóa miêu tả tính cách" @input="markDirty">
            <div class="hint">VD: Dịu dàng, nội tâm, hơi hướng nội, yêu sách</div>
          </div>
        </div>
        <div class="form-group">
          <label>Thiết lập bối cảnh (scenario)</label>
          <textarea class="textarea" v-model="d.scenario" rows="3"
            placeholder="Bối cảnh tình huống diễn ra cuộc trò chuyện" @input="markDirty"></textarea>
        </div>
        <div class="form-group">
          <label>Mẫu đối thoại (mes_example)</label>
          <textarea class="textarea" v-model="d.mes_example" rows="8"
            placeholder="Dùng <START> để phân cách các bối cảnh đối thoại khác nhau&#10;{{user}}: Chào bạn&#10;{{char}}: *khẽ mỉm cười* Bạn đã đến rồi." @input="markDirty"></textarea>
          <div class="hint">Dùng &lt;START&gt; để phân cách bối cảnh, {{char}} đại diện cho nhân vật, {{user}} đại diện cho người dùng</div>
        </div>
      </div>
    </div>

    <!-- Mô tả nhân vật -->
    <div v-show="tab === 'desc'" class="card">
      <div class="card__body">
        <div class="form-group">
          <label>Mô tả nhân vật (description)</label>
          <textarea class="textarea" v-model="d.description" rows="20"
            placeholder="Thiết lập cốt lõi của nhân vật: ngoại hình, tính cách, bối cảnh, cách nói chuyện...&#10;&#10;Gợi ý: Nếu bạn dùng Worldbook để lưu trữ thiết lập chi tiết, ở đây có thể để trống hoặc chỉ viết thông tin cốt lõi nhất." @input="markDirty"></textarea>
          <div class="hint">
            Số từ: {{ (d.description || '').length }} từ | Token ước tính: ~{{ Math.round((d.description || '').length * 1.3) }}
          </div>
        </div>
      </div>
    </div>

    <!-- Lời mở đầu -->
    <div v-show="tab === 'greetings'" class="card">
      <div class="card__body">
        <div class="form-group">
          <label>Lời mở đầu chính (first_mes) <span class="badge badge--danger">Bắt buộc</span></label>
          <textarea class="textarea" v-model="d.first_mes" rows="12"
            placeholder="Tin nhắn đầu tiên của nhân vật. Miêu tả bối cảnh, trạng thái nhân vật, mở ra gợi ý để người dùng tiếp lời." @input="markDirty"></textarea>
          <div class="hint">Số từ: {{ (d.first_mes || '').length }}</div>
        </div>

        <div class="divider"></div>

        <div class="flex-between mb-md">
          <label style="font-weight:600">Lời mở đầu dự phòng (alternate_greetings)</label>
          <button class="btn btn--secondary btn--sm" @click="store.addGreeting()">+ Thêm lời mở đầu</button>
        </div>

        <div v-for="(g, i) in d.alternate_greetings" :key="i" class="alt-greeting">
          <div class="flex-between mb-md">
            <span class="badge badge--info">Lời mở đầu {{ i + 2 }}</span>
            <button class="btn btn--danger btn--sm" @click="appStore.confirmAction('Xóa lời mở đầu này?', () => store.removeGreeting(i))">Xóa</button>
          </div>
          <textarea class="textarea" v-model="d.alternate_greetings[i]" rows="8"
            placeholder="Nội dung lời mở đầu dự phòng" @input="markDirty"></textarea>
        </div>
      </div>
    </div>

    <!-- Prompt -->
    <div v-show="tab === 'prompts'" class="card">
      <div class="card__body">
        <div class="form-group">
          <label>System Prompt (system_prompt)</label>
          <textarea class="textarea" v-model="d.system_prompt" rows="8"
            placeholder="Chỉ lệnh bổ sung cho AI như định dạng trả lời, độ dài, góc nhìn..." @input="markDirty"></textarea>
          <div class="hint">Tùy chọn. Dùng để kiểm soát quy tắc hành vi của AI như "Mỗi lần trả lời 800-1500 từ", "Không đóng vai {{user}}"...</div>
        </div>
        <div class="form-group">
          <label>Chỉ lệnh sau lịch sử trò chuyện (post_history_instructions)</label>
          <textarea class="textarea" v-model="d.post_history_instructions" rows="5"
            placeholder="Chỉ lệnh chèn sau lịch sử trò chuyện và trước câu trả lời của AI" @input="markDirty"></textarea>
        </div>
        <div class="form-group">
          <label>Depth Prompt (depth_prompt)</label>
          <div class="grid-2">
            <div>
              <textarea class="textarea" v-model="d.extensions.depth_prompt.prompt" rows="4"
                placeholder="Prompt được tiêm tại độ sâu chỉ định" @input="markDirty"></textarea>
            </div>
            <div>
              <div class="form-group">
                <label>Độ sâu chèn</label>
                <input class="input" type="number" v-model.number="d.extensions.depth_prompt.depth"
                  min="0" max="999" @input="markDirty">
              </div>
              <div class="form-group">
                <label>Vai trò</label>
                <select class="select" v-model="d.extensions.depth_prompt.role" @change="markDirty">
                  <option value="system">System</option>
                  <option value="user">User</option>
                  <option value="assistant">Assistant</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Thông tin meta -->
    <div v-show="tab === 'meta'" class="card">
      <div class="card__body">
        <div class="grid-2">
          <div class="form-group">
            <label>Tác giả (creator)</label>
            <input class="input" v-model="d.creator" @input="markDirty">
          </div>
          <div class="form-group">
            <label>Phiên bản (character_version)</label>
            <input class="input" v-model="d.character_version" @input="markDirty">
          </div>
        </div>
        <div class="form-group">
          <label>Ghi chú của tác giả (creator_notes)</label>
          <textarea class="textarea" v-model="d.creator_notes" rows="4"
            placeholder="Lời nhắn gửi tới người dùng (không gửi cho AI)" @input="markDirty"></textarea>
        </div>
        <div class="form-group">
          <label>Tag (tags)</label>
          <input class="input" :value="(d.tags || []).join(', ')"
            @input="d.tags = $event.target.value.split(',').map(t => t.trim()).filter(Boolean); markDirty()"
            placeholder="Phân tách các tag bằng dấu phẩy">
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useCardStore } from '../stores/card.js';
import { useAppStore } from '../stores/app.js';

const store = useCardStore();
const appStore = useAppStore();
const api = window.cardForgeAPI;

const tab = ref('basic');
const d = computed(() => store.cardData);
const coverImagePath = computed(() => store.coverImagePath);

function markDirty() { store.markDirty(); }

async function handleImportCover() {
  const path = await api.openImage();
  if (path) {
    store.coverImagePath = path;
    appStore.toastSuccess('Đã thiết lập ảnh bìa');
  }
}

async function handleExport() {
  try {
    const json = store.exportJson();
    const defaultName = (d.value.name || 'character');

    const savePath = await api.saveFile({
      defaultPath: defaultName + '.png',
      filters: [
        { name: 'Thẻ nhân vật PNG', extensions: ['png'] },
        { name: 'File JSON', extensions: ['json'] }
      ]
    });
    if (!savePath) return;

    if (savePath.endsWith('.json')) {
      await api.writeFile(savePath, JSON.stringify(json, null, 2));
      appStore.toastSuccess('Xuất JSON thành công');
    } else if (savePath.endsWith('.png')) {
      if (!store.coverImagePath) {
        const imgPath = await api.openImage();
        if (!imgPath) { appStore.toastWarning('Cần có ảnh bìa'); return; }
        store.coverImagePath = imgPath;
      }
      const result = await api.embedCharaData(store.coverImagePath, json, savePath);
      if (!result.success) throw new Error(result.error);
      appStore.toastSuccess('Xuất thẻ nhân vật PNG thành công');
    }
    store.isDirty = false;
  } catch (e) {
    appStore.toastError(`Xuất thất bại: ${e.message}`);
  }
}
</script>

<style scoped>
.alt-greeting {
  background: var(--cf-bg-tertiary);
  border: 1px solid var(--cf-border);
  border-radius: var(--cf-radius-sm);
  padding: var(--cf-gap-md);
  margin-bottom: var(--cf-gap-md);
}
</style>