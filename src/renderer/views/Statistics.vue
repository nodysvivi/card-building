<template>
  <div class="page">
    <div class="page__header">
      <h1>Thống kê thẻ</h1>
      <p>Phân tích cấu trúc và thống kê dữ liệu của thẻ nhân vật hiện tại</p>
    </div>

    <div v-if="!cardStore.cardData.name" class="card">
      <div class="empty-state">
        <div class="empty-state__icon"></div>
        <div class="empty-state__title">Chưa có dữ liệu</div>
        <div class="empty-state__desc">Vui lòng tạo hoặc nhập một thẻ nhân vật trước</div>
      </div>
    </div>

    <template v-else>
      <!-- Tổng quan -->
      <div class="grid-3 mb-md">
        <div class="stat-card">
          <div class="stat-card__value">{{ s.totalEntries }}</div>
          <div class="stat-card__label">Mục Worldbook</div>
          <div class="stat-card__sub">{{ s.enabledEntries }} bật / {{ s.disabledEntries }} tắt</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__value">{{ s.regexCount }}</div>
          <div class="stat-card__label">Script Regex</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__value">{{ s.scriptCount }}</div>
          <div class="stat-card__label">Script Tavern Helper</div>
        </div>
      </div>

      <div class="grid-2 mb-md">
        <div class="stat-card">
          <div class="stat-card__value">~{{ s.estimatedTokens.toLocaleString() }}</div>
          <div class="stat-card__label">Ước tính tổng token</div>
          <div class="stat-card__sub">{{ s.totalContentChars.toLocaleString() }} ký tự</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__value">{{ s.constantEntries }}</div>
          <div class="stat-card__label">Mục thường trực</div>
          <div class="stat-card__sub">Tiêu hao cố định mỗi lượt hội thoại</div>
        </div>
      </div>

      <!-- Phân bố Worldbook -->
      <div class="card mb-md">
        <div class="card__header"><h3>Phân bố mục Worldbook</h3></div>
        <div class="card__body">
          <div class="wb-dist">
            <div class="wb-dist__row">
              <span class="wb-dist__label">Thường trực (constant)</span>
              <div class="wb-dist__bar">
                <div class="wb-dist__fill" style="background:var(--cf-warning)"
                  :style="{ width: pct(constCount, total) + '%' }"></div>
              </div>
              <span class="wb-dist__num">{{ constCount }}</span>
            </div>
            <div class="wb-dist__row">
              <span class="wb-dist__label">Kích hoạt (keyword)</span>
              <div class="wb-dist__bar">
                <div class="wb-dist__fill" style="background:var(--cf-info)"
                  :style="{ width: pct(triggerCount, total) + '%' }"></div>
              </div>
              <span class="wb-dist__num">{{ triggerCount }}</span>
            </div>
            <div class="wb-dist__row">
              <span class="wb-dist__label">Đã tắt (disabled)</span>
              <div class="wb-dist__bar">
                <div class="wb-dist__fill" style="background:var(--cf-danger)"
                  :style="{ width: pct(disabledCount, total) + '%' }"></div>
              </div>
              <span class="wb-dist__num">{{ disabledCount }}</span>
            </div>
          </div>

          <div class="divider"></div>

          <div class="grid-2">
            <div>
              <strong style="font-size:13px">Phân bố vị trí</strong>
              <p style="font-size:12px;color:var(--cf-text-secondary);margin-top:4px">
                before_char: {{ beforeCount }} mục<br>
                after_char: {{ afterCount }} mục
              </p>
            </div>
            <div>
              <strong style="font-size:13px">Sử dụng trường thông tin</strong>
              <p style="font-size:12px;color:var(--cf-text-secondary);margin-top:4px">
                description: {{ cardStore.cardData.description ? 'Có nội dung' : 'Trống' }}<br>
                personality: {{ cardStore.cardData.personality ? 'Có nội dung' : 'Trống' }}<br>
                scenario: {{ cardStore.cardData.scenario ? 'Có nội dung' : 'Trống' }}<br>
                system_prompt: {{ cardStore.cardData.system_prompt ? 'Có nội dung' : 'Trống' }}
              </p>
            </div>
          </div>
        </div>
      </div>
      <!-- Chi tiết script Regex -->
      <div class="card mb-md" v-if="cardStore.regexScripts.length > 0">
        <div class="card__header"><h3>Chi tiết script Regex</h3></div>
        <div class="card__body">
          <div v-for="r in cardStore.regexScripts" :key="r.id" style="margin-bottom:6px;font-size:12px">
            <span class="badge" :class="r.markdownOnly ? 'badge--info' : r.promptOnly ? 'badge--warning' : 'badge--accent'" style="margin-right:6px">
              {{ r.markdownOnly ? 'Hiển thị' : r.promptOnly ? 'Lớp AI' : 'Hai lớp' }}
            </span>
            {{ r.scriptName || '(Chưa đặt tên)' }}
            <span style="color:var(--cf-text-muted)"> | thay thế {{ (r.replaceString || '').length }} ký tự</span>
            <span v-if="r.minDepth !== null" style="color:var(--cf-text-muted)"> | minD={{ r.minDepth }}</span>
            <span v-if="r.maxDepth !== null" style="color:var(--cf-text-muted)"> | maxD={{ r.maxDepth }}</span>
          </div>
        </div>
      </div>

      <!-- Chi tiết script Tavern Helper -->
      <div class="card mb-md" v-if="cardStore.tavernScripts.length > 0">
        <div class="card__header"><h3>Chi tiết script Tavern Helper</h3></div>
        <div class="card__body">
          <div v-for="sc in cardStore.tavernScripts" :key="sc.id" style="margin-bottom:6px;font-size:12px">
            <span class="badge" :class="sc.enabled ? 'badge--success' : 'badge--danger'" style="margin-right:6px">
              {{ sc.enabled ? 'Đang bật' : 'Đã tắt' }}
            </span>
            {{ sc.name || '(Chưa đặt tên)' }}
            <span style="color:var(--cf-text-muted)"> | {{ (sc.content || '').length }} ký tự</span>
            <span v-if="sc.button?.buttons?.length" style="color:var(--cf-text-muted)"> | {{ sc.button.buttons.length }} nút bấm</span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useCardStore } from '../stores/card.js';

const cardStore = useCardStore();
const s = computed(() => cardStore.stats);
const entries = computed(() => cardStore.worldEntries);

const total = computed(() => entries.value.length || 1);
const constCount = computed(() => entries.value.filter(e => e.constant && e.enabled).length);
const triggerCount = computed(() => entries.value.filter(e => !e.constant && e.enabled).length);
const disabledCount = computed(() => entries.value.filter(e => !e.enabled).length);
const beforeCount = computed(() => entries.value.filter(e => e.position === 'before_char').length);
const afterCount = computed(() => entries.value.filter(e => e.position === 'after_char').length);

function pct(n, t) { return t > 0 ? Math.round(n / t * 100) : 0; }
</script>

<style scoped>
.stat-card {
  background: var(--cf-bg-secondary);
  border: 1px solid var(--cf-border);
  border-radius: var(--cf-radius-md);
  padding: 24px;
  text-align: center;
}
.stat-card__value { font-size: 32px; font-weight: 700; color: var(--cf-accent); }
.stat-card__label { font-size: 13px; color: var(--cf-text-secondary); margin-top: 4px; }
.stat-card__sub { font-size: 11px; color: var(--cf-text-muted); margin-top: 2px; }

.wb-dist__row { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.wb-dist__label { width: 120px; font-size: 13px; color: var(--cf-text-secondary); }
.wb-dist__bar {
  flex: 1; height: 8px; background: var(--cf-bg-tertiary);
  border-radius: 4px; overflow: hidden;
}
.wb-dist__fill { height: 100%; border-radius: 4px; transition: width 0.5s ease; }
.wb-dist__num { width: 40px; text-align: right; font-size: 13px; font-weight: 600; }
</style>