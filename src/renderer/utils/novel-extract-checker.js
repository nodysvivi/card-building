/**
 * Trích xuất tiểu thuyết sang Worldbook —— Kiểm tra chất lượng kết quả trích xuất
 * - scanBaguaInExtraction: Quét văn mẫu sáo rỗng (tái sử dụng scanBagua của npc-checker)
 * - checkChapterReferences: Kiểm tra thiếu sót neo số chương
 * - checkAbstractRelationLabels: Kiểm tra nhãn trừu tượng trong quan hệ
 * - aiSelfCheck: AI tự kiểm tra (gọi một lần sau khi tạo xong một loại)
 * - mergeR1R2: Gộp kết quả chạy kép R1+R2
 */

import { scanBagua } from './npc-checker.js';
import { SELF_CHECK_PROMPT, JSON_QUOTE_RULE } from './novel-extract-rules.js';
import { normalizeExtractionArray } from './novel-extract-format.js';
import { parseAiJsonArray } from './json-repair.js';

// ====================================================================
// Thu thập toàn bộ các trường chuỗi văn bản (tùy theo type mà trường khác nhau)
// ====================================================================

function collectTextFromArray(arr, type) {
  if (!Array.isArray(arr)) return [];
  const texts = [];

  for (const item of arr) {
    if (!item || typeof item !== 'object') continue;

    if (type === 'character') {
      if (item.appearance) texts.push(item.appearance);
      const tracks = item.tracks || {};
      for (const trackArr of Object.values(tracks)) {
        if (!Array.isArray(trackArr)) continue;
        for (const t of trackArr) {
          if (t.evidence) texts.push(t.evidence);
          if (t.summary) texts.push(t.summary);
          if (t.boundary) texts.push(t.boundary);
          if (t.decisions) texts.push(t.decisions);
          if (Array.isArray(t.behaviors)) {
            for (const b of t.behaviors) {
              if (b.behavior) texts.push(b.behavior);
              if (b.context) texts.push(b.context);
            }
          }
          if (Array.isArray(t.dialogues)) texts.push(...t.dialogues.filter(d => typeof d === 'string'));
        }
      }
    } else if (type === 'eventline') {
      if (item.cause?.summary) texts.push(item.cause.summary);
      if (item.cause?.dialogue) texts.push(item.cause.dialogue);
      for (const p of item.passages || []) {
        if (p.node) texts.push(p.node);
        if (p.dialogue) texts.push(p.dialogue);
      }
      if (item.result?.summary) texts.push(item.result.summary);
      if (item.result?.dialogue) texts.push(item.result.dialogue);
      if (item.follow_up) texts.push(item.follow_up);
    } else if (type === 'timeline') {
      if (item.summary) texts.push(item.summary);
      if (item.protagonist_status) texts.push(item.protagonist_status);
    } else if (type === 'setting') {
      if (item.effect) texts.push(item.effect);
      if (item.description) texts.push(item.description);
    } else if (type === 'item_trajectory') {
      for (const e of item.events || []) {
        if (e.source) texts.push(e.source);
        if (e.destination) texts.push(e.destination);
        if (e.evidence) texts.push(e.evidence);
      }
    }
  }
  return texts;
}

// ====================================================================
// Quét văn mẫu sáo rỗng
// ====================================================================

/**
 * Quét biểu đạt văn mẫu trong mảng kết quả trích xuất của một loại nhất định
 * @param {Array} arr Mảng kết quả trích xuất
 * @param {string} type 'character' | 'eventline' | ...
 * @returns {{ total, byType, items }} Tổng số + Phân nhóm theo loại văn mẫu + Các mục trúng khớp
 */
export function scanBaguaInExtraction(arr, type) {
  const texts = collectTextFromArray(arr, type);
  const allIssues = [];
  for (const text of texts) {
    const issues = scanBagua(text);
    allIssues.push(...issues);
  }
  const byType = {};
  for (const i of allIssues) {
    byType[i.type] = (byType[i.type] || 0) + 1;
  }
  return { total: allIssues.length, byType, items: allIssues.slice(0, 30) };
}

// ====================================================================
// Kiểm tra thiếu sót neo số chương
// ====================================================================

/**
 * Kiểm tra các mục có trường số chương bị trống hoặc bất thường trong kết quả trích xuất
 * @returns {Array<{path, expected, current}>} Danh sách thiếu sót
 */
export function checkChapterReferences(arr, type) {
  if (!Array.isArray(arr)) return [];
  const issues = [];

  for (let i = 0; i < arr.length; i++) {
    const item = arr[i];
    const itemName = item?.name || item?.stage_name || item?.item_name || `#${i}`;

    if (type === 'character') {
      const tracks = item?.tracks || {};
      for (const [trackName, trackArr] of Object.entries(tracks)) {
        if (!Array.isArray(trackArr)) continue;
        for (let ti = 0; ti < trackArr.length; ti++) {
          const t = trackArr[ti];
          if (!t.chapter || t.chapter === '') {
            issues.push({ path: `${itemName} / Quỹ đạo·${trackName}[${ti}]`, expected: 'Số chương', current: 'Trống' });
          }
          if (Array.isArray(t.behaviors)) {
            for (let bi = 0; bi < t.behaviors.length; bi++) {
              if (!t.behaviors[bi].chapter) {
                issues.push({ path: `${itemName} / Quan hệ·Hành vi[${bi}]`, expected: 'Số chương', current: 'Trống' });
              }
            }
          }
        }
      }
    } else if (type === 'eventline') {
      if (item?.cause && !item.cause.chapter) {
        issues.push({ path: `${itemName} / Nguyên nhân`, expected: 'Số chương', current: 'Trống' });
      }
      for (let pi = 0; pi < (item?.passages || []).length; pi++) {
        if (!item.passages[pi].chapter) {
          issues.push({ path: `${itemName} / Diễn biến[${pi}]`, expected: 'Số chương', current: 'Trống' });
        }
      }
      if (item?.result && !item.result.chapter) {
        issues.push({ path: `${itemName} / Kết quả`, expected: 'Số chương', current: 'Trống' });
      }
    } else if (type === 'item_trajectory') {
      for (let ei = 0; ei < (item?.events || []).length; ei++) {
        if (!item.events[ei].chapter) {
          issues.push({ path: `${itemName} / Lưu chuyển[${ei}]`, expected: 'Số chương', current: 'Trống' });
        }
      }
    }
  }
  return issues;
}

// ====================================================================
// Kiểm tra nhãn trừu tượng trong quan hệ
// ====================================================================

const ABSTRACT_LABEL_PATTERNS = [
  /ôn thuận ngoan ngoãn|nũng nịu|tin cậy chân thành|thúc đẩy bởi đố kỵ|phụ nữ bị chinh phục|từ ái nhưng vụng về|温顺乖巧|俏皮撒娇|真诚信赖|嫉妒驱动|被征服的女性|慈爱却略显笨拙/g,
  /^(dịu dàng|tốt bụng|kiên cường|thông minh|cởi mở|hướng nội|tsundere|bụng dạ đen tối|ấm áp|lạnh lùng|đáng yêu|xinh đẹp|đẹp trai|温柔|善良|坚强|聪明|开朗|内向|傲娇|腹黑|温暖|冷漠|可爱|漂亮|帅气)[、，,]/gm,
  /^(trưởng thành|thay đổi|thăng hoa|thức tỉnh|成熟|成长|蜕变|升华|觉醒)$/gm
];

/**
 * Kiểm tra các nhãn trừu tượng trong quan hệ / mô thức hành vi của nhân vật
 */
export function checkAbstractRelationLabels(characters) {
  if (!Array.isArray(characters)) return [];
  const issues = [];

  for (const char of characters) {
    const tracks = char?.tracks || {};
    const rels = tracks.关系 || tracks['Quan hệ'] || [];
    for (const r of rels) {
      if (typeof r.summary === 'string') {
        for (const pattern of ABSTRACT_LABEL_PATTERNS) {
          pattern.lastIndex = 0;
          let m;
          while ((m = pattern.exec(r.summary)) !== null) {
            issues.push({ char: char.name, target: r.target, label: m[0], field: 'Đặc trưng tương tác' });
            if (m.index === pattern.lastIndex) pattern.lastIndex++;
          }
        }
      }
    }
    const behaviors = tracks.行为模式 || tracks['Mô thức hành vi'] || [];
    for (const stage of behaviors) {
      if (typeof stage.decisions === 'string') {
        for (const pattern of ABSTRACT_LABEL_PATTERNS) {
          pattern.lastIndex = 0;
          let m;
          while ((m = pattern.exec(stage.decisions)) !== null) {
            issues.push({ char: char.name, stage: stage.stage, label: m[0], field: 'Thiên hướng quyết định' });
            if (m.index === pattern.lastIndex) pattern.lastIndex++;
          }
        }
      }
    }
  }
  return issues;
}

// ====================================================================
// AI tự kiểm tra (gọi một lần sau khi tạo xong một loại)
// ====================================================================

/**
 * Gửi kết quả trích xuất của một loại cho AI tự kiểm tra, trả về mảng đã sửa đổi
 */
export async function aiSelfCheckExtraction(apiStore, extractionArray, type) {
  if (!apiStore.isConfigured) return extractionArray;
  if (!Array.isArray(extractionArray) || extractionArray.length === 0) return extractionArray;

  const sysMsg = 'Bạn là chuyên gia thẩm định tạo thẻ nhân vật SillyTavern. Kiểm tra và sửa đổi kết quả trích xuất theo đúng các quy tắc viết văn, bắt buộc xuất ra cấu trúc mảng JSON hoàn chỉnh bằng tiếng Việt. ' + JSON_QUOTE_RULE;
  const userPrompt = SELF_CHECK_PROMPT + `\n\n## Kết quả trích xuất hiện tại (type: ${type})\n\n` + JSON.stringify(extractionArray, null, 2);

  try {
    const result = await apiStore.chat([
      { role: 'system', content: sysMsg },
      { role: 'user', content: userPrompt }
    ], {
      temperature: 0.3,
      maxTokens: apiStore.getModelMaxTokens(apiStore.activeProvider?.model)
    });
    const parsed = parseAiJsonArray(result);
    const normalized = normalizeExtractionArray(parsed, type);
    return normalized.length > 0 ? normalized : extractionArray;
  } catch (e) {
    return extractionArray;
  }
}

// ====================================================================
// Gộp chạy kép R1+R2
// ====================================================================

/**
 * Gửi kết quả 2 lần trích xuất độc lập R1 + R2 cho AI để hợp nhất và loại bỏ trùng lặp
 */
export async function mergeR1R2(apiStore, r1Array, r2Array, type) {
  if (!apiStore.isConfigured) {
    return mergeArraysFallback(r1Array, r2Array, type);
  }
  if (!Array.isArray(r1Array) || !Array.isArray(r2Array)) {
    return r1Array || r2Array || [];
  }

  const sysMsg = 'Bạn là công cụ hợp nhất dữ liệu. So sánh 2 bản kết quả trích xuất độc lập, xuất ra mảng JSON hoàn chỉnh sau khi đã gộp và khử trùng lặp bằng tiếng Việt. ' + JSON_QUOTE_RULE;
  const userPrompt = `## Nhiệm vụ: Hợp nhất kết quả trích xuất của R1 và R2 (type: ${type})

Quy tắc hợp nhất:
- Các mục cùng tên / cùng nghĩa thì lấy hợp (union), số chương lấy phiên bản có thông tin đầy đủ hơn
- Giữ lại các mục độc nhất chỉ một bên có
- Lời thoại / điểm nút của các quỹ đạo quan hệ / mô thức hành vi cần lấy hợp và khử trùng lặp
- Xuất mảng JSON hoàn chỉnh (cùng cấu trúc trường với R1/R2)

===R1===
${JSON.stringify(r1Array, null, 2)}

===R2===
${JSON.stringify(r2Array, null, 2)}

Chỉ xuất ra mảng JSON sau khi hợp nhất, không kèm bất kỳ giải thích nào.`;

  try {
    const result = await apiStore.chat([
      { role: 'system', content: sysMsg },
      { role: 'user', content: userPrompt }
    ], {
      temperature: 0.3,
      maxTokens: apiStore.getModelMaxTokens(apiStore.activeProvider?.model)
    });
    const parsed = parseAiJsonArray(result);
    const normalized = normalizeExtractionArray(parsed, type);
    return normalized.length > 0 ? normalized : mergeArraysFallback(r1Array, r2Array, type);
  } catch (e) {
    return mergeArraysFallback(r1Array, r2Array, type);
  }
}

// Phương án dự phòng khử trùng lặp đơn giản khi AI gộp thất bại
function mergeArraysFallback(r1, r2, type) {
  const arr = [...(r1 || []), ...(r2 || [])];
  const seen = new Set();
  const result = [];
  for (const item of arr) {
    const key = item?.name || item?.stage_name || item?.item_name || JSON.stringify(item);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  return result;
}

// ====================================================================
// Gộp các mục trùng tên giữa các đoạn (Phương án C: AI gộp + Dự phòng hợp trường cục bộ)
// ====================================================================

const TYPE_LABELS = {
  character: 'Nhân vật',
  eventline: 'Tuyến sự kiện',
  timeline: 'Giai đoạn dòng thời gian',
  setting: 'Thiết lập',
  item_trajectory: 'Vật phẩm'
};

function sleepMs(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * Gộp nhiều bản ghi cùng tên trích xuất độc lập từ các đoạn khác nhau thành một bản ghi duy nhất
 */
export async function mergeSameNameByAI(apiStore, array, type) {
  if (!Array.isArray(array) || array.length === 0) return array || [];

  const getKey = (item) => item?.name || item?.stage_name || item?.item_name || JSON.stringify(item);
  const groups = new Map();
  const order = [];
  for (const item of array) {
    const key = getKey(item);
    if (!groups.has(key)) {
      groups.set(key, []);
      order.push(key);
    }
    groups.get(key).push(item);
  }

  const merged = [];
  for (const key of order) {
    const items = groups.get(key);
    if (items.length === 1) {
      merged.push(items[0]);
      continue;
    }
    let result = null;
    if (apiStore.isConfigured) {
      try {
        result = await mergeGroupByAI(apiStore, items, type, key);
      } catch (e) {
        result = null;
      }
      await sleepMs(13000);
    }
    if (!result) {
      result = mergeItemsLocal(items);
    }
    merged.push(result);
  }

  return merged;
}

async function mergeGroupByAI(apiStore, items, type, name) {
  const typeName = TYPE_LABELS[type] || type;
  const sysMsg = 'Bạn là công cụ hợp nhất dữ liệu. Hãy gộp nhiều phần thông tin trích xuất độc lập của cùng một thực thể từ các đoạn khác nhau thành một mục hoàn chỉnh, lấy hợp thông tin không bỏ sót sự kiện, xuất ra mảng JSON chứa 1 đối tượng duy nhất bằng tiếng Việt. ' + JSON_QUOTE_RULE;
  const userPrompt = `## Nhiệm vụ: Gộp các mục trùng tên giữa các đoạn (type: ${type})

Đây là ${items.length} phần thông tin trích xuất độc lập của cùng một ${typeName} "${name}" từ các đoạn khác nhau của tiểu thuyết.

Quy tắc hợp nhất:
- Thông tin **lấy hợp (union)**, không bỏ sót bất kỳ sự kiện độc nhất nào
- Các trường mảng (tracks / passages / events...) cần khử trùng lặp và gộp lại
- Số chương lấy phiên bản có thông tin đầy đủ hơn
- Khi có mâu thuẫn, giữ lại nhiều bản và ngăn cách bằng " / "
- Cấu trúc trường đồng nhất với mục ban đầu

===Kết quả trích xuất theo đoạn===
${JSON.stringify(items, null, 2)}

Chỉ xuất ra mảng JSON (chứa 1 đối tượng đã gộp), không kèm bất kỳ giải thích nào.`;

  const result = await apiStore.chat([
    { role: 'system', content: sysMsg },
    { role: 'user', content: userPrompt }
  ], {
    temperature: 0.3,
    maxTokens: apiStore.getModelMaxTokens(apiStore.activeProvider?.model)
  });
  const parsed = parseAiJsonArray(result);
  const normalized = normalizeExtractionArray(parsed, type);
  return normalized.length > 0 ? normalized[0] : null;
}

// Hợp nhất trường dữ liệu cục bộ (Phương án dự phòng khi AI gộp thất bại)
function mergeItemsLocal(items) {
  if (!items || items.length === 0) return null;
  if (items.length === 1) return items[0];
  let base = JSON.parse(JSON.stringify(items[0]));
  for (let i = 1; i < items.length; i++) {
    base = mergeValuesLocal(base, items[i]);
  }
  return base;
}

function mergeValuesLocal(a, b) {
  if (a == null || a === '') return b;
  if (b == null || b === '') return a;

  if (Array.isArray(a) !== Array.isArray(b)) return a;
  if (typeof a !== typeof b) return a;

  // Mảng: Lấy hợp và khử trùng lặp
  if (Array.isArray(a)) {
    const seen = new Set(a.map(x => JSON.stringify(x)));
    const result = [...a];
    for (const x of b) {
      const s = JSON.stringify(x);
      if (!seen.has(s)) {
        seen.add(s);
        result.push(x);
      }
    }
    return result;
  }

  // Đối tượng: Đệ quy hợp nhất từng trường
  if (typeof a === 'object') {
    const result = { ...a };
    for (const [k, vb] of Object.entries(b)) {
      if (vb == null || vb === '') continue;
      const va = result[k];
      if (va == null || va === '') {
        result[k] = vb;
      } else {
        result[k] = mergeValuesLocal(va, vb);
      }
    }
    return result;
  }

  // Chuỗi: Nếu khác nhau thì nối lại
  if (typeof a === 'string') {
    if (a === b || a.includes(b) || b.includes(a)) return a;
    return a + ' / ' + b;
  }

  // Số / Boolean: Giữ giá trị a
  return a;
}

// ====================================================================
// Đánh giá điểm chất lượng tổng thể
// ====================================================================

/**
 * Đánh giá điểm chất lượng cho toàn bộ kết quả trích xuất (dùng để hiển thị ở khu vực kết quả)
 * @returns {{ score, baguaCount, missingChapterCount, abstractLabelCount, suggestions }}
 */
export function summarizeExtractionQuality(extraction) {
  let baguaCount = 0;
  let missingChapterCount = 0;

  for (const type of ['character', 'eventline', 'timeline', 'setting', 'item_trajectory']) {
    const arr = extraction[type === 'character' ? 'characters' :
                            type === 'eventline' ? 'eventlines' :
                            type === 'timeline' ? 'timeline' :
                            type === 'setting' ? 'settings' :
                            'item_trajectories'];
    const baguaScan = scanBaguaInExtraction(arr, type);
    baguaCount += baguaScan.total;
    missingChapterCount += checkChapterReferences(arr, type).length;
  }

  const abstractLabelCount = checkAbstractRelationLabels(extraction.characters).length;

  const totalIssues = baguaCount + missingChapterCount + abstractLabelCount;
  const score = Math.max(0, 100 - baguaCount * 2 - missingChapterCount * 1 - abstractLabelCount * 3);

  const suggestions = [];
  if (baguaCount > 0) suggestions.push(`${baguaCount} chỗ biểu đạt văn mẫu sáo rỗng, khuyến nghị dùng AI tự kiểm tra để sửa đổi`);
  if (missingChapterCount > 0) suggestions.push(`${missingChapterCount} sự kiện thiếu số chương`);
  if (abstractLabelCount > 0) suggestions.push(`${abstractLabelCount} chỗ gắn nhãn trừu tượng trong quan hệ`);

  return {
    score,
    baguaCount,
    missingChapterCount,
    abstractLabelCount,
    totalIssues,
    suggestions
  };
}