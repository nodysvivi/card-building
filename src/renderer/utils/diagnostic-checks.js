/**
 * Chẩn đoán thẻ nhân vật —— 7 kiểm tra chuyên biệt thuần frontend (Không gọi AI, ra kết quả tức thì)
 *
 * Mỗi hàm check trả về cấu trúc chuẩn hóa:
 * {
 *   key: 'check_id',
 *   name: 'Tên kiểm tra chuyên biệt',
 *   passed: boolean,        // Có vượt qua hoàn toàn hay không (không có vấn đề)
 *   summary: 'Tóm tắt một câu',   // Hiển thị trên dashboard
 *   stats: {...},           // Tùy chọn, số liệu thống kê bổ sung
 *   issues: [               // Danh sách vấn đề
 *     {
 *       severity: 'error' | 'warning' | 'info',
 *       title: 'Tiêu đề vấn đề',
 *       description: 'Mô tả chi tiết vấn đề',
 *       location: 'Vị trí phát sinh (VD: Mục #3 / description)',
 *       fixable: boolean,   // Có thể sửa nhanh 1 chạm hay không
 *       fixId: 'fix_id',    // Khóa hàm sửa tương ứng trong diagnostic-fix.js
 *       fixPayload: {...}   // Tham số cần cho việc sửa lỗi
 *     }
 *   ]
 * }
 */

import { scanBagua } from './npc-checker.js';

// ====================================================================
// 1. Kiểm tra thông tin cơ bản
// ====================================================================

export function checkBasicInfo(cardStore) {
  const d = cardStore.cardData;
  const issues = [];

  const requiredFields = [
    { key: 'name', label: 'Tên nhân vật', minLen: 1 },
    { key: 'description', label: 'Mô tả nhân vật (description)', minLen: 50 },
    { key: 'personality', label: 'Tính cách (personality)', minLen: 10 },
    { key: 'first_mes', label: 'Lời mở đầu (first_mes)', minLen: 30 }
  ];

  for (const f of requiredFields) {
    const val = (d[f.key] || '').trim();
    if (!val) {
      issues.push({
        severity: 'error',
        title: `${f.label} đang để trống`,
        description: `Trường bắt buộc ${f.key} chưa được điền`,
        location: f.key,
        fixable: false
      });
    } else if (val.length < f.minLen) {
      issues.push({
        severity: 'warning',
        title: `${f.label} quá ít từ (${val.length}/${f.minLen})`,
        description: `Hiện có ${val.length} từ, khuyến nghị tối thiểu ${f.minLen} từ để AI hiểu rõ nhân vật`,
        location: f.key,
        fixable: false
      });
    }
  }

  // Nhắc nhở trường tùy chọn
  const optionalFields = [
    { key: 'scenario', label: 'Bối cảnh (scenario)' },
    { key: 'mes_example', label: 'Mẫu đối thoại (mes_example)' }
  ];
  for (const f of optionalFields) {
    if (!(d[f.key] || '').trim()) {
      issues.push({
        severity: 'info',
        title: `${f.label} đang để trống`,
        description: 'Trường tùy chọn, nhưng giúp tăng tính nhất quán của nhân vật',
        location: f.key,
        fixable: false
      });
    }
  }

  // Ước tính Token
  const totalChars = ['description', 'personality', 'scenario', 'first_mes', 'mes_example', 'system_prompt']
    .reduce((sum, k) => sum + (d[k] || '').length, 0);
  const tokenEst = Math.round(totalChars * 1.3);

  if (tokenEst > 4000) {
    issues.push({
      severity: 'warning',
      title: `Tổng token các trường cơ bản hơi nhiều (~${tokenEst})`,
      description: 'Tổng các trường cơ bản (description+personality+scenario+first_mes+mes_example+system_prompt) ước tính vượt quá 4000 token, có thể chiếm dụng không gian Worldbook',
      location: 'Thông tin cơ bản',
      fixable: false
    });
  }

  return {
    key: 'basic_info',
    name: 'Kiểm tra thông tin cơ bản',
    passed: issues.filter(i => i.severity === 'error').length === 0,
    summary: issues.length === 0 ? 'Trường cơ bản đầy đủ' : `${issues.length} vấn đề (${tokenEst} token)`,
    stats: { totalChars, tokenEst, alternateGreetings: (d.alternate_greetings || []).length },
    issues
  };
}

// ====================================================================
// 2. Chẩn đoán cấu trúc Worldbook
// ====================================================================

export function checkWorldbookStructure(cardStore) {
  const entries = cardStore.worldEntries || [];
  const issues = [];

  if (entries.length === 0) {
    return {
      key: 'worldbook_structure',
      name: 'Chẩn đoán cấu trúc Worldbook',
      passed: true,
      summary: 'Worldbook đang trống (nếu không cần có thể bỏ qua)',
      stats: { total: 0 },
      issues
    };
  }

  const enabled = entries.filter(e => e.enabled);
  const constant = enabled.filter(e => e.constant);
  const triggered = enabled.filter(e => !e.constant);
  const disabled = entries.filter(e => !e.enabled);

  // order không phải 100
  for (const e of entries) {
    if (e.insertion_order !== 100) {
      issues.push({
        severity: 'warning',
        title: `Mục "${e.comment || '(Chưa đặt tên)'}" có order=${e.insertion_order}, khuyến nghị đặt 100`,
        description: 'Quy tắc mặc định CardBuilding: tất cả order thống nhất là 100',
        location: `Mục #${e.id}`,
        fixable: true,
        fixId: 'fix_order_100',
        fixPayload: { entryId: e.id }
      });
    }
  }

  // Mục cô lập (đèn xanh nhưng không có keys)
  for (const e of entries) {
    if (!e.constant && e.enabled && (!e.keys || e.keys.length === 0)) {
      issues.push({
        severity: 'error',
        title: `Mục "${e.comment || '(Chưa đặt tên)'}" là đèn xanh nhưng không có từ khóa`,
        description: 'Mục đèn xanh (kích hoạt bằng từ khóa) bắt buộc phải có từ khóa, nếu không sẽ không bao giờ được kích hoạt',
        location: `Mục #${e.id}`,
        fixable: true,
        fixId: 'fix_make_constant',
        fixPayload: { entryId: e.id }
      });
    }
  }

  // Kiểm tra trường trống
  for (const e of entries) {
    if (!(e.content || '').trim()) {
      issues.push({
        severity: 'error',
        title: `Mục "${e.comment || '(Chưa đặt tên)'}" có nội dung (content) trống`,
        description: 'Mục có content trống kể cả khi được kích hoạt cũng không tiêm bất kỳ nội dung nào',
        location: `Mục #${e.id}`,
        fixable: true,
        fixId: 'fix_delete_entry',
        fixPayload: { entryId: e.id }
      });
    }
    if (!(e.comment || '').trim()) {
      issues.push({
        severity: 'warning',
        title: `Mục #${e.id} chưa đặt tên (comment trống)`,
        description: 'Khuyến nghị đặt tên cho mục để dễ quản lý',
        location: `Mục #${e.id}`,
        fixable: false
      });
    }
  }

  // Mảng keys chứa chuỗi rỗng
  for (const e of entries) {
    if (Array.isArray(e.keys) && e.keys.some(k => !k || !String(k).trim())) {
      issues.push({
        severity: 'warning',
        title: `Mục "${e.comment || '(Chưa đặt tên)'}" keys chứa chuỗi rỗng`,
        description: 'Mảng keys có phần tử khoảng trắng, nên lọc bỏ đi',
        location: `Mục #${e.id}`,
        fixable: true,
        fixId: 'fix_filter_empty_keys',
        fixPayload: { entryId: e.id }
      });
    }
  }

  return {
    key: 'worldbook_structure',
    name: 'Chẩn đoán cấu trúc Worldbook',
    passed: issues.filter(i => i.severity === 'error').length === 0,
    summary: `${entries.length} mục (Thường trực ${constant.length}/Kích hoạt ${triggered.length}/Đã tắt ${disabled.length})${issues.length > 0 ? ', ' + issues.length + ' vấn đề' : ''}`,
    stats: { total: entries.length, enabled: enabled.length, constant: constant.length, triggered: triggered.length, disabled: disabled.length },
    issues
  };
}

// ====================================================================
// 3. Phân tích xung đột từ khóa
// ====================================================================

export function checkKeywordConflicts(cardStore) {
  const entries = (cardStore.worldEntries || []).filter(e => e.enabled && !e.constant);
  const issues = [];

  const keyMap = {};
  for (const e of entries) {
    for (const k of (e.keys || [])) {
      const trimmed = String(k).trim();
      if (!trimmed) continue;
      if (!keyMap[trimmed]) keyMap[trimmed] = [];
      keyMap[trimmed].push({ entryId: e.id, comment: e.comment || '(Chưa đặt tên)' });
    }
  }

  // Cùng một từ khóa kích hoạt nhiều mục
  for (const [k, list] of Object.entries(keyMap)) {
    if (list.length > 1) {
      issues.push({
        severity: 'warning',
        title: `Từ khóa "${k}" sẽ kích hoạt đồng thời ${list.length} mục`,
        description: 'Có thể dẫn đến lãng phí token — chỉ cần xuất hiện từ khóa một lần là toàn bộ mục cùng key sẽ bị tiêm vào. Khuyến nghị đổi key thành từ chính xác hơn',
        location: list.map(l => `#${l.entryId} ${l.comment}`).join(' / '),
        fixable: false
      });
    }
  }

  // Kiểm tra từ khóa quá phổ biến
  const tooCommon = ['của', 'là', 'ở', 'có', 'tu luyện', 'cấp độ', 'hệ thống', 'thế giới', 'nhân vật', 'được', 'và', '的', '了', '是', '在', '有', '修炼', '等级', '系统', '世界', '人物'];
  for (const k of Object.keys(keyMap)) {
    if (tooCommon.includes(k.toLowerCase())) {
      issues.push({
        severity: 'error',
        title: `Từ khóa "${k}" quá phổ biến, dễ kích hoạt nhầm`,
        description: 'Từ này có thể xuất hiện trong hầu hết các tin nhắn RP, khiến mục gần như luôn bị kích hoạt, gây lãng phí token',
        location: keyMap[k].map(l => `#${l.entryId} ${l.comment}`).join(' / '),
        fixable: false
      });
    }
  }

  return {
    key: 'keyword_conflicts',
    name: 'Phân tích xung đột từ khóa',
    passed: issues.length === 0,
    summary: `${Object.keys(keyMap).length} từ khóa độc lập${issues.length > 0 ? ', ' + issues.length + ' chỗ xung đột/từ quá phổ biến' : ''}`,
    stats: { totalKeys: Object.keys(keyMap).length, conflicts: issues.length },
    issues
  };
}

// ====================================================================
// 4. Thống kê chiếm dụng Token
// ====================================================================

export function checkTokenUsage(cardStore) {
  const entries = cardStore.worldEntries || [];
  const issues = [];

  const ranked = entries
    .filter(e => e.enabled)
    .map(e => ({
      id: e.id,
      comment: e.comment || '(Chưa đặt tên)',
      constant: e.constant,
      chars: (e.content || '').length,
      tokens: Math.round((e.content || '').length * 1.3)
    }))
    .sort((a, b) => b.tokens - a.tokens);

  const constantTokens = ranked.filter(e => e.constant).reduce((s, e) => s + e.tokens, 0);
  const triggeredTokens = ranked.filter(e => !e.constant).reduce((s, e) => s + e.tokens, 0);

  // Cảnh báo mục thường trực vượt quá 8000 token
  if (constantTokens > 8000) {
    issues.push({
      severity: 'warning',
      title: `Tổng token các mục thường trực hơi nhiều (~${constantTokens})`,
      description: 'Mục thường trực được tiêm cố định vào mỗi lượt hội thoại, quá nhiều sẽ chiếm dụng không gian context. Khuyến nghị chuyển các mục không cần thiết sang dạng kích hoạt bằng từ khóa',
      location: 'Worldbook - Tổng các mục thường trực',
      fixable: false
    });
  }

  const top5 = ranked.slice(0, 5);

  return {
    key: 'token_usage',
    name: 'Thống kê chiếm dụng Token',
    passed: issues.filter(i => i.severity === 'error').length === 0,
    summary: `Thường trực ~${constantTokens} token / Kích hoạt ~${triggeredTokens} token / Tổng ~${constantTokens + triggeredTokens} token`,
    stats: { constantTokens, triggeredTokens, top5 },
    issues
  };
}

// ====================================================================
// 5. Kiểm tra rủi ro đệ quy
// ====================================================================

export function checkRecursionSettings(cardStore) {
  const entries = cardStore.worldEntries || [];
  const issues = [];

  for (const e of entries) {
    if (!e.enabled) continue;
    const ext = e.extensions || {};

    if (e.constant) {
      // Đèn xanh thường trực: bắt buộc bật exclude_recursion, không bật prevent_recursion
      if (!ext.exclude_recursion) {
        issues.push({
          severity: 'warning',
          title: `Mục thường trực "${e.comment || '(Chưa đặt tên)'}" chưa bật "Không đệ quy"`,
          description: 'Quy tắc CardBuilding: Mục thường trực nên bật exclude_recursion',
          location: `Mục #${e.id}`,
          fixable: true,
          fixId: 'fix_recursion_for_constant',
          fixPayload: { entryId: e.id }
        });
      }
    } else {
      // Đèn xanh kích hoạt: cả hai tùy chọn đều phải bật
      if (!ext.exclude_recursion || !ext.prevent_recursion) {
        const missing = [];
        if (!ext.exclude_recursion) missing.push('Không đệ quy');
        if (!ext.prevent_recursion) missing.push('Ngăn chặn đệ quy tiếp');
        issues.push({
          severity: 'warning',
          title: `Mục kích hoạt "${e.comment || '(Chưa đặt tên)'}" chưa bật "${missing.join('+')}"`,
          description: 'Quy tắc CardBuilding: Mục kích hoạt cần bật cả hai tùy chọn đệ quy (chống bùng nổ token)',
          location: `Mục #${e.id}`,
          fixable: true,
          fixId: 'fix_recursion_for_triggered',
          fixPayload: { entryId: e.id }
        });
      }
    }
  }

  return {
    key: 'recursion_settings',
    name: 'Kiểm tra rủi ro đệ quy',
    passed: issues.length === 0,
    summary: issues.length === 0 ? 'Tất cả mục đều có cài đặt đệ quy hợp lệ' : `${issues.length} mục có cài đặt đệ quy chưa hợp lệ`,
    issues
  };
}

// ====================================================================
// 6. Đánh giá chất lượng hành văn (Quét văn mẫu sáo rỗng)
// ====================================================================

export function checkWritingQuality(cardStore) {
  const d = cardStore.cardData;
  const issues = [];

  const fields = [
    { key: 'description', label: 'description' },
    { key: 'personality', label: 'personality' },
    { key: 'scenario', label: 'scenario' },
    { key: 'first_mes', label: 'first_mes' },
    { key: 'mes_example', label: 'mes_example' }
  ];

  let totalBagua = 0;

  for (const f of fields) {
    const text = d[f.key] || '';
    if (!text) continue;
    const baguaIssues = scanBagua(text);
    totalBagua += baguaIssues.length;

    const byType = {};
    for (const i of baguaIssues) {
      if (!byType[i.type]) byType[i.type] = [];
      byType[i.type].push(i.word);
    }

    for (const [type, words] of Object.entries(byType)) {
      const uniqueWords = [...new Set(words)];
      issues.push({
        severity: 'warning',
        title: `${f.label} chứa ${type} (${words.length} chỗ)`,
        description: `Từ trúng khớp: ${uniqueWords.slice(0, 5).join('、')}${uniqueWords.length > 5 ? '...' : ''}`,
        location: f.label,
        fixable: false
      });
    }
  }

  // Quét văn mẫu các mục Worldbook
  for (const e of cardStore.worldEntries || []) {
    if (!e.enabled || !e.content) continue;
    const baguaIssues = scanBagua(e.content);
    if (baguaIssues.length > 0) {
      totalBagua += baguaIssues.length;
      const byType = {};
      for (const i of baguaIssues) {
        if (!byType[i.type]) byType[i.type] = 0;
        byType[i.type]++;
      }
      const summary = Object.entries(byType).map(([t, c]) => `${t}×${c}`).join('、');
      issues.push({
        severity: 'info',
        title: `Mục "${e.comment || '(Chưa đặt tên)'}" chứa văn mẫu sáo rỗng`,
        description: summary,
        location: `Mục #${e.id}`,
        fixable: false
      });
    }
  }

  return {
    key: 'writing_quality',
    name: 'Đánh giá chất lượng hành văn',
    passed: totalBagua === 0,
    summary: totalBagua === 0 ? 'Chưa phát hiện biểu đạt văn mẫu sáo rỗng' : `Tổng cộng ${totalBagua} chỗ văn mẫu sáo rỗng (khuyến nghị dùng AI để viết lại sửa đổi)`,
    stats: { totalBagua },
    issues
  };
}

// ====================================================================
// 7. Kiểm tra script Regex
// ====================================================================

export function checkRegexScripts(cardStore) {
  const scripts = cardStore.regexScripts || [];
  const issues = [];

  for (let i = 0; i < scripts.length; i++) {
    const s = scripts[i];
    if (s.disabled) continue;

    if (!s.findRegex || !s.findRegex.trim()) {
      issues.push({
        severity: 'error',
        title: `Script Regex "${s.scriptName || '(Chưa đặt tên)'}" có findRegex trống`,
        description: 'Không có mẫu khớp, script không thể hoạt động',
        location: `Script #${i}`,
        fixable: false
      });
      continue;
    }

    if (/\.\*\?[^$]/.test(s.findRegex) || /\([^)]*\.\*\)[^$]/.test(s.findRegex)) {
      issues.push({
        severity: 'warning',
        title: `Script Regex "${s.scriptName || '(Chưa đặt tên)'}" chứa lượng từ tham lam, có thể khớp quá rộng`,
        description: '`.*` không có ký tự neo, có thể khớp nhầm đoạn văn bản lớn',
        location: `Script #${i}`,
        fixable: false
      });
    }

    try {
      new RegExp(s.findRegex);
    } catch (e) {
      issues.push({
        severity: 'error',
        title: `Script Regex "${s.scriptName || '(Chưa đặt tên)'}" có lỗi cú pháp`,
        description: e.message,
        location: `Script #${i}`,
        fixable: false
      });
    }

    if (!Array.isArray(s.placement) || s.placement.length === 0) {
      issues.push({
        severity: 'warning',
        title: `Script Regex "${s.scriptName || '(Chưa đặt tên)'}" chưa thiết lập phạm vi áp dụng`,
        description: 'Cần tích chọn áp dụng cho tin nhắn người dùng / AI / lệnh gạch chéo...',
        location: `Script #${i}`,
        fixable: false
      });
    }
  }

  return {
    key: 'regex_scripts',
    name: 'Kiểm tra script Regex',
    passed: issues.filter(i => i.severity === 'error').length === 0,
    summary: scripts.length === 0 ? 'Không có script Regex' : `${scripts.length} script${issues.length > 0 ? ', ' + issues.length + ' vấn đề' : ''}`,
    issues
  };
}

// ====================================================================
// Chạy tất cả kiểm tra
// ====================================================================

export function runAllChecks(cardStore) {
  return [
    checkBasicInfo(cardStore),
    checkWorldbookStructure(cardStore),
    checkKeywordConflicts(cardStore),
    checkTokenUsage(cardStore),
    checkRecursionSettings(cardStore),
    checkWritingQuality(cardStore),
    checkRegexScripts(cardStore)
  ];
}

export const CHECK_METADATA = [
  { key: 'basic_info', name: 'Kiểm tra thông tin cơ bản', desc: 'Độ đầy đủ trường cốt lõi + ước tính token' },
  { key: 'worldbook_structure', name: 'Chẩn đoán cấu trúc Worldbook', desc: 'Tỷ lệ thường trực/kích hoạt + order + mục cô lập' },
  { key: 'keyword_conflicts', name: 'Phân tích xung đột từ khóa', desc: 'Từ khóa trùng lặp + từ khóa quá phổ biến' },
  { key: 'token_usage', name: 'Thống kê chiếm dụng token', desc: 'Tỷ lệ token thường trực vs kích hoạt + Top 5' },
  { key: 'recursion_settings', name: 'Kiểm tra rủi ro đệ quy', desc: 'Kiểm tra tùy chọn đệ quy thường trực/kích hoạt theo quy tắc CardBuilding' },
  { key: 'writing_quality', name: 'Đánh giá chất lượng hành văn', desc: 'Quét văn mẫu sáo rỗng + mỹ nhân khuôn mẫu + nhãn tính cách' },
  { key: 'regex_scripts', name: 'Kiểm tra script Regex', desc: 'Lỗi cú pháp + rủi ro lặp vô tận + phạm vi áp dụng' }
];