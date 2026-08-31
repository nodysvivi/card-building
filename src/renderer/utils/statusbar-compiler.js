/**
 * statusbar-compiler.js — Lớp biên dịch thanh trạng thái (Cốt lõi Phase 1)
 *
 * Nhiệm vụ: Nhận cấu hình biến có cấu trúc (dạng cfMvuVarGroups), tạo ra toàn bộ sản phẩm
 * của bộ MVU và mã HTML thanh trạng thái tự động. Hàm thuần túy, không tác dụng phụ;
 * cổng duy nhất có tác dụng phụ là applyMvuKit / merge.
 *
 * Quy cách sản phẩm đồng nhất với cấu trúc tiêm hiện hành của MvuEditor/StatusBarEditor:
 *   · 2 script: Hệ thống biến MVU (MagVarUpdate + 6 nút bấm), Zod Schema
 *   · 5+ mục Worldbook: [initvar] Biến khởi tạo không mở (disabled) / Danh sách biến hoặc tách theo nhóm /
 *     [mvu_update] Quy tắc cập nhật biến / [mvu_update] Định dạng xuất biến / [mvu_update] Nhấn mạnh định dạng xuất biến
 *   · 4 Regex: [Làm đẹp] Đang cập nhật biến → [Làm đẹp] Cập nhật biến hoàn tất → Chỉ gửi cập nhật biến của N tin nhắn gần nhất → [Không gửi] Placeholder giao diện
 *   · Lời mở đầu bổ sung <StatusPlaceHolderImpl/>
 */

/* ========================================================================
 * Mẫu cố định — Giữ nguyên theo tài liệu chuẩn
 * ======================================================================== */

export const OUTPUT_FORMAT_TEXT = `---
Định dạng xuất biến:
  rule:
    - you must output the update analysis and the actual update commands at once in the end of the next reply
    - the update commands works like the **JSON Patch (RFC 6902)** standard, must be a valid JSON array containing operation objects, but supports the following operations instead:
      - replace: replace the value of existing paths
      - delta: update the value of existing number paths by a delta value
      - insert: insert new items into an object or array (using \`-\` as array index intends appending to the end)
      - remove
      - move
    - don't update field names starts with \`_\` as they are readonly, such as \`_biến\`
  format: |-
    <UpdateVariable>
    <Analysis>$(BẰNG TIẾNG VIỆT, tối đa 400 từ)
    - \${calculate time passed: ...}
    - \${decide whether dramatic updates are allowed as it's in a special case or the time passed is more than usual: yes/no}
    - \${analyze every variable based on its corresponding \`check\`, according only to current reply instead of previous plots: ...}
    </Analysis>
    <JSONPatch>
    [
      { "op": "replace", "path": "\${/path/to/variable}", "value": "\${new_value}" },
      { "op": "delta", "path": "\${/path/to/number/variable}", "value": "\${positive_or_negative_delta}" },
      { "op": "insert", "path": "\${/path/to/object/new_key}", "value": "\${new_value}" },
      { "op": "insert", "path": "\${/path/to/array/-}", "value": "\${new_value}" },
      { "op": "remove", "path": "\${/path/to/object/key}" },
      { "op": "remove", "path": "\${/path/to/array/0}" },
      { "op": "move", "from": "\${/path/to/variable}", "to": "\${/path/to/another/path}" },
      ...
    ]
    </JSONPatch>
    </UpdateVariable>`;

export const OUTPUT_EMPHASIS_TEXT = `---
Nhấn mạnh định dạng xuất biến:
  rule: The following must be inserted to the end of reply, cannot be omitted
  format: |-
    <UpdateVariable>
    ...
    </UpdateVariable>`;

export const VARIABLE_LIST_TEXT = `---
<status_current_variables>
{{format_message_variable::stat_data}}
</status_current_variables>`;

export const MVU_SCRIPT_URL = 'https://testingcf.jsdelivr.net/gh/MagicalAstrogy/MagVarUpdate/artifact/bundle.js';
export const ZOD_UTIL_URL = 'https://testingcf.jsdelivr.net/gh/StageDog/tavern_resource/dist/util/mvu_zod.js';

/* Danh sách từ khóa (Bao gồm cả tiếng Việt mới và tiếng Trung cũ để tương thích ngược) */
export const MVU_KEYWORDS = [
  'Quy tắc cập nhật biến', 'Định dạng xuất biến', 'Nhấn mạnh định dạng xuất biến', 'Giá trị biến hiện tại',
  'Biến khởi tạo', 'Danh sách biến', 'Zod Schema', 'Hệ thống biến MVU', 'MVUbeta',
  '变量更新规则', '变量输出格式', '变量输出格式强调', '当前变量值',
  '变量初始化', '变量列表', 'MVU 变量系统'
];

export const REGEX_KEYWORDS = [
  'Đang cập nhật biến', 'Cập nhật biến hoàn tất', 'Cập nhật biến', 'Placeholder giao diện',
  'Chỉ gửi cập nhật biến', '变量更新中', '完整变量完成', '变量更新', '界面占位符'
];

export const STATUSBAR_REGEX_OLD_NAMES = [
  'Làm đẹp thanh trạng thái', 'Thanh trạng thái', 'Render thanh trạng thái frontend', '[Ẩn] Placeholder thanh trạng thái',
  '[Dọn dẹp] Thanh trạng thái tầng cũ', 'Ẩn dữ liệu trạng thái với AI',
  '状态栏美化', '状态栏', '前端状态栏渲染', '[隐藏]状态栏占位符',
  '[清理]旧楼层状态栏', '对AI隐藏状态数据'
];

/* ========================================================================
 * Công cụ
 * ======================================================================== */

function jsKey(value) { return JSON.stringify(String(value ?? '')); }
function jsString(value) { return JSON.stringify(String(value ?? '')); }

export function mkField(name = '', type = 'string', defaultValue = '', min = null, max = null, clamp = false) {
  return {
    name, type, defaultValue,
    min, max, clamp,
    enumValues: '', recordFields: '', description: '', showAdvanced: false
  };
}

/** Lọc các trường biến hợp lệ (đã có tên) */
function activeFields(group) {
  return (group.fields || []).filter(f => f.name);
}

/**
 * Kiểm tra tính hợp lệ của cấu hình biến. Trả về [{ level:'error'|'warn', message }]
 */
export function validateVariables(groups, opts = {}) {
  const issues = [];
  if (!groups || groups.length === 0 || groups.every(g => !g.name)) {
    issues.push({ level: 'error', message: 'Vui lòng thêm ít nhất một nhóm biến' });
    return issues;
  }

  const groupNames = new Set();
  for (const g of groups) {
    if (!g.name) { issues.push({ level: 'error', message: 'Tồn tại nhóm biến chưa đặt tên' }); continue; }
    if (groupNames.has(g.name)) issues.push({ level: 'error', message: `Trùng lặp tên nhóm: ${g.name}` });
    groupNames.add(g.name);
    for (const f of g.fields || []) {
      if (!f.name) continue;
      const path = `${g.name}.${f.name}`;
      if (f.type === 'enum') {
        const vals = (f.enumValues || '').split(',').map(v => v.trim()).filter(Boolean);
        if (vals.length === 0) issues.push({ level: 'error', message: `${path}: Kiểu enum thiếu giá trị enum` });
        else if (String(f.defaultValue ?? '').trim() !== '' && !vals.includes(String(f.defaultValue).trim())) {
          issues.push({ level: 'warn', message: `${path}: Giá trị mặc định không nằm trong tùy chọn enum, sẽ chuyển về giá trị enum đầu tiên` });
        }
      }
      if (f.type === 'number') {
        if (String(f.defaultValue ?? '').trim() !== '' && !Number.isFinite(Number(f.defaultValue))) {
          issues.push({ level: 'error', message: `${path}: Giá trị mặc định không phải số hợp lệ (sẽ tính là 0)` });
        }
        if (f.clamp && f.min === null && f.max === null) {
          issues.push({ level: 'error', message: `${path}: Đã bật kẹp giá trị nhưng chưa thiết lập giá trị tối thiểu/tối đa` });
        }
        if (f.min !== null && f.max !== null && Number(f.min) >= Number(f.max)) {
          issues.push({ level: 'warn', message: `${path}: Giá trị tối thiểu phải nhỏ hơn giá trị tối đa` });
        }
      }
      if (f.type === 'record' && !(f.recordFields || '').trim()) {
        issues.push({ level: 'warn', message: `${path}: Chưa định nghĩa cấu trúc trường con, sẽ sinh theo dạng từ điển chuỗi (record)` });
      }
    }
  }
  return dedupeIssues(issues);
}

function dedupeIssues(issues) {
  const seen = new Set();
  const out = [];
  for (const it of issues) {
    const k = it.level + '|' + it.message;
    if (!seen.has(k)) { seen.add(k); out.push(it); }
  }
  return out;
}

/* ========================================================================
 * Tạo Zod Schema
 * Quy tắc: z.coerce.number / .prefault / clamp transform /
 * Không dùng strict passthrough / dựng cây phân cấp từ đường dẫn chấm
 * ======================================================================== */

function buildZodType(field, groupName) {
  switch (field.type) {
    case 'number': {
      let t = 'z.coerce.number()';
      if (field.clamp && (field.min !== null || field.max !== null)) {
        const lo = field.min ?? -999999;
        const hi = field.max ?? 999999;
        t += `.transform(v => _.clamp(v, ${lo}, ${hi}))`;
      }
      const parsedDefault = Number(field.defaultValue);
      t += `.prefault(${Number.isFinite(parsedDefault) ? parsedDefault : 0})`;
      return t;
    }
    case 'string':
      return `z.string().prefault(${jsString(field.defaultValue || '')})`;
    case 'boolean':
      return `z.boolean().prefault(${field.defaultValue === true || field.defaultValue === 'true'})`;
    case 'enum': {
      const enumValues = (field.enumValues || '').split(',').map(v => v.trim()).filter(Boolean);
      if (enumValues.length === 0) return `z.string().prefault(${jsString(field.defaultValue || '')})`;
      const fallback = enumValues.includes(String(field.defaultValue)) ? field.defaultValue : enumValues[0];
      return `z.enum([${enumValues.map(jsString).join(', ')}]).prefault(${jsString(fallback)})`;
    }
    case 'record': {
      const keyDesc = groupName || field.name || 'Tên khóa';
      const sub = (field.recordFields || '').split(',').map(s => {
        const parts = s.trim().split(':');
        if (parts.length < 2 || !parts[0]) return '';
        const n = parts[0].trim();
        const t = parts[1].trim();
        const zt = t === 'number' ? 'z.coerce.number().prefault(0)' : "z.string().prefault('')";
        return `      ${n}: ${zt}`;
      }).filter(Boolean).join(',\n');
      if (sub) {
        return `z.record(\n    z.string().describe('${keyDesc}'),\n    z.object({\n${sub}\n    }).prefault({})\n  ).prefault({})`;
      }
      return `z.record(z.string().describe('${keyDesc}'), z.string().prefault('')).prefault({})`;
    }
    case 'array':
      return "z.array(z.string()).prefault([])";
    default:
      return "z.string().prefault('')";
  }
}

function buildNestedTree(fields, leafTag) {
  const tree = {};
  for (const f of fields) {
    if (!f.name) continue;
    const parts = f.name.split('.');
    let node = tree;
    for (let i = 0; i < parts.length - 1; i++) {
      const next = node[parts[i]];
      if (!next || typeof next !== 'object' || next[leafTag]) {
        node[parts[i]] = {};
      }
      node = node[parts[i]];
    }
    node[parts[parts.length - 1]] = { [leafTag]: f };
  }
  return tree;
}

export function generateZodSchema(groups, opts = {}) {
  const validGroups = (groups || []).filter(g => g.name);
  if (validGroups.length === 0) return '(Vui lòng thêm nhóm biến trước)';
  let code = `import { registerMvuSchema } from\n  '${ZOD_UTIL_URL}';\n\nexport const Schema = z.object({\n`;
  for (const group of validGroups) {
    const rawFields = group.fields || [];
    const wholeRecord = rawFields.length === 1 && rawFields[0].type === 'record' && !rawFields[0].name;
    if (wholeRecord) {
      code += `  ${jsKey(group.name)}: ${buildZodType(rawFields[0], group.name)},\n`;
      continue;
    }
    code += `  ${jsKey(group.name)}: z.object({\n`;
    const tree = buildNestedTree(activeFields(group), '__zodLeaf');
    code += zodTreeToCode(tree, 2, group.name);
    code += '  }).prefault({}),\n';
  }
  if (opts.trackPresentChars) {
    code += "  \"Theo dõi nhân vật hiện diện\": z.object({\n    \"Nhân vật hiện diện\": z.string().prefault('')\n  }).prefault({}),\n";
  }
  code += '});\n\n$(() => {\n  registerMvuSchema(Schema);\n});\n';
  return code;
}

function zodTreeToCode(tree, indent, groupName) {
  let code = '';
  const pad = '  '.repeat(indent);
  for (const [k, v] of Object.entries(tree)) {
    if (v.__zodLeaf) {
      code += `${pad}${jsKey(k)}: ${buildZodType(v.__zodLeaf, groupName)},\n`;
    } else {
      code += `${pad}${jsKey(k)}: z.object({\n`;
      code += zodTreeToCode(v, indent + 1, groupName);
      code += `${pad}}).prefault({}),\n`;
    }
  }
  return code;
}

/* ========================================================================
 * Tạo InitVar YAML
 * ======================================================================== */

function yamlLeafValue(f) {
  if (f.type === 'record') return '{}';
  if (f.type === 'number') {
    return String(f.defaultValue ?? '') !== '' && Number.isFinite(Number(f.defaultValue))
      ? String(Number(f.defaultValue)) : '0';
  }
  if (f.type === 'boolean') return (f.defaultValue === true || f.defaultValue === 'true') ? 'true' : 'false';
  if (f.type === 'array') return '[]';
  return `"${f.defaultValue || ''}"`;
}

export function generateInitVarYaml(groups, opts = {}) {
  const validGroups = (groups || []).filter(g => g.name);
  if (validGroups.length === 0) return '(Vui lòng thêm nhóm biến)';
  let yaml = '';
  for (const group of validGroups) {
    yaml += `${group.name}:\n`;
    yaml += yamlTreeToText(buildNestedTree(activeFields(group), '__yamlLeaf'), 1);
  }
  if (opts.trackPresentChars) yaml += 'Theo dõi nhân vật hiện diện:\n  Nhân vật hiện diện: ""\n';
  return yaml;
}

function yamlTreeToText(obj, indent) {
  let yaml = '';
  const pad = '  '.repeat(indent);
  for (const [k, v] of Object.entries(obj)) {
    if (v.__yamlLeaf) yaml += `${pad}${k}: ${yamlLeafValue(v.__yamlLeaf)}\n`;
    else yaml += `${pad}${k}:\n${yamlTreeToText(v, indent + 1)}`;
  }
  return yaml;
}

/* ========================================================================
 * Tạo quy tắc cập nhật biến
 * ======================================================================== */

function getDefaultCheck(field) {
  switch (field.type) {
    case 'number': return 'update when relevant events cause this value to change, use reasonable delta';
    case 'enum': return 'update only when conditions trigger a stage transition';
    case 'record': return 'insert when new entries appear, remove when they leave or are consumed';
    case 'boolean': return 'toggle when the condition changes';
    default: return 'update when this information changes in the narrative';
  }
}

export function generateUpdateRules(groups, opts = {}) {
  const validGroups = (groups || []).filter(g => g.name);
  if (validGroups.length === 0) return '(Vui lòng thêm biến trước)';
  let text = '---\nQuy tắc cập nhật biến:\n';
  for (const group of validGroups) {
    const updatable = activeFields(group).filter(f => !f.name.startsWith('_'));
    if (updatable.length === 0) continue;
    text += `  ${group.name}:\n`;
    text += ruleTreeToText(buildNestedTree(updatable, '__ruleLeaf'), 2);
  }
  if (opts.trackPresentChars) {
    text += '  Theo dõi nhân vật hiện diện:\n    Nhân vật hiện diện:\n      check:\n        - update with comma-separated names of characters currently present in the scene\n';
  }
  return text;
}

function ruleTreeToText(tree, indent) {
  let text = '';
  const pad = '  '.repeat(indent);
  const leaves = [];
  const branches = [];
  for (const [k, v] of Object.entries(tree)) {
    if (v.__ruleLeaf) leaves.push({ key: k, field: v.__ruleLeaf });
    else branches.push({ key: k, subtree: v });
  }
  const plainStrings = leaves.filter(({ field }) => field.type === 'string' && !field.description);
  const others = leaves.filter(({ field }) => !(field.type === 'string' && !field.description));

  if (plainStrings.length > 1) {
    text += `${pad}${plainStrings.map(l => l.key).join(', ')}:\n`;
    text += `${pad}  check:\n${pad}    - update when this information changes in the narrative\n`;
  } else if (plainStrings.length === 1) {
    text += `${pad}${plainStrings[0].key}:\n`;
    text += `${pad}  check:\n${pad}    - update when this information changes in the narrative\n`;
  }

  const sameCheck = {};
  for (const { key, field } of others) {
    const k = field.type + '|' + (field.description || getDefaultCheck(field));
    if (!sameCheck[k]) sameCheck[k] = [];
    sameCheck[k].push({ key, field });
  }
  for (const grp of Object.values(sameCheck)) {
    if (grp.length > 1) {
      const f0 = grp[0].field;
      text += `${pad}${grp.map(g => g.key).join(', ')}:\n`;
      if (f0.type === 'number') text += `${pad}  type: number\n`;
      text += `${pad}  check:\n`;
      text += formatCheckLines(f0.description || getDefaultCheck(f0), pad);
    } else {
      text += buildRuleField(grp[0].field, grp[0].key, indent * 2);
    }
  }

  for (const { key, subtree } of branches) {
    text += `${pad}${key}:\n`;
    text += ruleTreeToText(subtree, indent + 1);
  }
  return text;
}

function formatCheckLines(desc, pad) {
  const lines = String(desc || '').split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return '';
  return lines.map(l => `${pad}    - ${l}\n`).join('');
}

function buildRuleField(f, name, indent) {
  const pad = '  '.repeat(indent / 2);
  let text = `${pad}${name}:\n`;
  if (f.type === 'number') {
    text += `${pad}  type: number\n`;
    if (f.min !== null || f.max !== null)
      text += `${pad}  range: ${f.min ?? 0}~${f.max ?? '...'}\n`;
  } else if (f.type === 'enum' && f.enumValues) {
    text += `${pad}  type: ${f.enumValues.split(',').map(v => `'${v.trim()}'`).join('|')}\n`;
  } else if (f.type === 'record') {
    const sub = (f.recordFields || '').split(',').map(s => {
      const parts = s.trim().split(':');
      return parts.length >= 2 ? `${pad}      ${parts[0].trim()}: ${parts[1].trim()};` : '';
    }).filter(Boolean).join('\n');
    if (sub)
      text += `${pad}  type: |-\n${pad}    {\n${pad}      [${name}: string]: {\n${sub}\n${pad}      }\n${pad}    }\n`;
  } else if (f.type === 'boolean') {
    text += `${pad}  type: boolean\n`;
  }
  text += `${pad}  check:\n`;
  text += formatCheckLines(f.description || getDefaultCheck(f), pad);
  return text;
}

/* ========================================================================
 * Cấu hình chung cho mục Worldbook (position=4, depth=0, order=200, không đệ quy)
 * ======================================================================== */

export function applyEntryConfig(entry, opts = {}) {
  entry.constant = opts.constant !== undefined ? opts.constant : true;
  entry.enabled = opts.enabled !== undefined ? opts.enabled : true;
  entry.extensions.position = 4;
  entry.insertion_order = opts.order || 200;
  if (!entry.extensions) entry.extensions = {};
  entry.extensions.depth = opts.depth !== undefined ? opts.depth : 0;
  entry.extensions.prevent_recursion = true;
  entry.extensions.exclude_recursion = true;
  return entry;
}

/* ========================================================================
 * buildMvuKit — Đóng gói toàn bộ sản phẩm
 * ======================================================================== */

export function buildMvuKit(variableState) {
  const { groups = [], injectMode = 'single', keepFloors = 3, trackPresentChars = false } = variableState;

  const scripts = [
    {
      name: 'Hệ thống biến MVU',
      content: `import '${MVU_SCRIPT_URL}';`,
      button: {
        enabled: true,
        buttons: [
          { name: '重新处理变量', visible: true },
          { name: '重新读取初始变量', visible: true },
          { name: '清除旧楼层变量', visible: false },
          { name: '快照楼层', visible: false },
          { name: '重演楼层', visible: false },
          { name: '重试额外模型解析', visible: false }
        ]
      }
    },
    { name: 'Zod Schema', content: generateZodSchema(groups, { trackPresentChars }) }
  ];

  const entries = [
    { comment: '[initvar] Biến khởi tạo không mở', content: generateInitVarYaml(groups, { trackPresentChars }), cfg: { constant: false, enabled: false } }
  ];

  if (injectMode === 'split') {
    let orderBase = 190;
    for (const group of groups) {
      if (!group.name) continue;
      const alwaysOn = ['Thế giới', 'Hệ thống', 'Môi trường', 'Nhân vật chính', '世界', '系统', '环境', '主角'].includes(group.name);
      entries.push({
        comment: `Biến ${group.name}`,
        content: `${group.name}:\n  {{format_message_variable::stat_data.${group.name}}}`,
        cfg: { constant: alwaysOn, order: orderBase++ },
        keys: alwaysOn ? undefined : [group.name]
      });
    }
  } else {
    entries.push({ comment: 'Danh sách biến', content: VARIABLE_LIST_TEXT, cfg: {} });
  }

  entries.push(
    { comment: '[mvu_update] Quy tắc cập nhật biến', content: generateUpdateRules(groups, { trackPresentChars }), cfg: {} },
    { comment: '[mvu_update] Định dạng xuất biến', content: OUTPUT_FORMAT_TEXT, cfg: {} },
    { comment: '[mvu_update] Nhấn mạnh định dạng xuất biến', content: OUTPUT_EMPHASIS_TEXT, cfg: {} }
  );

  const regexes = [
    {
      scriptName: '[Làm đẹp] Đang cập nhật biến',
      findRegex: '/<UpdateVariable>(?![\\s\\S]*<\\/UpdateVariable>)([\\s\\S]*)/gs',
      replaceString: '<details open style="background:rgba(0,0,0,0.15);border:1px solid rgba(100,200,255,0.15);border-radius:6px;padding:8px;margin:4px 0;font-size:12px"><summary style="cursor:pointer;color:#60a5fa">Đang cập nhật biến...</summary><pre style="white-space:pre-wrap;color:#aaa;margin:4px 0">$1</pre></details>',
      markdownOnly: true, promptOnly: false
    },
    {
      scriptName: '[Làm đẹp] Cập nhật biến hoàn tất',
      findRegex: '/<UpdateVariable>([\\s\\S]*?)<\\/UpdateVariable>/gs',
      replaceString: '<details style="background:rgba(0,0,0,0.15);border:1px solid rgba(255,255,255,0.06);border-radius:6px;padding:8px;margin:4px 0;font-size:12px"><summary style="cursor:pointer;color:#888">Cập nhật biến</summary><pre style="white-space:pre-wrap;color:#aaa;margin:4px 0">$1</pre></details>',
      markdownOnly: true, promptOnly: false
    },
    {
      scriptName: `Chỉ gửi cập nhật biến của ${keepFloors} tin nhắn gần nhất`,
      findRegex: '/<UpdateVariable>[\\s\\S]*?<\\/UpdateVariable>/gm',
      replaceString: '',
      markdownOnly: false, promptOnly: true,
      minDepth: keepFloors * 2 || null
    },
    {
      scriptName: '[Không gửi] Placeholder giao diện',
      findRegex: '/<StatusPlaceHolderImpl\\s*\\/>/g',
      replaceString: '',
      markdownOnly: false, promptOnly: true
    }
  ];

  return {
    scripts, entries, regexes,
    summary: {
      scriptCount: scripts.length,
      entryCount: injectMode === 'split' ? 4 + groups.filter(g => g.name).length : 5,
      regexCount: regexes.length
    }
  };
}

/* ========================================================================
 * Tiêm bộ sản phẩm vào thẻ
 * ======================================================================== */

export function detectExistingMvu(cardStore) {
  return cardStore.worldEntries.some(e => MVU_KEYWORDS.some(k => (e.comment || '').includes(k)))
    || cardStore.tavernScripts.some(s => MVU_KEYWORDS.some(k => (s.name || '').includes(k)));
}

export function detectExistingStatusRegex(cardStore) {
  return (cardStore.regexScripts || [])
    .filter(s => s.scriptName && STATUSBAR_REGEX_OLD_NAMES.includes(s.scriptName))
    .map(s => s.scriptName);
}

function removeByKeywords(arr, keywords, getLabel) {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (keywords.some(k => ((getLabel(arr[i]) || '') + '').includes(k))) arr.splice(i, 1);
  }
}

export function applyMvuKit(cardStore, kit) {
  removeByKeywords(cardStore.tavernScripts, MVU_KEYWORDS, s => s.name);
  removeByKeywords(cardStore.worldEntries, MVU_KEYWORDS, e => e.comment);
  removeByKeywords(cardStore.regexScripts, REGEX_KEYWORDS, r => r.scriptName);

  for (const sc of kit.scripts) {
    const s = cardStore.createEmptyTavernScript();
    s.name = sc.name; s.content = sc.content;
    if (sc.button) s.button = JSON.parse(JSON.stringify(sc.button));
    cardStore.addTavernScript(s);
  }
  for (const en of kit.entries) {
    const e = cardStore.addWorldEntry();
    e.comment = en.comment; e.content = en.content;
    applyEntryConfig(e, en.cfg || {});
    if (en.keys) e.keys = [...en.keys];
  }
  for (const rx of kit.regexes) {
    cardStore.addRegexScript({ ...cardStore.createEmptyRegexScript(), ...rx });
  }
  ensurePlaceholderOnGreetings(cardStore);
  cardStore.markDirty();
}

export function ensurePlaceholderOnGreetings(cardStore) {
  const fm = cardStore.cardData.first_mes || '';
  if (!fm.includes('StatusPlaceHolderImpl')) {
    cardStore.cardData.first_mes = fm + '\n<StatusPlaceHolderImpl/>';
  }
  const ag = cardStore.cardData.alternate_greetings || [];
  for (let i = 0; i < ag.length; i++) {
    if (!String(ag[i]).includes('StatusPlaceHolderImpl')) ag[i] += '\n<StatusPlaceHolderImpl/>';
  }
}

export function mergeMvuKitIntoCard(cardStore, kit, newGroups) {
  const saved = cardStore.cardData.extensions?.cfMvuVarGroups || [];
  const merged = JSON.parse(JSON.stringify(saved));
  for (const ng of newGroups || []) {
    if (!ng.name) continue;
    const existing = merged.find(g => g.name === ng.name);
    if (existing) {
      for (const nf of ng.fields) {
        if (nf.name && !existing.fields.find(ef => ef.name === nf.name)) {
          existing.fields.push(JSON.parse(JSON.stringify(nf)));
        }
      }
    } else {
      merged.push(JSON.parse(JSON.stringify(ng)));
    }
  }
  if (!cardStore.cardData.extensions) cardStore.cardData.extensions = {};
  cardStore.cardData.extensions.cfMvuVarGroups = merged;

  const hasScripts = cardStore.tavernScripts.some(s => (s.content || '').includes('MagVarUpdate'));
  const hasEntries = cardStore.worldEntries.some(e => {
    const c = e.comment || '';
    return c.includes('Quy tắc cập nhật biến') || c.includes('变量更新规则');
  });

  if (!hasScripts) {
    const mvuScript = kit.scripts.find(s => s.name === 'Hệ thống biến MVU' || s.name === 'MVU 变量系统');
    const s = cardStore.createEmptyTavernScript();
    s.name = mvuScript.name; s.content = mvuScript.content;
    s.button = JSON.parse(JSON.stringify(mvuScript.button));
    cardStore.addTavernScript(s);
  }

  const zs = cardStore.tavernScripts.find(s => (s.name || '').includes('Zod'));
  if (zs) zs.content = generateZodSchema(merged);
  else {
    const s = cardStore.createEmptyTavernScript();
    s.name = 'Zod Schema';
    s.content = generateZodSchema(merged);
    cardStore.addTavernScript(s);
  }

  for (const en of kit.entries) {
    const comment = en.comment || '';
    if (comment.includes('initvar') || comment.includes('Khởi tạo biến') || comment.includes('变量初始化')) {
      patchInitVarEntry(cardStore, merged);
      continue;
    }
    if (comment.includes('Quy tắc cập nhật biến') || comment.includes('变量更新规则')) {
      if (hasEntries) {
        const cur = cardStore.worldEntries.find(e => {
          const ec = e.comment || '';
          return ec.includes('Quy tắc cập nhật biến') || ec.includes('变量更新规则');
        });
        if (cur) cur.content = generateUpdateRules(merged);
        continue;
      }
    }
    const exists = cardStore.worldEntries.some(e => normalizeComment(e.comment) === normalizeComment(en.comment));
    if (exists) continue;
    const e = cardStore.addWorldEntry();
    e.comment = en.comment; e.content = en.content;
    applyEntryConfig(e, en.cfg || {});
    if (en.keys) e.keys = [...en.keys];
  }

  refreshListEntryContents(cardStore, merged, kit);

  const existingRegexNames = cardStore.regexScripts.map(r => r.scriptName);
  for (const rx of kit.regexes) {
    if (!existingRegexNames.includes(rx.scriptName)) {
      cardStore.addRegexScript({ ...cardStore.createEmptyRegexScript(), ...rx });
    }
  }

  ensurePlaceholderOnGreetings(cardStore);
  cardStore.markDirty();
  return { mode: 'merged' };
}

function refreshListEntryContents(cardStore, merged, kit) {
  const listEntry = cardStore.worldEntries.find(e => {
    const c = normalizeComment(e.comment);
    return c === normalizeComment('Danh sách biến') || c === normalizeComment('变量列表');
  });
  const newListEntry = kit.entries.find(en => normalizeComment(en.comment) === normalizeComment('Danh sách biến'));
  if (listEntry && newListEntry) listEntry.content = newListEntry.content;
  for (const g of merged) {
    if (!g.name) continue;
    const ge = cardStore.worldEntries.find(e => {
      const c = normalizeComment(e.comment);
      return c === normalizeComment(`Biến ${g.name}`) || c === normalizeComment(`${g.name}变量`);
    });
    if (ge) ge.content = `${g.name}:\n  {{format_message_variable::stat_data.${g.name}}}`;
  }
}

function normalizeComment(c) { return (c || '').replace(/\s+/g, ''); }

function patchInitVarEntry(cardStore, groups) {
  const initEntry = cardStore.worldEntries.find(e => {
    const c = (e.comment || '').toLowerCase();
    return c.includes('initvar') || c.includes('khởi tạo biến') || c.includes('变量初始化');
  });
  if (!initEntry) return false;
  let content = initEntry.content || '';
  for (const g of groups) {
    if (!g.name) continue;
    if (!content.includes(g.name + ':')) {
      content += '\n' + g.name + ':\n';
      for (const f of g.fields || []) {
        if (!f.name) continue;
        content += nestedYamlFieldLines(f, 1);
      }
    } else {
      for (const f of g.fields || []) {
        if (!f.name) continue;
        const leafName = f.name.includes('.') ? f.name.split('.').pop() : f.name;
        if (!content.includes(leafName)) {
          const idx = content.indexOf(g.name + ':') + (g.name + ':').length;
          content = content.slice(0, idx) + '\n' + nestedYamlFieldLines(f, 1) + content.slice(idx);
        }
      }
    }
  }
  initEntry.content = content;
  return true;
}

function nestedYamlFieldLines(f, baseIndent) {
  const parts = String(f.name).split('.');
  let yaml = '';
  for (let i = 0; i < parts.length - 1; i++) {
    yaml += '  '.repeat(baseIndent + i) + parts[i] + ':\n';
  }
  const leaf = parts[parts.length - 1];
  const pad = '  '.repeat(baseIndent + parts.length - 1);
  const val = f.type === 'record' ? '{}' : f.type === 'number'
    ? (String(f.defaultValue ?? '') !== '' && Number.isFinite(Number(f.defaultValue)) ? String(Number(f.defaultValue)) : '0')
    : '"' + (f.defaultValue || '') + '"';
  yaml += pad + leaf + ': ' + val + '\n';
  return yaml;
}

/* ========================================================================
 * Kiểm tra đường dẫn 3 chiều
 * ======================================================================== */

export function extractVarGroupPaths(groups) {
  const out = [];
  for (const group of groups || []) {
    if (!group.name) continue;
    for (const f of group.fields || []) {
      if (!f.name || f.name.startsWith('_')) continue;
      out.push(`${group.name}.${f.name}`);
    }
  }
  return out;
}

export function extractStatusBarPaths(htmlText) {
  const set = new Set();
  if (!htmlText) return set;
  const re = /stat_data\.([\w\u00C0-\u1EF9一-龥][\w\u00C0-\u1EF9一-龥\s.]*)/g;
  let m;
  while ((m = re.exec(htmlText)) !== null) set.add(m[1].trim());
  return set;
}

export function diffVariableUsagePaths(groups, htmlText) {
  const defined = extractVarGroupPaths(groups);
  const used = [...extractStatusBarPaths(htmlText)];
  const usedSet = new Set(used);
  return {
    definedPaths: defined,
    usedPaths: used,
    onlyDefined: defined.filter(p => !usedSet.has(p)),
    onlyUsed: used.filter(p => !defined.includes(p))
  };
}

/* ========================================================================
 * Chế độ thuần văn bản
 * ======================================================================== */

export const TEXT_MODE_OUTPUT_RULE_ENTRY_COMMENT = 'Chỉ lệnh xuất dữ liệu trạng thái';

export function generateTextModeRuleEntry(groups) {
  const sampleLines = [];
  for (const g of groups || []) {
    if (!g.name) continue;
    for (const f of g.fields || []) {
      if (!f.name || f.name.startsWith('_') || f.name.includes('.')) continue;
      sampleLines.push(`${fieldLabel(f)}:Giá trị`);
      if (sampleLines.length >= 6) break;
    }
    if (sampleLines.length >= 6) break;
  }
  return `Quy tắc xuất dữ liệu trạng thái:
  - Sau mỗi lần trả lời, bắt buộc phải nối thêm khối <StatusData> ở cuối
  - Định dạng mỗi dòng là "Tên trường:Giá trị", dấu hai chấm liền sau tên trường
  - Khối <StatusData> không được hiển thị trong văn bản chính

Ví dụ định dạng đầu ra:
  <StatusData>
  ${sampleLines.length ? sampleLines.join('\n  ') : 'Vị trí:Một nơi nào đó\n  Trạng thái:Bình thường'}
  </StatusData>`;
}

export function buildTextModeRegexes(statusHtml, opts = {}) {
  let html = statusHtml;
  if (!/__statusRawText/.test(html)) {
    html = html.replace(/<\/body>/,
      '<scr' + 'ipt type="module">window.__statusRawText=`$1`;<\/scr' + 'ipt>\n</body>');
  }
  void opts.minDepth;
  return [
    {
      scriptName: 'Thanh trạng thái',
      findRegex: '/<StatusData>([\\s\\S]*?)<\\/StatusData>/gm',
      replaceString: '```html\n' + html + '\n```',
      markdownOnly: true,
      promptOnly: false
    },
    {
      scriptName: 'Ẩn dữ liệu trạng thái với AI',
      findRegex: '/<StatusData>[\\s\\S]*?<\\/StatusData>/gm',
      replaceString: '',
      markdownOnly: false,
      promptOnly: true,
      minDepth: 6
    }
  ];
}

export function generateTextModeHtml(groups, o = {}) {
  const themeKey = WORKBENCH_THEMES[o.theme] ? o.theme : 'modern';
  const layout = WORKBENCH_LAYOUTS[o.layout] ? o.layout : 'grouped';
  const themeVars = Object.entries(WORKBENCH_THEMES[themeKey].vars)
    .map(([k, v]) => `      ${k}: ${v};`).join('\n');

  const sections = [];
  for (const g of groups || []) {
    if (!g.name) continue;
    const fields = activeFields(g).filter(f => !f.name.startsWith('_') && !f.name.includes('.'));
    if (fields.length === 0) continue;
    sections.push({ name: g.name, fields });
  }

  let bodyRoot;
  if (sections.length === 0) {
    bodyRoot = '<div class="sb-root"><div class="sb-empty">Vui lòng thêm biến ở cột bên trái để xem trước</div></div>';
  } else {
    bodyRoot = `<div class="sb-root">\n${sections.map(s => sectionMarkup(layout, s)).join('\n')}\n</div>`;
  }

  const parseRuntime =
    '<scr' + 'ipt type="module">\n' +
    '    function parseAndDisplay() {\n' +
    '      const raw = (window.__statusRawText || "");\n' +
    '      const lines = String(raw).trim().split("\\n").filter(Boolean);\n' +
    '      const data = {};\n' +
    '      lines.forEach(l => {\n' +
    '        const i = l.indexOf(":");\n' +
    '        if (i > 0) data[l.slice(0, i).trim()] = l.slice(i + 1).trim();\n' +
    '      });\n' +
    '      for (const [k, v] of Object.entries(data)) {\n' +
    '        document.querySelectorAll("[data-st-key]").forEach(el => {\n' +
    '          if (el.dataset.stKey === k) el.textContent = v;\n' +
    '        });\n' +
    '      }\n' +
    '    }\n' +
    '    parseAndDisplay();\n' +
    '    window.addEventListener("message", function (e) {\n' +
    '      if (e.data && e.data.type === "textModeMock") {\n' +
    '        window.__statusRawText = e.data.raw;\n' +
    '        parseAndDisplay();\n' +
    '      }\n' +
    '    });\n' +
    '</scr' + 'ipt>';

  let doc = `<!doctype html>\n<html lang="vi">\n<head>\n  <meta charset="utf-8">\n  <style>\n${cssBlock().replace('@@THEMEVARS@@', themeVars)}\n  </style>\n</head>\n<body>\n  ${bodyRoot}\n${parseRuntime}\n</body>\n</html>`;
  for (const s of sections) {
    for (const f of s.fields) {
      const id = domId(s.name, f.name);
      const key = fieldLabel(f);
      const tagRe = new RegExp(`<([a-z]+)([^>]*id="${id}"[^>]*)>`, 'i');
      const m = doc.match(tagRe);
      if (!m) continue;
      let attrs = m[2];
      attrs = attrs.replace(/class="/i, `data-st-key="${escapeAttr(key)}" class="`);
      doc = doc.replace(tagRe, `<${m[1]}${attrs}>`);
    }
  }
  return doc;
}

function escapeAttr(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;'); }

function fieldLabel(f) { return f.label || f.displayName || f.name; }

export function aiPlanToVarGroups(list) {
  const map = new Map();
  for (const v of list || []) {
    const g = v.group || 'Khác';
    if (!map.has(g)) map.set(g, []);
    const field = mkField(String(v.field || ''), v.type === 'number' ? 'number' : (v.type || 'string'), String(v.default ?? ''));
    if (v.min !== undefined && v.min !== null) field.min = v.min;
    if (v.max !== undefined && v.max !== null) field.max = v.max;
    if (Array.isArray(v.options) && v.options.length) field.enumValues = v.options.join(',');
    if (typeof v.description === 'string') field.description = v.description;
    map.get(g).push(field);
  }
  return [...map.entries()].map(([name, fields]) => ({ name, fields }));
}

/* ========================================================================
 * Trình tạo mã HTML thanh trạng thái tự động
 * ======================================================================== */

export const WORKBENCH_THEMES = {
  modern: {
    label: 'Hiện đại tối giản',
    vars: {
      '--sb-accent': '#60a5fa', '--sb-accent-soft': 'rgba(96,165,250,0.25)',
      '--sb-bg': 'rgba(10,10,25,0.65)', '--sb-panel': 'rgba(255,255,255,0.05)',
      '--sb-border': 'rgba(148,163,184,0.28)', '--sb-text': '#e5e7eb',
      '--sb-muted': '#94a3b8', '--sb-font': "'Segoe UI', system-ui, sans-serif",
      '--sb-radius': '10px', '--sb-meter-track': 'rgba(96,165,250,0.15)'
    }
  },
  xiuxian: {
    label: 'Tiên hiệp cổ phong',
    vars: {
      '--sb-accent': '#ffd700', '--sb-accent-soft': 'rgba(255,215,0,0.22)',
      '--sb-bg': 'rgba(20,14,36,0.78)', '--sb-panel': 'rgba(255,215,0,0.06)',
      '--sb-border': 'rgba(255,215,0,0.35)', '--sb-text': '#f3e8d3',
      '--sb-muted': '#c9b98a', '--sb-font': "'Noto Serif SC', serif",
      '--sb-radius': '4px', '--sb-meter-track': 'rgba(255,215,0,0.12)'
    }
  },
  cyber: {
    label: 'Cyberpunk',
    vars: {
      '--sb-accent': '#00e5ff', '--sb-accent-soft': 'rgba(0,229,255,0.18)',
      '--sb-bg': 'rgba(4,12,20,0.82)', '--sb-panel': 'rgba(0,229,255,0.05)',
      '--sb-border': 'rgba(0,229,255,0.45)', '--sb-text': '#ccfbf1',
      '--sb-muted': '#67e8f9', '--sb-font': "'Consolas', monospace",
      '--sb-radius': '2px', '--sb-meter-track': 'rgba(0,229,255,0.12)'
    }
  },
  dark: {
    label: 'Kỳ ảo tăm tối',
    vars: {
      '--sb-accent': '#e94560', '--sb-accent-soft': 'rgba(233,69,96,0.20)',
      '--sb-bg': 'rgba(26,10,10,0.82)', '--sb-panel': 'rgba(233,69,96,0.07)',
      '--sb-border': 'rgba(233,69,96,0.38)', '--sb-text': '#eddcd2',
      '--sb-muted': '#b08a80', '--sb-font': "'Georgia', serif",
      '--sb-radius': '6px', '--sb-meter-track': 'rgba(233,69,96,0.12)'
    }
  },
  school: {
    label: 'Học đường tươi sáng',
    vars: {
      '--sb-accent': '#a5b4fc', '--sb-accent-soft': 'rgba(165,180,252,0.25)',
      '--sb-bg': 'rgba(248,250,252,0.90)', '--sb-panel': 'rgba(165,180,252,0.10)',
      '--sb-border': 'rgba(165,180,252,0.55)', '--sb-text': '#334155',
      '--sb-muted': '#64748b', '--sb-font': "'PingFang SC', 'Segoe UI', sans-serif",
      '--sb-radius': '14px', '--sb-meter-track': 'rgba(165,180,252,0.18)'
    }
  }
};

export const WORKBENCH_LAYOUTS = {
  grouped: { label: 'Bảng theo nhóm (Hiển thị phân khối theo nhóm biến)' },
  vertical: { label: 'Danh sách dọc (Mỗi biến một dòng)' },
  grid: { label: 'Bố cục lưới (Thẻ 2-3 cột)' }
};

export function buildPreviewStatData(groups, opts = {}) {
  const data = {};
  for (const g of groups || []) {
    if (!g.name) continue;
    const go = {};
    for (const f of g.fields || []) {
      if (!f.name) continue;
      const parts = f.name.split('.');
      let node = go;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!node[parts[i]] || typeof node[parts[i]] !== 'object') node[parts[i]] = {};
        node = node[parts[i]];
      }
      let v;
      switch (f.type) {
        case 'number': v = Number.isFinite(Number(f.defaultValue)) ? Number(f.defaultValue) : 0; break;
        case 'boolean': v = f.defaultValue === true || f.defaultValue === 'true'; break;
        case 'array': v = []; break;
        case 'record': v = {}; break;
        default: v = String(f.defaultValue || '');
      }
      node[parts[parts.length - 1]] = v;
    }
    data[g.name] = go;
  }
  if (opts.trackPresentChars) data['Theo dõi nhân vật hiện diện'] = { 'Nhân vật hiện diện': '' };
  return data;
}

const RUNTIME_TEMPLATE =
  '<scr' + 'ipt type="module">\n' +
  '    function formatCollection(v) {\n' +
  '      if (Array.isArray(v)) return v.length ? v.join("、") : "--";\n' +
  '      if (v && typeof v === "object") {\n' +
  '        var ks = Object.keys(v);\n' +
  '        if (!ks.length) return "--";\n' +
  '        return ks.map(function (k) { return k + " " + v[k]; }).join("、");\n' +
  '      }\n' +
  '      return String(v == null ? "--" : v);\n' +
  '    }\n' +
  '\n' +
  '    function populateCharacterData() {\n' +
  '      const all_variables = getAllVariables();\n' +
  '/*__BINDINGS__*/\n' +
  '    }\n' +
  '\n' +
  '    async function init() {\n' +
  '      await waitGlobalInitialized(\'Mvu\');\n' +
  '      populateCharacterData();\n' +
  '      eventOn(Mvu.events.VARIABLE_UPDATE_ENDED, () => {\n' +
  '        populateCharacterData();\n' +
  '      });\n' +
  '/*__TABSWITCH__*/\n' +
  '    }\n' +
  '\n' +
  '    $(errorCatched(init));\n' +
  '</scr' + 'ipt>';

const TAB_SWITCH_SNIPPET =
  '\n      $("[data-target]").on("click", function () {\n' +
  '        const target = $(this).data("target");\n' +
  '        $("[data-target]").removeClass("active");\n' +
  '        $(this).addClass("active");\n' +
  '        $(".sb-pane").removeClass("active");\n' +
  '        $("#" + target).addClass("active");\n' +
  '      });\n';

function cssBlock() {
  return [
    '    body { margin: 0; padding: 0; background: transparent; }',
    '    :root {',
    '@@THEMEVARS@@',
    '    }',
    '    .sb-root { font-family: var(--sb-font); color: var(--sb-text); background: var(--sb-bg); border: 1px solid var(--sb-border); border-radius: var(--sb-radius); padding: 14px 16px; font-size: 13px; }',
    '    .sb-empty { padding: 24px; text-align: center; color: var(--sb-muted); }',
    '    .sb-section-title { margin: 0 0 10px 0; font-size: 14px; font-weight: 600; color: var(--sb-accent); letter-spacing: 1px; }',
    '    .sb-items { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; }',
    '    .sb-item { background: var(--sb-panel); border: 1px solid var(--sb-border); border-radius: var(--sb-radius); padding: 8px 10px; }',
    '    .sb-item-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; margin-bottom: 6px; }',
    '    .sb-item--row { display: flex; justify-content: space-between; align-items: center; gap: 8px; }',
    '    .sb-item--block { display: flex; flex-direction: column; gap: 6px; }',
    '    .sb-label { color: var(--sb-muted); }',
    '    .sb-value { font-weight: 600; }',
    '    .sb-meter { height: 5px; border-radius: 999px; background: var(--sb-meter-track); overflow: hidden; }',
    '    .sb-meter-fill { height: 100%; width: 0%; border-radius: inherit; background: linear-gradient(90deg, var(--sb-accent-soft), var(--sb-accent)); }',
    '    .sb-badge--bool { padding: 2px 10px; border-radius: 999px; background: var(--sb-accent-soft); color: var(--sb-accent); font-size: 12px; font-weight: 600; }',
    '    .sb-collection { white-space: pre-wrap; word-break: break-all; }',
    '    .sb-list { display: flex; flex-direction: column; gap: 6px; }',
    '    .sb-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; }',
    '    .sb-tile { background: var(--sb-panel); border: 1px solid var(--sb-border); border-radius: var(--sb-radius); padding: 10px; display: flex; flex-direction: column; gap: 6px; min-width: 0; }',
    '    .sb-big { font-size: 18px; color: var(--sb-accent); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }',
    '    .sb-tabs { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }',
    '    .sb-tab-btn { cursor: pointer; font-family: inherit; font-size: 12px; color: var(--sb-muted); background: var(--sb-panel); border: 1px solid var(--sb-border); border-radius: 999px; padding: 4px 14px; }',
    '    .sb-tab-btn.active { color: var(--sb-accent); border-color: var(--sb-accent); background: var(--sb-accent-soft); }',
    '    .sb-pane { display: none; }',
    '    .sb-pane.active { display: block; }'
  ].join('\n');
}

function buildBindingLines(groupId, fields) {
  const lines = [];
  for (const f of fields) {
    const id = domId(groupId, f.name);
    const path = `${groupId}.${f.name}`;
    if (f.type === 'number') {
      const def = Number.isFinite(Number(f.defaultValue)) ? Number(f.defaultValue) : 0;
      const lo = f.min ?? 0;
      const hi = f.max ?? Math.max(lo + 100, def || 100);
      lines.push(`      $("#${id}").text(_.get(all_variables, 'stat_data.${path}', ${def}));`);
      if (hi > lo) {
        lines.push(`      $("#${id}-meter").css("width", Math.round(_.clamp(_.get(all_variables, 'stat_data.${path}', ${def}), ${lo}, ${hi}) / (${hi} - ${lo}) * 10000) / 100 + "%");`);
      } else {
        lines.push(`      $("#${id}-meter").css("width", "100%");`);
      }
    } else if (f.type === 'boolean') {
      lines.push(`      $("#${id}").text(_.get(all_variables, 'stat_data.${path}', false) ? "Có" : "Không");`);
    } else if (f.type === 'enum') {
      const vals = (f.enumValues || '').split(',').map(v => v.trim()).filter(Boolean);
      const fb = vals.length ? `'${vals[0]}'` : "'--'";
      lines.push(`      $("#${id}").text(_.get(all_variables, 'stat_data.${path}', ${fb}));`);
    } else if (f.type === 'record' || f.type === 'array') {
      lines.push(`      $("#${id}").text(formatCollection(_.get(all_variables, 'stat_data.${path}', ${f.type === 'record' ? '{}' : '[]'})));`);
    } else {
      lines.push(`      $("#${id}").text(_.get(all_variables, 'stat_data.${path}', '${f.defaultValue || '--'}'));`);
    }
  }
  return lines.join('\n');
}

function paneItemMarkup(groupId, f) {
  const id = domId(groupId, f.name);
  const label = escapeHtml(f.label || f.name);
  if (f.type === 'number') {
    return `<div class="sb-item">\n        <div class="sb-item-head"><span class="sb-label">${label}</span><span class="sb-value" id="${id}">--</span></div>\n        <div class="sb-meter"><div class="sb-meter-fill" id="${id}-meter"></div></div>\n      </div>`;
  }
  if (f.type === 'boolean') {
    return `<div class="sb-item sb-item--row">\n        <span class="sb-label">${label}</span>\n        <span class="sb-badge--bool" id="${id}">--</span>\n      </div>`;
  }
  if (f.type === 'record' || f.type === 'array') {
    return `<div class="sb-item sb-item--block">\n        <span class="sb-label">${label}</span>\n        <span class="sb-collection" id="${id}">--</span>\n      </div>`;
  }
  return `<div class="sb-item sb-item--row">\n        <span class="sb-label">${label}</span>\n        <span class="sb-value" id="${id}">--</span>\n      </div>`;
}

function tileMarkup(groupId, f) {
  const id = domId(groupId, f.name);
  const label = escapeHtml(f.label || f.name);
  if (f.type === 'number') {
    return `<div class="sb-tile">\n      <span class="sb-label">${label}</span>\n      <strong class="sb-big" id="${id}">--</strong>\n      <div class="sb-meter"><div class="sb-meter-fill" id="${id}-meter"></div></div>\n    </div>`;
  }
  return `<div class="sb-tile">\n      <span class="sb-label">${label}</span>\n      <strong class="sb-big" id="${id}">--</strong>\n    </div>`;
}

function sectionMarkup(layout, section) {
  const title = `<h3 class="sb-section-title">${escapeHtml(section.name)}</h3>`;
  if (layout === 'grid') {
    return `${title}\n<div class="sb-grid">\n    ${section.fields.map(f => tileMarkup(section.name, f)).join('\n    ')}\n  </div>`;
  }
  if (layout === 'vertical') {
    return `${title}\n<div class="sb-list">\n    ${section.fields.map(f => paneItemMarkup(section.name, f)).join('\n    ')}\n  </div>`;
  }
  return `${title}\n<div class="sb-items">\n    ${section.fields.map(f => paneItemMarkup(section.name, f)).join('\n    ')}\n  </div>`;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function domId(groupId, fieldName) {
  const raw = `${groupId}.${fieldName}`;
  let slug = '';
  for (let i = 0; i < raw.length && slug.length < 40; i++) {
    const ch = raw[i];
    if (/[A-Za-z0-9]/.test(ch)) slug += ch.toLowerCase();
    else slug += '_';
  }
  let h = 5381;
  for (let i = 0; i < raw.length; i++) h = ((h << 5) + h + raw.charCodeAt(i)) & 0x7fffffff;
  return 'sb-' + slug + '-' + h.toString(36);
}

export function generateStatusHtml(groups, o = {}) {
  const themeKey = WORKBENCH_THEMES[o.theme] ? o.theme : 'modern';
  const layout = WORKBENCH_LAYOUTS[o.layout] ? o.layout : 'grouped';

  const themeVars = Object.entries(WORKBENCH_THEMES[themeKey].vars)
    .map(([k, v]) => `      ${k}: ${v};`).join('\n');

  const sections = [];
  for (const g of groups || []) {
    if (!g.name) continue;
    const fields = activeFields(g).filter(f => !f.name.startsWith('_'));
    if (fields.length === 0) continue;
    sections.push({ name: g.name, fields });
  }
  if (sections.length === 0) {
    const emptyCss = cssBlock().replace('@@THEMEVARS@@', themeVars);
    return `<!doctype html>\n<html lang="vi">\n<head>\n  <meta charset="utf-8">\n  <style>\n${emptyCss}\n  </style>\n</head>\n<body>\n  <div class="sb-root"><div class="sb-empty">Vui lòng thêm biến ở cột bên trái để xem trước</div></div>\n</body>\n</html>`;
  }

  const tabbed = layout === 'grid' ? sections.length > 1 : sections.length > 3;
  let bodyHtml = '';
  if (tabbed) {
    const navBtns = sections.map((s, i) =>
      `    <button class="sb-tab-btn${i === 0 ? ' active' : ''}" data-target="sb-tab-${i}">${escapeHtml(s.name)}</button>`).join('\n');
    const panes = sections.map((s, i) =>
      `  <section class="sb-pane${i === 0 ? ' active' : ''}" id="sb-tab-${i}">\n  ${sectionMarkup(layout, s)}\n  </section>`).join('\n');
    bodyHtml = `  <nav class="sb-tabs">\n${navBtns}\n  </nav>\n${panes}`;
  } else {
    bodyHtml = sections.map(s => `  <section class="sb-block">\n  ${sectionMarkup(layout, s)}\n  </section>`).join('\n');
  }

  const bindings = sections.map(s => buildBindingLines(s.name, s.fields)).join('\n');
  const runtime = RUNTIME_TEMPLATE
    .replace('/*__BINDINGS__*/', bindings)
    .replace('/*__TABSWITCH__*/', tabbed ? TAB_SWITCH_SNIPPET : '');

  const css = cssBlock().replace('@@THEMEVARS@@', themeVars);
  return `<!doctype html>\n<html lang="vi">\n<head>\n  <meta charset="utf-8">\n  <style>\n${css}\n  </style>\n</head>\n<body>\n  <div class="sb-root">\n${bodyHtml}\n  </div>\n${runtime}\n</body>\n</html>`;
}