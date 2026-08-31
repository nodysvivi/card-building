/**
 * Công cụ nhập JSON Worldbook gốc từ SillyTavern
 *
 * Đầu vào: JSON Worldbook do ST xuất trực tiếp, trường entries ở cấp cao nhất:
 *   {
 *     "entries": {
 *       "0": { uid, key, keysecondary, comment, content, constant, ... },
 *       "1": { ... }
 *     }
 *   }
 *   entries có thể là object (khóa chuỗi "0"/"1"/...) hoặc array.
 *
 * Đầu ra: Mảng đối tượng entry định dạng character_book nội bộ của CardBuilding
 *
 * Quy tắc CardBuilding bắt buộc:
 *   - insertion_order = 100
 *   - exclude_recursion = true
 *   - prevent_recursion = !constant (Thường trực tắt, kích hoạt bật)
 *
 * Tương thích Position:
 *   - ST position 0 → 'before_char' / extensions.position 0
 *   - ST position 1 → 'after_char'  / extensions.position 1
 *   - ST position 2~6 (before_AN / after_AN / at_depth_*) UI CardBuilding không hỗ trợ,
 *     chuyển dự phòng sang 'after_char' và báo cáo số lượng trong giá trị trả về
 */

function buildEntry(stEntry, idx) {
  let pos = 'before_char';
  let posNum = 0;
  let unsupported = false;
  if (stEntry.position === 1) {
    pos = 'after_char';
    posNum = 1;
  } else if (stEntry.position === 0 || stEntry.position == null) {
    // Mặc định before_char
  } else {
    // Kiểu 2~6 chuyển dự phòng
    pos = 'after_char';
    posNum = 1;
    unsupported = true;
  }
  const isConstant = !!stEntry.constant;
  return {
    entry: {
      id: idx,
      keys: Array.isArray(stEntry.key) ? stEntry.key.filter(Boolean) : [],
      secondary_keys: Array.isArray(stEntry.keysecondary) ? stEntry.keysecondary.filter(Boolean) : [],
      comment: String(stEntry.comment || ''),
      content: String(stEntry.content || ''),
      constant: isConstant,
      selective: !!stEntry.selective,
      insertion_order: 100,
      enabled: stEntry.disable !== true,
      position: pos,
      use_regex: false,
      extensions: {
        position: posNum,
        exclude_recursion: true,
        prevent_recursion: !isConstant,
        display_index: idx,
        probability: typeof stEntry.probability === 'number' ? stEntry.probability : 100,
        useProbability: stEntry.useProbability !== false,
        depth: typeof stEntry.depth === 'number' ? stEntry.depth : 4,
        selectiveLogic: typeof stEntry.selectiveLogic === 'number' ? stEntry.selectiveLogic : 0,
        group: stEntry.group || '',
        group_override: false,
        group_weight: typeof stEntry.groupWeight === 'number' ? stEntry.groupWeight : 100,
        delay_until_recursion: false,
        scan_depth: null,
        match_whole_words: null,
        use_group_scoring: false,
        case_sensitive: null,
        automation_id: '',
        role: 0,
        vectorized: !!stEntry.vectorized,
        sticky: null,
        cooldown: null,
        delay: null,
        match_persona_description: false,
        match_character_description: false,
        match_character_personality: false,
        match_character_depth_prompt: false,
        match_scenario: false,
        match_creator_notes: false,
        triggers: [],
        ignore_budget: false,
        cfSortKey: idx + 1
      }
    },
    unsupported
  };
}

export function parseStWorldbookEntries(rawJson) {
  if (!rawJson || typeof rawJson !== 'object') {
    throw new Error('Định dạng JSON không hợp lệ');
  }
  const entriesField = rawJson.entries;
  if (!entriesField || typeof entriesField !== 'object') {
    throw new Error('Cấp cao nhất của JSON thiếu trường entries, không phải JSON Worldbook hợp lệ của SillyTavern');
  }
  const entriesList = Array.isArray(entriesField)
    ? entriesField
    : Object.values(entriesField);
  let unsupportedPosition = 0;
  const parsed = [];
  let idx = 0;
  for (const stEntry of entriesList) {
    if (!stEntry || typeof stEntry !== 'object') continue;
    const { entry, unsupported } = buildEntry(stEntry, idx);
    if (unsupported) unsupportedPosition++;
    parsed.push(entry);
    idx++;
  }
  return { entries: parsed, unsupportedPosition };
}