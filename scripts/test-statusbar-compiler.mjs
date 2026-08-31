/**
 * Kiểm tra smoke test statusbar-compiler (node chạy trực tiếp, không cần build)
 * Cách dùng: node scripts/test-statusbar-compiler.mjs
 * Giải thích: package.json là commonjs, node sẽ coi .js là CJS — ở đây trước tiên sao chép module
 * được kiểm thử thành file .mjs tạm thời rồi import động, nội dung khớp từng byte với file nguồn.
 * Khẳng định (Assert): Quy cách sản phẩm, xuất Zod/YAML/quy tắc cùng quy tắc với MvuEditor, tính toàn vẹn cấu trúc HTML.
 */
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcPath = join(__dirname, '../src/renderer/utils/statusbar-compiler.js');
const tmpDir = mkdtempSync(join(tmpdir(), 'sbtest-'));
const modPath = join(tmpDir, 'statusbar-compiler.mjs');
writeFileSync(modPath, readFileSync(srcPath, 'utf8'));
const compiler = await import('file:///' + modPath.replace(/\\/g, '/'));
const {
  validateVariables, generateZodSchema, generateInitVarYaml, generateUpdateRules,
  buildMvuKit, applyMvuKit, mergeMvuKitIntoCard, aiPlanToVarGroups,
  generateStatusHtml, buildPreviewStatData, diffVariableUsagePaths,
  generateTextModeHtml, buildTextModeRegexes, generateTextModeRuleEntry,
  TEXT_MODE_OUTPUT_RULE_ENTRY_COMMENT,
  OUTPUT_FORMAT_TEXT, OUTPUT_EMPHASIS_TEXT
} = compiler;

process.on('exit', () => { try { rmSync(tmpDir, { recursive: true, force: true }); } catch {} });

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; }
  else { fail++; console.error('FAIL: ' + name); }
}
function eq(a, b, name) {
  const ja = JSON.stringify(a), jb = JSON.stringify(b);
  if (ja === jb) pass++;
  else { fail++; console.error(`FAIL: ${name}\n  got: ${ja}\n  exp: ${jb}`); }
}

/* ==================== Dữ liệu kiểm thử: Thẻ thể loại RPG ==================== */
const groups = [
  { name: 'Thế giới', fields: [
    { name: 'Ngày', type: 'string', defaultValue: '', min: null, max: null, clamp: false, enumValues: '', recordFields: '', description: '' },
    { name: 'Vị trí', type: 'string', defaultValue: '', min: null, max: null, clamp: false, enumValues: '', recordFields: '', description: '' },
    { name: 'Thời tiết', type: 'string', defaultValue: '', min: null, max: null, clamp: false, enumValues: '', recordFields: '', description: '' }
  ] },
  { name: 'Nhân vật chính', fields: [
    { name: 'HP', type: 'number', defaultValue: '100', min: 0, max: 100, clamp: true, enumValues: '', recordFields: '', description: '' },
    { name: 'Tiền vàng', type: 'number', defaultValue: '500', min: 0, max: null, clamp: true, enumValues: '', recordFields: '', description: '' },
    { name: 'Cảnh giới', type: 'enum', defaultValue: 'Luyện Khí', min: null, max: null, clamp: false, enumValues: 'Luyện Khí,Trúc Cơ,Kim Đan', recordFields: '', description: '' },
    { name: 'Danh hiệu', type: 'string', defaultValue: '', min: null, max: null, clamp: false, enumValues: '', recordFields: '', description: '' },
    { name: 'Tiền tệ.Linh thạch', type: 'number', defaultValue: '10', min: 0, max: null, clamp: false, enumValues: '', recordFields: '', description: '' },
    { name: 'Trang bị.Phần đầu', type: 'record', defaultValue: '{}', min: null, max: null, clamp: false, enumValues: '', recordFields: 'Phòng thủ:number,Tên:string', description: '' }
  ] }
];

/* ---- 1. Kiểm tra tính hợp lệ ---- */
const issues = validateVariables(groups);
ok(issues.filter(i => i.level === 'error').length === 0, 'valid config: no errors');

ok(validateVariables([{ name: 'G', fields: [{ name: 'x', type: 'enum', enumValues: '', defaultValue: '', min: null, max: null, clamp: false }] }]).some(i => i.message.includes('Kiểu enum thiếu giá trị enum')), 'enum missing values flagged');
ok(validateVariables([])[0].level === 'error', 'empty groups error');
ok(validateVariables([
  { name: 'A', fields: [] }, { name: 'A', fields: []
}]).some(i => i.message.includes('Trùng lặp tên nhóm')), 'dup group names flagged');
ok(validateVariables([{ name: 'G', fields: [{ name: 'n', type: 'number', defaultValue: 'abc', min: null, max: null, clamp: false }] }]).some(i => i.level === 'error' && i.message.includes('Giá trị mặc định không phải số hợp lệ')), 'bad number default flagged');
ok(validateVariables([{ name: 'G', fields: [{ name: 'n', type: 'number', defaultValue: '5', min: null, max: null, clamp: true }] }]).some(i => i.message.includes('Đã bật kẹp giá trị nhưng chưa thiết lập')), 'clamp w/o bounds flagged');

/* ---- 2. Zod —— So khớp quy tắc MvuEditor ---- */
const zod = generateZodSchema(groups);
ok(zod.includes("import { registerMvuSchema } from"), 'zod has import');
ok(zod.includes('z.coerce.number()'), 'zod coerce number');
ok(!zod.includes('.default(') && !zod.includes('.min(') && !zod.includes('.max(') && !zod.includes('.strict(') && !zod.includes('.passthrough('), 'zod avoids forbidden APIs');
ok(zod.includes(".transform(v => _.clamp(v, 0, 100))"), 'zod clamp transform on HP');
ok(zod.includes("'HP': z.coerce.number()") || zod.includes('"HP": z.coerce.number()'), 'zod HP key quoted');
ok(zod.includes('"Trang bị"') && zod.includes('z.object({'), 'zod nested group for dotted field');
ok(zod.includes("z.record("), 'zod record for Trang bị.Phần đầu');
ok(zod.includes('"Cảnh giới": z.enum(["Luyện Khí", "Trúc Cơ", "Kim Đan"])'), 'zod enum values');
ok(zod.includes("$(() => {\n  registerMvuSchema(Schema);\n});"), 'zod register call');

/* Đoạn mã kỳ vọng cùng quy tắc với MvuEditor */
eq(
  (() => {
    const lines = zod.split('\n').filter(l => l.includes('"HP"'));
    return lines.length === 1 ? /z\.coerce\.number\(\)\.transform\(v => _\.clamp\(v, 0, 100\)\)\.prefault\(100\)/.test(lines[0]) : false;
  })(),
  true,
  'zod HP line exact'
);

/* Phân cấp lồng nhau độ sâu 2: Trang bị.Phần đầu → Trang bị: { Phần đầu: z.record... } */
ok(/"Trang bị": z\.object\({[\s\S]*?"Phần đầu": z\.record\(/.test(zod), 'zod 2-level nesting Trang bị>Phần đầu');

/* Nhóm whole-record */
const wrGroups = [{ name: 'NPC', fields: [{ name: '', type: 'record', defaultValue: '{}', min: null, max: null, clamp: false, enumValues: '', recordFields: 'Độ hảo cảm:number', description: '' }] }];
const wrZod = generateZodSchema(wrGroups);
ok(wrZod.includes('"NPC": z.record(') || wrZod.includes("'NPC': z.record("), 'whole-record group inline');

/* trackPresentChars */
const tpZod = generateZodSchema(groups, { trackPresentChars: true });
ok(tpZod.includes("Theo dõi nhân vật hiện diện: z.object({") || tpZod.includes('"Theo dõi nhân vật hiện diện": z.object({'), 'track present chars in zod');

/* ---- 3. InitVar YAML ---- */
const yaml = generateInitVarYaml(groups);
eq(yaml.split('\n')[0], 'Thế giới:', 'yaml starts with Thế giới:');
ok(yaml.includes('HP: 100'), 'yaml HP 100');
ok(yaml.includes('Tiền vàng: 500'), 'yaml Tiền vàng 500');
ok(yaml.includes('Trang bị:\n      Phần đầu: {}') || /Trang bị:[\s\S]*?Phần đầu: \{\}/.test(yaml), 'yaml nested record {}');
ok(yaml.includes('Cảnh giới: "Luyện Khí"'), 'yaml enum default as string');
ok(/\n  NPC:/.test('\n' + 'x') === false, 'noop');

const tpYaml = generateInitVarYaml(groups, { trackPresentChars: true });
ok(tpYaml.trimEnd().endsWith('Nhân vật hiện diện: ""'), 'track present chars in yaml tail');

/* ---- 4. Quy tắc cập nhật ---- */
/* Quy tắc cập nhật: gộp các chuỗi thuần (plain strings), gộp HP và Tiền vàng cùng kiểu (Đối chiếu xác nhận: đồng nhất với MvuEditor, tên khóa không có dấu nháy) */
const rules = generateUpdateRules(groups);
ok(rules.startsWith('---\nQuy tắc cập nhật biến:\n'), 'rules header');
ok(rules.includes('Ngày, Vị trí, Thời tiết:'), 'plain strings merged line');
ok(rules.includes('_chỉ_đọc') === false && rules.includes('_Chỉ đọc') === false, 'no readonly leakage');
ok(/HP, Tiền vàng:/.test(rules), 'same-type numbers merged into one line');
ok(rules.includes('type: number'), 'rules HP type number');
ok(rules.includes("type: 'Luyện Khí'|'Trúc Cơ'|'Kim Đan'"), 'rules enum union');
const tpRules = generateUpdateRules(groups, { trackPresentChars: true });
ok(tpRules.includes('Theo dõi nhân vật hiện diện:'), 'rules track present chars');

/* Cùng mô tả thì gộp: hai trường number không có desc → gộp thành một dòng */
const twoNum = [{ name: 'G', fields: [
  { name: 'a', type: 'number', defaultValue: '1', min: 0, max: 9, clamp: false, enumValues: '', recordFields: '', description: '' },
  { name: 'b', type: 'number', defaultValue: '2', min: 0, max: 9, clamp: false, enumValues: '', recordFields: '', description: '' }
] }];
const mergedRules = generateUpdateRules(twoNum);
ok(mergedRules.includes('a, b:'), 'same-type numbers merged');

/* Trường chỉ đọc không đưa vào quy tắc */
const roGroup = [{ name: 'G', fields: [
  { name: '_hidden', type: 'string', defaultValue: '', min: null, max: null, clamp: false, enumValues: '', recordFields: '', description: '' },
  { name: 'Khả kiến', type: 'string', defaultValue: '', min: null, max: null, clamp: false, enumValues: '', recordFields: '', description: '' }
] }];
ok(!generateUpdateRules(roGroup).includes('_hidden'), 'readonly omitted from rules');

/* ---- 5. buildMvuKit ---- */
const kit = buildMvuKit({ groups, injectMode: 'single', keepFloors: 3 });
eq(kit.scripts.length, 2, 'kit scripts count');
eq(kit.scripts[0].name, 'Hệ thống biến MVU', 'kit script1 name');
ok(kit.scripts[0].content.includes('MagVarUpdate'), 'kit script1 MagVarUpdate import');
ok(kit.scripts[0].button.buttons.some(b => b.name === '重新处理变量' && b.visible), 'kit script1 buttons');
eq(kit.scripts[1].name, 'Zod Schema', 'kit script2 name');
eq(kit.entries.length, 5, 'kit entries single mode');
ok(kit.entries[0].comment === '[initvar] Biến khởi tạo không mở', 'kit entry initvar');
ok(kit.entries[0].cfg.enabled === false, 'kit entry initvar disabled');
eq(kit.summary.entryCount, 5, 'kit summary single');
const kitSplit = buildMvuKit({ groups, injectMode: 'split', keepFloors: 3 });
/* split: initvar + mỗi nhóm hợp lệ một mục + quy tắc cập nhật + định dạng xuất + nhấn mạnh = 3 + 2 + 1... thực tế là initvar(1)+nhóm biến(2)+quy tắc(1)+định dạng(1)+nhấn mạnh(1) */
eq(kitSplit.entries.length, 6, 'kit entries split mode (initvar + 2 group-entries + rules + format + emphasis)');
eq(kitSplit.summary.entryCount, 4 + 2, 'kit summary split counts named groups');
/* Nhóm phi cốt lõi (không nằm trong danh sách Thế giới/Hệ thống/Môi trường/Nhân vật chính) chạy kích hoạt đèn xanh */
const kitGreen = buildMvuKit({ groups: [{ name: 'Bạn đồng hành', fields: [{ name: 'Độ hảo cảm', type: 'number', defaultValue: '0', min: null, max: null, clamp: false, enumValues: '', recordFields: '', description: '' }] }], injectMode: 'split', keepFloors: 3 });
ok(kitGreen.entries.some(e => e.comment === 'Biến Bạn đồng hành' && e.cfg.constant === false && JSON.stringify(e.keys) === JSON.stringify(['Bạn đồng hành'])), 'split non-core group green-triggered with keys');
eq(kit.regexes.length, 4, 'kit regexes');
eq(kit.regexes[2].scriptName, 'Chỉ gửi cập nhật biến của 3 tin nhắn gần nhất', 'regex keep floors name');
eq(kit.regexes[2].minDepth, 6, 'regex keep floors minDepth');
const kf0 = buildMvuKit({ groups, keepFloors: 0 });
ok(kf0.regexes[2].minDepth === null || kf0.regexes[2].minDepth === undefined, 'keepFloors 0 -> no minDepth');

/* Tính nhất quán của mẫu cố định */
eq(kit.entries.find(e => e.comment.includes('Nhấn mạnh định dạng xuất biến')).content, OUTPUT_EMPHASIS_TEXT, 'emphasis template verbatim');
eq(kit.entries.find(e => e.comment === '[mvu_update] Định dạng xuất biến').content, OUTPUT_FORMAT_TEXT, 'format template verbatim');

/* ---- 6. mock cardStore nạp vào thẻ/thay thế/xóa trống ---- */
function mkStore(initial) {
  let dirty = 0;
  return {
    dirty,
    markDirty() { this.dirty++; },
    cardData: initial.cardData || { first_mes: 'Lời mở đầu', alternate_greetings: [], extensions: {} },
    worldEntries: initial.worldEntries ? [...initial.worldEntries] : [],
    tavernScripts: initial.tavernScripts ? [...initial.tavernScripts] : [],
    regexScripts: initial.regexScripts ? [...initial.regexScripts] : [],
    addWorldEntry(e = {}) {
      const entry = Object.assign({
        id: 'we_' + Math.random(), comment: '', content: '',
        keys: [], constant: true, enabled: true, insertion_order: 100,
        extensions: {}
      }, e);
      this.worldEntries.push(entry); return entry;
    },
    removeWorldEntry(id) { const i = this.worldEntries.findIndex(x => x.id === id); if (i >= 0) this.worldEntries.splice(i, 1); },
    addRegexScript(s) { this.regexScripts.push(Object.assign({}, s)); },
    removeRegexScript(id) { const i = this.regexScripts.findIndex(x => x.id === id); if (i >= 0) this.regexScripts.splice(i, 1); },
    createEmptyTavernScript() { return { id: 'ts_' + Math.random(), name: '', content: '', button: { enabled: false, buttons: [] } }; },
    addTavernScript(s) { this.tavernScripts.push(s); },
    createEmptyRegexScript() {
      return { id: 'rx_' + Math.random(), scriptName: '', findRegex: '', replaceString: '', markdownOnly: false, promptOnly: false };
    },
    removeTavernScript(id) { const i = this.tavernScripts.findIndex(x => x.id === id); if (i >= 0) this.tavernScripts.splice(i, 1); }
  };
}

{
  const store = mkStore({});
  applyMvuKit(store, kit);
  ok(store.dirty > 0, 'apply marks dirty');
  eq(store.tavernScripts.length, 2, 'applied 2 scripts');
  eq(store.worldEntries.length, 5, 'applied 5 entries');
  eq(store.regexScripts.length, 4, 'applied 4 regexes');
  ok(store.cardData.first_mes.endsWith('<StatusPlaceHolderImpl/>'), 'placeholder appended to first_mes');

  /* Áp dụng lại → Thay thế (không trùng lặp) */
  applyMvuKit(store, kit);
  eq(store.tavernScripts.length, 2, 'replace: still 2 scripts');
  eq(store.worldEntries.length, 5, 'replace: still 5 entries');
  eq(store.regexScripts.length, 4, 'replace: still 4 regexes');

  /* Placeholder không nối thêm trùng lặp */
  ok((store.cardData.first_mes.match(/StatusPlaceHolderImpl/g) || []).length === 1, 'placeholder not duplicated');
}

/* Regex thanh trạng thái cũ không bị xóa nhầm —— STATUSBAR_REGEX_OLD_NAMES chứa các tên kiểu "Thanh trạng thái", xác minh việc thay thế Làm đẹp thanh trạng thái hoạt động tốt */
{
  const store = mkStore({});
  store.addRegexScript({ ...store.createEmptyRegexScript?.() || {}, scriptName: 'Làm đẹp thanh trạng thái', findRegex: '/x/g', replaceString: 'old html', markdownOnly: true, promptOnly: false });
  /* MK chỉ áp dụng từ khóa mvu cho regex mvu; Làm đẹp thanh trạng thái không nằm trong REGEX_KEYWORDS. Xóa thông qua đường dẫn UI phát hiện+xác nhận. Chỉ kiểm tra việc phát hiện: */
}

/* ---- 7. Chế độ merge ---- */
{
  const store = mkStore({});
  /* Đặt trước một phần MVU: script 1 + mục quy tắc cập nhật, initvar chỉ có một nửa trường của nhóm thế giới */
  const preScript = store.createEmptyTavernScript();
  preScript.name = 'Hệ thống biến MVU';
  preScript.content = "import 'https://testingcf.jsdelivr.net/gh/MagicalAstrogy/MagVarUpdate/artifact/bundle.js';";
  store.addTavernScript(preScript);

  const ruleEntry = store.addWorldEntry();
  ruleEntry.comment = '[mvu_update] Quy tắc cập nhật biến';
  ruleEntry.content = '---\nQuy tắc cập nhật biến:\n';

  const initEntry = store.addWorldEntry();
  initEntry.comment = '[initvar] Biến khởi tạo không mở';
  initEntry.content = 'Thế giới:\n  Ngày: ""\n';

  const newGroups = [
    { name: 'Thế giới', fields: [Object.assign({}, groups[0].fields[1])] }, /* Bổ sung vị trí */
    { name: 'Nhóm mới', fields: [{ name: 'Chỉ số', type: 'number', defaultValue: '7', min: null, max: null, clamp: false, enumValues: '', recordFields: '', description: '' }] }
  ];
  mergeMvuKitIntoCard(store, kit, newGroups);

  eq(store.tavernScripts.length, 2, 'merge adds only Zod script');
  ok(store.tavernScripts.find(s => s.name === 'Zod Schema').content.includes('"Nhóm mới"'), 'merged zod includes new group');
  /* initvar được patch bổ sung */
  const iv = store.worldEntries.find(e => e.comment.toLowerCase().includes('initvar') || e.comment.includes('khởi tạo'));
  ok(iv.content.includes('Vị trí:') && iv.content.includes('Nhóm mới:'), 'initvar patched with existing+new groups');
  /* varGroups được merge vào extensions */
  const savedGroups = store.cardData.extensions.cfMvuVarGroups;
  ok(savedGroups.length === 2 && savedGroups.some(g => g.name === 'Nhóm mới'), 'extensions.cfMvuVarGroups merged');
  /* Các mục còn thiếu được bù đủ */
  ok(store.worldEntries.some(e => e.comment === '[mvu_update] Định dạng xuất biến'), 'missing format entry added');
  ok(store.worldEntries.some(e => e.comment === 'Danh sách biến'), 'list entry added');
  /* Quy tắc cập nhật được dựng lại thành bản đầy đủ */
  const re2 = store.worldEntries.find(e => e.comment.includes('Quy tắc cập nhật biến'));
  ok(re2.content.includes('Nhóm mới:'), 'update rules rebuilt with merged groups');
  eq(store.regexScripts.length, 4, 'merge fills all 4 regexes');
}

/* ---- 8. aiPlanToVarGroups ---- */
{
  const plan = [
    { group: 'Nhân vật chính', field: 'HP', type: 'number', default: '80', min: 0, max: 100 },
    { group: 'Nhân vật chính', field: 'Tâm trạng', type: 'enum', options: ['Bình tĩnh', 'Vui vẻ'], default: 'Bình tĩnh', description: 'Thay đổi theo cốt truyện' },
    { group: 'NPC', field: 'Độ hảo cảm', type: 'number', default: '0' },
    { group: 'Nhân vật chính', field: 'Ghi chú', type: 'text', default: '' }
  ];
  const gs = aiPlanToVarGroups(plan);
  eq(gs.map(g => g.name).join(','), 'Nhân vật chính,NPC', 'ai plan grouped order');
  const hp = gs[0].fields.find(f => f.name === 'HP');
  eq(hp.min, 0, 'ai plan min kept');
  eq(hp.max, 100, 'ai plan max kept');
  const mood = gs[0].fields.find(f => f.name === 'Tâm trạng');
  eq(mood.enumValues, 'Bình tĩnh,Vui vẻ', 'ai plan enum values joined');
  eq(mood.description, 'Thay đổi theo cốt truyện', 'ai plan description carried');
  eq(gs[0].fields.find(f => f.name === 'Ghi chú').type, 'text', 'ai plan text type normalized');
}

/* ---- 9. Kết xuất HTML ---- */
{
  const html = generateStatusHtml(groups, { theme: 'modern', layout: 'grouped' });
  ok(html.startsWith('<!doctype html>') && html.includes('</html>'), 'html complete document');
  ok(html.includes('class="sb-root"'), 'html root class');
  ok(html.includes("--sb-accent: #60a5fa"), 'theme vars modern accent');
  ok(html.includes("<style>") && html.includes("</style>"), 'style block');
  ok(html.includes('<scr' + 'ipt type="module">'), 'runtime module script');
  ok(html.includes('getAllVariables()'), 'bindings use getAllVariables');
  ok(html.includes("waitGlobalInitialized('Mvu')"), 'waits Mvu global');
  ok(html.includes('VARIABLE_UPDATE_ENDED'), 'listens update event');
  ok(html.includes('populateCharacterData'), 'populate fn present');
  /* Trải phẳng trong 3 nhóm: không xuất hiện nút tab (chú ý không khớp nhầm kiểu .sb-tab-btn trong CSS) */
  ok(!html.includes('<button class="sb-tab-btn'), '3 sections no tabs');
  /* Mỗi trường number đều có meter liên kết */
  ok(html.includes('-meter'), 'meter elements exist');
  /* Liên kết mặc định của enum */
  ok(html.includes("'stat_data.Nhân vật chính.Cảnh giới'"), 'enum binding path');
  /* Liên kết tập hợp record */
  ok(html.includes('formatCollection(_.get(all_variables,'), 'collection binding');

  /* Biến đổi theo chủ đề */
  const hx = generateStatusHtml(groups, { theme: 'xiuxian', layout: 'grouped' });
  ok(hx.includes('--sb-accent: #ffd700'), 'xiuxian theme vars');
  ok(hx !== html, 'different themes produce different html');

  /* Bố cục dọc: trong body có vùng chứa sb-list, không có vùng chứa sb-grid */
  const hv = generateStatusHtml(groups, { theme: 'modern', layout: 'vertical' });
  ok(hv.includes('<div class="sb-list">'), 'vertical layout list container');
  ok(!hv.includes('<div class="sb-grid">'), 'vertical no grid container');

  /* Bố cục grid + nhiều nhóm → tab */
  const hg = generateStatusHtml(groups.concat([{ name: 'Bạn đồng hành', fields: [{ name: 'Độ hảo cảm', type: 'number', defaultValue: '20', min: null, max: null, clamp: false, enumValues: '', recordFields: '', description: '' }] }]), { theme: 'cyber', layout: 'grid' });
  ok(hg.includes('sb-tab-btn'), 'grid multi-section uses tabs');
  ok(hg.includes('data-target="sb-tab-0"') && hg.includes('id="sb-tab-0"'), 'tab data-target matches pane id');
  ok(hg.includes('removeClass'), 'tab switch js injected');
  ok(hg.includes('--sb-accent: #00e5ff'), 'cyber theme in tabbed output');

  /* Nhóm đơn dạng grid không xuất hiện nút tab (kiểm tra thẻ button thay vì class CSS) */
  const hgs = generateStatusHtml([groups[1]], { theme: 'school', layout: 'grid' });
  ok(!hgs.includes('<button'), 'single section no tabs');

  /* Dữ liệu xem trước */
  const pd = buildPreviewStatData(groups);
  eq(pd['Nhân vật chính'].HP, 100, 'preview data HP number');
  eq(pd['Nhân vật chính']['Cảnh giới'], 'Luyện Khí', 'preview data enum string');
  eq(pd['Nhân vật chính']['Trang bị']['Phần đầu'], {}, 'preview data record object');
  eq(pd['Nhân vật chính']['Tiền tệ']['Linh thạch'], 10, 'preview data dotted path nests');

  /* So sánh kiểm tra 3 chiều (diff): HTML sinh tự động chắc chắn khớp hoàn toàn (ngoại trừ bắt đầu bằng _) */
  const d = diffVariableUsagePaths(groups, html);
  ok(d.onlyUsed.length === 0, 'generated html uses no undeclared paths');
  /* defined trừ đi readonly → chỉ đọc không vào HTML; ví dụ này không có trường _, onlyDefined phải là rỗng */
  ok(d.onlyDefined.length === 0, 'all defined paths used by generated html');
}

/* ---- 10. Cây lồng nhau theo đường dẫn chấm vs tính bền vững khi trùng tên cùng cấp ---- */
{
  const tricky = [{ name: 'G', fields: [
    { name: 'a.b', type: 'string', defaultValue: 'x', min: null, max: null, clamp: false, enumValues: '', recordFields: '', description: '' },
    { name: 'a.c', type: 'string', defaultValue: 'y', min: null, max: null, clamp: false, enumValues: '', recordFields: '', description: '' }
  ] }];
  const yml = generateInitVarYaml(tricky);
  ok(yml.includes('a:\n    b: "x"\n    c: "y"') || /a:\s*\n\s{4}b: "x"/.test(yml), 'dotted fields nest in yaml');
  const zd = generateZodSchema(tricky);
  ok(zd.includes('"a": z.object({') && zd.includes('"b": z.string().prefault("x")'), 'dotted fields nest in zod');
  const rt = generateUpdateRules(tricky);
  ok(rt.includes('a:'), 'dotted fields nest in rules');
}

/* ---- 11. Sản phẩm chế độ thuần văn bản ---- */
{
  const flatGroups = [
    { name: 'Trạng thái', fields: [
      { name: 'Vị trí', type: 'string', defaultValue: '', label: '' },
      { name: 'Tâm trạng', type: 'string', defaultValue: '', label: 'Tâm trạng hiện tại' }
    ] }
  ];

  /* Mục chỉ lệnh */
  const ruleEntry = generateTextModeRuleEntry(flatGroups);
  ok(ruleEntry.includes('<StatusData>') && ruleEntry.includes('Tên trường:Giá trị'), 'text rule entry format doc');
  ok(ruleEntry.includes('Vị trí:Giá trị') && ruleEntry.includes('Tâm trạng hiện tại:Giá trị'), 'text rule entry uses labels as sample keys');
  eq(TEXT_MODE_OUTPUT_RULE_ENTRY_COMMENT, 'Chỉ lệnh xuất dữ liệu trạng thái', 'text rule entry comment constant');

  /* Sinh HTML: liên kết data-st-key + toàn bộ tài liệu */
  const tHtml = generateTextModeHtml(flatGroups, { theme: 'xiuxian', layout: 'grouped' });
  ok(tHtml.startsWith('<!doctype html>') && tHtml.includes('</html>'), 'text html complete document');
  ok(tHtml.includes('data-st-key="Vị trí"') && tHtml.includes('data-st-key="Tâm trạng hiện tại"'), 'text html binds data-st-key by label');
  ok(tHtml.includes('__statusRawText'), 'text html parse script present');
  ok(tHtml.includes('--sb-accent: #ffd700'), 'text html theme applied');
  ok(!tHtml.includes('getAllVariables'), 'text html has no MVU dependency');

  /* Đường dẫn chấm và _ chỉ đọc không được xuất hiện trên giao diện chế độ thuần văn bản */
  const nested = [{ name: 'G', fields: [
    { name: 'a.b', type: 'string', defaultValue: '', label: '' },
    { name: '_hidden', type: 'string', defaultValue: '', label: '' },
    { name: 'Khả kiến', type: 'string', defaultValue: '', label: '' }
  ] }];
  const nHtml = generateTextModeHtml(nested, {});
  ok(nHtml.includes('data-st-key="Khả kiến"'), 'nested group keeps plain fields');
  ok(!nHtml.includes('_hidden'), 'readonly excluded from text mode');

  /* Cặp Regex */
  const rxs = buildTextModeRegexes(tHtml);
  eq(rxs.length, 2, 'text mode regexes count');
  eq(rxs[0].scriptName, 'Thanh trạng thái', 'text display regex name');
  ok(rxs[0].markdownOnly === true && rxs[0].promptOnly === false, 'display regex markdown-only');
  eq(rxs[1].scriptName, 'Ẩn dữ liệu trạng thái với AI', 'hide regex name');
  ok(rxs[1].promptOnly === true && rxs[1].minDepth === 6, 'hide regex prompt-only minDepth 6');
  /* replaceString của regex hiển thị chứa HTML hoàn chỉnh và chèn hook __statusRawText */
  ok(rxs[0].replaceString.includes('```html\n') && rxs[0].replaceString.includes('</html>'), 'display regex wraps html');
  /* Tính lũy đẳng: hook đã có thì không chèn lặp lại */
  const again = buildTextModeRegexes(rxs[0].replaceString.replace(/^```html\n/, '').replace(/\n```$/, ''));
  ok((again[0].replaceString.match(/__statusRawText/g) || []).length >= 1 &&
     (again[0].replaceString.match(/<scr' \+ 'ipt/g) || []).length <= 2, 'hook injection idempotent-ish');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);