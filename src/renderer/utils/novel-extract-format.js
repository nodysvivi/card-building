/**
 * Trích xuất tiểu thuyết sang Worldbook —— Cấu trúc dữ liệu kết quả trích xuất + Chuyển đổi mục Worldbook + Phân đoạn chương
 */

import { CHAPTER_REGEXES } from './novel-extract-rules.js';

// ====================================================================
// Mẫu dữ liệu mặc định
// ====================================================================

export function emptyExtraction() {
  return {
    characters: [],
    eventlines: [],
    timeline: [],
    settings: [],
    item_trajectories: []
  };
}

export function emptyExtractConfig() {
  return {
    novelName: '',
    chapterName: '',
    protagonistName: '',
    userMode: 'replace',           // 'replace' | 'npc'
    enableR2DoubleCheck: false,
    enableContinuationSummary: false,
    chunkStrategy: 'auto',         // 'auto' | 'chapter' | 'words'
    chaptersPerChunk: 5,
    wordsPerChunk: 10000,
    chapterRangeStart: 1,           // Điểm bắt đầu "Chỉ chạy N chương đầu" (mặc định từ 1)
    chapterRangeEnd: 0,             // 0 = không giới hạn
    selectedTypes: ['character', 'eventline', 'timeline', 'setting', 'item_trajectory']
  };
}

// ====================================================================
// Phân đoạn chương
// ====================================================================

const COMBINED_CHAPTER_REGEX = /(?=^[\s]*(?:第[一二三四五六七八九十百千零\d]+[章话节卷話章節]|(Chương|Hồi|Tiết|Quyển|Tập|Phần)\s*(\d+|[IVXLCDM]+|[一二三四五六七八九十百千]+)|Chapter\s+\d+|Episode\s+\d+|Part\s+\d+|Scene\s+\d+|序章|プロローグ|Prologue|Epilogue|尾声|Mở đầu|Kết thúc))/m;

/**
 * Phân đoạn tiểu thuyết thông minh
 * @param {string} text Nguyên tác tiểu thuyết
 * @param {object} opts { strategy, chaptersPerChunk, wordsPerChunk }
 * @returns {{ strategy, chunks, totalChapters, fallback }}
 */
export function chunkNovel(text, opts = {}) {
  const strategy = opts.strategy || 'auto';
  const chaptersPerChunk = opts.chaptersPerChunk || 5;
  const wordsPerChunk = opts.wordsPerChunk || 10000;

  if (!text || !text.trim()) {
    return { strategy: 'words', chunks: [], totalChapters: 0, fallback: false };
  }

  if (strategy === 'auto' || strategy === 'chapter') {
    const chapters = splitByChapters(text);
    if (chapters.length >= 3 || strategy === 'chapter') {
      const chunks = groupChapters(chapters, chaptersPerChunk);
      return {
        strategy: 'chapter',
        chunks,
        totalChapters: chapters.length,
        fallback: false
      };
    }
  }

  // strategy === 'words' hoặc auto fallback
  const chunks = splitByWords(text, wordsPerChunk);
  return {
    strategy: 'words',
    chunks,
    totalChapters: 0,
    fallback: strategy === 'auto'
  };
}

function splitByChapters(text) {
  const parts = text.split(new RegExp(COMBINED_CHAPTER_REGEX.source, 'gm'))
    .filter(p => p && p.trim().length > 50);
  return parts;
}

function groupChapters(chapters, chaptersPerChunk) {
  const chunks = [];
  for (let i = 0; i < chapters.length; i += chaptersPerChunk) {
    const slice = chapters.slice(i, i + chaptersPerChunk);
    chunks.push(slice.join('\n\n'));
  }
  return chunks.length > 0 ? chunks : [chapters.join('\n\n')];
}

function splitByWords(text, wordsPerChunk) {
  const chunks = [];
  const totalLen = text.length;
  for (let i = 0; i < totalLen; i += wordsPerChunk) {
    let end = Math.min(i + wordsPerChunk, totalLen);
    if (end < totalLen) {
      const breakMatch = text.slice(end - 200, end).match(/.*[。！？.!?\n]/);
      if (breakMatch) end = (end - 200) + breakMatch.index + breakMatch[0].length;
    }
    chunks.push(text.slice(i, end));
    if (end >= totalLen) break;
  }
  return chunks.length > 0 ? chunks : [text];
}

// ====================================================================
// Kết quả trích xuất → Mục Worldbook (tự động chia thường trực / kích hoạt)
// ====================================================================

/**
 * Chuyển đổi toàn bộ kết quả trích xuất thành mảng mục Worldbook (chờ tiêm vào cardStore)
 */
export function extractionToWorldEntries(extraction, config) {
  const entries = [];
  const characters = extraction.characters || [];
  const isMultiChar = characters.filter(c => c.role === 'major').length > 1;
  const chapterName = config.chapterName || '';
  const prefix = chapterName ? `[${chapterName}] ` : '';

  // === Nhân vật quan trọng ===
  for (const char of characters.filter(c => c.role === 'major')) {
    entries.push(buildEntry({
      comment: `${prefix}Nhân vật·${char.name}`,
      keys: [char.name],
      content: characterToYaml(char),
      constant: !isMultiChar,        // Thẻ đơn nhân vật là thường trực, đa nhân vật là kích hoạt
      selective: isMultiChar,
      position: !isMultiChar ? 'before_char' : 'after_char'
    }));
  }

  // === Nhân vật thứ yếu (mỗi người một mục) ===
  for (const char of characters.filter(c => c.role === 'minor')) {
    entries.push(buildEntry({
      comment: `${prefix}Nhân vật thứ yếu·${char.name}`,
      keys: [char.name],
      content: characterToYaml(char),
      constant: false,
      selective: true,
      position: 'after_char'
    }));
  }

  // === Tuyến sự kiện (mỗi tuyến một mục độc lập) ===
  for (const event of extraction.eventlines || []) {
    const isMain = event.type === 'Tuyến chính' || event.type === '主线';
    entries.push(buildEntry({
      comment: `${prefix}Tuyến sự kiện·${event.type}·${event.name}`,
      keys: buildEventlineKeys(event),
      content: eventlineToYaml(event),
      constant: isMain,
      selective: !isMain,
      position: isMain ? 'before_char' : 'after_char'
    }));
  }

  // === Dòng thời gian (mỗi giai đoạn một mục thường trực) ===
  for (const stage of extraction.timeline || []) {
    entries.push(buildEntry({
      comment: `${prefix}Dòng thời gian·${stage.stage_name}`,
      keys: [],
      content: timelineStageToYaml(stage),
      constant: true,
      selective: false,
      position: 'before_char'
    }));
  }

  // === Thiết lập (mỗi thiết lập một mục kích hoạt độc lập) ===
  for (const setting of extraction.settings || []) {
    entries.push(buildEntry({
      comment: `${prefix}Thiết lập·${setting.subtype}·${setting.name}`,
      keys: [setting.name],
      content: settingToYaml(setting),
      constant: false,
      selective: true,
      position: 'after_char'
    }));
  }

  // === Quỹ đạo vật phẩm (mỗi vật phẩm một mục kích hoạt) ===
  for (const item of extraction.item_trajectories || []) {
    entries.push(buildEntry({
      comment: `${prefix}Vật phẩm·${item.item_name}`,
      keys: [item.item_name],
      content: itemTrajectoryToYaml(item),
      constant: false,
      selective: true,
      position: 'after_char'
    }));
  }

  return entries;
}

function buildEntry({ comment, keys, content, constant, selective, position }) {
  return {
    comment,
    keys: keys.filter(Boolean),
    secondary_keys: [],
    content,
    constant,
    selective,
    enabled: true,
    position,
    insertion_order: 100,             // Quy tắc CardBuilding: order thống nhất 100
    extensions: {
      position: position === 'before_char' ? 0 : 1,
      depth: 4,
      // Quy tắc: thường trực chỉ bật exclude_recursion; kích hoạt bật cả hai
      exclude_recursion: true,
      prevent_recursion: !constant,
      probability: 100,
      useProbability: true,
      selectiveLogic: 0,
      group: '',
      group_weight: 100
    }
  };
}

function buildEventlineKeys(event) {
  const keys = [event.name];
  for (const p of event.passages || []) {
    if (Array.isArray(p.key_characters)) {
      keys.push(...p.key_characters.slice(0, 3));
    }
  }
  return [...new Set(keys.filter(Boolean))];
}

// ====================================================================
// Tuần tự hóa các loại → YAML
// ====================================================================

function characterToYaml(char) {
  const lines = [];
  lines.push(`Nhân vật: ${char.name || '(Chưa đặt tên)'}`);
  if (char.role) lines.push(`Loại: ${char.role === 'major' ? 'Nhân vật quan trọng' : 'Nhân vật thứ yếu'}`);
  if (char.first_chapter) lines.push(`Xuất hiện lần đầu: ${char.first_chapter}`);
  if (char.last_chapter) lines.push(`Xuất hiện lần cuối: ${char.last_chapter}`);

  if (char.basic && typeof char.basic === 'object') {
    lines.push('Thông tin cơ bản:');
    for (const [k, v] of Object.entries(char.basic)) {
      if (v) lines.push(`  ${k}: ${esc(v)}`);
    }
  }

  if (char.appearance) {
    lines.push(`Đặc trưng ngoại hình: ${esc(char.appearance)}`);
  }

  const tracks = char.tracks || {};

  const tracksRealm = tracks.境界 || tracks['Cảnh giới'];
  if (Array.isArray(tracksRealm) && tracksRealm.length) {
    lines.push('Quỹ đạo cảnh giới:');
    for (const t of tracksRealm) {
      lines.push(`  - [${t.chapter || 'Chưa rõ chương'}] ${esc(t.state || '')}${t.evidence ? ' (' + esc(t.evidence) + ')' : ''}`);
    }
  }

  const tracksLoc = tracks.位置 || tracks['Vị trí'];
  if (Array.isArray(tracksLoc) && tracksLoc.length) {
    lines.push('Quỹ đạo vị trí:');
    for (const t of tracksLoc) {
      lines.push(`  - [${t.chapter || 'Chưa rõ chương'}] ${esc(t.location || '')}`);
    }
  }

  const tracksItem = tracks.物品 || tracks['Vật phẩm'];
  if (Array.isArray(tracksItem) && tracksItem.length) {
    lines.push('Quỹ đạo vật phẩm:');
    for (const t of tracksItem) {
      lines.push(`  - [${t.chapter || 'Chưa rõ chương'}] ${esc(t.action || '')} ${esc(t.item || '')}${t.source ? ' (Nguồn: ' + esc(t.source) + ')' : ''}${t.destination ? ' (Nơi đến: ' + esc(t.destination) + ')' : ''}`);
    }
  }

  const tracksRel = tracks.关系 || tracks['Quan hệ'];
  if (Array.isArray(tracksRel) && tracksRel.length) {
    lines.push('Quan hệ:');
    for (const r of tracksRel) {
      lines.push(`  Với ${esc(r.target || '(Chưa xác định)')}:`);
      if (Array.isArray(r.behaviors) && r.behaviors.length) {
        for (const b of r.behaviors) {
          lines.push(`    - [${b.chapter || 'Chưa rõ chương'}] ${esc(b.behavior || '')}${b.context ? ' ' + esc(b.context) : ''}`);
        }
      }
      if (r.summary) lines.push(`    Đặc trưng tương tác: ${esc(r.summary)}`);
      if (r.boundary) lines.push(`    Ranh giới nguyên tác: ${esc(r.boundary)}`);
    }
  }

  const tracksBehavior = tracks.行为模式 || tracks['Mô thức hành vi'];
  if (Array.isArray(tracksBehavior) && tracksBehavior.length) {
    lines.push('Mô thức hành vi:');
    for (const stage of tracksBehavior) {
      lines.push(`  ${esc(stage.stage || 'Giai đoạn')} (${esc(stage.range || 'Chưa rõ')}):`);
      if (Array.isArray(stage.dialogues) && stage.dialogues.length) {
        lines.push('    Câu thoại:');
        for (const d of stage.dialogues) {
          lines.push(`      - ${esc(d)}`);
        }
      }
      if (stage.decisions) lines.push(`    Thiên hướng quyết định: ${esc(stage.decisions)}`);
    }
  }

  return lines.join('\n');
}

function eventlineToYaml(event) {
  const lines = [];
  lines.push(`Tuyến sự kiện: ${event.name || '(Chưa đặt tên)'}`);
  lines.push(`Loại: ${event.type || 'Tuyến phụ'}`);

  if (event.cause) {
    lines.push('Nguyên nhân:');
    lines.push(`  Chương: ${event.cause.chapter || 'Chưa rõ chương'}`);
    if (event.cause.summary) lines.push(`  Tóm tắt: ${esc(event.cause.summary)}`);
    if (event.cause.dialogue) lines.push(`  Câu thoại tiêu biểu: ${esc(event.cause.dialogue)}`);
  }

  if (Array.isArray(event.passages) && event.passages.length) {
    lines.push('Diễn biến:');
    for (let i = 0; i < event.passages.length; i++) {
      const p = event.passages[i];
      lines.push(`  ${i + 1}. [${p.chapter || 'Chưa rõ chương'}] ${esc(p.node || '')}`);
      if (p.location) lines.push(`     Địa điểm: ${esc(p.location)}`);
      if (Array.isArray(p.key_characters) && p.key_characters.length) {
        lines.push(`     Nhân vật then chốt: ${p.key_characters.map(esc).join('、')}`);
      }
      if (p.dialogue) lines.push(`     Câu thoại tiêu biểu: ${esc(p.dialogue)}`);
    }
  }

  if (event.result) {
    lines.push('Kết quả:');
    lines.push(`  Chương: ${event.result.chapter || 'Chưa rõ chương'}`);
    if (event.result.summary) lines.push(`  Tóm tắt: ${esc(event.result.summary)}`);
    if (event.result.dialogue) lines.push(`  Câu thoại tiêu biểu: ${esc(event.result.dialogue)}`);
  }

  if (event.follow_up) {
    lines.push(`Ảnh hưởng tiếp theo: ${esc(event.follow_up)}`);
  }

  return lines.join('\n');
}

function timelineStageToYaml(stage) {
  const lines = [];
  lines.push(`Giai đoạn dòng thời gian: ${stage.stage_name || '(Chưa đặt tên)'}`);
  if (stage.chapter_range) lines.push(`Phạm vi chương: ${stage.chapter_range}`);

  if (Array.isArray(stage.time_markers) && stage.time_markers.length) {
    lines.push('Mốc thời gian:');
    for (const t of stage.time_markers) {
      lines.push(`  - [${t.chapter || 'Chưa rõ chương'}] ${esc(t.raw || '')}${t.annotation ? ' (' + esc(t.annotation) + ')' : ''}`);
    }
  }

  if (stage.summary) lines.push(`Tóm tắt: ${esc(stage.summary)}`);
  if (stage.protagonist_status) lines.push(`Trạng thái nhân vật chính: ${esc(stage.protagonist_status)}`);

  return lines.join('\n');
}

function settingToYaml(setting) {
  const lines = [];
  lines.push(`${setting.subtype || 'Thiết lập'}: ${setting.name || '(Chưa đặt tên)'}`);
  if (setting.level) lines.push(`Cấp độ: ${esc(setting.level)}`);
  if (setting.grade) lines.push(`Phẩm cấp: ${esc(setting.grade)}`);
  if (setting.user) lines.push(`Người dùng: ${esc(setting.user)}`);
  if (setting.refiner) lines.push(`Người luyện chế: ${esc(setting.refiner)}`);
  if (setting.first_chapter) lines.push(`Xuất hiện lần đầu: ${setting.first_chapter}`);
  if (setting.effect) lines.push(`Hiệu quả: ${esc(setting.effect)}`);
  if (setting.description) lines.push(`Miêu tả: ${esc(setting.description)}`);
  return lines.join('\n');
}

function itemTrajectoryToYaml(item) {
  const lines = [];
  lines.push(`Vật phẩm: ${item.item_name || '(Chưa đặt tên)'}`);
  if (item.owner) lines.push(`Người sở hữu: ${esc(item.owner)}`);
  if (Array.isArray(item.events) && item.events.length) {
    lines.push('Nhật ký lưu chuyển:');
    for (const e of item.events) {
      const action = e.action || 'Nhận được';
      const detail = e.source ? `Nguồn: ${esc(e.source)}` : (e.destination ? `Nơi đến: ${esc(e.destination)}` : '');
      lines.push(`  - [${e.chapter || 'Chưa rõ chương'}] ${action}${detail ? ' (' + detail + ')' : ''}${e.evidence ? ' / Bằng chứng: ' + esc(e.evidence) : ''}`);
    }
  }
  return lines.join('\n');
}

function esc(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[:#\n"]/.test(s)) {
    return `"${s.replace(/"/g, '\\"')}"`;
  }
  return s;
}

// ====================================================================
// Kiểm tra + Giá trị mặc định
// ====================================================================

/**
 * Chuẩn hóa mảng kết quả trích xuất từ AI
 */
export function normalizeExtractionArray(arr, type) {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter(item => isValidExtractionItem(item, type))
    .map(item => normalizeExtractionItem(item, type));
}

function isValidExtractionItem(item, type) {
  if (!item || typeof item !== 'object') return false;
  if (type === 'character') return !!item.name;
  if (type === 'eventline') return !!item.name;
  if (type === 'timeline') return !!item.stage_name;
  if (type === 'setting') return !!item.name && !!item.subtype;
  if (type === 'item_trajectory') return !!item.item_name;
  return false;
}

function normalizeExtractionItem(item, type) {
  if (type === 'character') {
    return {
      name: item.name,
      role: item.role === 'major' ? 'major' : 'minor',
      first_chapter: item.first_chapter || '',
      last_chapter: item.last_chapter || '',
      basic: item.basic || {},
      appearance: item.appearance || '',
      tracks: {
        境界: Array.isArray(item.tracks?.境界 || item.tracks?.['Cảnh giới']) ? (item.tracks.境界 || item.tracks['Cảnh giới']) : [],
        位置: Array.isArray(item.tracks?.位置 || item.tracks?.['Vị trí']) ? (item.tracks.位置 || item.tracks['Vị trí']) : [],
        物品: Array.isArray(item.tracks?.物品 || item.tracks?.['Vật phẩm']) ? (item.tracks.物品 || item.tracks['Vật phẩm']) : [],
        关系: Array.isArray(item.tracks?.关系 || item.tracks?.['Quan hệ']) ? (item.tracks.关系 || item.tracks['Quan hệ']) : [],
        行为模式: Array.isArray(item.tracks?.行为模式 || item.tracks?.['Mô thức hành vi']) ? (item.tracks.行为模式 || item.tracks['Mô thức hành vi']) : []
      }
    };
  }
  if (type === 'eventline') {
    const validTypes = ['Tuyến chính', 'Tuyến phụ', 'Tuyến ngầm', 'Phục bút', '主线', '支线', '暗线', '伏笔'];
    return {
      name: item.name,
      type: validTypes.includes(item.type) ? item.type : 'Tuyến phụ',
      cause: item.cause || null,
      passages: Array.isArray(item.passages) ? item.passages : [],
      result: item.result || null,
      follow_up: item.follow_up || ''
    };
  }
  if (type === 'timeline') {
    return {
      stage_name: item.stage_name,
      chapter_range: item.chapter_range || '',
      time_markers: Array.isArray(item.time_markers) ? item.time_markers : [],
      summary: item.summary || '',
      protagonist_status: item.protagonist_status || ''
    };
  }
  if (type === 'setting') {
    const validSubtypes = ['Công pháp', 'Đan dược', 'Địa lý', 'Thế lực', 'Thường thức thế giới', '功法', '丹药', '地理', '势力', '世界观常识'];
    return {
      ...item,
      subtype: validSubtypes.includes(item.subtype) ? item.subtype : 'Thường thức thế giới',
      name: item.name,
      first_chapter: item.first_chapter || ''
    };
  }
  if (type === 'item_trajectory') {
    return {
      item_name: item.item_name,
      owner: item.owner || '',
      events: Array.isArray(item.events) ? item.events.map(e => ({
        chapter: e.chapter || 'Chưa rõ chương',
        action: ['Nhận được', 'Tiêu hao', 'Chuyển tặng', '获得', '消耗', '转赠'].includes(e.action) ? e.action : 'Nhận được',
        source: e.source || '',
        destination: e.destination || '',
        evidence: e.evidence || ''
      })) : []
    };
  }
  return item;
}

// ====================================================================
// Hàm tiện ích
// ====================================================================

/**
 * Ước tính tổng số lượt gọi (5 bước phân loại × số đoạn cắt)
 */
export function estimateTotalCalls(chunkCount, selectedTypes, enableR2 = false) {
  const baseCalls = chunkCount * (selectedTypes?.length || 5);
  return enableR2 ? baseCalls * 2 + chunkCount : baseCalls;
}

/**
 * Ước tính tổng thời gian tiêu tốn (tính theo RPM)
 */
export function estimateTotalTime(totalCalls, intervalMs = 13000) {
  return Math.ceil(totalCalls * intervalMs / 1000);
}

/**
 * Số ký tự → Ước tính token (tiếng Việt 1 từ ≈ 1.3 token)
 */
export function estimateTokens(text) {
  return Math.round((text || '').length * 1.3);
}