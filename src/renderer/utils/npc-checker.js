/**
 * Tự kiểm tra chất lượng / văn mẫu sáo rỗng NPC
 * - scanBagua: Quét regex thuần frontend, phản hồi tức thì (dùng nhắc nhở thời gian thực khi nhập)
 * - aiCheckField: AI tự kiểm tra ngữ nghĩa từng trường (dùng khi onBlur, 1-2 phút có kết quả)
 * - aiCheckFullNpc: AI tự kiểm tra toàn diện NPC (gọi một lần sau khi tạo xong)
 */

import { BAGUA_PATTERNS, NPC_SELF_CHECK_PROMPT, JSON_QUOTE_RULE } from './npc-rules.js';
import { normalizeNpc, isValidNpc } from './npc-format.js';
import { parseAiJsonObject } from './json-repair.js';

/**
 * Quét regex thuần frontend —— Nhập văn bản, trả về toàn bộ cảnh báo văn mẫu sáo rỗng
 * Dùng làm nổi bật thời gian thực cho textarea oninput
 * @param {string} text
 * @returns {Array<{word, index, type, suggest}>}
 */
export function scanBagua(text) {
  if (!text || typeof text !== 'string') return [];
  const issues = [];
  for (const rule of BAGUA_PATTERNS) {
    // Đặt lại lastIndex để tránh làm ô nhiễm trạng thái regex toàn cục có cờ g
    rule.pattern.lastIndex = 0;
    let m;
    while ((m = rule.pattern.exec(text)) !== null) {
      issues.push({
        word: m[0],
        index: m.index,
        type: rule.type,
        suggest: rule.suggest
      });
      // Ngăn chặn lặp vô tận do khớp độ dài 0
      if (m.index === rule.pattern.lastIndex) rule.pattern.lastIndex++;
    }
  }
  return issues;
}

/**
 * AI tự kiểm tra ngữ nghĩa từng trường —— Gọi khi onBlur, kiểm tra từ 5-10 trường trong 1-2 phút
 * Dùng kiểm tra các vấn đề ngữ nghĩa mà scanBagua không bắt được
 * @param {object} apiStore
 * @param {string} fieldLabel - Tên hiển thị trường tiếng Việt
 * @param {string} fieldValue - Nội dung hiện tại của trường
 * @returns {Promise<{hasIssue, issues, suggest} | null>}
 */
export async function aiCheckField(apiStore, fieldLabel, fieldValue) {
  if (!fieldValue || typeof fieldValue !== 'string' || fieldValue.trim().length < 5) return null;
  if (!apiStore.isConfigured) return null;

  const sysMsg = 'Bạn là chuyên gia thẩm định thẻ nhân vật SillyTavern, kiểm tra nội dung theo phương pháp luận viết thẻ xem có phù hợp với "độ không tuyệt đối / bạch miêu / khác biệt hóa đặc trưng / cấm văn mẫu" hay không. ' + JSON_QUOTE_RULE;
  const userPrompt = `Vui lòng kiểm tra trường "${fieldLabel}" của NPC sau, tìm ra các vấn đề về văn mẫu sáo rỗng, miêu tả mỹ nhân khuôn mẫu, gắn nhãn tính cách, đánh giá chủ quan...

Nội dung trường:
${fieldValue}

Xuất JSON (khi không có vấn đề thì hasIssue là false):
{"hasIssue": true hoặc false, "issues": ["Mô tả vấn đề 1", "Mô tả vấn đề 2"], "suggest": "Đề xuất sửa đổi cụ thể"}

Chỉ xuất ra JSON bằng tiếng Việt, không kèm bất kỳ giải thích nào.`;

  try {
    const result = await apiStore.chat([
      { role: 'system', content: sysMsg },
      { role: 'user', content: userPrompt }
    ], { temperature: 0.3 });

    const parsed = parseAiJsonObject(result);
    return {
      hasIssue: !!parsed.hasIssue,
      issues: Array.isArray(parsed.issues) ? parsed.issues : [],
      suggest: String(parsed.suggest || '')
    };
  } catch (e) {
    // Tự kiểm tra thất bại không làm gián đoạn luồng chính
    return null;
  }
}

/**
 * AI tự kiểm tra toàn diện NPC —— Gọi một lần sau khi tạo xong, thẩm định toàn bộ và sửa đổi theo danh mục quy tắc tích hợp
 * @param {object} apiStore
 * @param {object} npc - JSON NPC 6 khối
 * @returns {Promise<object>} NPC đã sửa đổi (nếu thất bại trả về NPC gốc)
 */
export async function aiCheckFullNpc(apiStore, npc) {
  if (!npc || !apiStore.isConfigured) return npc;

  const sysMsg = 'Bạn là chuyên gia thẩm định thẻ nhân vật SillyTavern. Kiểm tra và sửa đổi NPC theo phương pháp luận viết thẻ, bắt buộc xuất ra cấu trúc JSON 6 khối hoàn chỉnh bằng tiếng Việt. ' + JSON_QUOTE_RULE;
  const userPrompt = NPC_SELF_CHECK_PROMPT + '\n\nJSON NPC hiện tại:\n' + JSON.stringify(npc, null, 2);

  try {
    const result = await apiStore.chat([
      { role: 'system', content: sysMsg },
      { role: 'user', content: userPrompt }
    ], { temperature: 0.3 });

    const parsed = parseAiJsonObject(result);
    const fixed = normalizeNpc(parsed);
    if (!isValidNpc(fixed)) return npc;
    return fixed;
  } catch (e) {
    return npc;
  }
}

/**
 * Thống kê tổng số lượng văn mẫu sáo rỗng của NPC (Dùng để hiển thị điểm chất lượng ở khu vực kết quả)
 * @param {object} npc
 * @returns {{total, byType}} Tổng số + Phân nhóm theo loại
 */
export function summarizeBagua(npc) {
  if (!npc) return { total: 0, byType: {} };
  const allText = collectNpcText(npc);
  const issues = scanBagua(allText);
  const byType = {};
  for (const i of issues) {
    byType[i.type] = (byType[i.type] || 0) + 1;
  }
  return { total: issues.length, byType };
}

// Ghép nối toàn bộ trường văn bản của NPC thành một đoạn để quét tổng thể
function collectNpcText(npc) {
  const parts = [];
  for (const block of ['basic', 'appearance', 'personality', 'relationship', 'language']) {
    const data = npc[block];
    if (data && typeof data === 'object') {
      for (const v of Object.values(data)) {
        if (typeof v === 'string') parts.push(v);
      }
    }
  }
  if (Array.isArray(npc.sample_dialogues)) {
    parts.push(...npc.sample_dialogues.filter(d => typeof d === 'string'));
  }
  return parts.join('\n');
}