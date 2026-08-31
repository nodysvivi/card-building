<template>
  <div class="wb-entry"
    :class="{
      'wb-entry--disabled': !entry.enabled,
      'wb-entry--constant': entry.constant && entry.enabled,
      'wb-entry--dragging': isDraggingMe,
      'wb-entry--dragover': isDragOverMe
    }"
    :draggable="draggable && draggingEnabled"
    @dragstart="$emit('drag-start', $event)"
    @dragover.prevent="$emit('drag-over', $event)"
    @dragleave="$emit('drag-leave')"
    @drop.prevent="$emit('drop', $event)"
    @dragend="$emit('drag-end')">

    <!-- Phần đầu thẻ -->
    <div class="wb-entry__header" @click="$emit('toggle-expand')">
      <div class="flex-row">
        <span v-if="mode === 'persisted' && draggable" class="wb-drag-handle"
          @click.stop
          @mousedown="draggingEnabled = true"
          @mouseup="draggingEnabled = false"
          @mouseleave="draggingEnabled = false"
          title="Kéo giữ để sắp xếp thứ tự">⋮⋮</span>

        <label v-if="batchMode || mode === 'preview'" class="toggle-label" style="margin-right:4px" @click.stop>
          <input type="checkbox" :checked="selected" @change="$emit('toggle-select')">
        </label>

        <input v-if="mode === 'persisted'" type="number" class="wb-order-input"
          :value="entry.extensions?.cfSortKey"
          @click.stop
          @mousedown.stop
          @change="$emit('update-order', $event.target.value)"
          title="Thứ tự hiển thị — Chỉ dùng sắp xếp nội bộ trong CardBuilding, không ảnh hưởng đến insertion_order">

        <span class="wb-entry__expand">{{ expanded ? '▼' : '▶' }}</span>
        <span class="wb-entry__name">{{ entry.comment || '(Chưa đặt tên)' }}</span>
        <span v-if="entry.constant && entry.enabled" class="badge badge--warning">Thường trực</span>
        <span v-if="!entry.enabled" class="badge badge--danger">Đã tắt</span>
        <span v-if="entry.keys?.length" class="wb-entry__keys">
          {{ (entry.keys || []).slice(0, 3).join(', ') }}{{ (entry.keys || []).length > 3 ? '...' : '' }}
        </span>
      </div>
      <div class="flex-row" @click.stop>
        <span class="wb-entry__meta">{{ entry.position }}</span>
        <button v-if="mode === 'persisted'" class="btn btn--ghost btn--sm" @click="$emit('duplicate')">Sao chép</button>
        <button class="btn btn--danger btn--sm" @click="handleDelete">{{ mode === 'preview' ? 'Gỡ bỏ' : 'Xóa' }}</button>
      </div>
    </div>

    <!-- Chi tiết -->
    <div v-if="expanded" class="wb-entry__body">
      <div class="grid-2">
        <div class="form-group">
          <label>Tên mục (comment)</label>
          <input class="input" v-model="entry.comment" @input="markDirty">
        </div>
        <div class="form-group">
          <label>Từ khóa (keys)</label>
          <input class="input" :value="(entry.keys || []).join(', ')"
            @input="entry.keys = $event.target.value.split(',').map(k => k.trim()).filter(Boolean); markDirty()">
          <div class="hint">Phân tách nhiều từ khóa bằng dấu phẩy</div>
        </div>
      </div>

      <div class="form-group">
        <label>Nội dung (content)</label>
        <textarea class="textarea selectable" v-model="entry.content" rows="8"
          style="font-family: var(--cf-font-mono); font-size: 12px;"
          @input="markDirty"></textarea>
        <div class="hint">{{ (entry.content || '').length }} ký tự | ~{{ Math.round((entry.content || '').length * 1.3) }} token</div>
      </div>

      <div class="grid-3">
        <div class="form-group">
          <label>Vị trí chèn (position)</label>
          <select class="select" v-model="entry.position" @change="syncPosition(); markDirty()">
            <option value="before_char">Trước định nghĩa nhân vật</option>
            <option value="after_char">Sau định nghĩa nhân vật</option>
            <option value="before_example">Trước tin nhắn mẫu</option>
            <option value="after_example">Sau tin nhắn mẫu</option>
            <option value="before_author">Trước ghi chú tác giả</option>
            <option value="after_author">Sau ghi chú tác giả</option>
            <option value="atDepth_system">@D [Hệ thống] Tại độ sâu</option>
            <option value="atDepth_user">@D [Người dùng] Tại độ sâu</option>
            <option value="atDepth_ai">@D [AI] Tại độ sâu</option>
          </select>
          <div v-if="String(entry.position || '').startsWith('atDepth')" class="form-group" style="margin-top:6px">
            <label>Giá trị độ sâu</label>
            <input class="input" type="number" v-model.number="entry.extensions.depth" min="0" placeholder="0=Tận cùng dưới đáy" @input="markDirty">
            <div class="hint">D0=Cạnh nội dung mới nhất (hiệu lực mạnh nhất), D1=Tin nhắn cuối cùng, D4=Vị trí xa hơn</div>
          </div>
          <div class="hint" v-else>Vị trí trước/sau định nghĩa nhân vật là phổ biến nhất. Chèn theo độ sâu (@D) càng gần đáy thì hiệu lực càng mạnh.</div>
        </div>
        <div class="form-group">
          <label>Thứ tự chèn (insertion_order)</label>
          <input class="input" type="number" v-model.number="entry.insertion_order" @input="markDirty">
          <div class="hint">Giá trị càng lớn càng nằm về phía dưới. Khuyến nghị: Quy tắc hệ thống 1-10, NPC 50-80, Định dạng xuất 9990+</div>
        </div>
        <div class="form-group">
          <label>Độ sâu quét (depth)</label>
          <input class="input" type="number" v-model.number="entry.extensions.depth" min="0" @input="markDirty">
          <div class="hint">Số tin nhắn gần nhất được quét để khớp từ khóa. 0=Luôn khớp, 4=Mặc định</div>
        </div>
      </div>

      <div class="flex-row gap-md" style="flex-wrap:wrap">
        <label class="toggle-label">
          <input type="checkbox" v-model="entry.enabled" @change="markDirty"> Bật
        </label>
        <label class="toggle-label">
          <input type="checkbox" v-model="entry.constant" @change="markDirty"> Thường trực (đèn xanh)
        </label>
        <label class="toggle-label">
          <input type="checkbox" v-model="entry.selective" @change="markDirty"> Bật từ khóa cấp hai
        </label>
        <label class="toggle-label">
          <input type="checkbox" v-model="entry.extensions.exclude_recursion" @change="markDirty"> Không đệ quy
        </label>
        <label class="toggle-label">
          <input type="checkbox" v-model="entry.extensions.prevent_recursion" @change="markDirty"> Ngăn chặn đệ quy tiếp
        </label>
      </div>

      <div v-if="entry.selective" class="form-group mt-md">
        <label>Logic từ khóa cấp hai (selectiveLogic)</label>
        <select class="select" v-model.number="entry.extensions.selectiveLogic" @change="markDirty">
          <option :value="0">VÀ BẤT KỲ (AND ANY) — Khớp bất kỳ từ khóa bên phải nào là kích hoạt</option>
          <option :value="1">VÀ TẤT CẢ (AND ALL) — Khớp toàn bộ từ khóa bên phải mới kích hoạt</option>
          <option :value="2">KHÔNG PHẢI TẤT CẢ (NOT ALL) — Có ít nhất một từ bên phải không khớp là kích hoạt</option>
          <option :value="3">KHÔNG PHẢI BẤT KỲ (NOT ANY) — Toàn bộ từ bên phải đều không khớp mới kích hoạt</option>
        </select>
      </div>

      <div v-if="entry.selective" class="form-group mt-md">
        <label>Từ khóa cấp hai (secondary_keys)</label>
        <input class="input" :value="(entry.secondary_keys || []).join(', ')"
          @input="entry.secondary_keys = $event.target.value.split(',').map(k => k.trim()).filter(Boolean); markDirty()">
        <div class="hint">Cần thỏa mãn đồng thời từ khóa chính và từ khóa cấp hai mới kích hoạt</div>
      </div>

      <!-- Cài đặt nâng cao -->
      <details class="mt-md">
        <summary style="font-size:12px;color:var(--cf-text-muted);cursor:pointer">Cài đặt nâng cao</summary>
        <div style="margin-top:12px">
          <div class="grid-3">
            <div class="form-group">
              <label>Vai trò (role)</label>
              <select class="select" v-model.number="entry.extensions.role" @change="markDirty">
                <option :value="0">System</option>
                <option :value="1">User</option>
                <option :value="2">Assistant</option>
              </select>
              <div class="hint">Mục này được chèn vào prompt dưới danh nghĩa vai trò nào</div>
            </div>
            <div class="form-group">
              <label>Xác suất kích hoạt (%)</label>
              <input class="input" type="number" v-model.number="entry.extensions.probability" min="0" max="100" @input="markDirty">
              <div class="hint">Xác suất thực tế kích hoạt sau khi từ khóa trúng khớp</div>
            </div>
            <div class="form-group">
              <label>Độ sâu quét độc lập</label>
              <input class="input" type="number" v-model.number="entry.extensions.scan_depth" placeholder="Theo cấu hình chung" @input="markDirty">
              <div class="hint">Để trống sẽ dùng độ sâu chung</div>
            </div>
          </div>
          <div class="grid-3">
            <div class="form-group">
              <label>Nhóm (group)</label>
              <input class="input" v-model="entry.extensions.group" @input="markDirty">
              <div class="hint">Các mục cùng nhóm sẽ loại trừ lẫn nhau, chỉ kích hoạt mục có trọng số cao nhất</div>
            </div>
            <div class="form-group">
              <label>Trọng số nhóm</label>
              <input class="input" type="number" v-model.number="entry.extensions.group_weight" @input="markDirty">
            </div>
            <div class="form-group">
              <label>Độ dính (sticky)</label>
              <input class="input" type="number" v-model.number="entry.extensions.sticky" placeholder="0" @input="markDirty">
              <div class="hint">Số lượt duy trì kích hoạt sau khi được kích hoạt</div>
            </div>
          </div>
          <div class="grid-3">
            <div class="form-group">
              <label>Thời gian hồi (cooldown)</label>
              <input class="input" type="number" v-model.number="entry.extensions.cooldown" placeholder="0" @input="markDirty">
              <div class="hint">Số lượt hồi sau khi được kích hoạt</div>
            </div>
            <div class="form-group">
              <label>Độ trễ (delay)</label>
              <input class="input" type="number" v-model.number="entry.extensions.delay" placeholder="0" @input="markDirty">
              <div class="hint">Độ trễ số lượt sau khi từ khóa trúng khớp mới kích hoạt</div>
            </div>
            <div class="form-group">
              <label>Tùy chọn</label>
              <div style="display:flex;flex-direction:column;gap:6px">
                <label class="toggle-label">
                  <input type="checkbox" v-model="entry.use_regex" @change="markDirty"> Từ khóa sử dụng so khớp Regex
                </label>
                <label class="toggle-label">
                  <input type="checkbox" v-model="entry.extensions.match_whole_words" @change="markDirty"> Khớp toàn bộ từ
                </label>
                <label class="toggle-label">
                  <input type="checkbox" v-model="entry.extensions.case_sensitive" @change="markDirty"> Phân biệt hoa thường
                </label>
                <label class="toggle-label">
                  <input type="checkbox" v-model="entry.extensions.ignore_budget" @change="markDirty"> Bỏ qua ngân sách token
                </label>
              </div>
            </div>
          </div>
        </div>
      </details>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useCardStore } from '../stores/card.js';
import { useAppStore } from '../stores/app.js';

const props = defineProps({
  entry: { type: Object, required: true },
  mode: { type: String, default: 'persisted' },  // 'persisted' | 'preview'
  expanded: { type: Boolean, default: false },
  batchMode: { type: Boolean, default: false },
  selected: { type: Boolean, default: false },
  draggable: { type: Boolean, default: true },
  isDraggingMe: { type: Boolean, default: false },
  isDragOverMe: { type: Boolean, default: false }
});

const emit = defineEmits([
  'toggle-expand', 'toggle-select', 'delete', 'duplicate', 'update-order',
  'drag-start', 'drag-over', 'drag-leave', 'drop', 'drag-end'
]);

const store = useCardStore();
const appStore = useAppStore();
const draggingEnabled = ref(false);

function markDirty() {
  if (props.mode === 'persisted') {
    store.markDirty();
  }
}

function syncPosition() {
  const posMap = {
    'before_char': 0, 'after_char': 1,
    'before_example': 2, 'after_example': 3,
    'before_author': 4, 'after_author': 5,
    'atDepth_system': 6, 'atDepth_user': 7, 'atDepth_ai': 8
  };
  if (!props.entry.extensions) props.entry.extensions = {};
  props.entry.extensions.position = posMap[props.entry.position] ?? 0;
  if (props.entry.position === 'atDepth_system') props.entry.extensions.role = 0;
  else if (props.entry.position === 'atDepth_user') props.entry.extensions.role = 1;
  else if (props.entry.position === 'atDepth_ai') props.entry.extensions.role = 2;
}

function handleDelete() {
  if (props.mode === 'preview') {
    emit('delete');
  } else {
    appStore.confirmAction('Xóa mục Worldbook này?', () => emit('delete'));
  }
}
</script>

<style scoped>
.wb-entry {
  background: var(--cf-bg-secondary);
  border: 1px solid var(--cf-border);
  border-radius: var(--cf-radius-sm);
  margin-bottom: 8px;
  transition: all var(--cf-transition);
}
.wb-entry--disabled { opacity: 0.5; }
.wb-entry--constant { border-left: 3px solid var(--cf-warning); }
.wb-entry--dragging { opacity: 0.4; }
.wb-entry--dragover { border-color: var(--cf-accent); border-style: dashed; }

.wb-entry__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  cursor: pointer;
  gap: 8px;
}
.wb-entry__header:hover { background: var(--cf-bg-hover); }

.wb-drag-handle {
  cursor: grab;
  color: var(--cf-text-muted);
  font-size: 14px;
  user-select: none;
  padding: 0 4px;
}
.wb-drag-handle:active { cursor: grabbing; }

.wb-order-input {
  width: 50px;
  padding: 2px 6px;
  font-size: 12px;
  background: var(--cf-bg-tertiary);
  border: 1px solid var(--cf-border);
  border-radius: 3px;
  color: var(--cf-text-primary);
  text-align: center;
}

.wb-entry__expand { color: var(--cf-text-muted); font-size: 11px; }
.wb-entry__name { font-weight: 500; color: var(--cf-text-primary); }
.wb-entry__keys {
  font-size: 11px;
  color: var(--cf-text-muted);
  font-family: var(--cf-font-mono);
}
.wb-entry__meta {
  font-size: 11px;
  color: var(--cf-text-muted);
  font-family: var(--cf-font-mono);
}

.wb-entry__body {
  border-top: 1px solid var(--cf-border);
  padding: 16px;
}

.toggle-label {
  display: flex; align-items: center; gap: 6px;
  font-size: 13px; cursor: pointer; color: var(--cf-text-secondary);
}
.toggle-label input { accent-color: var(--cf-accent); }

.flex-row { display: flex; align-items: center; gap: 8px; }
.gap-md { gap: var(--cf-gap-md); }
.mt-md { margin-top: var(--cf-gap-md); }
</style>