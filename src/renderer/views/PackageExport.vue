<template>
  <div class="page">
    <div class="page__header">
      <h1>Đóng gói thẻ nhân vật</h1>
      <p>Tải lên ảnh bìa, xuất thành thẻ nhân vật PNG hoặc file JSON</p>
    </div>

    <div class="card mb-md">
      <div class="card__body hint" style="line-height:1.8">
        Sau khi hoàn tất mọi thiết lập, bạn có thể xuất thẻ nhân vật tại đây:<br>
        · <strong>Định dạng PNG</strong> (Khuyên dùng) — Dữ liệu nhân vật được nhúng vào trong ảnh, chia sẻ bằng file ảnh tiện lợi, đối phương nhập vào là dùng được ngay<br>
        · <strong>Định dạng JSON</strong> — File dữ liệu thuần, phù hợp cho việc phát triển, gỡ lỗi và sao lưu<br>
        · Xuất file PNG cần tải lên một ảnh bìa (ảnh đại diện nhân vật) trước
      </div>
    </div>

    <!-- Ảnh bìa -->
    <div class="card mb-md">
      <div class="card__header"><h3>Ảnh bìa</h3></div>
      <div class="card__body">
        <div class="cover-area" @click="selectCover">
          <div v-if="coverPreview" class="cover-preview">
            <img :src="coverPreview" alt="Xem trước ảnh bìa">
            <div class="cover-overlay">Nhấp để thay đổi</div>
          </div>
          <div v-else class="cover-placeholder">
            <div style="font-size:48px;margin-bottom:12px"></div>
            <div style="font-size:14px">Nhấp để tải lên ảnh bìa</div>
            <div class="hint mt-md">Hỗ trợ PNG / JPG / WEBP</div>
          </div>
        </div>
        <div class="hint mt-md" v-if="store.coverImagePath">
          Ảnh hiện tại: {{ store.coverImagePath }}
        </div>
      </div>
    </div>

    <!-- Tổng quan thẻ nhân vật -->
    <div class="card mb-md">
      <div class="card__header"><h3>Tổng quan thẻ nhân vật</h3></div>
      <div class="card__body">
        <div class="grid-3">
          <div class="pack-stat">
            <div class="pack-stat__label">Tên nhân vật</div>
            <div class="pack-stat__value">{{ store.cardName }}</div>
          </div>
          <div class="pack-stat">
            <div class="pack-stat__label">Mục Worldbook</div>
            <div class="pack-stat__value">{{ s.totalEntries }} mục</div>
          </div>
          <div class="pack-stat">
            <div class="pack-stat__label">Script Regex</div>
            <div class="pack-stat__value">{{ s.regexCount }} script</div>
          </div>
          <div class="pack-stat">
            <div class="pack-stat__label">Script Tavern Helper</div>
            <div class="pack-stat__value">{{ s.scriptCount }} script</div>
          </div>
          <div class="pack-stat">
            <div class="pack-stat__label">Lời mở đầu dự phòng</div>
            <div class="pack-stat__value">{{ s.alternateGreetings }} mục</div>
          </div>
          <div class="pack-stat">
            <div class="pack-stat__label">Token ước tính</div>
            <div class="pack-stat__value">~{{ s.estimatedTokens.toLocaleString() }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Kiểm tra trước khi xuất (Chỉ tham khảo, không chặn xuất) -->
    <div class="card mb-md" v-if="healthIssues.length > 0">
      <div class="card__header flex-between">
        <h3>Kiểm tra trước khi xuất</h3>
        <span class="badge badge--info">Chỉ mang tính tham khảo · Không chặn xuất file</span>
      </div>
      <div class="card__body">
        <div class="hint mb-md">Dưới đây là các vấn đề tiềm ẩn được phát hiện, bạn có thể bỏ qua và tiếp tục xuất:</div>
        <div v-for="(issue, i) in healthIssues" :key="i" style="margin-bottom:6px;font-size:13px">
          <span class="badge badge--info" style="margin-right:8px">Gợi ý</span>
          {{ issue.msg }}
        </div>
      </div>
    </div>

    <!-- Ghi đè file gốc (Chỉ hiển thị khi nhập từ file PNG bên ngoài) -->
    <div v-if="canQuickSave" class="card mb-md quick-save-card">
      <div class="card__header"><h3>Lưu nhanh</h3></div>
      <div class="card__body">
        <p class="hint mb-md">
          Phát hiện thẻ này được nhập từ file PNG bên ngoài. Sau khi sửa đổi có thể ghi đè trực tiếp vào file gốc mà không cần chọn lại vị trí lưu.<br>
          Đường dẫn file gốc: <code style="font-size:11px">{{ store.filePath }}</code>
        </p>
        <button class="btn btn--primary" style="width:100%" @click="quickSaveOriginal">
          Ghi đè lưu vào file gốc
        </button>
      </div>
    </div>

    <!-- Nút xuất file -->
    <div class="card">
      <div class="card__header"><h3>Xuất (Lưu thành file mới)</h3></div>
      <div class="card__body">
        <div class="grid-2">
          <div class="export-option" @click="exportPng">
            <div style="font-size:32px;margin-bottom:8px"></div>
            <strong>Xuất thành thẻ nhân vật PNG</strong>
            <p class="hint">Nhúng dữ liệu nhân vật vào ảnh bìa, định dạng chia sẻ thẻ nhân vật chuẩn</p>
            <span class="badge badge--warning mt-md" v-if="!store.coverImagePath">Cần tải lên ảnh bìa trước</span>
          </div>
          <div class="export-option" @click="exportJson">
            <div style="font-size:32px;margin-bottom:8px"></div>
            <strong>Xuất thành file JSON</strong>
            <p class="hint">Định dạng dữ liệu thuần, phù hợp cho việc phát triển, gỡ lỗi và sao lưu</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useCardStore } from '../stores/card.js';
import { useAppStore } from '../stores/app.js';

const store = useCardStore();
const appStore = useAppStore();
const api = window.cardForgeAPI;

const s = computed(() => store.stats);

// Kiểm tra có thể lưu nhanh hay không (thẻ được nhập từ file PNG bên ngoài)
const canQuickSave = computed(() => {
  return store.filePath &&
         store.filePath.toLowerCase().endsWith('.png') &&
         store.coverImagePath;
});

async function quickSaveOriginal() {
  if (!store.filePath) { appStore.toastError('Chưa phát hiện đường dẫn file gốc'); return; }
  try {
    const json = store.exportJson();
    const result = await api.embedCharaData(store.coverImagePath, json, store.filePath);
    if (!result.success) throw new Error(result.error);
    store.isDirty = false;
    appStore.toastSuccess('Đã lưu vào file gốc: ' + store.filePath);
  } catch (e) {
    appStore.toastError('Lưu thất bại: ' + e.message);
  }
}

const healthIssues = computed(() => {
  const issues = [];
  const d = store.cardData;
  if (!d.name) issues.push({ level: 'danger', msg: 'Tên nhân vật đang trống (bắt buộc)' });
  if (!d.first_mes) issues.push({ level: 'danger', msg: 'Lời mở đầu đang trống (bắt buộc)' });
  if (s.value.scriptCount > 0 && s.value.regexCount === 0) issues.push({ level: 'warning', msg: 'Có script Tavern Helper nhưng không có script Regex, có thể thiếu regex thu gọn/làm sạch biến' });
  if (s.value.regexCount > 0 && s.value.totalEntries === 0) issues.push({ level: 'warning', msg: 'Có script Regex nhưng không có mục Worldbook' });
  if (s.value.scriptCount > 0 && !d.creator_notes?.includes('Tavern Helper') && !d.creator_notes?.includes('酒馆助手')) {
    issues.push({ level: 'warning', msg: 'Có sử dụng script nhưng creator_notes chưa nhắc người chơi cài đặt plugin Tavern Helper' });
  }
  const hasStatusPlaceholder = (d.first_mes || '').includes('StatusPlaceHolderImpl');
  const hasStatusRegex = (d.extensions?.regex_scripts || []).some(r => r.replaceString?.includes('StatusPlaceHolderImpl') || r.findRegex?.includes('StatusPlaceHolderImpl'));
  if (hasStatusRegex && !hasStatusPlaceholder) issues.push({ level: 'warning', msg: 'Có regex thanh trạng thái nhưng lời mở đầu thiếu placeholder <StatusPlaceHolderImpl/>' });
  if (!d.description && s.value.totalEntries === 0) issues.push({ level: 'warning', msg: 'description và Worldbook đều trống, AI sẽ không biết phải đóng vai nhân vật nào' });
  return issues;
});
const coverPreview = ref(null);

onMounted(async () => {
  if (store.coverImagePath) {
    await loadCoverPreview(store.coverImagePath);
  }
});

async function loadCoverPreview(path) {
  try {
    const result = await api.readFile(path);
    if (result.success) {
      const ext = path.split('.').pop().toLowerCase();
      const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
      coverPreview.value = `data:${mime};base64,${result.data}`;
    }
  } catch (e) {}
}

async function selectCover() {
  const path = await api.openImage();
  if (path) {
    store.coverImagePath = path;
    await loadCoverPreview(path);
    appStore.toastSuccess('Đã thiết lập ảnh bìa');
  }
}

async function exportPng() {
  if (!store.coverImagePath) {
    await selectCover();
    if (!store.coverImagePath) return;
  }

  const name = store.cardData.name || 'character';
  const savePath = await api.saveFile({
    defaultPath: name + '.png',
    filters: [{ name: 'Thẻ nhân vật PNG', extensions: ['png'] }]
  });
  if (!savePath) return;

  try {
    const json = store.exportJson();
    const result = await api.embedCharaData(store.coverImagePath, json, savePath);
    if (!result.success) throw new Error(result.error);
    appStore.toastSuccess('Xuất thẻ nhân vật PNG thành công!');
  } catch (e) {
    appStore.toastError(`Xuất thất bại: ${e.message}`);
  }
}

async function exportJson() {
  const name = store.cardData.name || 'character';
  const savePath = await api.saveFile({
    defaultPath: name + '.json',
    filters: [{ name: 'File JSON', extensions: ['json'] }]
  });
  if (!savePath) return;

  try {
    const json = store.exportJson();
    await api.writeFile(savePath, JSON.stringify(json, null, 2));
    appStore.toastSuccess('Xuất JSON thành công!');
  } catch (e) {
    appStore.toastError(`Xuất thất bại: ${e.message}`);
  }
}
</script>

<style scoped>
.cover-area {
  width: 280px;
  height: 360px;
  border: 2px dashed rgba(255, 255, 255, 0.15);
  border-radius: var(--cf-radius-md);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: var(--cf-transition);
  overflow: hidden;
  position: relative;
}
.cover-area:hover {
  border-color: rgba(0, 229, 255, 0.4);
}
.cover-preview {
  width: 100%;
  height: 100%;
  position: relative;
}
.cover-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.cover-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 14px;
  opacity: 0;
  transition: var(--cf-transition);
}
.cover-area:hover .cover-overlay { opacity: 1; }

.cover-placeholder {
  text-align: center;
  color: var(--cf-text-muted);
}

.pack-stat {
  padding: 8px 0;
}
.pack-stat__label {
  font-size: 11px;
  color: var(--cf-text-muted);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 2px;
}
.pack-stat__value {
  font-size: 15px;
  font-weight: 600;
}

.export-option {
  background: rgba(0, 0, 0, 0.1);
  border: 1px solid var(--cf-border);
  border-radius: var(--cf-radius-md);
  padding: 24px;
  text-align: center;
  cursor: pointer;
  transition: var(--cf-transition);
}
.export-option:hover {
  border-color: rgba(0, 229, 255, 0.3);
  transform: translateY(-2px);
}
.quick-save-card {
  border: 1px solid rgba(255, 215, 0, 0.3);
  background: rgba(255, 215, 0, 0.04);
}
.quick-save-card code {
  background: rgba(0, 0, 0, 0.2);
  padding: 2px 6px;
  border-radius: 3px;
  color: var(--cf-text-primary);
}
</style>