/**
 * Chẩn đoán thẻ nhân vật —— 3 kiểm tra chuyên biệt AI + Hàm sửa lỗi AI
 * Bổ trợ cho 7 kiểm tra thuần frontend trong diagnostic-checks.js
 */

import { parseAiJsonArray } from './json-repair.js';
import { JSON_QUOTE_RULE } from './npc-rules.js';

// ====================================================================
// 8. Chẩn đoán tính nhất quán nhân vật (AI)
// ====================================================================

export async function checkCharacterConsistency(apiStore, cardStore) {
  if (!apiStore.isConfigured) {
    return {
      key: 'character_consistency',
      name: 'Chẩn đoán tính nhất quán nhân vật',
      passed: false,
      summary: 'API chưa cấu hình, không thể chạy kiểm tra AI',
      issues: []
    };
  }

  const d = cardStore.cardData;
  const fields = {
    name: d.name || '',
    description: (d.description || '').slice(0, 1500),
    personality: d.personality || '',
    scenario: (d.scenario || '').slice(0, 1000),
    first_mes: (d.first_mes || '').slice(0, 1500)
  };

  if (!fields.name && !fields.description && !fields.personality && !fields.first_mes) {
    return {
      key: 'character_consistency',
      name: 'Chẩn đoán tính nhất quán nhân vật',
      passed: true,
      summary: 'Trường cơ bản trống, không có nội dung để kiểm tra',
      issues: []
    };
  }

  const sysMsg = 'Bạn là chuyên gia thẩm định viết thẻ nhân vật SillyTavern, chuyên tìm các mâu thuẫn logic giữa 4 trường lớn của thẻ nhân vật (description / personality / scenario / first_mes). ' + JSON_QUOTE_RULE;
  const userPrompt = `Vui lòng kiểm tra tính nhất quán giữa 4 trường sau của thẻ nhân vật, tìm ra các điểm mâu thuẫn:

【name】
${fields.name || '(Trống)'}

【description】
${fields.description || '(Trống)'}

【personality】
${fields.personality || '(Trống)'}

【scenario】
${fields.scenario || '(Trống)'}

【first_mes】
${fields.first_mes || '(Trống)'}

Tiêu chuẩn kiểm tra:
- Miêu tả tính cách và biểu hiện thực tế trong lời mở đầu có nhất quán không (ví dụ ghi "dịu dàng" nhưng mở đầu lại lạnh lùng)
- Tuổi tác / giới tính / thân phận ở các trường khác nhau có đồng nhất không
- Thiết lập bối cảnh và lời mở đầu có khớp nhau không
- Hành vi nhân vật có phù hợp với thiết lập personality không

Xuất mảng JSON (nếu không có vấn đề thì xuất mảng rỗng []):
\`\`\`json
[
  {
    "field": "first_mes",
    "conflict_with": "personality",
    "title": "Tiêu đề mâu thuẫn",
    "description": "Mô tả mâu thuẫn cụ thể",
    "fix_suggestion": "Định hướng sửa đổi đề xuất"
  }
]
\`\`\`

Chỉ xuất ra mảng JSON bằng tiếng Việt, không kèm bất kỳ giải thích nào.`;

  try {
    const result = await apiStore.chat([
      { role: 'system', content: sysMsg },
      { role: 'user', content: userPrompt }
    ], { temperature: 0.3, maxTokens: apiStore.getModelMaxTokens(apiStore.activeProvider?.model) });

    const parsed = parseAiJsonArray(result);
    const issues = (Array.isArray(parsed) ? parsed : [])
      .filter(p => p && (p.title || p.description))
      .map(p => ({
        severity: 'warning',
        title: p.title || 'Vấn đề nhất quán nhân vật',
        description: `${p.description || ''}\nĐề xuất: ${p.fix_suggestion || 'Vui lòng tự xem xét điều chỉnh'}`,
        location: `${p.field || '?'} ↔ ${p.conflict_with || '?'}`,
        fixable: true,
        fixId: 'ai_fix_field',
        fixPayload: { field: p.field, suggestion: p.fix_suggestion, conflictDesc: p.description }
      }));

    return {
      key: 'character_consistency',
      name: 'Chẩn đoán tính nhất quán nhân vật',
      passed: issues.length === 0,
      summary: issues.length === 0 ? '4 trường cơ bản nhất quán tốt' : `Phát hiện ${issues.length} chỗ mâu thuẫn`,
      issues
    };
  } catch (e) {
    return {
      key: 'character_consistency',
      name: 'Chẩn đoán tính nhất quán nhân vật',
      passed: false,
      summary: 'Gọi AI thất bại: ' + e.message,
      issues: []
    };
  }
}

// ====================================================================
// 9. Chẩn đoán biến MVU (AI)
// ====================================================================

export async function checkMvuVariables(apiStore, cardStore) {
  if (!apiStore.isConfigured) {
    return {
      key: 'mvu_variables',
      name: 'Chẩn đoán biến MVU',
      passed: false,
      summary: 'API chưa cấu hình, không thể chạy kiểm tra AI',
      issues: []
    };
  }

  const varGroups = cardStore.cardData.extensions?.cfMvuVarGroups || [];
  if (varGroups.length === 0) {
    return {
      key: 'mvu_variables',
      name: 'Chẩn đoán biến MVU',
      passed: true,
      summary: 'Chưa bật hệ thống biến MVU (nếu không cần có thể bỏ qua)',
      issues: []
    };
  }

  const allVars = [];
  for (const g of varGroups) {
    for (const f of (g.fields || [])) {
      allVars.push(`${g.name}.${f.name} (${f.type}${f.defaultValue ? '=' + f.defaultValue : ''})`);
    }
  }

  const worldbookContent = (cardStore.worldEntries || [])
    .filter(e => e.enabled)
    .map(e => `[${e.comment || '(Chưa đặt tên)'}]\n${(e.content || '').slice(0, 500)}`)
    .join('\n\n');

  const sysMsg = 'Bạn là chuyên gia thẩm định hệ thống biến MVU của SillyTavern. ' + JSON_QUOTE_RULE;
  const userPrompt = `Vui lòng kiểm tra định nghĩa và việc sử dụng biến MVU có hợp lý hay không:

【Các biến đã định nghĩa】
${allVars.join('\n')}

【Nội dung Worldbook (Xem tình hình tham chiếu biến)】
${worldbookContent.slice(0, 5000)}

Các hạng mục kiểm tra:
1. Có biến nào được định nghĩa nhưng chưa từng được tham chiếu trong Worldbook không?
2. Có kiểu biến nào không hợp lý không (như hệ thống chiến đấu toàn dùng string mà không có number)?
3. Có thiếu các biến thông thường mà hệ thống MVU nên có không (như thời gian / vị trí / trạng thái)?
4. Tên biến có bị mơ hồ hoặc trùng lặp không?

Xuất mảng JSON (nếu không có vấn đề thì xuất mảng rỗng []):
\`\`\`json
[
  {
    "title": "Tiêu đề vấn đề",
    "description": "Vấn đề cụ thể",
    "variable": "Tên biến liên quan",
    "fix_suggestion": "Đề xuất"
  }
]
\`\`\`

Chỉ xuất ra mảng JSON bằng tiếng Việt.`;

  try {
    const result = await apiStore.chat([
      { role: 'system', content: sysMsg },
      { role: 'user', content: userPrompt }
    ], { temperature: 0.3, maxTokens: apiStore.getModelMaxTokens(apiStore.activeProvider?.model) });

    const parsed = parseAiJsonArray(result);
    const issues = (Array.isArray(parsed) ? parsed : [])
      .filter(p => p && (p.title || p.description))
      .map(p => ({
        severity: 'info',
        title: p.title || 'Vấn đề biến MVU',
        description: `${p.description || ''}\nĐề xuất: ${p.fix_suggestion || ''}`,
        location: p.variable || 'Biến MVU',
        fixable: false  // Chẩn đoán biến MVU chỉ đưa ra đề xuất, không tự động sửa bằng AI
      }));

    return {
      key: 'mvu_variables',
      name: 'Chẩn đoán biến MVU',
      passed: issues.length === 0,
      summary: `${allVars.length} biến${issues.length === 0 ? ', không có vấn đề' : ', ' + issues.length + ' đề xuất'}`,
      issues
    };
  } catch (e) {
    return {
      key: 'mvu_variables',
      name: 'Chẩn đoán biến MVU',
      passed: false,
      summary: 'Gọi AI thất bại: ' + e.message,
      issues: []
    };
  }
}

// ====================================================================
// 10. Đánh giá thực hành tốt nhất (AI)
// ====================================================================

export async function checkBestPractices(apiStore, cardStore) {
  if (!apiStore.isConfigured) {
    return {
      key: 'best_practices',
      name: 'Đánh giá thực hành tốt nhất',
      passed: false,
      summary: 'API chưa cấu hình, không thể chạy kiểm tra AI',
      issues: []
    };
  }

  const d = cardStore.cardData;
  const description = d.description || '';
  const personality = d.personality || '';

  if (!description && !personality) {
    return {
      key: 'best_practices',
      name: 'Đánh giá thực hành tốt nhất',
      passed: true,
      summary: 'description/personality đang trống, không có nội dung để đánh giá',
      issues: []
    };
  }

  const sysMsg = 'Bạn là chuyên gia thẩm định viết thẻ nhân vật SillyTavern, đánh giá theo nguyên tắc "độ không tuyệt đối + khác biệt hóa đặc trưng + cấm gắn nhãn quan hệ". ' + JSON_QUOTE_RULE;
  const userPrompt = `Vui lòng đánh giá chất lượng hành văn của thẻ nhân vật theo các quy tắc nghiêm ngặt sau:

【description】
${description.slice(0, 2000)}

【personality】
${personality}

Tiêu chuẩn đánh giá:
1. **Khác biệt hóa đặc trưng**: Ngoại hình có chỉ viết phần "lệch khỏi nhận thức mặc định của AI" không? Hay chồng chất miêu tả mỹ nhân khuôn mẫu như "gương mặt tinh xảo / làn da trắng nõn"?
2. **Cấm gắn nhãn quan hệ**: Có dùng các nhãn trừu tượng như "ngoan ngoãn phục tùng / tin cậy chân thành / đố kỵ" để miêu tả quan hệ không? Cần thay thế bằng hành vi cụ thể
3. **Cấm gắn nhãn tính cách**: Có viết trực tiếp "cô ấy rất dịu dàng / anh ấy rất tốt bụng" không? Cần thể hiện qua hành vi cụ thể
4. **Độ không tuyệt đối**: Có chứa đánh giá chủ quan của tác giả / biểu đạt văn mẫu sáo rỗng (dường như / phảng phất / khóe miệng khẽ nhếch) không?

Xuất mảng JSON (nếu không có vấn đề thì xuất mảng rỗng []):
\`\`\`json
[
  {
    "field": "description" hoặc "personality",
    "title": "Tiêu đề vấn đề (VD: description chứa miêu tả mỹ nhân khuôn mẫu)",
    "description": "Mô tả vấn đề cụ thể",
    "violations": ["Từ/câu cụ thể vi phạm"],
    "fix_suggestion": "Định hướng viết lại đề xuất"
  }
]
\`\`\`

Chỉ xuất ra mảng JSON bằng tiếng Việt.`;

  try {
    const result = await apiStore.chat([
      { role: 'system', content: sysMsg },
      { role: 'user', content: userPrompt }
    ], { temperature: 0.3, maxTokens: apiStore.getModelMaxTokens(apiStore.activeProvider?.model) });

    const parsed = parseAiJsonArray(result);
    const issues = (Array.isArray(parsed) ? parsed : [])
      .filter(p => p && (p.title || p.description))
      .map(p => ({
        severity: 'warning',
        title: p.title || 'Vấn đề thực hành tốt nhất',
        description: `${p.description || ''}${p.violations ? '\nTrúng khớp: ' + (Array.isArray(p.violations) ? p.violations.join('、') : p.violations) : ''}\nĐề xuất: ${p.fix_suggestion || ''}`,
        location: p.field || 'description',
        fixable: true,
        fixId: 'ai_fix_field',
        fixPayload: { field: p.field, suggestion: p.fix_suggestion, conflictDesc: p.description }
      }));

    return {
      key: 'best_practices',
      name: 'Đánh giá thực hành tốt nhất',
      passed: issues.length === 0,
      summary: issues.length === 0 ? 'Phong cách hành văn phù hợp với thực hành tốt nhất' : `${issues.length} chỗ vi phạm quy tắc viết văn`,
      issues
    };
  } catch (e) {
    return {
      key: 'best_practices',
      name: 'Đánh giá thực hành tốt nhất',
      passed: false,
      summary: 'Gọi AI thất bại: ' + e.message,
      issues: []
    };
  }
}

// ====================================================================
// Chạy tất cả kiểm tra AI
// ====================================================================

export async function runAllAiChecks(apiStore, cardStore, onProgress) {
  const checks = [
    { fn: checkCharacterConsistency, name: 'Chẩn đoán tính nhất quán nhân vật' },
    { fn: checkMvuVariables, name: 'Chẩn đoán biến MVU' },
    { fn: checkBestPractices, name: 'Đánh giá thực hành tốt nhất' }
  ];

  const results = [];
  for (let i = 0; i < checks.length; i++) {
    if (onProgress) onProgress(i, checks.length, checks[i].name);
    try {
      const r = await checks[i].fn(apiStore, cardStore);
      results.push(r);
    } catch (e) {
      results.push({
        key: 'unknown',
        name: checks[i].name,
        passed: false,
        summary: 'Kiểm tra thất bại: ' + e.message,
        issues: []
      });
    }
    if (i < checks.length - 1) await new Promise(r => setTimeout(r, 13000));
  }
  return results;
}

// Meta dữ liệu kiểm tra AI
export const AI_CHECK_METADATA = [
  { key: 'character_consistency', name: 'Chẩn đoán tính nhất quán nhân vật', desc: 'Kiểm tra mâu thuẫn giữa description ↔ personality ↔ first_mes' },
  { key: 'mvu_variables', name: 'Chẩn đoán biến MVU', desc: 'Tính hợp lý của định nghĩa biến + Phát hiện biến chưa được dùng' },
  { key: 'best_practices', name: 'Đánh giá thực hành tốt nhất', desc: 'Kiểm tra theo quy tắc viết văn (khác biệt hóa đặc trưng / cấm gắn nhãn quan hệ)' }
];

// ====================================================================
// AI sửa lỗi: Viết lại trường chỉ định
// ====================================================================

/**
 * AI viết lại một trường nhất định của thẻ nhân vật
 * @returns {Promise<{ original, rewritten, field }>}
 */
export async function aiFixField(apiStore, cardStore, field, suggestion, conflictDesc) {
  if (!apiStore.isConfigured) throw new Error('API chưa cấu hình');

  const d = cardStore.cardData;
  const original = d[field] || '';
  if (!original.trim()) throw new Error(`Trường ${field} đang trống, không thể viết lại`);

  const sysMsg = 'Bạn là chuyên gia viết thẻ nhân vật SillyTavern, viết lại trường thông tin của thẻ nhân vật theo yêu cầu, giữ nguyên độ dài ban đầu và khung phong cách. ' + JSON_QUOTE_RULE;
  const userPrompt = `Vui lòng viết lại trường sau theo đề xuất:

【Tên trường】${field}
【Nội dung gốc】
${original}

【Vấn đề phát hiện】
${conflictDesc || '(Không có mô tả cụ thể)'}

【Đề xuất viết lại】
${suggestion || 'Sửa chữa các vấn đề nêu trên'}

Yêu cầu:
- Chỉ sửa phần có vấn đề, không viết lại toàn bộ từ đầu
- Giữ nguyên cấu trúc tổng thể và văn phong của nguyên văn
- Xuất toàn bộ nội dung hoàn chỉnh sau khi sửa đổi (không phải dạng diff, mà là phiên bản mới đầy đủ)
- Không thêm bất kỳ giải thích, tiền tố, hay bọc khối mã Markdown nào

Xuất trực tiếp toàn bộ nội dung sau khi sửa đổi bằng tiếng Việt:`;

  const result = await apiStore.chat([
    { role: 'system', content: sysMsg },
    { role: 'user', content: userPrompt }
  ], { temperature: 0.6, maxTokens: apiStore.getModelMaxTokens(apiStore.activeProvider?.model) });

  const rewritten = String(result || '').replace(/^```[\s\S]*?\n/, '').replace(/```$/, '').trim();

  return { original, rewritten, field };
}

/**
 * Ghi giá trị trường đã được AI viết lại vào cardStore
 */
export function applyAiFix(cardStore, field, newValue) {
  if (!field) return false;
  cardStore.cardData[field] = newValue;
  cardStore.markDirty();
  return true;
}