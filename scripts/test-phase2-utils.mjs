import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const temp = mkdtempSync(join(tmpdir(), 'phase2-utils-'));
process.on('exit', () => rmSync(temp, { recursive: true, force: true }));

async function loadUtility(name) {
  const source = readFileSync(join(here, `../src/renderer/utils/${name}.js`), 'utf8');
  const target = join(temp, `${name}.mjs`);
  writeFileSync(target, source);
  return import(pathToFileURL(target));
}

const { parseAiJsonObject } = await loadUtility('json-repair');
assert.deepEqual(parseAiJsonObject('```json\n{“name”:“A Thanh”,“tags”:[“a”,],}\n```'), { name: 'A Thanh', tags: ['a'] });
assert.deepEqual(parseAiJsonObject('{"text":"Dòng 1\nDòng 2"}'), { text: 'Dòng 1\nDòng 2' });
assert.throws(() => parseAiJsonObject('not json'), /định dạng ai trả về bất thường|không tìm thấy đối tượng json|未找到 JSON 对象/i);

const { buildCardContext } = await loadUtility('card-context');
const cardStore = {
  cardData: { name: 'Nhân vật kiểm thử', description: 'Mô tả'.repeat(500), personality: '', scenario: '', first_mes: '' },
  worldEntries: Array.from({ length: 80 }, (_, index) => ({
    enabled: true, constant: true, comment: `Mục ${index}`, keys: [], content: 'Thiết lập'.repeat(800)
  })),
  regexScripts: [], tavernScripts: []
};
const small = buildCardContext(cardStore, '', { modelContextTokens: 16000 });
const large = buildCardContext(cardStore, '', { modelContextTokens: 128000 });
assert.ok(small.length < large.length, 'larger model window should receive a larger card context');
assert.ok(small.length < 9000, 'small context stays inside its protected budget');
assert.ok(large.length < 50000, 'large context stays below the 48k character cap plus headings');

console.log('Phase 2 utils: Sửa lỗi JSON và ngân sách ngữ cảnh động đã vượt qua kiểm thử');