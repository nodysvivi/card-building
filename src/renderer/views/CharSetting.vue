<template>
  <div class="page">
    <div class="page__header flex-between">
      <div>
        <h1>Thiết lập nhân vật chính</h1>
        <p>Thiết lập từng nhân vật chính do AI đảm nhiệm và tự động tổng hợp thành mô tả thẻ nhân vật chuẩn</p>
      </div>
      <button class="btn btn--primary" @click="addCharacter">+ Thêm nhân vật</button>
    </div>

    <div class="card mb-md">
      <div class="card__body hint" style="line-height:1.8">
        Mỗi nhân vật được điền trong một khối độc lập. Tính cách sẽ được ghi vào description cùng với ngoại hình, bối cảnh;
        dữ liệu phân khối gốc được lưu trong trường mở rộng của CardBuilding, do đó không ảnh hưởng đến tính tương thích SillyTavern V2.
      </div>
    </div>

    <div v-if="characters.length === 0" class="card mb-md">
      <div class="empty-state">
        <div class="empty-state__title">Chưa có nhân vật chính nào</div>
        <div class="empty-state__desc">Bạn có thể lần lượt thêm nhiều nhân vật chính, mỗi nhân vật đều có thể chỉnh sửa và nhập vào Worldbook riêng biệt.</div>
        <button class="btn btn--primary mt-md" @click="addCharacter">Thêm nhân vật đầu tiên</button>
      </div>
    </div>

    <div v-for="(character, index) in characters" :key="character.id" class="card mb-md character-card">
      <div class="card__header flex-between">
        <div class="flex-row">
          <button class="btn btn--ghost btn--sm" @click="character.collapsed = !character.collapsed">
            {{ character.collapsed ? '▶' : '▼' }}
          </button>
          <h3>{{ character.name || `Nhân vật chính ${index + 1}` }}</h3>
          <span class="badge badge--info">{{ characterText(character).length }} từ</span>
        </div>
        <div class="flex-row">
          <button class="btn btn--secondary btn--sm" @click="injectOne(character)">Nhập vào Worldbook</button>
          <button class="btn btn--ghost btn--sm" @click="duplicateCharacter(index)">Sao chép</button>
          <button class="btn btn--danger btn--sm" @click="removeCharacter(index)">Xóa</button>
        </div>
      </div>

      <div v-show="!character.collapsed" class="card__body">
        <div class="lock-strip">
          <span class="hint">Bảo vệ trường AI:</span>
          <button v-for="group in lockGroups" :key="group.key" class="btn btn--sm"
            :class="isLocked(character, group.key) ? 'btn--primary' : 'btn--ghost'"
            @click="toggleLock(character, group.key)">{{ isLocked(character, group.key) ? 'Đã khóa' : 'Khóa' }} {{ group.label }}</button>
        </div>
        <div class="section-title">Thông tin cơ bản</div>
        <div class="grid-2">
          <div class="form-group"><label>Tên nhân vật</label><input class="input" v-model="character.name" placeholder="Tên chính thức" @input="syncDescription"></div>
          <div class="form-group"><label>Biệt danh / Danh hiệu</label><input class="input" v-model="character.aliases" placeholder="Nhiều tên phân tách bằng dấu phẩy" @input="syncDescription"></div>
        </div>
        <div class="grid-3">
          <div class="form-group"><label>Giới tính</label><input class="input" v-model="character.gender" placeholder="Nữ / Nam / Không rõ" @input="syncDescription"></div>
          <div class="form-group"><label>Tuổi</label><input class="input" v-model="character.age" placeholder="24 tuổi / Ngoại hình thanh niên" @input="syncDescription"></div>
          <div class="form-group"><label>Chủng tộc</label><input class="input" v-model="character.race" placeholder="Nhân loại, Tinh linh..." @input="syncDescription"></div>
        </div>
        <div class="form-group"><label>Thân phận / Nghề nghiệp / Định vị cốt truyện</label><input class="input" v-model="character.role" placeholder="Thân phận và vai trò trong câu chuyện" @input="syncDescription"></div>

        <div class="section-title">Thân thể và ngoại hình</div>
        <div class="grid-2">
          <div class="form-group"><label>Đặc trưng thân thể</label><textarea class="textarea" v-model="character.body" rows="3" placeholder="Chiều cao, vóc dáng, màu da, nét đặc trưng" @input="syncDescription"></textarea></div>
          <div class="form-group"><label>Gương mặt và kiểu tóc</label><textarea class="textarea" v-model="character.face" rows="3" placeholder="Ngũ quan, màu mắt, màu tóc, kiểu tóc" @input="syncDescription"></textarea></div>
        </div>
        <div class="form-group"><label>Trang phục và khí chất</label><textarea class="textarea" v-model="character.clothing" rows="3" placeholder="Trang phục thường mặc, phụ kiện, khí chất tổng thể và thói quen động tác" @input="syncDescription"></textarea></div>

        <div class="section-title">Tính cách và hành vi</div>
        <div class="grid-2">
          <div class="form-group"><label>Đặc trưng tính cách</label><textarea class="textarea" v-model="character.personality" rows="4" placeholder="Tính cách cốt lõi, ưu khuyết điểm, phản ứng cảm xúc" @input="syncDescription"></textarea></div>
          <div class="form-group"><label>Động cơ, mục tiêu và giới hạn</label><textarea class="textarea" v-model="character.motivation" rows="4" placeholder="Muốn đạt được gì, sợ hãi điều gì, tuyệt đối không làm gì" @input="syncDescription"></textarea></div>
        </div>
        <div class="grid-2">
          <div class="form-group"><label>Cách nói chuyện</label><textarea class="textarea" v-model="character.speech" rows="3" placeholder="Giọng điệu, khẩu ngữ, xưng hô và văn phong diễn đạt" @input="syncDescription"></textarea></div>
          <div class="form-group"><label>Sở thích và ghét bỏ</label><textarea class="textarea" v-model="character.preferences" rows="3" placeholder="Sở thích, ghét bỏ, thói quen và điểm yếu" @input="syncDescription"></textarea></div>
        </div>

        <div class="section-title">Trải nghiệm và quan hệ</div>
        <div class="grid-2">
          <div class="form-group"><label>Bối cảnh trải nghiệm</label><textarea class="textarea" v-model="character.background" rows="4" placeholder="Quá trình trưởng thành, biến cố quan trọng, hoàn cảnh hiện tại" @input="syncDescription"></textarea></div>
          <div class="form-group"><label>Quan hệ nhân vật</label><textarea class="textarea" v-model="character.relationships" rows="4" placeholder="Quan hệ với {{user}}, các nhân vật khác và tổ chức" @input="syncDescription"></textarea></div>
        </div>
        <div class="form-group"><label>Thông tin bổ sung (văn bản tự do)</label><textarea class="textarea" v-model="character.extra" rows="5" placeholder="Các thiết lập hoặc quy tắc đặc biệt không thuộc các phân loại trên" @input="syncDescription"></textarea></div>
      </div>
    </div>

    <div v-if="characters.length" class="card mb-md">
      <div class="card__header flex-between">
        <h3>Xem trước tổng hợp (description)</h3>
        <div class="flex-row">
          <button class="btn btn--secondary btn--sm" @click="injectAll">Nhập tất cả vào Worldbook</button>
          <button class="btn btn--primary btn--sm" @click="syncDescription(true)">Đồng bộ vào thẻ nhân vật</button>
        </div>
      </div>
      <div class="card__body">
        <pre class="preview selectable">{{ compiledDescription || '(Vui lòng điền thông tin nhân vật)' }}</pre>
        <div class="hint mt-sm">Token ước tính: ~{{ Math.round(compiledDescription.length * 1.3) }}</div>
      </div>
    </div>

    <div class="card mb-md">
      <div class="card__header"><h3>Thiết lập bối cảnh</h3></div>
      <div class="card__body"><textarea class="textarea" v-model="d.scenario" rows="4" placeholder="Thời gian, địa điểm và tình huống khởi đầu" @input="markDirty"></textarea></div>
    </div>

    <div class="card mb-md">
      <div class="card__header flex-between"><h3>Mẫu đối thoại (mes_example)</h3><span class="badge badge--info">{{ (d.mes_example || '').length }} từ</span></div>
      <div class="card__body"><textarea class="textarea" v-model="d.mes_example" rows="8" placeholder="<START>&#10;{{user}}: ...&#10;Tên nhân vật: ..." @input="markDirty"></textarea></div>
    </div>

    <div class="card mb-md">
      <div class="card__header"><h3>System Prompt</h3></div>
      <div class="card__body">
        <div class="form-group"><label>System Prompt</label><textarea class="textarea" v-model="d.system_prompt" rows="5" @input="markDirty"></textarea></div>
        <div class="form-group"><label>Chỉ lệnh sau lịch sử trò chuyện (post_history_instructions)</label><textarea class="textarea" v-model="d.post_history_instructions" rows="3" @input="markDirty"></textarea></div>
        <div class="form-group">
          <label>Depth Prompt</label>
          <div class="grid-2">
            <textarea class="textarea" v-model="d.extensions.depth_prompt.prompt" rows="3" @input="markDirty"></textarea>
            <div class="grid-2">
              <input class="input" type="number" v-model.number="d.extensions.depth_prompt.depth" min="0" @input="markDirty">
              <select class="select" v-model="d.extensions.depth_prompt.role" @change="markDirty"><option value="system">System</option><option value="user">User</option><option value="assistant">Assistant</option></select>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card__header"><h3>Thông tin meta</h3></div>
      <div class="card__body">
        <div class="grid-2">
          <div class="form-group"><label>Tác giả</label><input class="input" v-model="d.creator" @input="markDirty"></div>
          <div class="form-group"><label>Phiên bản</label><input class="input" v-model="d.character_version" @input="markDirty"></div>
        </div>
        <div class="form-group"><label>Ghi chú của tác giả</label><textarea class="textarea" v-model="d.creator_notes" rows="3" @input="markDirty"></textarea></div>
        <div class="form-group"><label>Tag</label><input class="input" :value="(d.tags || []).join(', ')" @input="d.tags = $event.target.value.split(',').map(t => t.trim()).filter(Boolean); markDirty()"></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue';
import { useCardStore } from '../stores/card.js';
import { useAppStore } from '../stores/app.js';

const store = useCardStore();
const appStore = useAppStore();
const d = computed(() => store.cardData);
const characters = computed(() => {
  if (!Array.isArray(d.value.extensions.cardforge_main_characters)) d.value.extensions.cardforge_main_characters = [];
  for (const character of d.value.extensions.cardforge_main_characters) {
    if (!Array.isArray(character.lockedFields)) character.lockedFields = [];
  }
  return d.value.extensions.cardforge_main_characters;
});

function emptyCharacter() {
  return {
    id: crypto.randomUUID(), name: '', aliases: '', gender: '', age: '', race: '', role: '',
    body: '', face: '', clothing: '', personality: '', motivation: '', speech: '',
    preferences: '', background: '', relationships: '', extra: '', collapsed: false, lockedFields: []
  };
}
const lockGroups = [
  { key: 'identity', label: 'Thân phận' }, { key: 'appearance', label: 'Ngoại hình' },
  { key: 'behavior', label: 'Tính cách hành vi' }, { key: 'interaction', label: 'Ngôn ngữ quan hệ' },
  { key: 'history', label: 'Bối cảnh bí mật' }
];
function isLocked(character, key) { return Array.isArray(character.lockedFields) && character.lockedFields.includes(key); }
function toggleLock(character, key) {
  character.lockedFields ||= [];
  const index = character.lockedFields.indexOf(key);
  if (index === -1) character.lockedFields.push(key); else character.lockedFields.splice(index, 1);
  store.markDirty();
}
function labeled(lines, label, value) { if (String(value || '').trim()) lines.push(`${label}: ${String(value).trim()}`); }
function characterText(c) {
  const hasContent = ['name','aliases','gender','age','race','role','body','face','clothing','personality',
    'motivation','speech','preferences','background','relationships','extra']
    .some(key => String(c[key] || '').trim());
  if (!hasContent) return '';
  const lines = [`【Nhân vật chính: ${c.name || 'Chưa đặt tên'}】`];
  for (const [label, key] of [
    ['Biệt danh/Danh hiệu','aliases'], ['Giới tính','gender'], ['Tuổi','age'], ['Chủng tộc','race'], ['Thân phận/Định vị','role'],
    ['Đặc trưng thân thể','body'], ['Gương mặt và kiểu tóc','face'], ['Trang phục và khí chất','clothing'], ['Tính cách','personality'],
    ['Động cơ, mục tiêu và giới hạn','motivation'], ['Cách nói chuyện','speech'], ['Sở thích và ghét bỏ','preferences'],
    ['Bối cảnh trải nghiệm','background'], ['Quan hệ nhân vật','relationships'], ['Thông tin bổ sung','extra']
  ]) labeled(lines, label, c[key]);
  return lines.join('\n');
}
const compiledDescription = computed(() => characters.value.map(characterText).filter(Boolean).join('\n\n'));

function syncDescription(showToast = false) {
  d.value.description = compiledDescription.value;
  d.value.personality = characters.value.filter(c => c.name && c.personality).map(c => `${c.name}: ${c.personality}`).join('\n');
  store.markDirty();
  if (showToast) appStore.toastSuccess('Nhân vật chính đã được đồng bộ vào thẻ nhân vật');
}
function addCharacter() { characters.value.push(emptyCharacter()); syncDescription(); }
function duplicateCharacter(index) {
  const clone = JSON.parse(JSON.stringify(characters.value[index]));
  clone.id = crypto.randomUUID(); clone.name = clone.name ? `${clone.name} (Bản sao)` : '';
  characters.value.splice(index + 1, 0, clone); syncDescription();
}
function removeCharacter(index) {
  appStore.confirmAction(`Xác nhận xóa "${characters.value[index].name || `Nhân vật chính ${index + 1}`}"?`, () => {
    characters.value.splice(index, 1); syncDescription();
  });
}
function worldEntryFor(c) {
  const content = characterText(c);
  const duplicate = store.worldEntries.some(e => e.comment === c.name && e.content === content);
  if (duplicate) return false;
  const entry = store.addWorldEntry();
  entry.comment = c.name || 'Nhân vật chính chưa đặt tên';
  entry.keys = [c.name, ...String(c.aliases || '').split(/[,，、]/)].map(v => v.trim()).filter(Boolean);
  entry.content = content; entry.constant = false; entry.enabled = true; entry.selective = false;
  entry.position = 'after_char'; entry.insertion_order = 100;
  entry.extensions.exclude_recursion = true; entry.extensions.prevent_recursion = true;
  return true;
}
function injectOne(c) {
  if (!c.name) return appStore.toastWarning('Vui lòng điền tên nhân vật trước');
  appStore.chooseAction(`Tiêm "${c.name}" vào bản nháp Worldbook dạng kích hoạt?\nTừ khóa: ${[c.name, c.aliases].filter(Boolean).join('、')}`, [
    { value: 'apply', label: 'Áp dụng và tiêm', cls: 'btn--primary' }, { value: 'cancel', label: 'Hủy', cls: 'btn--ghost' }
  ], choice => {
    if (choice !== 'apply') return;
    if (!worldEntryFor(c)) return appStore.toastWarning(`Worldbook đã tồn tại mục "${c.name}" tương tự`);
    appStore.toastSuccess(`Đã nhập "${c.name}" vào Worldbook`);
  });
}
function injectAll() {
  const valid = characters.value.filter(c => c.name);
  if (!valid.length) return appStore.toastWarning('Vui lòng điền ít nhất một tên nhân vật');
  const added = valid.filter(worldEntryFor).length;
  if (added === 0) return appStore.toastWarning('Tất cả nhân vật đã chọn đều đã tồn tại trong Worldbook');
  appStore.toastSuccess(`Đã nhập ${added} nhân vật chính vào Worldbook`);
}
function markDirty() { store.markDirty(); }
onMounted(() => {
  if (!characters.value.length && (d.value.description || d.value.personality)) {
    const legacy = emptyCharacter();
    legacy.name = d.value.name || ''; legacy.personality = d.value.personality || ''; legacy.extra = d.value.description || '';
    characters.value.push(legacy);
  }
});
</script>

<style scoped>
.character-card { border-color: rgba(100,200,255,.18); }
.section-title { margin:12px 0 10px;padding-bottom:6px;border-bottom:1px solid var(--cf-border);color:var(--cf-accent);font-size:13px;font-weight:600; }
.section-title:first-child { margin-top:0; }
.preview { margin:0;padding:12px;max-height:500px;overflow-y:auto;white-space:pre-wrap;font:13px/1.75 var(--cf-font);color:var(--cf-text-primary);background:rgba(0,0,0,.12);border-radius:var(--cf-radius-sm); }
.lock-strip { display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:14px;padding:10px;background:var(--cf-bg-tertiary);border-radius:var(--cf-radius-sm); }
</style>