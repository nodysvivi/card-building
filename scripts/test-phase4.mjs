import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const temp = mkdtempSync(join(tmpdir(), 'phase4-'));
process.on('exit', () => rmSync(temp, { recursive: true, force: true }));
const target = join(temp, 'normalizer.mjs');
writeFileSync(target, readFileSync(join(here, '../src/renderer/utils/world-entry-normalizer.js'), 'utf8'));
const { normalizeNewWorldEntry } = await import(pathToFileURL(target));

const normalized = normalizeNewWorldEntry({
  keys: [' A Thanh ', 'A Thanh', ''], secondary_keys: ['Bạn đồng hành'], constant: false,
  position: 'invalid', insertion_order: '120', extensions: { probability: 130, depth: -2, cooldown: -1 }
}, { source: 'ai' });
assert.deepEqual(normalized.keys, ['A Thanh']);
assert.equal(normalized.selective, true);
assert.equal(normalized.position, 'after_char');
assert.equal(normalized.insertion_order, 120);
assert.equal(normalized.extensions.probability, 100);
assert.equal(normalized.extensions.depth, 0);
assert.equal(normalized.extensions.cooldown, 0);
assert.equal(normalized.extensions.exclude_recursion, true);
assert.equal(normalized.extensions.prevent_recursion, true);
assert.equal(normalized.extensions.cfGeneratedSource, 'ai');

const constant = normalizeNewWorldEntry({ constant: true, extensions: {} });
assert.equal(constant.extensions.prevent_recursion, false);
console.log('Phase 4: Chuẩn hóa an toàn mục Worldbook đã vượt qua kiểm thử');