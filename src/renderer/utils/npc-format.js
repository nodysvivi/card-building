/**
 * Chuyển đổi qua lại giữa cấu trúc 6 khối NPC ↔ YAML
 * - Khi tạo: JSON 6 khối → Chuỗi YAML tiêm vào content của Worldbook
 * - Khi nạp lại: Content NPC cũ (YAML hoặc văn bản thuần) → JSON 6 khối cho trình soạn thảo
 */

// Ánh xạ key JSON nội bộ → key hiển thị YAML (trường đặc biệt)
const KEY_DISPLAY_MAP = {
  'quan_hệ_với_user': 'Quan hệ với {{user}}',
  '与user关系': '与{{user}}的关系'
};

function displayKey(k) {
  return KEY_DISPLAY_MAP[k] || k;
}

// Ngược lại: key hiển thị YAML → key JSON nội bộ
function internalKey(k) {
  for (const [internal, display] of Object.entries(KEY_DISPLAY_MAP)) {
    if (k === display) return internal;
  }
  return k;
}

// Mẫu NPC trống (Dữ liệu khởi tạo biểu mẫu IDE / Dùng khi tạo NPC trống mới)
export function emptyNpc() {
  return {
    name: '',
    keys: [],
    basic: { 'Họ tên': '', 'Tuổi': '', 'Giới tính': '', 'Thân phận': '' },
    appearance: { 'Tổng quan ấn tượng': '', 'Đặc trưng then chốt': '', 'Phong cách ăn mặc': '' },
    personality: { 'Đặc chất cốt lõi': '', 'Mô thức hành vi': '' },
    relationship: { 'quan_hệ_với_user': '', 'Thái độ': '', 'Phương thức tương tác': '' },
    language: { 'Phong cách nói chuyện': '', 'Câu cửa miệng': '' },
    sample_dialogues: []
  };
}

// JSON 6 khối → Chuỗi YAML (Dùng tiêm vào content của Worldbook)
export function npcToYaml(npc) {
  if (!npc) return '';
  const lines = [];
  const blocks = [
    ['basic', 'Thông tin cơ bản'],
    ['appearance', 'Đặc trưng ngoại hình'],
    ['personality', 'Tính cách cốt lõi'],
    ['relationship', 'Định vị quan hệ'],
    ['language', 'Đặc trưng ngôn ngữ']
  ];

  lines.push(`NPC: ${npc.name || '(Chưa đặt tên)'}`);

  for (const [field, label] of blocks) {
    const data = npc[field];
    if (!data || typeof data !== 'object') continue;
    const entries = Object.entries(data).filter(([_, v]) => v && String(v).trim());
    if (entries.length === 0) continue;
    lines.push(`  ${label}:`);
    for (const [k, v] of entries) {
      lines.push(`    ${displayKey(k)}: ${escapeYamlValue(String(v))}`);
    }
  }

  if (Array.isArray(npc.sample_dialogues) && npc.sample_dialogues.length > 0) {
    const filtered = npc.sample_dialogues.filter(d => d && String(d).trim());
    if (filtered.length > 0) {
      lines.push('  Ngữ liệu tham khảo:');
      for (const d of filtered) {
        lines.push(`    - "${String(d).replace(/"/g, '\\"')}"`);
      }
    }
  }

  return lines.join('\n');
}

// Escape giá trị YAML trên một dòng: chứa ký tự đặc biệt thì bọc dấu nháy kép
function escapeYamlValue(v) {
  if (/[:#\n"]/.test(v)) {
    return `"${v.replace(/"/g, '\\"')}"`;
  }
  return v;
}

// YAML/Văn bản thuần → JSON 6 khối (Dùng khi nạp lại vào trình soạn thảo, phân tích dạng best-effort)
export function yamlToNpc(text) {
  const npc = emptyNpc();
  if (!text || typeof text !== 'string') return npc;

  const sections = {
    'Thông tin cơ bản': 'basic',
    'Đặc trưng ngoại hình': 'appearance',
    'Tính cách cốt lõi': 'personality',
    'Định vị quan hệ': 'relationship',
    'Đặc trưng ngôn ngữ': 'language',
    'Ngữ liệu tham khảo': 'sample_dialogues',
    '基础信息': 'basic',
    '外貌特征': 'appearance',
    '性格核心': 'personality',
    '关系定位': 'relationship',
    '语言特征': 'language',
    '参考语料': 'sample_dialogues'
  };

  // Trích xuất name từ NPC: xxx ở đầu
  const nameMatch = text.match(/^NPC:\s*(.+)$/m);
  if (nameMatch) npc.name = nameMatch[1].trim().replace(/^["']|["']$/g, '');

  let currentSection = null;
  const lines = text.split('\n');

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/, '');
    if (!line.trim()) continue;

    // Phát hiện tiêu đề section (Thụt lề tối đa 4 khoảng trắng + Tên trường + Dấu hai chấm)
    const sectionMatch = line.match(/^\s{0,4}([^:]+):\s*$/);
    if (sectionMatch && sections[sectionMatch[1].trim()]) {
      currentSection = sections[sectionMatch[1].trim()];
      continue;
    }

    if (!currentSection) continue;

    if (currentSection === 'sample_dialogues') {
      const dialMatch = line.match(/^\s*-\s*["']?(.+?)["']?\s*$/);
      if (dialMatch) {
        npc.sample_dialogues.push(dialMatch[1].replace(/\\"/g, '"'));
      }
      continue;
    }

    // key: value
    const kvMatch = line.match(/^\s+([^:]+?):\s*(.+)$/);
    if (kvMatch) {
      const k = internalKey(kvMatch[1].trim());
      let v = kvMatch[2].trim();
      v = v.replace(/^["']|["']$/g, '').replace(/\\"/g, '"');
      if (npc[currentSection] && typeof npc[currentSection] === 'object') {
        npc[currentSection][k] = v;
      }
    }
  }

  return npc;
}

// Kiểm tra JSON NPC có khớp cấu trúc 6 khối không (Dùng kiểm tra sau khi AI xuất)
export function isValidNpc(npc) {
  if (!npc || typeof npc !== 'object') return false;
  if (!npc.name) return false;
  const required = ['basic', 'appearance', 'personality', 'relationship', 'language'];
  for (const f of required) {
    if (!npc[f] || typeof npc[f] !== 'object') return false;
  }
  if (!Array.isArray(npc.sample_dialogues)) return false;
  return true;
}

// Sửa chữa JSON NPC bị thiếu trường: thiếu trường nào bù trường rỗng đó
export function normalizeNpc(npc) {
  const empty = emptyNpc();
  const out = { ...empty, ...(npc || {}) };
  for (const k of ['basic', 'appearance', 'personality', 'relationship', 'language']) {
    out[k] = { ...empty[k], ...(npc?.[k] || {}) };
  }
  out.keys = Array.isArray(npc?.keys) ? npc.keys : (npc?.name ? [npc.name] : []);
  out.sample_dialogues = Array.isArray(npc?.sample_dialogues) ? npc.sample_dialogues : [];
  return out;
}