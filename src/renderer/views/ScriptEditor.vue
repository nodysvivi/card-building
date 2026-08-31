<template>
  <div class="page">
    <div class="page__header flex-between">
      <div>
        <h1>Script Tavern Helper</h1>
        <p>Chỉnh sửa script Tavern Helper — Nạp MVU, Zod Schema, logic tự động hóa</p>
      </div>
      <div class="flex-row">
        <button class="btn btn--accent" @click="autoGenScript" :disabled="aiGen">
          {{ aiGen ? 'Đang tạo tự động...' : 'AI tạo tự động hoàn toàn' }}
        </button>
        <button class="btn btn--primary" @click="store.addTavernScript()">+ Tạo script mới</button>
      </div>
    </div>

    <div class="card mb-md">
      <div class="card__body hint" style="line-height:1.8">
        Script Tavern Helper là chương trình viết bằng JavaScript, chạy bên trong SillyTavern. Các công dụng phổ biến:<br>
        · <strong>Nạp MVU</strong> — Dùng 1 dòng lệnh import để nạp hệ thống biến (dùng trang Bàn làm việc tạo tự động sẽ tiện hơn)<br>
        · <strong>Zod Schema</strong> — Định nghĩa cấu trúc biến và ràng buộc phạm vi giá trị<br>
        · <strong>Tự động hóa</strong> — Lắng nghe biến cập nhật, tự động tính toán (như hồi phục thể lực mỗi ngày)<br>
        · <strong>Nút bấm</strong> — Thêm các nút thao tác tùy biến trên giao diện<br>
        · <strong>Không cần dùng script?</strong> Thẻ nhân vật đơn giản không cần mục này, chỉ dùng khi làm hệ thống trò chơi / theo dõi biến số
      </div>
    </div>

    <div v-if="scripts.length === 0" class="card">
      <div class="empty-state">
        <div class="empty-state__icon"></div>
        <div class="empty-state__title">Chưa có script Tavern Helper nào</div>
        <div class="empty-state__desc">Script có thể dùng để nạp hệ thống biến MVU, định nghĩa Zod Schema, thêm nút bấm...</div>
      </div>
    </div>

    <div v-for="(script, i) in scripts" :key="script.id" class="card mb-md">
      <div class="card__header">
        <div class="flex-row">
          <span class="badge badge--accent">#{{ i + 1 }}</span>
          <input class="input" style="width:300px;font-weight:600" v-model="script.name" @input="store.markDirty()">
          <label class="toggle-label">
            <input type="checkbox" v-model="script.enabled" @change="store.markDirty()"> Bật
          </label>
        </div>
        <button class="btn btn--danger btn--sm" @click="appStore.confirmAction('Xóa script này?', () => store.removeTavernScript(script.id))">Xóa</button>
      </div>
      <div class="card__body">
        <div class="form-group">
          <label>Mô tả script (info)</label>
          <input class="input" v-model="script.info" placeholder="Văn bản mô tả tùy chọn" @input="store.markDirty()">
        </div>
        <div class="form-group">
          <label>Mã nguồn script (content)</label>
          <textarea class="textarea selectable" v-model="script.content" rows="16"
            style="font-family:var(--cf-font-mono);font-size:12px;line-height:1.6"
            placeholder="Mã JavaScript, ví dụ:&#10;import 'https://testingcf.jsdelivr.net/gh/MagicalAstrogy/MagVarUpdate/artifact/bundle.js';"
            @input="store.markDirty()"></textarea>
          <div class="hint">{{ (script.content || '').length }} ký tự</div>
        </div>

        <!-- Mẫu chèn nhanh -->
        <div class="flex-row mb-md">
          <span style="font-size:12px;color:var(--cf-text-muted)">Chèn nhanh:</span>
          <button class="btn btn--ghost btn--sm" @click="insertTemplate(script, 'mvu')">Nạp MVU</button>
          <button class="btn btn--ghost btn--sm" @click="insertTemplate(script, 'zod')">Zod Schema</button>
          <button class="btn btn--ghost btn--sm" @click="insertTemplate(script, 'auto')">Mẫu tự động hóa</button>
          <button class="btn btn--ghost btn--sm" @click="insertTemplate(script, 'command')">Sửa lệnh</button>
          <button class="btn btn--ghost btn--sm" @click="insertTemplate(script, 'inject')">Tiêm prompt</button>
        </div>

        <!-- Cấu hình nút bấm -->
        <div class="form-group">
          <div class="flex-between">
            <label>Cấu hình nút bấm</label>
            <label class="toggle-label">
              <input type="checkbox" v-model="script.button.enabled" @change="store.markDirty()"> Bật nút bấm
            </label>
          </div>
          <div v-if="script.button.enabled">
            <div v-for="(btn, j) in script.button.buttons" :key="j" class="flex-row mb-md">
              <input class="input flex-1" v-model="btn.name" placeholder="Tên nút bấm" @input="store.markDirty()">
              <label class="toggle-label">
                <input type="checkbox" v-model="btn.visible" @change="store.markDirty()"> Hiển thị mặc định
              </label>
              <button class="btn btn--danger btn--sm"
                @click="script.button.buttons.splice(j, 1); store.markDirty()">×</button>
            </div>
            <button class="btn btn--secondary btn--sm"
              @click="script.button.buttons.push({ name: 'Nút mới', visible: true }); store.markDirty()">
              + Thêm nút bấm
            </button>
          </div>
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
import { chatForJsonArray } from '../utils/json-repair.js';

const store = useCardStore();
const apiStore = useApiStore();
const appStore = useAppStore();
const aiGen = ref(false);

async function autoGenScript() {
  if (!apiStore.isConfigured) { appStore.toastError('Vui lòng cấu hình API Key trong cài đặt trước'); return; }
  aiGen.value = true;
  try {
    const context = buildCardContext(store, '', { modelContextTokens: apiStore.getModelContextTokens(apiStore.activeProvider?.model) });
    const hasWorldBook = store.worldEntries.length > 0;
    const hasMvu = store.tavernScripts.some(s => s.content && s.content.includes('MagVarUpdate'));

    const prompt = `Bạn là chuyên gia về script Tavern Helper của SillyTavern. Dựa trên thông tin thẻ nhân vật sau, hãy tự động phán đoán cần những script nào và tạo mã tương ứng.

【Thông tin thẻ nhân vật】
${context}

【Trạng thái hiện tại】
- Đã có mục Worldbook: ${hasWorldBook ? 'Có' : 'Chưa'}
- Đã có hệ thống biến MVU: ${hasMvu ? 'Có' : 'Chưa'}
- Số lượng script hiện có: ${store.tavernScripts.length}

Vui lòng tự động phán đoán các script thẻ này cần. Logic phán đoán phổ biến:
- Có MVU → Cần script nạp MVU + Zod Schema
- Có hệ thống số liệu phức tạp → Cần script tự động hóa (như hồi thể lực mỗi ngày)
- Có độ hảo cảm NPC → Có thể cần script tiêm prompt

Với mỗi script, xuất mảng JSON:
[{ "name": "Tên script", "content": "Mã JS hoàn chỉnh", "info": "Mô tả" }]

Chỉ tạo các script thực sự cần thiết. Chỉ xuất JSON.`;

    const scripts = await chatForJsonArray(apiStore, [
      { role: 'system', content: 'Bạn là chuyên gia script Tavern Helper. Chỉ xuất mảng JSON hợp lệ bằng tiếng Việt.' },
      { role: 'user', content: prompt }
    ], { temperature: 0.7, maxTokens: apiStore.getModelMaxTokens(apiStore.activeProvider?.model) });
    for (const s of scripts) {
      store.addTavernScript({
        ...store.createEmptyTavernScript(),
        name: s.name || 'Script do AI tạo',
        content: (s.content || '').trim(),
        info: s.info || ''
      });
    }
    appStore.toastSuccess(`AI đã tự động tạo ${scripts.length} script`);
  } catch (e) {
    appStore.toastError('Tạo tự động thất bại: ' + e.message);
  } finally { aiGen.value = false; }
}

const scripts = computed(() => store.tavernScripts);

const templates = {
  mvu: `import 'https://testingcf.jsdelivr.net/gh/MagicalAstrogy/MagVarUpdate/artifact/bundle.js';`,
  zod: `import { registerMvuSchema } from
  'https://testingcf.jsdelivr.net/gh/StageDog/tavern_resource/dist/util/mvu_zod.js';

// z và _ (lodash) đã có sẵn toàn cục

export const Schema = z.object({
  "Thế giới": z.object({
    "Ngày": z.string().prefault('Ngày 1'),
    "Thời gian": z.string().prefault('08:00'),
    "Vị trí": z.string().prefault('Không rõ'),
  }).prefault({}),

  "Nhân vật chính": z.object({
    "HP": z.coerce.number().transform(v => _.clamp(v, 0, 100)).prefault(100),
    "Tiền": z.coerce.number().transform(v => Math.max(0, v)).prefault(1000),
  }).prefault({}),

  "NPC": z.record(z.string(), z.object({
    "Độ hảo cảm": z.coerce.number().transform(v => _.clamp(v, -100, 100)).prefault(0),
  })).prefault({}),
});

$(() => { registerMvuSchema(Schema); });`,
  auto: `// Mẫu script tự động hóa — Lắng nghe cập nhật biến
$(() => {
  waitGlobalInitialized('Mvu').then(() => {
    eventOn(Mvu.events.VARIABLE_UPDATE_ENDED, errorCatched(async () => {
      const data = Mvu.getMvuData({ type: 'message' });
      if (!data) return;

      // Viết logic tự động hóa tại đây
      // Ví dụ: Tự động hồi phục thể lực
      // const hp = _.get(data, 'Nhân vật chính.HP', 100);
      // if (hp < 100) {
      //   _.set(data, 'Nhân vật chính.HP', Math.min(100, hp + 5));
      //   Mvu.replaceMvuData(data, { type: 'message' });
      // }
    }));
  });
});`,
  command: `// Mẫu sửa phân tích lệnh — Sửa lệnh cập nhật biến do AI xuất ra
$(() => {
  waitGlobalInitialized('Mvu').then(() => {
    eventOn(Mvu.events.COMMAND_PARSED, errorCatched(commands => {
      commands.forEach(command => {
        // Sửa các ký tự sai trong đường dẫn
        command.args[0] = command.args[0].replaceAll('-', '');
        // Có thể thêm các logic sửa lỗi khác tại đây
      });
    }));
  });
});`,
  inject: `// Mẫu tiêm prompt — Tiêm động giá trị biến dùng cho kích hoạt đèn xanh
$(() => {
  waitGlobalInitialized('Mvu').then(() => {
    eventOn(Mvu.events.VARIABLE_UPDATE_ENDED, errorCatched(async (newVars) => {
      const value = _.get(newVars, 'stat_data.Nhân vật chính.Độ hảo cảm', 0);
      injectPrompts([{
        id: 'Kích hoạt-Độ hảo cảm',
        content: 'Độ hảo cảm=' + value,
        position: 'none',
        should_scan: true,
      }]);
    }));
  });
});`
};

function insertTemplate(script, type) {
  if (script.content) {
    appStore.confirmAction('Mã hiện đã tồn tại, bạn có muốn thay thế không?', () => {
      script.content = templates[type];
      store.markDirty();
    });
    return;
  }
  script.content = templates[type];
  store.markDirty();
}
</script>

<style scoped>
.toggle-label {
  display: flex; align-items: center; gap: 6px;
  font-size: 13px; cursor: pointer; color: var(--cf-text-secondary);
  input { accent-color: var(--cf-accent); }
}
</style>