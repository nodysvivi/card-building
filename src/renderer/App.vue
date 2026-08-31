<template>
  <div class="app-root">
    <!-- Lớp hình nền -->
    <div v-if="appStore.wallpaperEnabled" class="wallpaper-layer" :style="wallpaperStyle"></div>

    <!-- Thanh tiêu đề tùy biến -->
    <div class="titlebar">
      <button class="titlebar__hamburger" type="button" aria-label="Mở menu" @click="showSidebar = true">
        <span></span><span></span><span></span>
      </button>
      <div class="titlebar__title">CardBuilding</div>
      <div class="titlebar__controls">
        <div class="ai-task-menu">
          <button
            class="ai-task-trigger"
            :class="{ 'ai-task-trigger--active': showAiTasks }"
            type="button"
            aria-haspopup="dialog"
            :aria-expanded="showAiTasks"
            aria-controls="ai-task-panel"
            @click="showAiTasks = !showAiTasks"
          >
            <span class="ai-task-trigger__dot" :class="{ 'is-running': apiStore.activeRequestCount > 0 }"></span>
            <span>Nhiệm vụ AI</span>
            <span v-if="apiStore.activeRequestCount" class="ai-task-count">{{ apiStore.activeRequestCount }}</span>
          </button>
          <section
            v-if="showAiTasks"
            id="ai-task-panel"
            class="ai-task-panel"
            role="dialog"
            aria-label="Nhiệm vụ AI"
            @keyup.esc="showAiTasks = false"
          >
            <header class="ai-task-panel__header">
              <div>
                <strong>Nhiệm vụ AI</strong>
                <p>{{ apiStore.activeRequestCount ? `Đang thực hiện ${apiStore.activeRequestCount} mục` : 'Hiện không có nhiệm vụ nào đang chạy' }}</p>
              </div>
              <button class="ai-task-panel__close" type="button" aria-label="Đóng bảng nhiệm vụ" @click="showAiTasks = false">×</button>
            </header>
            <div v-if="apiStore.activeTasks.length" class="ai-task-list">
              <article v-for="task in apiStore.activeTasks" :key="task.id" class="ai-task-item">
                <div class="ai-task-item__info">
                  <strong>{{ task.label }}</strong>
                  <span>{{ [task.providerName, task.model].filter(Boolean).join(' · ') }}</span>
                </div>
                <span class="ai-task-item__state"><i></i>{{ task.state === 'stopping' ? 'Đang dừng' : 'Đang chạy' }}</span>
                <button
                  class="ai-task-stop"
                  type="button"
                  :disabled="task.state === 'stopping'"
                  :aria-label="`Dừng ${task.label}`"
                  @click="stopAiTask(task)"
                >Dừng</button>
              </article>
            </div>
            <div v-else class="ai-task-empty">
              <span>✓</span>
              <p>Tất cả nhiệm vụ tạo đã hoàn tất</p>
            </div>
            <footer v-if="apiStore.activeRequestCount > 1" class="ai-task-panel__footer">
              <button type="button" @click="cancelAiRequests">Dừng tất cả nhiệm vụ</button>
            </footer>
          </section>
        </div>
        <template v-if="isElectron">
          <button class="titlebar__btn" @click="api.minimize()">─</button>
          <button class="titlebar__btn" @click="api.maximize()">☐</button>
          <button class="titlebar__btn titlebar__btn--close" @click="api.close()">✕</button>
        </template>
      </div>
    </div>

    <!-- Bố cục chính -->
    <div class="app-layout">
      <!-- Lớp phủ nền khi mở menu trên di động (đặt cùng cấp với sidebar để
           z-index so sánh đúng trong cùng ngữ cảnh xếp lớp của .app-layout) -->
      <div v-if="showSidebar" class="sidebar-backdrop" @click="showSidebar = false"></div>

      <!-- Thanh bên -->
      <aside class="sidebar" :class="{ 'sidebar--open': showSidebar }">
        <div class="sidebar__logo">
          <div class="sidebar__logo-text" style="font-size:15px">
            CardBuilding
            <span class="sub">{{ appVersion }}</span>
          </div>
        </div>

        <nav class="sidebar__nav" @click="showSidebar = false">
          <div class="sidebar__section">
            <div class="sidebar__section-title">Tổng quan</div>
            <router-link to="/" class="sidebar__item" active-class="active" exact>
              <span class="sidebar__item-icon">·</span> Bàn làm việc
            </router-link>
          </div>

          <div class="sidebar__section">
            <div class="sidebar__section-title">Bắt buộc · Cốt lõi tạo thẻ</div>
            <router-link to="/basic" class="sidebar__item" active-class="active">
              <span class="sidebar__item-icon">·</span> Thông tin cơ bản
            </router-link>
            <router-link to="/charsetting" class="sidebar__item" active-class="active">
              <span class="sidebar__item-icon">·</span> Thiết lập nhân vật
            </router-link>
            <router-link to="/worldbook" class="sidebar__item" active-class="active">
              <span class="sidebar__item-icon">·</span> Worldbook
              <span class="badge badge--accent" v-if="cardStore.stats.totalEntries">
                {{ cardStore.stats.totalEntries }}
              </span>
            </router-link>
            <router-link to="/greeting" class="sidebar__item" active-class="active">
              <span class="sidebar__item-icon">·</span> Lời mở đầu
            </router-link>
          </div>

          <div class="sidebar__section">
            <div class="sidebar__section-title">Tùy chọn · Trau chuốt nâng cao</div>
            <router-link to="/npc" class="sidebar__item" active-class="active">
              <span class="sidebar__item-icon">·</span> Trình tạo NPC
            </router-link>
            <router-link to="/novel-extract" class="sidebar__item" active-class="active">
              <span class="sidebar__item-icon">·</span> Trích xuất tiểu thuyết
            </router-link>
            <router-link to="/player" class="sidebar__item" active-class="active">
              <span class="sidebar__item-icon">·</span> Nhân vật người chơi
            </router-link>
            <router-link to="/dialogue" class="sidebar__item" active-class="active">
              <span class="sidebar__item-icon">·</span> Mẫu đối thoại
            </router-link>
            <router-link to="/extra" class="sidebar__item" active-class="active">
              <span class="sidebar__item-icon">·</span> Yêu cầu bổ sung
            </router-link>
          </div>

          <div class="sidebar__section">
            <div class="sidebar__section-title">Bàn làm việc thanh trạng thái</div>
            <router-link to="/workbench" class="sidebar__item sidebar__item--primary" active-class="active">
              <span class="sidebar__item-icon">★</span> Bàn làm việc thanh trạng thái
            </router-link>
          </div>

          <div class="sidebar__section">
            <div class="sidebar__section-title">Mở rộng thẻ</div>
            <router-link to="/regex" class="sidebar__item" active-class="active">
              <span class="sidebar__item-icon">·</span> Script Regex
              <span class="badge badge--info" v-if="cardStore.stats.regexCount">
                {{ cardStore.stats.regexCount }}
              </span>
            </router-link>
            <router-link to="/scripts" class="sidebar__item" active-class="active">
              <span class="sidebar__item-icon">·</span> Script Tavern Helper
            </router-link>
            <router-link to="/ejs" class="sidebar__item" active-class="active">
              <span class="sidebar__item-icon">·</span> Mẫu EJS
            </router-link>
          </div>

          <div class="sidebar__section">
            <div class="sidebar__section-title">Xuất thẻ</div>
            <router-link to="/package" class="sidebar__item" active-class="active">
              <span class="sidebar__item-icon">·</span> Đóng gói thẻ nhân vật
            </router-link>
          </div>

          <div class="sidebar__section">
            <div class="sidebar__section-title">Công cụ</div>
            <router-link to="/diagnostic" class="sidebar__item" active-class="active">
              <span class="sidebar__item-icon">·</span> Chẩn đoán thẻ nhân vật
            </router-link>
            <router-link to="/assistant" class="sidebar__item" active-class="active">
              <span class="sidebar__item-icon">·</span> Trợ lý AI
            </router-link>
            <router-link to="/statistics" class="sidebar__item" active-class="active">
              <span class="sidebar__item-icon">·</span> Thống kê thẻ
            </router-link>
          </div>

          <div class="sidebar__section">
            <div class="sidebar__section-title">Cài đặt</div>
            <router-link to="/api" class="sidebar__item" active-class="active">
              <span class="sidebar__item-icon">·</span> Cài đặt API
              <span class="badge badge--success" v-if="apiStore.isConfigured">OK</span>
            </router-link>
            <div class="sidebar__item" style="cursor:pointer" @click="appStore.toggleWallpaper()">
              <span class="sidebar__item-icon">·</span> Hình nền
              <span class="badge" :class="appStore.wallpaperEnabled ? 'badge--success' : 'badge--warning'">
                {{ appStore.wallpaperEnabled ? 'Bật' : 'Tắt' }}
              </span>
            </div>
            <div class="sidebar__item" style="cursor:pointer" @click="showErrorLog = true">
              <span class="sidebar__item-icon">·</span> Log lỗi
            </div>
            <div v-if="isElectron" class="sidebar__item" style="cursor:pointer" @click="checkUpdate" :class="{ disabled: checkingUpdate }">
              <span class="sidebar__item-icon">·</span> {{ checkingUpdate ? 'Đang kiểm tra...' : 'Kiểm tra cập nhật' }}
            </div>
          </div>
        </nav>

      </aside>

      <!-- Vùng nội dung chính -->
      <main class="main-content">
        <router-view v-slot="{ Component }">
          <keep-alive>
            <component :is="Component" />
          </keep-alive>
        </router-view>
      </main>
    </div>

    <!-- Modal log lỗi -->
    <ErrorLogModal :visible="showErrorLog" @close="showErrorLog = false" />

    <!-- Hộp thoại xác nhận tùy biến -->
    <div v-if="appStore.confirmVisible" class="cf-confirm-overlay" @click.self="appStore.confirmNo()">
      <div class="cf-confirm-dialog">
        <div class="cf-confirm-msg">{{ appStore.confirmMessage }}</div>
        <div class="cf-confirm-btns">
          <button class="btn btn--danger" @click="appStore.confirmYes()">Xác nhận</button>
          <button class="btn btn--secondary" @click="appStore.confirmNo()">Hủy</button>
        </div>
      </div>
    </div>

    <!-- Hộp thoại đa lựa chọn -->
    <div v-if="appStore.chooseVisible" class="cf-confirm-overlay" @click.self="appStore.chooseResolve(null)">
      <div class="cf-confirm-dialog">
        <div class="cf-confirm-msg">{{ appStore.chooseMessage }}</div>
        <div class="cf-confirm-btns">
          <button v-for="opt in appStore.chooseOptions" :key="opt.value"
            class="btn" :class="opt.cls || 'btn--secondary'"
            @click="appStore.chooseResolve(opt.value)">
            {{ opt.label }}
          </button>
        </div>
      </div>
    </div>

    <!-- Bộ công cụ nổi toàn cục -->
    <FloatingTools v-if="$route.path !== '/assistant' && $route.path !== '/diagnostic'" />

    <!-- Thông báo Toast -->
    <div class="toast-container">
      <div
        v-for="t in appStore.toasts"
        :key="t.id"
        :class="['toast', `toast--${t.type}`]"
      >
        {{ t.message }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useCardStore } from './stores/card.js';
import { useApiStore } from './stores/api.js';
import { useAppStore } from './stores/app.js';
import wallpaperDataUrl from './wallpaper-data.js';
import ErrorLogModal from './components/ErrorLogModal.vue';
import FloatingTools from './components/FloatingTools.vue';
import { isElectron } from './utils/platform.js';

const api = window.cardForgeAPI;
const cardStore = useCardStore();
const apiStore = useApiStore();
const appStore = useAppStore();

const showSidebar = ref(false);
const appVersion = ref('');
const showErrorLog = ref(false);
const showAiTasks = ref(false);

const checkingUpdate = ref(false);
async function cancelAiRequests() {
  const count = await apiStore.cancelAllRequests();
  if (count) appStore.toastInfo(`Đã hủy ${count} yêu cầu AI`);
}

async function stopAiTask(task) {
  try {
    const stopped = await apiStore.cancelRequest(task.id);
    if (stopped) appStore.toastInfo(`Đang dừng "${task.label}"`);
  } catch (error) {
    appStore.toastError(`Dừng nhiệm vụ thất bại: ${error.message}`);
  }
}

async function checkUpdate() {
  if (checkingUpdate.value) return;
  checkingUpdate.value = true;
  try {
    const res = await window.cardForgeAPI.checkForUpdates();
    if (!res.success) {
      appStore.toastError('Kiểm tra thất bại: ' + (res.error || 'Lỗi không xác định'));
    } else if (res.skipped === 'dev') {
      appStore.toastInfo(res.message);
    } else if (res.version && res.version !== res.current) {
      appStore.toastInfo(`Phát hiện phiên bản mới ${res.version}`);
    } else {
      appStore.toastSuccess(`Đã là phiên bản mới nhất (${res.current || ''})`);
    }
  } catch (e) {
    appStore.toastError('Kiểm tra thất bại: ' + e.message);
  } finally {
    checkingUpdate.value = false;
  }
}

const wallpaperStyle = ref({ backgroundImage: `url(${wallpaperDataUrl})` });

onMounted(async () => {
  await appStore.loadTheme();
  await apiStore.loadFromDisk();
  await cardStore.loadProjects();
  if (isElectron) {
    try { appVersion.value = 'v' + await api.getAppVersion(); } catch {}
  }
});
</script>