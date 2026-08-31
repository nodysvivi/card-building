<template>
  <div class="page">
    <div class="page__header">
      <h1>Cài đặt API</h1>
      <p>Cấu hình nhà cung cấp AI — Điền Key và mô hình để sử dụng trong Trình tạo NPC, Trợ lý AI...</p>
    </div>

    <!-- Thanh trạng thái nhà cung cấp đang kích hoạt -->
    <div class="card mb-md current-bar">
      <div class="card__body flex-between">
        <div>
          <span style="font-size:12px;color:var(--cf-text-muted)">Đang sử dụng:</span>
          <strong v-if="currentProvider" style="color:#ffd700">
            {{ currentProvider.name }}
            <span style="font-weight:normal;color:var(--cf-text-secondary);font-size:12px">
              · {{ currentProvider.model }}
            </span>
          </strong>
          <strong v-else style="color:var(--cf-warning)">Chưa chọn — Vui lòng nhấp "Đặt làm hiện tại" bên dưới</strong>
        </div>
        <div v-if="lastSavedAt" style="font-size:11px;color:var(--cf-text-muted)">
          Đã tự động lưu · {{ lastSavedAt }}
        </div>
      </div>
    </div>

    <div class="card mb-md">
      <div class="card__header">
        <h3>Tổng quan sử dụng AI</h3>
        <button class="btn btn--ghost btn--sm" @click="apiStore.resetUsageStats()">Xóa sạch thống kê</button>
      </div>
      <div class="card__body" style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px">
        <div><div class="hint">Số lượt yêu cầu</div><strong>{{ apiStore.usageStats.requests }}</strong></div>
        <div><div class="hint">Số lượt thất bại</div><strong>{{ apiStore.usageStats.failures }}</strong></div>
        <div><div class="hint">Tổng token tích lũy</div><strong>{{ totalTokens.toLocaleString() }}</strong></div>
        <div><div class="hint">Thời gian trung bình</div><strong>{{ averageDuration }} giây</strong></div>
      </div>
      <div class="card__body hint" style="padding-top:0">
        Đầu vào {{ apiStore.usageStats.inputTokens.toLocaleString() }} · Đầu ra {{ apiStore.usageStats.outputTokens.toLocaleString() }};
        trong đó {{ apiStore.usageStats.estimatedRequests }} lượt là ước tính do nhà cung cấp không trả về usage.
      </div>
    </div>

    <div class="card mb-md">
      <div class="card__body hint" style="line-height:1.8">
        Mọi tính năng AI của phần mềm (Tạo NPC, Tạo Worldbook, Tạo lời mở đầu, Trợ lý AI...) đều cần cấu hình API Key mới có thể sử dụng.<br>
        · <strong>Tương thích OpenAI</strong> — Hỗ trợ OpenAI chính thức, các trạm chuyển tiếp (relay), DeepSeek, Ollama cục bộ và tất cả dịch vụ tương thích định dạng OpenAI<br>
        · <strong>Claude</strong> — API Anthropic chính thức<br>
        · <strong>Gemini</strong> — API Google chính thức<br>
        · Sau khi cấu hình nhiều nhà cung cấp, nhấp "Đặt làm hiện tại" ở đầu mỗi thẻ để chọn dịch vụ thực tế muốn dùng<br>
        · Key của bạn chỉ lưu trữ cục bộ trên máy (tự động lưu, không cần thao tác thủ công)<br>
        · Nhấp "+ Thêm nhà cung cấp tùy chỉnh" để thêm nhiều nguồn API khác
      </div>
    </div>

    <div v-for="provider in apiStore.providers" :key="provider.id" class="card mb-md"
      :class="{ 'provider-active': apiStore.activeProviderId === provider.id }">
      <div class="card__header">
        <div class="flex-row">
          <label class="active-radio" :class="{ checked: apiStore.activeProviderId === provider.id }">
            <input type="radio" name="active-provider"
              :checked="apiStore.activeProviderId === provider.id"
              :disabled="!provider.apiKey"
              @change="apiStore.setActiveProvider(provider.id)">
            <span>{{ apiStore.activeProviderId === provider.id ? 'Đang sử dụng' : 'Đặt làm hiện tại' }}</span>
          </label>
          <h3>{{ provider.name }}</h3>
          <span v-if="provider.apiKey" class="badge badge--success">Đã cấu hình</span>
          <span v-else class="badge badge--warning">Chưa cấu hình</span>
        </div>
        <div class="flex-row">
          <button v-if="provider.id.startsWith('custom_')"
            class="btn btn--danger btn--sm" @click="appStore.confirmAction('Xóa nhà cung cấp này?', () => apiStore.removeProvider(provider.id))">Xóa</button>
        </div>
      </div>
      <div class="card__body">
        <div class="grid-2">
          <div class="form-group">
            <label>Loại API</label>
            <select class="select" v-model="provider.type">
              <option value="openai">Tương thích OpenAI</option>
              <option value="claude">Claude (Anthropic)</option>
              <option value="gemini">Gemini (Google)</option>
            </select>
          </div>
          <div class="form-group">
            <label>Base URL</label>
            <input class="input" v-model="provider.baseUrl"
              placeholder="Địa chỉ cơ sở API">
          </div>
        </div>
        <div class="grid-2">
          <div class="form-group">
            <label>API Key</label>
            <div class="flex-row">
              <input :type="showKeys[provider.id] ? 'text' : 'password'" class="input flex-1"
                v-model="provider.apiKey" placeholder="Nhập API Key">
              <button class="btn btn--ghost btn--sm"
                @click="showKeys[provider.id] = !showKeys[provider.id]">
                {{ showKeys[provider.id] ? 'Ẩn' : 'Hiển thị' }}
              </button>
            </div>
          </div>
          <div class="form-group">
            <label>Mô hình</label>
            <div class="flex-row">
              <select v-if="modelLists[provider.id]?.length" class="select flex-1" v-model="provider.model">
                <option value="">-- Chọn mô hình --</option>
                <option v-for="m in modelLists[provider.id]" :key="m" :value="m">{{ m }}</option>
              </select>
              <input v-else class="input flex-1" v-model="provider.model"
                placeholder="Nhập Key rồi nhấp lấy mô hình bên phải">
              <button class="btn btn--secondary btn--sm" @click="loadModels(provider)"
                :disabled="modelLoading[provider.id] || !provider.apiKey">
                {{ modelLoading[provider.id] ? 'Đang lấy...' : 'Lấy mô hình' }}
              </button>
            </div>
          </div>
        </div>
        <div class="form-group">
          <label>Nhiệt độ (Temperature)</label>
          <div class="temperature-row">
            <input type="range" class="temperature-slider"
              :value="provider.temperature ?? 0.8"
              min="0" max="2" step="0.01"
              @input="provider.temperature = parseFloat($event.target.value)">
            <input type="number" class="input temperature-input"
              :value="provider.temperature ?? 0.8"
              min="0" max="2" step="0.01"
              @input="provider.temperature = Math.min(2, Math.max(0, parseFloat($event.target.value) || 0))">
          </div>
          <div class="hint" style="margin-top:4px">0 = Tính xác định cao nhất · 1 = Cân bằng · 2 = Ngẫu nhiên nhất. Mặc định 0.8, nội dung sáng tạo có thể tăng, tạo JSON khuyến nghị 0.6~0.8</div>
        </div>
        <div class="form-group">
          <label class="toggle-label">
            <input type="checkbox" v-model="provider.enabled"> Bật nhà cung cấp này (khi tắt không thể đặt làm hiện tại)
          </label>
        </div>
        <button class="btn btn--secondary btn--sm" @click="testConnection(provider)">
          Kiểm tra kết nối
        </button>
      </div>
    </div>

    <button class="btn btn--secondary" @click="apiStore.addProvider()">+ Thêm nhà cung cấp tùy chỉnh</button>
  </div>
</template>

<script setup>
import { reactive, ref, computed, watch } from 'vue';
import { useApiStore } from '../stores/api.js';
import { useAppStore } from '../stores/app.js';

const apiStore = useApiStore();
const totalTokens = computed(() => apiStore.usageStats.inputTokens + apiStore.usageStats.outputTokens);
const averageDuration = computed(() => apiStore.usageStats.requests
  ? (apiStore.usageStats.totalDurationMs / apiStore.usageStats.requests / 1000).toFixed(1)
  : '0.0');
const appStore = useAppStore();
const showKeys = reactive({});
const lastSavedAt = ref('');
const modelLists = reactive({});
const modelLoading = reactive({});

async function loadModels(provider) {
  if (!provider.apiKey) { appStore.toastWarning('Vui lòng điền API Key trước'); return; }
  if (!provider.baseUrl) { appStore.toastWarning('Vui lòng điền Base URL trước'); return; }
  modelLoading[provider.id] = true;
  try {
    const models = await apiStore.fetchModels(provider);
    if (models.length > 0) {
      modelLists[provider.id] = models;
      if (!provider.model || !models.includes(provider.model)) {
        provider.model = models[0];
      }
      appStore.toastSuccess(`Lấy được ${models.length} mô hình`);
    } else {
      appStore.toastWarning('Không lấy được danh sách mô hình, vui lòng kiểm tra Key và Base URL');
    }
  } catch (e) {
    appStore.toastError('Lấy mô hình thất bại: ' + e.message);
  } finally { modelLoading[provider.id] = false; }
}

const currentProvider = computed(() => {
  const id = apiStore.activeProviderId;
  if (id) return apiStore.providers.find(p => p.id === id);
  return null;
});

watch(
  [() => apiStore.providers, () => apiStore.activeProviderId],
  () => {
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    lastSavedAt.value = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  },
  { deep: true }
);

async function testConnection(provider) {
  if (!provider.apiKey) {
    appStore.toastWarning('Vui lòng điền API Key trước');
    return;
  }
  try {
    const origActive = apiStore.activeProviderId;
    apiStore.setActiveProvider(provider.id);
    const result = await apiStore.chat([
      { role: 'user', content: 'Vui lòng trả lời 4 chữ "kết nối thành công"' }
    ], { maxTokens: 20 });
    apiStore.setActiveProvider(origActive);
    appStore.toastSuccess(`${provider.name} kết nối thành công: ${result.slice(0, 30)}`);
  } catch (e) {
    appStore.toastError(`Kết nối thất bại: ${e.message}`);
  }
}
</script>

<style scoped>
.temperature-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.temperature-slider {
  flex: 1;
  accent-color: var(--cf-accent);
  cursor: pointer;
}
.temperature-input {
  width: 70px;
  flex-shrink: 0;
  text-align: center;
}
.toggle-label {
  display: flex; align-items: center; gap: 6px;
  font-size: 13px; cursor: pointer; color: var(--cf-text-secondary);
  input { accent-color: var(--cf-accent); }
}
.current-bar {
  border: 1px solid rgba(255, 215, 0, 0.3);
  background: rgba(255, 215, 0, 0.04);
}
.provider-active {
  border: 1px solid rgba(255, 215, 0, 0.45) !important;
  box-shadow: 0 0 16px rgba(255, 215, 0, 0.12);
}
.active-radio {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: var(--cf-radius-sm);
  font-size: 12px;
  cursor: pointer;
  border: 1px solid var(--cf-border);
  color: var(--cf-text-secondary);
  background: rgba(0, 0, 0, 0.1);
  transition: all 0.2s ease;

  input[type="radio"] {
    accent-color: #ffd700;
    cursor: pointer;
    &:disabled { cursor: not-allowed; }
  }

  &:hover {
    border-color: rgba(255, 215, 0, 0.4);
    color: var(--cf-text-primary);
  }
  &.checked {
    border-color: rgba(255, 215, 0, 0.6);
    background: rgba(255, 215, 0, 0.1);
    color: #ffd700;
    font-weight: 600;
  }
}
</style>