/**
 * Gọi AI và phân tích cú pháp mảng JSON trả về, tự động thử lại khi thất bại.
 * @param {object} apiStore - Instance của apiStore
 * @param {Array} messages - Mảng tin nhắn chat
 * @param {object} options - Tùy chọn chat (temperature, maxTokens...)
 * @param {number} maxRetries - Số lần thử lại tối đa (mặc định 2 lần, tức tối đa 3 lượt)
 * @returns {Promise<Array>} Mảng sau khi phân tích cú pháp
 */
export async function chatForJsonArray(apiStore, messages, options = {}, maxRetries = 2) {
  let lastErr;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await apiStore.chat(messages, options);
      return parseAiJsonArray(result);
    } catch (e) {
      lastErr = e;
      if (attempt < maxRetries) continue;
    }
  }
  throw lastErr;
}

/**
 * Trích xuất và sửa lỗi mảng JSON từ văn bản do AI trả về.
 * Xử lý các lỗi phổ biến từ AI: khối mã markdown, chú thích, dấu phẩy thừa ở cuối, dấu nháy thông minh, dấu nháy chưa escape trong chuỗi...
 * @param {string} raw - Văn bản gốc do AI trả về
 * @returns {Array} Mảng sau khi phân tích cú pháp
 */
export function parseAiJsonArray(raw) {
  // 1. Loại bỏ bao bọc khối mã markdown
  let text = raw
    .replace(/```(?:json)?\s*/gi, '')
    .replace(/\/\/[^\n]*/g, '')        // Chú thích một dòng
    .replace(/\/\*[\s\S]*?\*\//g, ''); // Chú thích nhiều dòng

  // 2. Trích xuất [ ... ] ngoài cùng, hỗ trợ sửa lỗi ngắt quãng
  let match = text.match(/\[[\s\S]*\]/);
  if (!match) {
    // Có thể JSON bị ngắt quãng, không có dấu ] đóng
    const openBracket = text.indexOf('[');
    if (openBracket !== -1) {
      // Thử bù đầy đủ: cắt đến } hoàn chỉnh cuối cùng, sau đó bù ]
      let truncated = text.slice(openBracket);
      const lastBrace = truncated.lastIndexOf('}');
      if (lastBrace !== -1) {
        truncated = truncated.slice(0, lastBrace + 1);
        // Loại bỏ dấu phẩy có thể có ở cuối
        truncated = truncated.replace(/,\s*$/, '');
        truncated += ']';
        match = [truncated];
      }
    }
    if (!match) throw new Error('Định dạng AI trả về bất thường, không tìm thấy mảng JSON');
  }

  let jsonStr = match[0];

  // 3. Làm sạch cơ bản
  jsonStr = jsonStr
    .replace(/,\s*([}\]])/g, '$1')     // Dấu phẩy ở cuối
    .replace(/[\u201c\u201d]/g, '"')   // Dấu ngoặc kép tiếng Trung
    .replace(/[\u2018\u2019]/g, "'")   // Dấu ngoặc đơn tiếng Trung
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, ''); // Ký tự điều khiển không hợp lệ (giữ lại \n \r \t)

  // 4. Thử phân tích cú pháp qua nhiều vòng
  // Dự phòng ngắt quãng: tìm } hoàn chỉnh cuối cùng từ đuôi ngược lên, cắt đến đó + bù ] để đối tượng cuối bị cắt không làm hỏng toàn bộ đối tượng trước đó
  const trimToLastObject = (s) => {
    const open = s.indexOf('[');
    if (open === -1) return s;
    let body = s.slice(open);
    const lastBrace = body.lastIndexOf('}');
    if (lastBrace === -1) return s;
    body = body.slice(0, lastBrace + 1).replace(/,\s*$/, '') + ']';
    return body;
  };

  const attempts = [
    () => jsonStr,
    () => escapeNewlinesInStrings(jsonStr),
    () => jsonStr.replace(/[\r\n]+/g, ' '),
    () => repairUnescapedQuotes(jsonStr.replace(/[\r\n]+/g, ' ')),
    () => trimToLastObject(repairUnescapedQuotes(jsonStr.replace(/[\r\n]+/g, ' '))),
    () => trimToLastObject(jsonStr),
  ];

  let lastErr;
  let lastAttemptStr = jsonStr;
  for (const attempt of attempts) {
    try {
      const s = attempt();
      lastAttemptStr = s;
      return JSON.parse(s);
    } catch (e) {
      lastErr = e;
    }
  }

  // Đính kèm 50 ký tự trước sau vị trí lỗi + 200 ký tự đầu của raw để dễ tra cứu
  let contextHint = '';
  const posMatch = lastErr.message.match(/position (\d+)/);
  if (posMatch) {
    const pos = parseInt(posMatch[1]);
    const start = Math.max(0, pos - 50);
    const end = Math.min(lastAttemptStr.length, pos + 50);
    contextHint = ` | Vị trí gần lỗi: "...${lastAttemptStr.slice(start, pos)}【ERR→】${lastAttemptStr.slice(pos, end)}..."`;
  }
  const rawHint = ' | 200 từ đầu ngõ ra gốc: ' + String(raw || '').slice(0, 200).replace(/\s+/g, ' ');
  throw new Error('Định dạng JSON do AI trả về không thể phân tích: ' + lastErr.message + contextHint + rawHint);
}

/** Trích xuất và sửa lỗi đối tượng JSON đơn lẻ từ văn bản AI trả về */
export function parseAiJsonObject(raw) {
  let text = String(raw || '')
    .replace(/```(?:json)?\s*/gi, '')
    .replace(/```/g, '')
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end < start) throw new Error('Định dạng AI trả về bất thường, không tìm thấy đối tượng JSON');
  let jsonStr = text.slice(start, end + 1)
    .replace(/,\s*([}\]])/g, '$1')
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '');
  const attempts = [
    jsonStr,
    escapeNewlinesInStrings(jsonStr),
    jsonStr.replace(/[\r\n]+/g, ' '),
    repairUnescapedQuotes(jsonStr.replace(/[\r\n]+/g, ' '))
  ];
  let lastError;
  for (const candidate of attempts) {
    try {
      const parsed = JSON.parse(candidate);
      if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error('Giá trị trả về không phải đối tượng JSON');
      return parsed;
    } catch (error) { lastError = error; }
  }
  throw new Error(`Đối tượng JSON do AI trả về không thể phân tích: ${lastError?.message || 'Lỗi không xác định'}`);
}

/** Escape ký tự xuống dòng gốc bên trong chuỗi JSON */
function escapeNewlinesInStrings(str) {
  return str.replace(/"(?:[^"\\]|\\.)*"/g, m =>
    m.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t')
  );
}

/**
 * Máy trạng thái sửa lỗi: phân biệt chuỗi key và chuỗi value, xử lý chính xác dấu nháy chưa escape.
 * Chuỗi key: xuất hiện sau { hoặc ,, kết thúc bằng ":
 * Chuỗi value: xuất hiện sau :, kết thúc bằng ", hoặc "} hoặc "]
 * Chỉ có bên trong chuỗi value mới có thể xuất hiện dấu nháy lạ cần escape
 */
function repairUnescapedQuotes(str) {
  const chars = [...str];
  const out = [];
  let inString = false;
  let isKeyString = false;
  // Duy trì ngăn xếp ngoặc: đỉnh '[' là đang trong mảng, đỉnh '{' là trong đối tượng
  // Chuỗi trong mảng luôn là value; trong đối tượng dựa vào ký tự phi khoảng trắng trước đó để đoán key/value
  const bracketStack = [];
  let i = 0;

  function prevNonSpaceFromOut(skipFromEnd) {
    for (let k = out.length - skipFromEnd; k >= 0; k--) {
      const c = out[k];
      if (c !== ' ' && c !== '\t' && c !== '\n' && c !== '\r') return c;
    }
    return '';
  }

  while (i < chars.length) {
    const ch = chars[i];

    if (!inString) {
      out.push(ch);
      if (ch === '{' || ch === '[') {
        bracketStack.push(ch);
      } else if (ch === '}' || ch === ']') {
        bracketStack.pop();
      } else if (ch === '"') {
        inString = true;
        const top = bracketStack[bracketStack.length - 1];
        if (top === '[') {
          isKeyString = false;
        } else {
          const prev2 = prevNonSpaceFromOut(2);
          isKeyString = (prev2 === '{' || prev2 === ',');
        }
      }
      i++;
      continue;
    }

    if (ch === '\\') {
      out.push(ch);
      i++;
      if (i < chars.length) { out.push(chars[i]); i++; }
      continue;
    }

    if (ch === '"') {
      let j = i + 1;
      while (j < chars.length && (chars[j] === ' ' || chars[j] === '\t' || chars[j] === '\n' || chars[j] === '\r')) j++;
      const next = chars[j];

      if (isKeyString) {
        if (next === ':') {
          out.push('"');
          inString = false;
        } else {
          out.push('\\"');
        }
      } else {
        if (next === ',' || next === '}' || next === ']' || next === undefined) {
          out.push('"');
          inString = false;
        } else {
          out.push('\\"');
        }
      }
      i++;
      continue;
    }

    out.push(ch);
    i++;
  }

  return out.join('');
}