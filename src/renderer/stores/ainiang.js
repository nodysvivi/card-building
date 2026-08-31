import { defineStore } from 'pinia';
import { ref } from 'vue';
import { buildCardContext } from '../utils/card-context.js';
import { resolveModelContextTokens } from './api.js';

function defaultYouxi() {
  return {
    id: 'youxi',
    name: 'Hựu Khê',
    title: 'Bạn đồng hành viết lách',
    personality: 'Bạn đồng hành viết lách ôn hòa và đáng tin cậy, am hiểu cả kỹ thuật làm thẻ nhân vật lẫn sáng tác nội dung. Có thể trò chuyện tìm cảm hứng, hỗ trợ sửa đổi đoạn văn, nhưng không kiểu cách cũng không nhõng nhẽo, tự nhiên như người quen trong nhóm. Khi nghe thấy yêu cầu cụ thể sẽ đưa ra đề xuất chi tiết, không có yêu cầu thì trò chuyện thoải mái.',
    speakStyle: 'Tự xưng là "Hựu Khê" hoặc lược bỏ; gọi đối phương là "bạn". Giọng điệu bình dị ấm áp, không lạm dụng thán từ. Câu trả lời ngắn gọn, chủ yếu trong vòng 3 câu, chủ đề thực sự có chiều sâu mới mở rộng phân tích.',
    greeting: 'Chào bạn, hôm nay chúng ta viết gì nào?',
    color: '#86efac',
    apiType: 'openai',
    apiBaseUrl: '',
    apiKey: '',
    apiModel: ''
  };
}

export const useAiNiangStore = defineStore('ainiang', () => {
  const youxi = ref(defaultYouxi());
  // Đường dẫn tuyệt đối file .model3.json do người dùng tự chọn
  const customModelFile = ref('');

  async function loadConfig() {
    try {
      const settings = await window.cardForgeAPI.loadSettings();
      if (settings.aiNiangYouxi) Object.assign(youxi.value, settings.aiNiangYouxi);

      // Chuyển đổi trường từ phiên bản cũ (chỉ chuyển đổi cấu hình API, thiết lập nhân vật bắt buộc dùng mặc định bản mới)
      const legacyApi = settings.aiNiangYeli || settings.aiNiangLiangxiao
        || settings.aiNiangWhite || settings.aiNiangBlack || settings.aiNiangAbi;
      if (legacyApi && !settings.aiNiangYouxi?.apiKey) {
        if (legacyApi.apiType) youxi.value.apiType = legacyApi.apiType;
        if (legacyApi.apiBaseUrl) youxi.value.apiBaseUrl = legacyApi.apiBaseUrl;
        if (legacyApi.apiKey) youxi.value.apiKey = legacyApi.apiKey;
        if (legacyApi.apiModel) youxi.value.apiModel = legacyApi.apiModel;
      }

      // Chuyển đổi đường dẫn mô hình Live2D
      if (typeof settings.customModelFile === 'string') {
        customModelFile.value = settings.customModelFile;
      } else if (settings.customModelFile?.youxi) {
        customModelFile.value = settings.customModelFile.youxi;
      }

      // Phát hiện trường dư thừa của bản cũ, kích hoạt lưu một lần để dọn dẹp đĩa
      const hasLegacy = settings.aiNiangYeli || settings.aiNiangLiangxiao
        || settings.aiNiangWhite || settings.aiNiangBlack || settings.aiNiangAbi
        || settings.aiNiangSuzuran || settings.customModelPath
        || (settings.customModelFile && typeof settings.customModelFile === 'object');
      if (hasLegacy) saveConfig();
    } catch (e) {}
  }

  async function saveConfig() {
    try {
      const settings = await window.cardForgeAPI.loadSettings();
      settings.aiNiangYouxi = JSON.parse(JSON.stringify(youxi.value));
      settings.customModelFile = customModelFile.value;
      // Xóa toàn bộ trường dư thừa của bản cũ
      delete settings.aiNiangYeli;
      delete settings.aiNiangLiangxiao;
      delete settings.aiNiangWhite;
      delete settings.aiNiangBlack;
      delete settings.aiNiangAbi;
      delete settings.aiNiangSuzuran;
      delete settings.customModelPath;
      await window.cardForgeAPI.saveSettings(settings);
    } catch (e) {}
  }

  function resetToDefault() {
    youxi.value = defaultYouxi();
    customModelFile.value = '';
  }

  // Dùng helper thống nhất của utils/card-context.js để ghép ngữ cảnh
  // currentMessage truyền tin nhắn người dùng hiện tại, mục đèn xanh khớp theo key chính mới nhét vào
  function buildSystemPrompt(niang, cardStore, currentMessage = '') {
    const n = niang || youxi.value;
    const hasCard = cardStore && cardStore.cardData
      && (cardStore.cardData.name || cardStore.cardData.description
        || cardStore.cardData.personality || cardStore.cardData.first_mes
        || (cardStore.worldEntries && cardStore.worldEntries.length > 0));
    const cardBlock = hasCard
      ? `\n\n—— Dưới đây là thẻ nhân vật người dùng đang chỉnh sửa, có thể tham khảo khi trò chuyện; không chủ động nhắc lại toàn bộ, khi người dùng hỏi tới mới mở rộng ——\n${buildCardContext(cardStore, currentMessage, { modelContextTokens: resolveModelContextTokens(n.apiModel) })}`
      : '\n\n(Hiện tại người dùng chưa điền nội dung thẻ nhân vật.)';
    return `Bạn tên là "${n.name}", là bạn đồng hành viết lách của người dùng.
Tính cách: ${n.personality}
Cách nói chuyện: ${n.speakStyle}

Công việc của bạn không phải là làm nhân viên chăm sóc khách hàng, mà là đồng hành cùng người dùng viết thẻ nhân vật: có thể trò chuyện sáng tác, gợi mở cảm hứng, viết lại đoạn văn, phân tích nhân vật hoặc tán gẫu nhẹ nhàng.
Bạn hiểu rõ toàn bộ cơ chế chế tác của SillyTavern (Worldbook / Regex / MVU / EJS / script Tavern Helper), nhưng chỉ khi người dùng hỏi tới mới mở rộng khía cạnh kỹ thuật, bình thường trò chuyện tự nhiên như bạn bè.

Nguyên tắc trò chuyện:
- Không dùng văn mẫu rập khuôn, không gượng gạo, không hở ra là liệt kê 1 2 3 4 điều
- Phản hồi ngắn gọn vừa phải (thường từ 1~3 câu), chủ đề thực sự có nội dung mới mở rộng
- Cảm hứng hay tán gẫu đều được, nhưng đừng câu nào cũng lái sang chào mời lời khuyên kỹ thuật
- Người dùng chưa hỏi thì không lên mặt dạy bảo, nhưng khi họ đưa ra một đoạn văn thì có thể tự nhiên góp ý
- Sử dụng tiếng Việt, dùng khẩu ngữ đời thường tự nhiên, không trịnh trọng cứng nhắc${cardBlock}`;
  }

  return {
    youxi, customModelFile,
    loadConfig, saveConfig, resetToDefault,
    buildSystemPrompt
  };
});