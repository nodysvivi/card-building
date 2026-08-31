<template>
  <div class="page">
    <div class="page__header flex-between">
      <div>
        <h1>Nhân vật người chơi</h1>
        <p>Thiết lập thông tin cơ bản cho {{user}} (chính người chơi) — Tính năng tùy chọn, để trống người chơi tự do phát huy</p>
      </div>
      <label class="toggle-label">
        <input type="checkbox" v-model="enabled"> Bật thiết lập nhân vật người chơi
      </label>
    </div>

    <div v-if="enabled">
      <div class="card mb-md">
        <div class="card__header"><h3>Thông tin cơ bản</h3></div>
        <div class="card__body">
          <div class="grid-2">
            <div class="form-group">
              <label>Tên người chơi</label>
              <input class="input" v-model="player.name" placeholder="Để trống người dùng tự đặt tên" @input="syncToCard">
            </div>
            <div class="form-group">
              <label>Giới tính</label>
              <select class="select" v-model="player.gender" @change="syncToCard">
                <option value="">Không giới hạn</option>
                <option value="男">Nam</option>
                <option value="女">Nữ</option>
                <option value="自定义">Tùy chỉnh</option>
              </select>
            </div>
          </div>
          <div class="grid-3">
            <div class="form-group">
              <label>Tuổi</label>
              <input class="input" v-model="player.age" placeholder="VD: 18 tuổi / Thanh niên" @input="syncToCard">
            </div>
            <div class="form-group">
              <label>Chủng tộc</label>
              <input class="input" v-model="player.race" placeholder="VD: Nhân loại, Tinh linh, Thú nhân" @input="syncToCard">
            </div>
            <div class="form-group">
              <label>Thân phận / Nghề nghiệp</label>
              <input class="input" v-model="player.role" placeholder="VD: Học sinh, Nhà thám hiểm, Nhân viên văn phòng" @input="syncToCard">
            </div>
          </div>
          <div class="form-group">
            <label>Mô tả ngoại hình</label>
            <input class="input" v-model="player.appearance" placeholder="Mô tả ngắn gọn, để trống nếu không giới hạn" @input="syncToCard">
          </div>
          <div class="form-group">
            <label>Đặc điểm tính cách</label>
            <input class="input" v-model="player.personality" placeholder="VD: Cởi mở, Trầm lặng, Dịu dàng" @input="syncToCard">
          </div>
          <div class="form-group">
            <label>Câu chuyện bối cảnh</label>
            <textarea class="textarea" v-model="player.background" rows="4"
              placeholder="Thiết lập bối cảnh của nhân vật người chơi (tùy chọn)" @input="syncToCard"></textarea>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card__header flex-between">
          <h3>Xem trước (sẽ ghi vào scenario)</h3>
          <button class="btn btn--primary btn--sm" @click="syncToCard">Đồng bộ vào thẻ nhân vật</button>
        </div>
        <div class="card__body">
          <pre class="preview selectable">{{ previewText }}</pre>
        </div>
      </div>
    </div>

    <div v-else class="card">
      <div class="empty-state">
        <div class="empty-state__icon"></div>
        <div class="empty-state__title">Thiết lập nhân vật người chơi đang tắt</div>
        <div class="empty-state__desc">
          {{user}} chính là người sử dụng thẻ nhân vật (bản thân người chơi).<br>
          Sau khi bật có thể thiết lập sẵn tên, thân phận... để AI biết người chơi là ai.<br>
          Rất nhiều thẻ không thiết lập {{user}} để người chơi tự do nhập vai — tính năng này hoàn toàn tùy chọn.
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue';
import { useCardStore } from '../stores/card.js';
import { useAppStore } from '../stores/app.js';

const cardStore = useCardStore();
const appStore = useAppStore();

const enabled = ref(false);
const player = reactive({
  name: '', gender: '', age: '', race: '', role: '',
  appearance: '', personality: '', background: ''
});

const previewText = computed(() => {
  const lines = [];
  lines.push('【Thiết lập nhân vật người chơi】');
  if (player.name) lines.push(`Tên: ${player.name}`);
  if (player.gender) lines.push(`Giới tính: ${player.gender}`);
  if (player.race) lines.push(`Chủng tộc: ${player.race}`);
  if (player.age) lines.push(`Tuổi: ${player.age}`);
  if (player.role) lines.push(`Thân phận: ${player.role}`);
  if (player.appearance) lines.push(`Ngoại hình: ${player.appearance}`);
  if (player.personality) lines.push(`Tính cách: ${player.personality}`);
  if (player.background) lines.push(`Bối cảnh: ${player.background}`);
  return lines.length > 1 ? lines.join('\n') : '(Vui lòng điền ít nhất một mục thông tin)';
});

function syncToCard() {
  if (!enabled.value) return;
  const existing = cardStore.cardData.scenario || '';
  const marker = '【Thiết lập nhân vật người chơi】';
  const legacyMarker = '【玩家角色设定】';
  let cleaned = existing;
  if (cleaned.includes(marker)) {
    cleaned = cleaned.split(marker)[0].trim();
  } else if (cleaned.includes(legacyMarker)) {
    cleaned = cleaned.split(legacyMarker)[0].trim();
  }
  cardStore.cardData.scenario = cleaned + (cleaned ? '\n\n' : '') + previewText.value;
  cardStore.markDirty();
  appStore.toastSuccess('Đã đồng bộ vào scenario');
}
</script>

<style scoped>
.toggle-label {
  display: flex; align-items: center; gap: 6px;
  font-size: 13px; cursor: pointer; color: var(--cf-text-secondary);
  input { accent-color: var(--cf-accent); }
}
.preview {
  font-size: 13px; line-height: 1.7; color: var(--cf-text-primary);
  white-space: pre-wrap; font-family: var(--cf-font); background: none; border: none; margin: 0;
}
</style>