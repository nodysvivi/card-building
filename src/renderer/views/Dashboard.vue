<template>
  <div class="page">
    <div class="page__header">
      <h1>Chào mừng đến với CardBuilding, bắt đầu sáng tạo tại đây</h1>
      <p>Công cụ tạo thẻ nhân vật SillyTavern toàn năng — Từ nhân vật đơn giản đến thế giới phức tạp, đúc kết tại một nơi</p>
    </div>

    <div class="card mb-md project-shelf">
      <div class="card__header flex-between">
        <div><h3>Dự án nhân vật</h3><span class="hint">Mỗi dự án tương ứng với một thẻ nhân vật có thể xuất độc lập</span></div>
        <button class="btn btn--secondary btn--sm" @click="saveCurrentProject" :disabled="!cardStore.currentProjectId">Lưu dự án hiện tại</button>
      </div>
      <div class="card__body">
        <div class="flex-row mb-md">
          <input class="input flex-1" v-model="newProjectName" placeholder="Tên dự án mới">
          <button class="btn btn--primary" @click="createProject">Tạo dự án mới</button>
        </div>
        <div v-if="cardStore.projects.length" class="project-grid">
          <button v-for="project in cardStore.projects" :key="project.id" class="project-chip"
            :class="{ active: project.id === cardStore.currentProjectId }" @click="cardStore.switchProject(project.id)">
            <span>{{ project.name || 'Nhân vật chưa đặt tên' }}</span>
            <small>{{ new Date(project.updatedAt).toLocaleString('vi-VN') }}</small>
            <i @click.stop="deleteProject(project)">Xóa</i>
          </button>
        </div>
        <div v-else class="hint">Chưa có dự án nào; việc chỉnh sửa thẻ đơn lẻ và xuất nhập vẫn hoạt động bình thường.</div>
      </div>
    </div>

    <!-- Thao tác nhanh -->
    <div class="grid-2 mb-md">
      <div class="dash-action" @click="handleNew" style="position:relative">
        <div class="dash-action__icon"></div>
        <div class="dash-action__title">Tạo thẻ nhân vật mới</div>
        <div class="dash-action__desc">Bắt đầu tạo từ mẫu trắng</div>
      </div>
      <div class="dash-action" @click="handleImport" style="position:relative">
        <div class="dash-action__icon"></div>
        <div class="dash-action__title">Nhập thẻ nhân vật</div>
        <div class="dash-action__desc">Mở file PNG hoặc JSON</div>
      </div>
    </div>

    <div class="grid-2 mb-md">
      <div class="dash-action" @click="$router.push('/npc')" style="position:relative">
        <div class="dash-action__icon"></div>
        <div class="dash-action__title">Trình tạo NPC</div>
        <div class="dash-action__desc">Dùng AI tạo nhân vật nhanh chóng</div>
      </div>
      <div class="dash-action" @click="handleImportFromWorldbook" style="position:relative">
        <div class="dash-action__icon"></div>
        <div class="dash-action__title">Tạo thẻ từ Worldbook</div>
        <div class="dash-action__desc">Tạo thẻ trắng từ JSON Worldbook của ST (tự động nạp các mục)</div>
      </div>
    </div>

    <div class="grid-2 mb-md">
      <div class="dash-action" @click="showAssetImport = true" style="position:relative">
        <div class="dash-action__icon"></div>
        <div class="dash-action__title">Nhập tài sản từ thẻ khác</div>
        <div class="dash-action__desc">Chọn lọc Worldbook / MVU / Regex / Script từ thẻ khác để gộp vào thẻ hiện tại</div>
      </div>
    </div>

    <AssetImportModal :visible="showAssetImport" @close="showAssetImport = false" />

    <!-- Thông tin thẻ hiện tại -->
    <div class="card" v-if="cardStore.cardData.name" style="position:relative">
      <div class="card__header">
        <h3>Thẻ nhân vật hiện tại</h3>
        <span class="badge badge--accent">{{ cardStore.isDirty ? 'Chưa lưu' : 'Đã lưu' }}</span>
      </div>
      <div class="card__body">
        <div class="grid-2">
          <div class="dash-stat">
            <span class="dash-stat__label">Tên nhân vật</span>
            <span class="dash-stat__value">{{ cardStore.cardName }}</span>
          </div>
          <div class="dash-stat">
            <span class="dash-stat__label">Mục Worldbook</span>
            <span class="dash-stat__value">{{ cardStore.stats.totalEntries }} mục
              <small>({{ cardStore.stats.enabledEntries }} bật / {{ cardStore.stats.constantEntries }} thường trực)</small>
            </span>
          </div>
          <div class="dash-stat">
            <span class="dash-stat__label">Script Regex</span>
            <span class="dash-stat__value">{{ cardStore.stats.regexCount }} script</span>
          </div>
          <div class="dash-stat">
            <span class="dash-stat__label">Script Tavern Helper</span>
            <span class="dash-stat__value">{{ cardStore.stats.scriptCount }} script</span>
          </div>
          <div class="dash-stat">
            <span class="dash-stat__label">Lời mở đầu dự phòng</span>
            <span class="dash-stat__value">{{ cardStore.stats.alternateGreetings }} mục</span>
          </div>
          <div class="dash-stat">
            <span class="dash-stat__label">Token ước tính</span>
            <span class="dash-stat__value">~{{ cardStore.stats.estimatedTokens.toLocaleString() }}</span>
          </div>
        </div>

        <div class="flex-row mt-md">
          <button class="btn btn--primary" @click="$router.push('/basic')">Chỉnh sửa thẻ nhân vật</button>
          <button class="btn btn--secondary" @click="handleExport">Xuất thẻ</button>
        </div>
      </div>
    </div>

    <!-- Trạng thái trống -->
    <div class="card" v-else style="position:relative">
      <div class="empty-state">
        <div class="empty-state__icon"></div>
        <div class="empty-state__title">Chưa mở thẻ nhân vật nào</div>
        <div class="empty-state__desc">
          Nhấp "Tạo thẻ nhân vật mới" ở trên để bắt đầu từ đầu, hoặc "Nhập thẻ nhân vật" để mở file PNG/JSON có sẵn
        </div>
      </div>
    </div>

    <!-- Tổng quan tính năng -->
    <div class="card mt-md" style="position:relative">
      <div class="card__header"><h3>Tổng quan tính năng</h3></div>
      <div class="card__body">
        <div class="grid-3">
          <div class="feature-item">
            <strong>Chỉnh sửa toàn diện các trường</strong>
            <p>Toàn bộ các trường theo quy cách V2: description, personality, scenario...</p>
          </div>
          <div class="feature-item">
            <strong>Trình chỉnh sửa Worldbook</strong>
            <p>Thêm sửa xóa mục, quản lý từ khóa, cấu hình vị trí / thứ tự / độ ưu tiên</p>
          </div>
          <div class="feature-item">
            <strong>Script Regex</strong>
            <p>markdownOnly/promptOnly, kiểm soát độ sâu tầng tin nhắn, xem trước thời gian thực</p>
          </div>
          <div class="feature-item">
            <strong>Script Tavern Helper</strong>
            <p>Chỉnh sửa mã MVU / Zod Schema, cấu hình nút bấm chức năng</p>
          </div>
          <div class="feature-item">
            <strong>Trình tạo NPC</strong>
            <p>AI tạo tự động hoàn toàn / mở rộng thông tin then chốt, tiêm 1 chạm vào Worldbook</p>
          </div>
          <div class="feature-item">
            <strong>Thống kê thẻ</strong>
            <p>Thống kê số lượng mục, ước tính token, phân tích cấu trúc thẻ</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useCardStore } from '../stores/card.js';
import { useAppStore } from '../stores/app.js';
import AssetImportModal from '../components/AssetImportModal.vue';
import { parseStWorldbookEntries } from '../utils/st-worldbook-import.js';

const router = useRouter();
const cardStore = useCardStore();
const appStore = useAppStore();
const api = window.cardForgeAPI;
const showAssetImport = ref(false);
const newProjectName = ref('');

async function createProject() {
  await cardStore.createProject(newProjectName.value.trim() || `Dự án nhân vật ${cardStore.projects.length + 1}`);
  newProjectName.value = '';
  appStore.toastSuccess('Dự án đã được tạo');
  router.push('/basic');
}
async function saveCurrentProject() {
  await cardStore.persistProjects();
  appStore.toastSuccess('Dự án hiện tại đã được lưu');
}
function deleteProject(project) {
  appStore.confirmAction(`Xóa dự án "${project.name}"?`, async () => {
    await cardStore.removeProject(project.id);
    appStore.toastSuccess('Dự án đã được xóa');
  });
}

function handleNew() {
  cardStore.newCard();
  router.push('/basic');
  appStore.toastSuccess('Đã tạo thẻ nhân vật mới');
}

async function handleImport() {
  const filePath = await api.openFile();
  if (!filePath) return;

  try {
    if (filePath.endsWith('.json')) {
      const result = await api.readTextFile(filePath);
      if (!result.success) throw new Error(result.error);
      const json = JSON.parse(result.data);
      cardStore.loadFromJson(json);
      cardStore.filePath = filePath;
      appStore.toastSuccess(`Đã nhập: ${cardStore.cardName}`);
      router.push('/basic');
      return;
    }

    if (filePath.endsWith('.png')) {
      // Đọc đồng thời PNG base64 làm ảnh bìa dự phòng
      const fileResult = await api.readFile(filePath);
      const base64 = fileResult.success ? `data:image/png;base64,${fileResult.data}` : null;

      // Thử trích xuất dữ liệu thẻ nhân vật
      const charaResult = await api.extractCharaData(filePath);

      if (!charaResult.success) {
        // PNG chỉ là ảnh bìa thuần (không chứa dữ liệu thẻ) → giữ nguyên cardData, chỉ đặt ảnh bìa
        cardStore.coverImagePath = filePath;
        if (base64) cardStore.coverImageBase64 = base64;
        cardStore.markDirty();
        appStore.toastSuccess('Đã đặt ảnh bìa (PNG không chứa dữ liệu thẻ nhân vật)');
        router.push('/basic');
        return;
      }

      // PNG chứa đầy đủ dữ liệu thẻ nhân vật
      const applyOverwrite = () => {
        cardStore.loadFromJson(charaResult.data);
        cardStore.filePath = filePath;
        cardStore.coverImagePath = filePath;
        if (base64) cardStore.coverImageBase64 = base64;
        appStore.toastSuccess(`Đã nhập: ${cardStore.cardName}`);
        router.push('/basic');
      };
      const applyCoverOnly = () => {
        cardStore.coverImagePath = filePath;
        if (base64) cardStore.coverImageBase64 = base64;
        cardStore.markDirty();
        appStore.toastSuccess('Đã đặt ảnh bìa (dữ liệu thẻ nhân vật đã được bỏ qua)');
        router.push('/basic');
      };

      if (cardStore.isDirty) {
        appStore.chooseAction(
          'File PNG này chứa dữ liệu thẻ nhân vật hoàn chỉnh. Thẻ hiện tại đang có thay đổi chưa lưu, bạn muốn xử lý thế nào?',
          [
            { value: 'cover', label: 'Chỉ dùng làm ảnh bìa', cls: 'btn--primary' },
            { value: 'overwrite', label: 'Dùng PNG ghi đè thẻ hiện tại', cls: 'btn--secondary' },
            { value: 'cancel', label: 'Hủy', cls: 'btn--ghost' },
          ],
          (choice) => {
            if (choice === 'overwrite') applyOverwrite();
            else if (choice === 'cover') applyCoverOnly();
          }
        );
        return;
      }

      applyOverwrite();
      return;
    }

    throw new Error('Định dạng file không được hỗ trợ');
  } catch (e) {
    appStore.toastError(`Nhập thất bại: ${e.message}`);
  }
}

async function handleImportFromWorldbook() {
  const filePath = await api.openFile();
  if (!filePath) return;
  if (!filePath.endsWith('.json')) {
    appStore.toastError('Vui lòng chọn file Worldbook định dạng .json');
    return;
  }
  try {
    const result = await api.readTextFile(filePath);
    if (!result.success) throw new Error(result.error);
    const rawJson = JSON.parse(result.data);
    const { entries, unsupportedPosition } = parseStWorldbookEntries(rawJson);
    if (entries.length === 0) {
      appStore.toastWarning('Không tìm thấy mục Worldbook hợp lệ trong file JSON');
      return;
    }
    cardStore.newCard();
    const fileName = filePath.split(/[/\\]/).pop().replace(/\.json$/i, '');
    cardStore.cardData.character_book.name = fileName;
    cardStore.cardData.character_book.entries = entries;
    cardStore.markDirty();

    let msg = `Đã tạo thẻ trắng từ Worldbook: ${entries.length} mục`;
    if (unsupportedPosition > 0) {
      msg += ` (${unsupportedPosition} mục có loại position không được hỗ trợ, đã chuyển thành after_char)`;
    }
    appStore.toastSuccess(msg);
    setTimeout(() => {
      appStore.toastInfo('Vui lòng điền tên nhân vật / mô tả / lời mở đầu trong trình chỉnh sửa');
    }, 1500);
    router.push('/basic');
  } catch (e) {
    appStore.toastError(`Nhập thất bại: ${e.message}`);
  }
}

async function handleExport() {
  try {
    const json = cardStore.exportJson();
    const defaultName = (cardStore.cardData.name || 'character') + '.json';
    const savePath = await api.saveFile({ defaultPath: defaultName });
    if (!savePath) return;

    if (savePath.endsWith('.json')) {
      await api.writeFile(savePath, JSON.stringify(json, null, 2));
      appStore.toastSuccess('Xuất JSON thành công');
    } else if (savePath.endsWith('.png')) {
      if (!cardStore.coverImagePath) {
        const imgPath = await api.openImage();
        if (!imgPath) {
          appStore.toastWarning('Cần chọn một ảnh bìa trước khi xuất file PNG');
          return;
        }
        cardStore.coverImagePath = imgPath;
      }
      const result = await api.embedCharaData(cardStore.coverImagePath, json, savePath);
      if (!result.success) throw new Error(result.error);
      appStore.toastSuccess('Xuất thẻ nhân vật PNG thành công');
    }
  } catch (e) {
    appStore.toastError(`Xuất thất bại: ${e.message}`);
  }
}
</script>

<style scoped>
.dash-action {
  background: var(--cf-bg-secondary);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: var(--cf-radius-md);
  padding: 24px;
  cursor: pointer;
  transition: var(--cf-transition);
  text-align: center;
}
.dash-action:hover {
  transform: translateY(-2px);
  border-color: rgba(245, 158, 66, 0.3);
}
.dash-action__icon { font-size: 32px; margin-bottom: 12px; }
.dash-action__title { font-size: 15px; font-weight: 600; margin-bottom: 4px; }
.dash-action__desc { font-size: 12px; color: var(--cf-text-muted); }

.dash-stat {
  padding: 12px 0;
}
.dash-stat__label {
  display: block;
  font-size: 11px;
  color: var(--cf-text-muted);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 4px;
}
.dash-stat__value {
  font-size: 15px;
  font-weight: 600;
}
.dash-stat__value small {
  font-weight: 400;
  color: var(--cf-text-secondary);
  font-size: 12px;
}

.feature-item {
  padding: 12px;
  strong { font-size: 13px; display: block; margin-bottom: 4px; }
  p { font-size: 12px; color: var(--cf-text-muted); line-height: 1.5; }
}
.project-grid { display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px; }
.project-chip { display:flex;flex-direction:column;align-items:flex-start;gap:4px;padding:12px;text-align:left;background:var(--cf-bg-tertiary);color:var(--cf-text-primary);border:1px solid var(--cf-border);border-radius:var(--cf-radius-sm);cursor:pointer; }
.project-chip.active { border-color:var(--cf-accent);background:var(--cf-accent-dim); }
.project-chip small { color:var(--cf-text-muted);font-size:10px; }
.project-chip i { color:var(--cf-danger);font-style:normal;font-size:11px;align-self:flex-end; }
</style>