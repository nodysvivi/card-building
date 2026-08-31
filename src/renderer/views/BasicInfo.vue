<template>
  <div class="page">
    <div class="page__header">
      <h1>Thông tin cơ bản</h1>
      <p>Chỉnh sửa thông tin cơ bản của thẻ nhân vật</p>
    </div>

    <div class="card mb-md">
      <div class="card__body">
        <div class="form-group">
          <label>Tên tác phẩm <span class="badge badge--danger">Bắt buộc</span></label>
          <input class="input input--lg" v-model="d.name" placeholder="Đặt tên cho tác phẩm của bạn" @input="markDirty">
          <div class="hint">Đây chính là tên của thẻ nhân vật, cũng là tên của {{char}}. Trong cuộc trò chuyện {{char}} sẽ được thay thế bằng tên này.</div>
        </div>

        <div class="form-group">
          <label>Thể loại tác phẩm</label>
          <input class="input" v-model="cardType" placeholder="Ví dụ: Kỳ ảo phiêu lưu / Đô thị hiện đại / Cyberpunk / Lịch sử giả tưởng / Đời thường học đường" @input="markDirty">
          <div class="hint">Giúp tính năng AI hiểu được thẻ của bạn thuộc thể loại gì, từ đó đưa ra đề xuất chính xác hơn.</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useCardStore } from '../stores/card.js';

const store = useCardStore();
const d = computed(() => store.cardData);
const cardType = computed({
  get: () => (store.cardData.tags || []).find(t => t.startsWith('Thể loại:') || t.startsWith('类型:'))?.replace(/^(Thể loại:|类型:)/, '') || '',
  set: (val) => {
    const tags = (store.cardData.tags || []).filter(t => !t.startsWith('Thể loại:') && !t.startsWith('类型:'));
    if (val) tags.unshift('Thể loại:' + val);
    store.cardData.tags = tags;
    store.markDirty();
  }
});

function markDirty() { store.markDirty(); }
</script>

<style scoped>
.input--lg {
  font-size: 16px;
  padding: 14px 18px;
}
</style>