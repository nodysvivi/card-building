<template>
  <div class="page">
    <div class="page__header flex-between">
      <div>
        <h1>Yêu cầu bổ sung</h1>
        <p>Bổ sung nhanh các quy tắc chung — Tích chọn các quy tắc bạn cần, tiêm vào system_prompt 1 chạm</p>
      </div>
      <button class="btn btn--primary" @click="applyRules">Áp dụng vào thẻ nhân vật</button>
    </div>

    <div class="card mb-md">
      <div class="card__body hint" style="line-height:1.8">
        Không cần tự viết system_prompt, chỉ cần tích chọn các quy tắc bạn cần tại đây:<br>
        · <strong>Định dạng trả lời</strong> — Kiểm soát độ dài, góc nhìn, quy chuẩn miêu tả động tác của AI<br>
        · <strong>Ràng buộc hành vi</strong> — Cấm AI tự quyết định thay người chơi, yêu cầu NPC có ý chí độc lập<br>
        · <strong>Quy tắc thế giới</strong> — Dòng chảy thời gian, thay đổi thời tiết, hệ thống kinh tế...<br>
        · Sau khi tích chọn, nội dung xem trước sẽ hiển thị ở đáy trang, nhấp "Áp dụng vào thẻ nhân vật" để ghi vào system_prompt
      </div>
    </div>

    <!-- Định dạng trả lời -->
    <div class="card mb-md">
      <div class="card__header"><h3>Định dạng trả lời</h3></div>
      <div class="card__body">
        <div class="grid-2">
          <div class="form-group">
            <label>Độ dài trả lời</label>
            <select class="select" v-model="rules.replyLength">
              <option value="">Không giới hạn</option>
              <option value="short">Ngắn (200-500 từ)</option>
              <option value="medium">Vừa (500-1000 từ)</option>
              <option value="long">Chi tiết (800-1500 từ)</option>
              <option value="very_long">Siêu dài (1500-3000 từ)</option>
            </select>
          </div>
          <div class="form-group">
            <label>Góc nhìn trần thuật</label>
            <select class="select" v-model="rules.perspective">
              <option value="">Không giới hạn</option>
              <option value="third">Ngôi thứ ba</option>
              <option value="first_char">Ngôi thứ nhất (Góc nhìn nhân vật)</option>
              <option value="second">Ngôi thứ hai (Bạn)</option>
            </select>
          </div>
        </div>
        <div class="rule-checks">
          <label class="toggle-label" v-for="r in formatRules" :key="r.id">
            <input type="checkbox" v-model="rules.format" :value="r.id"> {{ r.label }}
          </label>
        </div>
      </div>
    </div>

    <!-- Ràng buộc hành vi -->
    <div class="card mb-md">
      <div class="card__header"><h3>Ràng buộc hành vi</h3></div>
      <div class="card__body">
        <div class="rule-checks">
          <label class="toggle-label" v-for="r in behaviorRules" :key="r.id">
            <input type="checkbox" v-model="rules.behavior" :value="r.id"> {{ r.label }}
          </label>
        </div>
      </div>
    </div>

    <!-- Quy tắc thế giới -->
    <div class="card mb-md">
      <div class="card__header"><h3>Quy tắc thế giới</h3></div>
      <div class="card__body">
        <div class="rule-checks">
          <label class="toggle-label" v-for="r in worldRules" :key="r.id">
            <input type="checkbox" v-model="rules.world" :value="r.id"> {{ r.label }}
          </label>
        </div>
      </div>
    </div>

    <!-- Định dạng đầu ra AI -->
    <div class="card mb-md">
      <div class="card__header"><h3>Định dạng đầu ra AI</h3></div>
      <div class="card__body">
        <div class="rule-checks">
          <label class="toggle-label" v-for="r in outputRules" :key="r.id">
            <input type="checkbox" v-model="rules.output" :value="r.id"> {{ r.label }}
          </label>
        </div>
      </div>
    </div>

    <!-- Ngôn ngữ và phong cách -->
    <div class="card mb-md">
      <div class="card__header"><h3>Ngôn ngữ và phong cách</h3></div>
      <div class="card__body">
        <div class="grid-2">
          <div class="form-group">
            <label>Ngôn ngữ</label>
            <select class="select" v-model="rules.language">
              <option value="">Không giới hạn</option>
              <option value="zh">Tiếng Trung</option>
              <option value="en">English</option>
              <option value="jp">日本語</option>
              <option value="vi">Tiếng Việt</option>
              <option value="mixed">Song ngữ Việt - Nhật</option>
            </select>
          </div>
          <div class="form-group">
            <label>Phong cách hành văn</label>
            <select class="select" v-model="rules.writingStyle">
              <option value="">Không giới hạn</option>
              <option value="literary">Văn học / Tản văn</option>
              <option value="light_novel">Light novel</option>
              <option value="web_novel">Web novel</option>
              <option value="screenplay">Kịch bản</option>
              <option value="poetic">Thơ ca / Ý thức lưu</option>
            </select>
          </div>
        </div>
      </div>
    </div>

    <!-- Bổ sung tùy chỉnh -->
    <div class="card mb-md">
      <div class="card__header"><h3>Bổ sung tùy chỉnh</h3></div>
      <div class="card__body">
        <div class="form-group">
          <label>Quy tắc khác (tự do điền)</label>
          <textarea class="textarea" v-model="rules.custom" rows="4"
            placeholder="Bất kỳ quy tắc hoặc yêu cầu bổ sung nào...&#10;VD: Cảnh chiến đấu cần đổ xúc xắc phán định, NPC có lịch trình riêng, cuối mỗi câu trả lời kèm thanh trạng thái"></textarea>
        </div>
      </div>
    </div>

    <!-- Xem trước -->
    <div class="card">
      <div class="card__header flex-between">
        <h3>Xem trước nội dung được tạo</h3>
        <span class="badge badge--info">{{ generatedText.length }} từ</span>
      </div>
      <div class="card__body">
        <pre class="preview selectable">{{ generatedText || '(Tích chọn các quy tắc ở trên để xem trước tại đây)' }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, computed } from 'vue';
import { useCardStore } from '../stores/card.js';
import { useAppStore } from '../stores/app.js';

const cardStore = useCardStore();
const appStore = useAppStore();

const rules = reactive({
  replyLength: '',
  perspective: '',
  format: [],
  behavior: [],
  world: [],
  output: [],
  language: '',
  writingStyle: '',
  custom: ''
});

const formatRules = [
  { id: 'action_asterisk', label: 'Miêu tả động tác bọc trong dấu *sao*' },
  { id: 'dialogue_quotes', label: 'Lời thoại đặt trong dấu «» hoặc ""' },
  { id: 'inner_thought', label: 'Độc thoại nội tâm bọc trong dấu (ngoặc đơn)' },
  { id: 'scene_desc', label: 'Mỗi lần trả lời mở đầu bằng 1-2 câu miêu tả môi trường / bầu không khí' },
  { id: 'no_summary', label: 'Không tóm tắt lại ở cuối câu trả lời' },
  { id: 'sensory', label: 'Chú trọng miêu tả ngũ quan (thị giác, thính giác, xúc giác, khứu giác, vị giác)' }
];

const behaviorRules = [
  { id: 'no_control_user', label: 'Tuyệt đối không đóng vai {{user}} hoặc quyết định thay cho {{user}}' },
  { id: 'no_perfect', label: 'NPC không phải là nhân vật hoàn hảo, cần có khuyết điểm và mâu thuẫn' },
  { id: 'npc_autonomy', label: 'NPC có ý chí và lịch trình riêng, không vô điều kiện giúp đỡ người chơi' },
  { id: 'consequence', label: 'Hành động có hậu quả, không để người chơi nhận lợi ích mà không trả giá' },
  { id: 'realistic_reaction', label: 'Phản ứng cảm xúc của NPC phải phù hợp với tính cách, không thay đổi đột ngột' },
  { id: 'no_rush', label: 'Tình cảm và sự tin tưởng phát triển tuần tự, không thể vừa gặp đã yêu' },
  { id: 'fail_possible', label: 'Cho phép thất bại, việc khó khăn không nhất định thành công' },
  { id: 'mature_content', label: 'Cho phép nội dung người lớn, không né tránh hoặc làm giảm nhẹ' }
];

const worldRules = [
  { id: 'time_flow', label: 'Thời gian trôi tự nhiên (sáng trưa tối, thay đổi ngày tháng)' },
  { id: 'weather', label: 'Thời tiết thay đổi tự nhiên theo thời gian và mùa' },
  { id: 'economy', label: 'Hệ thống kinh tế vận hành thực tế (vật phẩm có giá cả, tiền bạc tiêu hao khi dùng)' },
  { id: 'npc_schedule', label: 'NPC xuất hiện ở các địa điểm khác nhau theo từng khung giờ' },
  { id: 'world_events', label: 'Thế giới diễn ra các sự kiện bối cảnh không liên quan đến người chơi' },
  { id: 'power_balance', label: 'Thực lực có khoảng cách cấp bậc, cấp thấp không thể dễ dàng đánh bại cấp cao' },
  { id: 'dice_roll', label: 'Hành động then chốt cần đổ xúc xắc định đoạt ({{roll 1d100}})' }
];

const outputRules = [
  { id: 'analysis', label: 'Yêu cầu AI xuất chuỗi tư duy <Analysis> (phân tích logic cốt truyện trước khi trả lời)' },
  { id: 'variable_update', label: 'Yêu cầu AI xuất lệnh cập nhật biến <UpdateVariable> (Bắt buộc cho hệ thống MVU)' },
  { id: 'status_placeholder', label: 'Yêu cầu AI xuất placeholder thanh trạng thái <StatusPlaceHolderImpl/> (Bắt buộc cho thanh trạng thái)' },
  { id: 'cot_english', label: 'Chuỗi tư duy xuất bằng tiếng Anh (Tiết kiệm token)' }
];

const lengthMap = { short: '200-500', medium: '500-1000', long: '800-1500', very_long: '1500-3000' };
const perspectiveMap = { third: 'ngôi thứ ba', first_char: 'ngôi thứ nhất (góc nhìn nhân vật)', second: 'ngôi thứ hai' };
const langMap = { zh: 'Sử dụng tiếng Trung để trả lời', en: 'Reply in English', jp: '日本語で返信してください', vi: 'Sử dụng tiếng Việt để trả lời', mixed: 'Song ngữ Việt - Nhật (Lời thoại tiếng Nhật + Tường thuật tiếng Việt)' };
const styleMap = { literary: 'Phong cách văn học tản văn, chú trọng ý cảnh và tu từ', light_novel: 'Phong cách light novel, nhẹ nhàng sống động', web_novel: 'Phong cách web novel, tiết tấu nhanh, điểm kịch tính dồn dập', screenplay: 'Phong cách kịch bản, đối thoại là chính', poetic: 'Phong cách thơ ca, miêu tả theo dòng ý thức' };

const generatedText = computed(() => {
  const lines = [];

  if (rules.replyLength) lines.push(`Mỗi lần trả lời khống chế trong ${lengthMap[rules.replyLength]} từ.`);
  if (rules.perspective) lines.push(`Sử dụng góc nhìn ${perspectiveMap[rules.perspective]} để trần thuật.`);
  if (rules.language) lines.push(langMap[rules.language] + '.');
  if (rules.writingStyle) lines.push(styleMap[rules.writingStyle] + '.');

  const formatTexts = {
    action_asterisk: 'Miêu tả động tác bọc trong dấu *sao*.',
    dialogue_quotes: 'Lời thoại nhân vật đặt trong dấu «».',
    inner_thought: 'Độc thoại nội tâm nhân vật bọc trong dấu (ngoặc đơn).',
    scene_desc: 'Mỗi lần trả lời mở đầu bằng 1-2 câu miêu tả môi trường và bầu không khí hiện tại.',
    no_summary: 'Không tóm tắt hoặc kể lại những gì vừa xảy ra ở cuối câu trả lời.',
    sensory: 'Miêu tả chú trọng chi tiết ngũ quan (thị giác, thính giác, xúc giác, khứu giác, vị giác).'
  };
  rules.format.forEach(id => { if (formatTexts[id]) lines.push(formatTexts[id]); });

  const behaviorTexts = {
    no_control_user: 'Tuyệt đối không đóng vai {{user}}, không nói thay, không quyết định thay hoặc miêu tả nội tâm của {{user}}.',
    no_perfect: 'NPC không phải là nhân vật hoàn hảo, mỗi NPC đều cần có khuyết điểm, mâu thuẫn và mặt không lý trí.',
    npc_autonomy: 'NPC có ý chí, lịch trình và mục tiêu riêng, không vô điều kiện giúp đỡ hoặc nghe theo {{user}}.',
    consequence: 'Mọi hành động đều có hậu quả và cái giá tương ứng, không có sự lựa chọn nào hoàn toàn phi rủi ro.',
    realistic_reaction: 'Phản ứng cảm xúc của NPC bắt buộc phải phù hợp với thiết lập tính cách, không được thay đổi đột ngột.',
    no_rush: 'Tình cảm và sự tin cậy cần thời gian cùng sự tương tác tích lũy, không thể một bước thành ngay.',
    fail_possible: 'Hành động khó khăn có khả năng thất bại, khi thất bại phải miêu tả quá trình và hậu quả thất bại.',
    mature_content: 'Không né tránh hoặc làm giảm nhẹ nội dung người lớn, miêu tả tự nhiên theo yêu cầu bối cảnh.'
  };
  rules.behavior.forEach(id => { if (behaviorTexts[id]) lines.push(behaviorTexts[id]); });

  const worldTexts = {
    time_flow: 'Thời gian trôi theo nhịp độ bình thường, bao gồm chuyển biến sáng trưa tối và thay đổi ngày tháng.',
    weather: 'Thời tiết thay đổi tự nhiên theo thời gian và mùa, ảnh hưởng đến hành vi nhân vật và miêu tả môi trường.',
    economy: 'Hệ thống kinh tế vận hành thực tế, vật phẩm có giá cả hợp lý, tiền bạc giảm đi khi chi tiêu.',
    npc_schedule: 'NPC xuất hiện ở các địa điểm khác nhau theo từng khung giờ, có nhịp sống riêng.',
    world_events: 'Thế giới sẽ diễn ra các sự kiện bối cảnh không liên quan đến {{user}}, tăng tính chân thực cho thế giới.',
    power_balance: 'Thực lực tồn tại khoảng cách cấp bậc, nhân vật cấp thấp không thể dễ dàng chiến thắng thực thể cấp cao.',
    dice_roll: 'Hành động then chốt (chiến đấu, kiểm tra kỹ năng...) sử dụng đổ xúc xắc định đoạt: {{roll 1d100}}, kết quả >50 là thành công.'
  };
  rules.world.forEach(id => { if (worldTexts[id]) lines.push(worldTexts[id]); });

  const outputTexts = {
    analysis: 'Trước mỗi lần trả lời, hãy phân tích logic cốt truyện hiện tại, phản ứng của NPC và biến động dữ liệu trong tag <Analysis> trước khi xuất văn bản chính.',
    variable_update: 'Ở cuối mỗi câu trả lời, bắt buộc phải xuất lệnh cập nhật biến trong tag <UpdateVariable>.',
    status_placeholder: 'Ở cuối mỗi câu trả lời, bắt buộc phải xuất placeholder <StatusPlaceHolderImpl/>.',
    cot_english: 'Phần Analysis vui lòng xuất bằng tiếng Anh để tiết kiệm token.'
  };
  rules.output.forEach(id => { if (outputTexts[id]) lines.push(outputTexts[id]); });

  if (rules.custom) lines.push(rules.custom);

  return lines.join('\n');
});

function applyRules() {
  if (!generatedText.value) { appStore.toastWarning('Vui lòng tích chọn ít nhất một quy tắc'); return; }

  const existing = cardStore.cardData.system_prompt || '';
  const marker = '【CardBuilding Yêu cầu bổ sung】';
  const legacyMarker = '【CardForge 额外需求】';
  let cleaned = existing;
  if (cleaned.includes(marker)) {
    cleaned = cleaned.split(marker)[0].trim();
  } else if (cleaned.includes(legacyMarker)) {
    cleaned = cleaned.split(legacyMarker)[0].trim();
  }
  cardStore.cardData.system_prompt = cleaned + (cleaned ? '\n\n' : '') + marker + '\n' + generatedText.value;
  cardStore.markDirty();
  appStore.toastSuccess('Đã áp dụng vào system_prompt (' + generatedText.value.split('\n').length + ' quy tắc)');
}
</script>

<style scoped>
.rule-checks {
  display: flex; flex-direction: column; gap: 10px;
}
.toggle-label {
  display: flex; align-items: flex-start; gap: 8px;
  font-size: 13px; cursor: pointer; color: var(--cf-text-secondary); line-height: 1.5;
  input { accent-color: var(--cf-accent); margin-top: 3px; }
}
.preview {
  font-size: 13px; line-height: 1.7; color: var(--cf-text-primary);
  white-space: pre-wrap; font-family: var(--cf-font); background: none; border: none; margin: 0;
}
</style>