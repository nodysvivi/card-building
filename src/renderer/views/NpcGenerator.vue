<template>
  <div class="page">
    <div class="page__header">
      <h1>Trình tạo NPC</h1>
      <p>3 chế độ tạo NPC có cấu trúc: Tự động hoàn toàn / Mở rộng từ khóa / IDE có hướng dẫn</p>
    </div>

    <!-- Chuyển đổi tab -->
    <div class="tabs mb-md">
      <div :class="['tabs__item', { active: tab === 'auto' }]" @click="tab = 'auto'">Tự động hoàn toàn</div>
      <div :class="['tabs__item', { active: tab === 'expand' }]" @click="tab = 'expand'">Mở rộng từ khóa</div>
      <div :class="['tabs__item', { active: tab === 'ide' }]" @click="tab = 'ide'">IDE có hướng dẫn</div>
    </div>

    <div class="grid-2">
      <!-- ============ Cột trái: Khu vực nhập liệu ============ -->
      <div>
        <!-- ===== Tab 1: Tự động hoàn toàn ===== -->
        <div v-if="tab === 'auto'" class="card">
          <div class="card__header"><h3>Tự động hoàn toàn</h3></div>
          <div class="card__body">
            <div class="hint mb-md" style="line-height:1.6">
              Thế giới quan được đọc tự động từ Worldbook của thẻ nhân vật hiện tại (bao gồm nội dung mục thường trực + tóm tắt mục kích hoạt), không cần nhập thủ công. AI sẽ xuất ra theo cấu trúc 6 khối (cơ bản / ngoại hình / tính cách / quan hệ / ngôn ngữ / câu thoại mẫu), tuân thủ nghiêm ngặt "độ không tuyệt đối + cấm văn mẫu + khác biệt hóa đặc trưng".
            </div>
            <div class="form-group">
              <label>Số lượng tạo</label>
              <select class="select" v-model.number="autoCount">
                <option :value="1">1 nhân vật</option>
                <option :value="3">3 nhân vật</option>
                <option :value="5">5 nhân vật</option>
              </select>
            </div>
            <div class="form-group">
              <label>Thiên hướng loại nhân vật (tùy chọn)</label>
              <input class="input" v-model="autoTypePreference"
                placeholder="VD: Phản diện nữ, thương nhân, sư phụ, NPC qua đường...">
            </div>
            <label class="toggle-label" style="margin-bottom:8px">
              <input type="checkbox" v-model="autoStreamMode"> Tạo dạng stream
            </label>
            <label class="toggle-label" style="margin-bottom:8px">
              <input type="checkbox" v-model="autoSelfCheck"> AI tự kiểm tra sau khi tạo (tốn thêm 1-2 phút, chất lượng cao hơn)
            </label>
            <button class="btn btn--primary btn--lg" style="width:100%"
              :disabled="generating" @click="handleAutoGenerate">
              {{ generating ? 'Đang tạo...' : 'Bắt đầu tạo' }}
            </button>
          </div>
        </div>

        <!-- ===== Tab 2: Mở rộng từ khóa ===== -->
        <div v-if="tab === 'expand'" class="card">
          <div class="card__header"><h3>Mở rộng từ khóa</h3></div>
          <div class="card__body">
            <div class="hint mb-md" style="line-height:1.6">
              Bạn cung cấp từ khóa, AI sẽ mở rộng thành NPC hoàn chỉnh theo cấu trúc 6 khối. Tối thiểu cần điền họ tên, các từ khóa của 6 khối khác có thể để trống (AI sẽ tự động bù đắp theo thế giới quan).
            </div>
            <div class="form-group">
              <label>Họ tên <span class="badge badge--danger">Bắt buộc</span></label>
              <input class="input" v-model="expandInput.name" placeholder="Họ tên nhân vật">
            </div>
            <div class="form-group">
              <label>Từ khóa thông tin cơ bản (tuổi / giới tính / thân phận)</label>
              <input class="input" v-model="expandInput.basic"
                placeholder="VD: Nữ 35 tuổi, giáo viên chủ nhiệm cấp 3">
            </div>
            <div class="form-group">
              <label>Từ khóa ngoại hình (đặc trưng độc đáo)</label>
              <input class="input" v-model="expandInput.appearance"
                placeholder="VD: Đeo kính gọng đen, người thấp đậm (tránh từ chung chung như 'gương mặt tinh xảo')">
            </div>
            <div class="form-group">
              <label>Từ khóa tính cách</label>
              <input class="input" v-model="expandInput.personality"
                placeholder="VD: Nghiêm khắc, khẩu xà tâm phật">
            </div>
            <div class="form-group">
              <label>Quan hệ với người chơi</label>
              <input class="input" v-model="expandInput.relationship"
                placeholder="VD: Giáo viên chủ nhiệm, không hài lòng về thành tích nên hay gọi nói chuyện">
            </div>
            <div class="form-group">
              <label>Đặc trưng nói chuyện / Câu cửa miệng</label>
              <input class="input" v-model="expandInput.language"
                placeholder="VD: Trực tiếp, câu cửa miệng 'Các em nhìn xem'">
            </div>
            <div class="form-group">
              <label>Mô tả bổ sung (tùy chọn)</label>
              <textarea class="textarea" v-model="expandInput.extra" rows="2"
                placeholder="Bất kỳ thiết lập bối cảnh / quy tắc đặc biệt nào muốn bổ sung..."></textarea>
            </div>
            <label class="toggle-label" style="margin-bottom:8px">
              <input type="checkbox" v-model="expandStreamMode"> Tạo dạng stream
            </label>
            <label class="toggle-label" style="margin-bottom:8px">
              <input type="checkbox" v-model="expandSelfCheck"> AI tự kiểm tra sau khi tạo
            </label>
            <button class="btn btn--primary btn--lg" style="width:100%"
              :disabled="generating || !expandInput.name" @click="handleExpand">
              {{ generating ? 'Đang mở rộng...' : 'Mở rộng NPC hoàn chỉnh' }}
            </button>
          </div>
        </div>

        <!-- ===== Tab 3: IDE có hướng dẫn ===== -->
        <div v-if="tab === 'ide'" class="card">
          <div class="card__header flex-between">
            <h3>IDE có hướng dẫn — Bước {{ ideStep + 1 }}/{{ ideSteps.length }}</h3>
            <div class="flex-row">
              <button class="btn btn--ghost btn--sm" @click="ideReset">Xóa làm lại</button>
            </div>
          </div>
          <div class="card__body">
            <div class="hint mb-md" style="line-height:1.6">
              Điền từng bước qua 6 khối, mỗi trường đều có kiểm tra văn mẫu theo thời gian thực (chữ đỏ nhắc nhở). Có thể nhấp "AI kiểm tra khối này" để đánh giá ngữ nghĩa. Hoàn thành thì nhấp "Thêm vào danh sách".
            </div>

            <!-- Thanh điều hướng bước -->
            <div class="step-nav mb-md">
              <button v-for="(s, i) in ideSteps" :key="i"
                class="step-btn" :class="{ active: ideStep === i, done: isStepComplete(i) }"
                @click="ideStep = i">
                <span class="step-num">{{ i + 1 }}</span>
                <span class="step-label">{{ s.label }}</span>
              </button>
            </div>

            <!-- ==== Bước 0: Thông tin cơ bản ==== -->
            <template v-if="ideStep === 0">
              <div class="form-group">
                <label>Họ tên <span class="badge badge--danger">Bắt buộc</span></label>
                <input class="input" v-model="ideNpc.name" placeholder="Họ tên nhân vật"
                  @input="onIdeFieldInput('name', ideNpc.name)">
              </div>
              <div class="grid-2">
                <div class="form-group">
                  <label>Tuổi</label>
                  <input class="input" v-model="ideNpc.basic.tuổi" placeholder="VD: 35 tuổi">
                </div>
                <div class="form-group">
                  <label>Giới tính</label>
                  <input class="input" v-model="ideNpc.basic.giới_tính" placeholder="VD: Nữ">
                </div>
              </div>
              <div class="form-group">
                <label>Thân phận / Nghề nghiệp</label>
                <input class="input" v-model="ideNpc.basic.thân_phận"
                  placeholder="VD: Giáo viên chủ nhiệm cấp 3, trưởng lão tông môn...">
              </div>
              <div class="form-group">
                <label>Từ khóa bổ sung (dùng để kích hoạt Worldbook)</label>
                <input class="input" :value="(ideNpc.keys || []).join(', ')"
                  @input="ideNpc.keys = $event.target.value.split(',').map(k => k.trim()).filter(Boolean)"
                  placeholder="VD: Thầy Vương, Vương Tĩnh, Giáo viên chủ nhiệm (phân tách bằng dấu phẩy)">
              </div>
            </template>

            <!-- ==== Bước 1: Ngoại hình ==== -->
            <template v-if="ideStep === 1">
              <div class="card mb-md" style="background:rgba(248,113,113,0.08);border-color:rgba(248,113,113,0.3)">
                <div class="card__body" style="padding:12px;font-size:12px;line-height:1.7">
                  <strong style="color:var(--cf-danger)">Quan trọng: Chỉ viết đặc trưng "lệch khỏi nhận thức mặc định của AI"</strong><br>
                  - Nhân vật phương Đông không cần viết "tóc đen mắt đen" (mặc định đã là vậy)<br>
                  - Nhân vật 18 tuổi không cần viết "trẻ trung" (mặc định đã là vậy)<br>
                  <strong style="color:var(--cf-danger)">Cấm miêu tả theo khuôn mẫu mỹ nhân:</strong> Gương mặt tinh xảo, làn da trắng nõn, mắt đào hoa, mày lá liễu, miệng chúm chím<br>
                  <strong>Tiêu chuẩn kiểm tra:</strong> Che tên nhân vật lại, chỉ nhìn đặc trưng bạn viết có nhận ra được nhân vật không — nếu được là đạt chuẩn
                </div>
              </div>
              <div class="form-group">
                <label>Tổng quan ấn tượng (một câu)</label>
                <input class="input" v-model="ideNpc.appearance.tổng_quan_ấn_tượng"
                  placeholder="VD: Cao 1m65, dáng người hơi đậm" @blur="onIdeBlur('Ngoại hình-Tổng quan ấn tượng', ideNpc.appearance.tổng_quan_ấn_tượng)">
              </div>
              <div class="form-group">
                <label>Đặc trưng then chốt (1-2 nét nổi bật nhất)</label>
                <input class="input" v-model="ideNpc.appearance.đặc_trưng_then_chốt"
                  placeholder="VD: Đeo kính gọng đen, luôn chau mày" @blur="onIdeBlur('Ngoại hình-Đặc trưng then chốt', ideNpc.appearance.đặc_trưng_then_chốt)">
                <BaguaWarning :issues="scanField(ideNpc.appearance.đặc_trưng_then_chốt)" />
              </div>
              <div class="form-group">
                <label>Phong cách ăn mặc</label>
                <input class="input" v-model="ideNpc.appearance.phong_cách_ăn_mặc"
                  placeholder="VD: Trang phục công sở tối màu, giày bệt" @blur="onIdeBlur('Ngoại hình-Phong cách ăn mặc', ideNpc.appearance.phong_cách_ăn_mặc)">
                <BaguaWarning :issues="scanField(ideNpc.appearance.phong_cách_ăn_mặc)" />
              </div>
              <FieldAiResult :result="ideAiCheck['Ngoại hình-Đặc trưng then chốt']" label="Đặc trưng then chốt" />
            </template>

            <!-- ==== Bước 2: Tính cách ==== -->
            <template v-if="ideStep === 2">
              <div class="card mb-md" style="background:rgba(245,158,66,0.08);border-color:rgba(245,158,66,0.3)">
                <div class="card__body" style="padding:12px;font-size:12px;line-height:1.7">
                  <strong style="color:var(--cf-accent)">Cấm gắn nhãn tính cách:</strong>
                  Không viết trực tiếp "cô ấy rất dịu dàng", "anh ấy rất tốt bụng", "cô ấy rất dễ thương"<br>
                  <strong>Hãy đổi thành hành vi cụ thể:</strong> "hay mang động vật bị thương về nhà", "thấy người già sẽ chủ động nhường ghế", "khi được khen thì giả vờ không quan tâm"
                </div>
              </div>
              <div class="form-group">
                <label>Đặc chất cốt lõi (2-3 từ khóa)</label>
                <input class="input" v-model="ideNpc.personality.đặc_chất_cốt_lõi"
                  placeholder="VD: Nghiêm nghị, cẩn thận, ít cười" @blur="onIdeBlur('Tính cách-Đặc chất cốt lõi', ideNpc.personality.đặc_chất_cốt_lõi)">
                <BaguaWarning :issues="scanField(ideNpc.personality.đặc_chất_cốt_lõi)" />
              </div>
              <div class="form-group">
                <label>Mô thức hành vi (làm gì trong tình huống cụ thể)</label>
                <textarea class="textarea" v-model="ideNpc.personality.mô_thức_hành_vi" rows="4"
                  placeholder="VD: Đi lại trong lớp khi giảng bài; phát hiện lỗi sai nhắc nhở ngay; hay gọi học sinh lên văn phòng nói chuyện"
                  @blur="onIdeBlur('Tính cách-Mô thức hành vi', ideNpc.personality.mô_thức_hành_vi)"></textarea>
                <BaguaWarning :issues="scanField(ideNpc.personality.mô_thức_hành_vi)" />
              </div>
              <FieldAiResult :result="ideAiCheck['Tính cách-Đặc chất cốt lõi']" label="Đặc chất cốt lõi" />
              <FieldAiResult :result="ideAiCheck['Tính cách-Mô thức hành vi']" label="Mô thức hành vi" />
            </template>

            <!-- ==== Bước 3: Định vị quan hệ ==== -->
            <template v-if="ideStep === 3">
              <div class="card mb-md" style="background:rgba(96,165,250,0.08);border-color:rgba(96,165,250,0.3)">
                <div class="card__body" style="padding:12px;font-size:12px;line-height:1.7">
                  <strong style="color:var(--cf-info)">Định vị quan hệ là phần quan trọng nhất của NPC</strong> — Tập trung viết về "quan hệ / phương thức tương tác / tác dụng của NPC đối với nhân vật chính".
                </div>
              </div>
              <div class="form-group">
                <label>Quan hệ với người chơi</label>
                <input class="input" v-model="ideNpc.relationship['quan_hệ_với_user']"
                  placeholder="VD: Giáo viên chủ nhiệm của người chơi">
              </div>
              <div class="form-group">
                <label>Thái độ với người chơi</label>
                <input class="input" v-model="ideNpc.relationship.thái_độ"
                  placeholder="VD: Chưa hài lòng về thành tích, thường xuyên gọi nhắc nhở"
                  @blur="onIdeBlur('Quan hệ-Thái độ', ideNpc.relationship.thái_độ)">
                <BaguaWarning :issues="scanField(ideNpc.relationship.thái_độ)" />
              </div>
              <div class="form-group">
                <label>Phương thức tương tác</label>
                <input class="input" v-model="ideNpc.relationship.phương_thức_tương_tác"
                  placeholder="VD: Giáo huấn, phê bình, yêu cầu tiến bộ"
                  @blur="onIdeBlur('Quan hệ-Phương thức tương tác', ideNpc.relationship.phương_thức_tương_tác)">
                <BaguaWarning :issues="scanField(ideNpc.relationship.phương_thức_tương_tác)" />
              </div>
              <FieldAiResult :result="ideAiCheck['Quan hệ-Thái độ']" label="Thái độ" />
              <FieldAiResult :result="ideAiCheck['Quan hệ-Phương thức tương tác']" label="Phương thức tương tác" />
            </template>

            <!-- ==== Bước 4: Đặc trưng ngôn ngữ ==== -->
            <template v-if="ideStep === 4">
              <div class="form-group">
                <label>Phong cách nói chuyện</label>
                <input class="input" v-model="ideNpc.language.phong_cách_nói_chuyện"
                  placeholder="VD: Giọng điệu nghiêm túc, nói năng thẳng thắn, không khách khí"
                  @blur="onIdeBlur('Ngôn ngữ-Phong cách nói chuyện', ideNpc.language.phong_cách_nói_chuyện)">
                <BaguaWarning :issues="scanField(ideNpc.language.phong_cách_nói_chuyện)" />
              </div>
              <div class="form-group">
                <label>Câu cửa miệng (tùy chọn)</label>
                <input class="input" v-model="ideNpc.language.câu_cửa_miệng"
                  placeholder="VD: 'Các em nhìn xem', 'Tôi đã nói bao nhiêu lần rồi'">
              </div>
              <FieldAiResult :result="ideAiCheck['Ngôn ngữ-Phong cách nói chuyện']" label="Phong cách nói chuyện" />
            </template>

            <!-- ==== Bước 5: Câu thoại mẫu ==== -->
            <template v-if="ideStep === 5">
              <div class="card mb-md" style="background:rgba(74,222,128,0.08);border-color:rgba(74,222,128,0.3)">
                <div class="card__body" style="padding:12px;font-size:12px;line-height:1.7">
                  <strong style="color:var(--cf-success)">5-10 câu thoại điển hình</strong> — <strong style="color:var(--cf-danger)">Thuần đối thoại</strong>, không thêm miêu tả động tác biểu cảm. Hãy để lời thoại tự bộc lộ tính cách.
                </div>
              </div>
              <div v-for="(d, i) in ideNpc.sample_dialogues" :key="i" class="form-group">
                <div class="flex-row">
                  <input class="input" v-model="ideNpc.sample_dialogues[i]" :placeholder="`Câu thoại ${i + 1}`">
                  <button class="btn btn--danger btn--sm" @click="ideNpc.sample_dialogues.splice(i, 1)">x</button>
                </div>
                <BaguaWarning :issues="scanField(ideNpc.sample_dialogues[i])" />
              </div>
              <button class="btn btn--secondary btn--sm" @click="ideNpc.sample_dialogues.push('')">
                + Thêm câu thoại
              </button>
            </template>

            <!-- Nút điều hướng bước -->
            <div class="step-actions">
              <button class="btn btn--ghost" @click="ideStep--" :disabled="ideStep === 0">Bước trước</button>
              <button v-if="ideStep < ideSteps.length - 1" class="btn btn--primary" @click="ideStep++">Bước sau</button>
              <button v-else class="btn btn--accent" @click="ideAddToList" :disabled="!ideNpc.name">
                Hoàn thành (Thêm vào danh sách)
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- ============ Cột phải: Khu vực kết quả ============ -->
      <div>
        <div class="card" style="height:100%;min-height:500px">
          <div class="card__header flex-between">
            <h3>Kết quả tạo ({{ generatedNpcs.length }})</h3>
            <div class="flex-row" v-if="generatedNpcs.length">
              <button class="btn btn--primary btn--sm" @click="injectToWorldBook">Tiêm vào Worldbook</button>
              <button class="btn btn--ghost btn--sm"
                @click="appStore.confirmAction('Xác nhận xóa toàn bộ kết quả tạo?', () => generatedNpcs = [])">Xóa trống</button>
            </div>
          </div>
          <div class="card__body" style="overflow-y:auto;max-height:calc(100vh - 280px)">
            <!-- Trạng thái trống -->
            <div v-if="generatedNpcs.length === 0 && !generating" class="empty-state">
              <div class="empty-state__icon"></div>
              <div class="empty-state__title">Chờ tạo</div>
              <div class="empty-state__desc">Chọn chế độ ở bên trái và điền thông tin</div>
            </div>

            <!-- Đang tải -->
            <div v-if="generating && !streamText" class="empty-state">
              <div class="empty-state__icon" style="animation: pulse 1.5s infinite"></div>
              <div class="empty-state__title">{{ generatingLabel }}</div>
            </div>

            <!-- Xem trước stream -->
            <div v-if="generating && streamText" class="npc-stream-preview">
              <div class="npc-stream-preview__label">Đang xuất dạng stream...</div>
              <pre class="npc-stream-preview__text">{{ streamText }}</pre>
            </div>

            <!-- Danh sách thẻ NPC -->
            <div v-for="(npc, i) in generatedNpcs" :key="i" class="npc-result">
              <div class="flex-between mb-md">
                <h4>{{ npc.name || `NPC ${i + 1}` }}</h4>
                <div class="flex-row">
                  <label v-if="!npc._editing" class="toggle-label">
                    <input type="checkbox" v-model="npc.selected"> Chọn
                  </label>
                  <button v-if="!npc._editing" class="btn btn--ghost btn--sm" @click="selfCheckOne(i)"
                    :disabled="checkingIdx === i">
                    {{ checkingIdx === i ? 'Đang tự kiểm' : 'AI tự kiểm tra' }}
                  </button>
                  <button class="btn btn--secondary btn--sm" @click="toggleEdit(i)">
                    {{ npc._editing ? 'Hủy' : 'Chỉnh sửa' }}
                  </button>
                  <button v-if="npc._editing" class="btn btn--primary btn--sm" @click="saveEdit(i)">Lưu</button>
                  <button v-if="npc._editing && npc._originalNpc" class="btn btn--ghost btn--sm"
                    @click="restoreOriginal(i)" title="Khôi phục nội dung gốc của AI vào trình soạn thảo (nhấp Lưu để áp dụng)">Khôi phục bản gốc AI</button>
                  <button v-if="!npc._editing" class="btn btn--danger btn--sm" @click="generatedNpcs.splice(i, 1)">Xóa</button>
                </div>
              </div>

              <!-- Tổng kết quét văn mẫu -->
              <BaguaSummary v-if="!npc._editing" :npc="npc" />

              <!-- Chế độ sửa: YAML textarea -->
              <div v-if="npc._editing">
                <div class="hint mb-sm">
                  Chế độ sửa YAML — Sửa xong nhấp Lưu. Nếu sai cú pháp YAML sẽ có thông báo lỗi (không tự động khôi phục, vui lòng sửa thủ công).
                </div>
                <textarea class="textarea selectable" v-model="npc._editText" rows="20"
                  style="font-family: var(--cf-font-mono); font-size: 12px;"></textarea>
              </div>

              <!-- Chế độ xem trước YAML -->
              <pre v-else class="npc-result__yaml selectable">{{ npcToYamlPreview(npc) }}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, watch, defineComponent, h } from 'vue';
import { useCardStore } from '../stores/card.js';
import { useApiStore } from '../stores/api.js';
import { useAppStore } from '../stores/app.js';
import { buildCardContext } from '../utils/card-context.js';
import { chatForJsonArray, parseAiJsonArray } from '../utils/json-repair.js';
import { NPC_RULES_PROMPT, NPC_SCHEMA_PROMPT, JSON_QUOTE_RULE } from '../utils/npc-rules.js';
import { emptyNpc, npcToYaml, yamlToNpc, isValidNpc, normalizeNpc } from '../utils/npc-format.js';
import { scanBagua, aiCheckField, aiCheckFullNpc, summarizeBagua } from '../utils/npc-checker.js';

const BaguaWarning = defineComponent({
  props: ['issues'],
  render() {
    if (!this.issues || this.issues.length === 0) return null;
    return h('div', { class: 'bagua-warning' }, [
      h('strong', `⚠ Phát hiện ${this.issues.length} điểm văn mẫu sáo rỗng:`),
      ...this.issues.slice(0, 5).map(i =>
        h('div', { class: 'bagua-warning__item' }, [
          h('span', { class: 'bagua-warning__word' }, `"${i.word}"`),
          h('span', { class: 'bagua-warning__type' }, ` (${i.type})`),
          h('span', { class: 'bagua-warning__suggest' }, i.suggest)
        ])
      ),
      this.issues.length > 5 ? h('div', { class: 'bagua-warning__more' }, `Còn ${this.issues.length - 5} điểm khác...`) : null
    ]);
  }
});

const FieldAiResult = defineComponent({
  props: ['result', 'label'],
  render() {
    const r = this.result;
    if (!r) return null;
    if (r.loading) return h('div', { class: 'ai-check-result ai-check-result--loading' }, `AI đang kiểm tra "${this.label}"...`);
    if (!r.hasIssue) return h('div', { class: 'ai-check-result ai-check-result--ok' }, `✓ AI kiểm tra "${this.label}" không có vấn đề`);
    return h('div', { class: 'ai-check-result ai-check-result--issue' }, [
      h('strong', `AI kiểm tra "${this.label}" phát hiện vấn đề:`),
      ...(r.issues || []).map(i => h('div', { class: 'ai-check-result__item' }, `- ${i}`)),
      r.suggest ? h('div', { class: 'ai-check-result__suggest' }, [h('strong', 'Gợi ý: '), r.suggest]) : null
    ]);
  }
});

const BaguaSummary = defineComponent({
  props: ['npc'],
  render() {
    const s = summarizeBagua(this.npc);
    if (s.total === 0) {
      return h('div', { class: 'bagua-summary bagua-summary--ok' }, '✓ Không có biểu đạt văn mẫu sáo rỗng');
    }
    const types = Object.entries(s.byType).map(([k, v]) => `${k}×${v}`).join('、');
    return h('div', { class: 'bagua-summary bagua-summary--warn' }, `⚠ Tổng cộng ${s.total} điểm văn mẫu sáo rỗng: ${types}`);
  }
});

const cardStore = useCardStore();
const apiStore = useApiStore();
const appStore = useAppStore();

const tab = ref('auto');
const generating = ref(false);
const streamText = ref('');
const generatingLabel = ref('AI đang tạo...');
const generatedNpcs = ref([]);
const checkingIdx = ref(-1);

const autoCount = ref(1);
const autoTypePreference = ref('');
const autoStreamMode = ref(localStorage.getItem('cf_npc_auto_stream') === 'true');
const autoSelfCheck = ref(localStorage.getItem('cf_npc_auto_selfcheck') === 'true');
watch(autoStreamMode, v => localStorage.setItem('cf_npc_auto_stream', v));
watch(autoSelfCheck, v => localStorage.setItem('cf_npc_auto_selfcheck', v));

async function handleAutoGenerate() {
  if (!apiStore.isConfigured) {
    appStore.toastError('Vui lòng cấu hình API Key trong cài đặt trước');
    return;
  }
  generating.value = true;
  streamText.value = '';
  generatingLabel.value = `AI đang tạo ${autoCount.value} NPC...`;

  try {
    const cardContext = buildCardContext(cardStore, '', { modelContextTokens: apiStore.getModelContextTokens(apiStore.activeProvider?.model) });
    const sysMsg = 'Bạn là chuyên gia sáng tạo NPC SillyTavern, xuất kết quả theo "cấu trúc JSON 6 khối", tuân thủ nghiêm ngặt các thiết lập viết văn. ' + NPC_RULES_PROMPT + JSON_QUOTE_RULE;
    const userPrompt = `Vui lòng tạo ${autoCount.value} NPC nguyên bản.

【Thông tin thẻ nhân vật hiện có】
${cardContext}

${autoTypePreference.value ? `【Thiên hướng loại nhân vật】\n${autoTypePreference.value}\n` : ''}
${NPC_SCHEMA_PROMPT}

Xuất nghiêm ngặt dưới dạng mảng JSON (mỗi phần tử trong mảng là một NPC 6 khối hoàn chỉnh):
\`\`\`json
[
  { "name": "...", "keys": [...], "basic": {...}, "appearance": {...}, "personality": {...}, "relationship": {...}, "language": {...}, "sample_dialogues": [...] }
]
\`\`\`

Chỉ xuất ra mảng JSON, không kèm bất kỳ giải thích nào.`;

    const msgs = [{ role: 'system', content: sysMsg }, { role: 'user', content: userPrompt }];
    const maxTokens = apiStore.getModelMaxTokens(apiStore.activeProvider?.model);

    let parsed;
    if (autoStreamMode.value) {
      const fullText = await apiStore.chat(msgs, {
        temperature: 0.9, maxTokens,
        onChunk: chunk => { streamText.value += chunk; }
      });
      streamText.value = '';
      parsed = parseAiJsonArray(fullText);
    } else {
      parsed = await chatForJsonArray(apiStore, msgs, { temperature: 0.9, maxTokens });
    }

    if (!Array.isArray(parsed) || parsed.length === 0) {
      appStore.toastWarning('AI không tạo ra NPC hợp lệ');
      return;
    }

    let npcs = parsed.map(n => normalizeNpc(n)).filter(n => isValidNpc(n));
    if (npcs.length === 0) {
      appStore.toastWarning('Định dạng AI xuất ra không đúng, vui lòng thử lại');
      return;
    }

    if (autoSelfCheck.value) {
      generatingLabel.value = `AI đang tự kiểm tra (${npcs.length} NPC)...`;
      const checked = [];
      for (const npc of npcs) {
        checked.push(await aiCheckFullNpc(apiStore, npc));
      }
      npcs = checked;
    }

    for (const npc of npcs) {
      generatedNpcs.value.push({ ...npc, selected: true });
    }
    appStore.toastSuccess(`Tạo thành công ${npcs.length} NPC${autoSelfCheck.value ? ' (đã tự kiểm tra)' : ''}`);
  } catch (e) {
    appStore.toastError(`Tạo thất bại: ${e.message}`);
  } finally {
    generating.value = false;
    streamText.value = '';
  }
}

const expandInput = reactive({
  name: '', basic: '', appearance: '', personality: '',
  relationship: '', language: '', extra: ''
});
const expandStreamMode = ref(localStorage.getItem('cf_npc_expand_stream') === 'true');
const expandSelfCheck = ref(localStorage.getItem('cf_npc_expand_selfcheck') === 'true');
watch(expandStreamMode, v => localStorage.setItem('cf_npc_expand_stream', v));
watch(expandSelfCheck, v => localStorage.setItem('cf_npc_expand_selfcheck', v));

async function handleExpand() {
  if (!apiStore.isConfigured) { appStore.toastError('Vui lòng cấu hình API Key trước'); return; }
  if (!expandInput.name.trim()) { appStore.toastError('Họ tên là bắt buộc'); return; }

  generating.value = true;
  streamText.value = '';
  generatingLabel.value = 'Đang mở rộng...';

  try {
    const cardContext = buildCardContext(cardStore, '', { modelContextTokens: apiStore.getModelContextTokens(apiStore.activeProvider?.model) });
    const labels = {
      basic: 'Thông tin cơ bản', appearance: 'Ngoại hình', personality: 'Tính cách',
      relationship: 'Quan hệ với {{user}}', language: 'Đặc trưng ngôn ngữ', extra: 'Mô tả bổ sung'
    };
    const fragments = Object.entries(labels)
      .filter(([k]) => expandInput[k] && expandInput[k].trim())
      .map(([k, v]) => `${v}: ${expandInput[k]}`)
      .join('\n');

    const sysMsg = 'Bạn là chuyên gia sáng tạo NPC SillyTavern, mở rộng từ khóa thành NPC hoàn chỉnh theo cấu trúc JSON 6 khối. Tuân thủ nghiêm ngặt các quy tắc viết văn. ' + NPC_RULES_PROMPT + JSON_QUOTE_RULE;
    const userPrompt = `Dựa vào các từ khóa sau, hãy mở rộng thành một NPC hoàn chỉnh (theo cấu trúc JSON 6 khối).

【Thông tin then chốt】
Họ tên: ${expandInput.name}
${fragments}

【Thông tin thẻ nhân vật hiện có】
${cardContext}

${NPC_SCHEMA_PROMPT}

Xuất nghiêm ngặt dưới dạng mảng JSON (chứa 1 phần tử):
\`\`\`json
[ { "name": "${expandInput.name}", "keys": [...], "basic": {...}, "appearance": {...}, "personality": {...}, "relationship": {...}, "language": {...}, "sample_dialogues": [...] } ]
\`\`\`

Chỉ xuất ra mảng JSON.`;

    const msgs = [{ role: 'system', content: sysMsg }, { role: 'user', content: userPrompt }];
    const maxTokens = apiStore.getModelMaxTokens(apiStore.activeProvider?.model);

    let parsed;
    if (expandStreamMode.value) {
      const fullText = await apiStore.chat(msgs, {
        temperature: 0.8, maxTokens,
        onChunk: chunk => { streamText.value += chunk; }
      });
      streamText.value = '';
      parsed = parseAiJsonArray(fullText);
    } else {
      parsed = await chatForJsonArray(apiStore, msgs, { temperature: 0.8, maxTokens });
    }

    if (!Array.isArray(parsed) || parsed.length === 0) {
      appStore.toastWarning('AI không tạo ra NPC hợp lệ');
      return;
    }

    let npc = normalizeNpc(parsed[0]);
    if (!isValidNpc(npc)) {
      appStore.toastWarning('Định dạng AI xuất ra không đúng');
      return;
    }

    if (expandSelfCheck.value) {
      generatingLabel.value = 'AI đang tự kiểm tra...';
      npc = await aiCheckFullNpc(apiStore, npc);
    }

    generatedNpcs.value.push({ ...npc, selected: true });
    appStore.toastSuccess(`Mở rộng hoàn tất${expandSelfCheck.value ? ' (đã tự kiểm tra)' : ''}`);
  } catch (e) {
    appStore.toastError(`Mở rộng thất bại: ${e.message}`);
  } finally {
    generating.value = false;
    streamText.value = '';
  }
}

const ideStep = ref(0);
const ideSteps = [
  { label: 'Thông tin cơ bản' },
  { label: 'Ngoại hình' },
  { label: 'Tính cách' },
  { label: 'Quan hệ' },
  { label: 'Ngôn ngữ' },
  { label: 'Câu thoại mẫu' }
];
const ideNpc = reactive(emptyNpc());
const ideAiCheck = reactive({});

function isStepComplete(stepIdx) {
  if (stepIdx === 0) return !!ideNpc.name;
  if (stepIdx === 1) return !!(ideNpc.appearance.tổng_quan_ấn_tượng || ideNpc.appearance.đặc_trưng_then_chốt);
  if (stepIdx === 2) return !!(ideNpc.personality.đặc_chất_cốt_lõi || ideNpc.personality.mô_thức_hành_vi);
  if (stepIdx === 3) return !!(ideNpc.relationship['quan_hệ_với_user'] || ideNpc.relationship.thái_độ);
  if (stepIdx === 4) return !!ideNpc.language.phong_cách_nói_chuyện;
  if (stepIdx === 5) return ideNpc.sample_dialogues.length > 0;
  return false;
}

function scanField(text) {
  return scanBagua(text || '');
}

function onIdeFieldInput(label, value) {}

async function onIdeBlur(label, value) {
  if (!value || value.length < 5) return;
  if (!apiStore.isConfigured) return;
  ideAiCheck[label] = { loading: true };
  const result = await aiCheckField(apiStore, label, value);
  ideAiCheck[label] = result || { hasIssue: false, issues: [], suggest: '' };
}

function ideAddToList() {
  if (!ideNpc.name) {
    appStore.toastError('Họ tên là bắt buộc');
    return;
  }
  const npc = normalizeNpc(JSON.parse(JSON.stringify(ideNpc)));
  if (!npc.keys || npc.keys.length === 0) npc.keys = [npc.name];
  generatedNpcs.value.push({ ...npc, selected: true });
  appStore.toastSuccess('Đã thêm vào danh sách, có thể tiếp tục tạo nhân vật tiếp theo');
  ideReset();
}

function ideReset() {
  Object.assign(ideNpc, emptyNpc());
  Object.keys(ideAiCheck).forEach(k => delete ideAiCheck[k]);
  ideStep.value = 0;
}

async function selfCheckOne(idx) {
  if (!apiStore.isConfigured) { appStore.toastError('Vui lòng cấu hình API Key trước'); return; }
  checkingIdx.value = idx;
  try {
    const original = generatedNpcs.value[idx];
    const fixed = await aiCheckFullNpc(apiStore, original);
    if (fixed && isValidNpc(fixed)) {
      generatedNpcs.value[idx] = { ...fixed, selected: original.selected };
      appStore.toastSuccess('Tự kiểm tra hoàn tất');
    } else {
      appStore.toastWarning('Tự kiểm tra thất bại, giữ nguyên bản gốc');
    }
  } catch (e) {
    appStore.toastError(`Tự kiểm tra thất bại: ${e.message}`);
  } finally {
    checkingIdx.value = -1;
  }
}

function npcToYamlPreview(npc) {
  return npcToYaml(npc);
}

function toggleEdit(idx) {
  const npc = generatedNpcs.value[idx];
  if (npc._editing) {
    npc._editing = false;
    npc._editText = '';
  } else {
    if (!npc._originalNpc) {
      npc._originalNpc = JSON.parse(JSON.stringify({
        name: npc.name, keys: npc.keys || [],
        basic: npc.basic || {}, appearance: npc.appearance || {},
        personality: npc.personality || {}, relationship: npc.relationship || {},
        language: npc.language || {}, sample_dialogues: npc.sample_dialogues || []
      }));
    }
    npc._editText = npcToYaml(npc);
    npc._editing = true;
  }
}

function saveEdit(idx) {
  const npc = generatedNpcs.value[idx];
  try {
    const parsed = yamlToNpc(npc._editText || '');
    if (!parsed.name || !parsed.name.trim()) {
      appStore.toastError('Phân tích YAML thất bại: trường name không được để trống (dòng đầu phải là NPC: Tên)');
      return;
    }
    const fixed = normalizeNpc(parsed);
    npc.name = fixed.name;
    npc.keys = fixed.keys;
    npc.basic = fixed.basic;
    npc.appearance = fixed.appearance;
    npc.personality = fixed.personality;
    npc.relationship = fixed.relationship;
    npc.language = fixed.language;
    npc.sample_dialogues = fixed.sample_dialogues;
    npc._editing = false;
    npc._editText = '';
    appStore.toastSuccess('Đã lưu');
  } catch (e) {
    appStore.toastError('Phân tích YAML thất bại: ' + e.message);
  }
}

function restoreOriginal(idx) {
  const npc = generatedNpcs.value[idx];
  if (!npc._originalNpc) return;
  npc._editText = npcToYaml(npc._originalNpc);
  appStore.toastInfo('Đã khôi phục nội dung gốc của AI vào trình soạn thảo, nhấp "Lưu" để áp dụng');
}

function injectToWorldBook() {
  const selected = generatedNpcs.value.filter(n => n.selected);
  if (selected.length === 0) {
    appStore.toastWarning('Vui lòng chọn ít nhất một NPC');
    return;
  }

  let count = 0;
  for (const npc of selected) {
    const entry = cardStore.addWorldEntry();
    entry.comment = npc.name || '(NPC chưa đặt tên)';
    entry.keys = npc.keys && npc.keys.length ? npc.keys : [npc.name].filter(Boolean);
    entry.content = npcToYaml(npc);
    entry.constant = false;
    entry.enabled = true;
    entry.selective = false;
    entry.position = 'after_char';
    entry.insertion_order = 100;
    entry.extensions.exclude_recursion = true;
    entry.extensions.prevent_recursion = true;
    count++;
  }

  appStore.toastSuccess(`Đã tiêm ${count} NPC vào Worldbook`);
}
</script>

<style scoped>
.tabs {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid var(--cf-border);
  margin-bottom: 16px;
}
.tabs__item {
  padding: 10px 20px;
  cursor: pointer;
  font-size: 14px;
  color: var(--cf-text-secondary);
  border-bottom: 2px solid transparent;
  transition: all var(--cf-transition);
}
.tabs__item:hover {
  color: var(--cf-text-primary);
}
.tabs__item.active {
  color: var(--cf-accent);
  border-bottom-color: var(--cf-accent);
}

.npc-result {
  background: var(--cf-bg-tertiary);
  border: 1px solid var(--cf-border);
  border-radius: var(--cf-radius-sm);
  padding: 16px;
  margin-bottom: 12px;
}
.npc-result h4 {
  font-size: 15px;
  color: var(--cf-accent);
}
.npc-result__yaml {
  font-size: 12px;
  line-height: 1.6;
  color: var(--cf-text-primary);
  white-space: pre-wrap;
  word-wrap: break-word;
  font-family: var(--cf-font-mono);
  background: rgba(0,0,0,0.15);
  border: 1px solid var(--cf-border);
  border-radius: var(--cf-radius-sm);
  padding: 10px;
  margin: 0;
  max-height: 300px;
  overflow-y: auto;
}

.toggle-label {
  display: flex; align-items: center; gap: 6px;
  font-size: 13px; cursor: pointer; color: var(--cf-text-secondary);
}
.toggle-label input { accent-color: var(--cf-accent); }

.npc-stream-preview {
  padding: 10px;
  background: rgba(0,0,0,0.2);
  border: 1px solid rgba(96,165,250,0.2);
  border-radius: var(--cf-radius-sm);
}
.npc-stream-preview__label {
  font-size: 11px; color: var(--cf-info); margin-bottom: 6px;
}
.npc-stream-preview__text {
  font-size: 12px; color: var(--cf-text-secondary);
  white-space: pre-wrap; word-break: break-all;
  max-height: 300px; overflow-y: auto; margin: 0;
  font-family: var(--cf-font-mono);
}

.bagua-warning {
  background: rgba(248,113,113,0.1);
  border: 1px solid rgba(248,113,113,0.3);
  border-radius: var(--cf-radius-sm);
  padding: 8px 10px;
  margin-top: 6px;
  font-size: 12px;
  color: var(--cf-danger);
}
.bagua-warning__item {
  margin-top: 4px;
  font-size: 11px;
  line-height: 1.5;
  color: var(--cf-text-secondary);
}
.bagua-warning__word {
  font-family: var(--cf-font-mono);
  background: rgba(248,113,113,0.2);
  padding: 1px 4px;
  border-radius: 3px;
  color: var(--cf-danger);
}
.bagua-warning__type {
  color: var(--cf-text-muted);
  margin: 0 6px;
}
.bagua-warning__suggest {
  color: var(--cf-text-secondary);
  font-style: italic;
}
.bagua-warning__more {
  margin-top: 4px;
  font-size: 11px;
  color: var(--cf-text-muted);
}

.bagua-summary {
  font-size: 12px;
  margin-bottom: 8px;
  padding: 4px 8px;
  border-radius: var(--cf-radius-sm);
}
.bagua-summary--ok {
  color: var(--cf-success);
  background: rgba(74,222,128,0.08);
}
.bagua-summary--warn {
  color: var(--cf-warning);
  background: rgba(251,191,36,0.08);
}

.ai-check-result {
  margin-top: 8px;
  padding: 8px 10px;
  border-radius: var(--cf-radius-sm);
  font-size: 12px;
  line-height: 1.6;
}
.ai-check-result--loading {
  background: rgba(96,165,250,0.08);
  color: var(--cf-info);
  font-style: italic;
}
.ai-check-result--ok {
  background: rgba(74,222,128,0.08);
  color: var(--cf-success);
}
.ai-check-result--issue {
  background: rgba(251,191,36,0.08);
  color: var(--cf-warning);
  border: 1px solid rgba(251,191,36,0.2);
}
.ai-check-result__item {
  margin-top: 2px;
  color: var(--cf-text-secondary);
}
.ai-check-result__suggest {
  margin-top: 4px;
  padding: 4px 6px;
  background: rgba(0,0,0,0.15);
  border-radius: 3px;
  color: var(--cf-text-primary);
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
</style>