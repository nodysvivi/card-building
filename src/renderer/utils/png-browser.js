// Đọc/ghi dữ liệu thẻ nhân vật (chunk tEXt "chara"/"ccv3") trực tiếp trong PNG
// bằng JS thuần, không phụ thuộc Node.js — dùng cho bản chạy trên trình duyệt (web).
// Chuyển thể từ bản gốc SillyTavern CardForge (web/src/utils/png-utils.js).

const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

/** Đọc dữ liệu thẻ nhân vật từ ArrayBuffer của một file PNG */
export function readPngCardData(arrayBuffer) {
  const data = new Uint8Array(arrayBuffer);
  const chunks = extractChunks(data);

  for (const key of ['ccv3', 'chara']) {
    for (const chunk of chunks) {
      if (chunk.type !== 'tEXt') continue;
      const sepIdx = chunk.data.indexOf(0);
      if (sepIdx === -1) continue;
      const keyword = uint8ArrayToString(chunk.data.slice(0, sepIdx));
      if (keyword !== key) continue;
      const value = uint8ArrayToString(chunk.data.slice(sepIdx + 1));
      try {
        const jsonStr = base64ToUtf8(value);
        return JSON.parse(jsonStr);
      } catch (e) {
        // thử chunk/keyword tiếp theo
      }
    }
  }
  return null;
}

/** Nhúng dữ liệu thẻ nhân vật (JSON) vào một PNG, trả về ArrayBuffer PNG mới */
export function writePngCardData(sourceArrayBuffer, cardJson) {
  const bytes = new Uint8Array(sourceArrayBuffer);
  const chunks = extractChunks(bytes);

  // Bỏ các chunk tEXt "chara"/"ccv3" cũ (nếu có)
  const filtered = chunks.filter(c => {
    if (c.type !== 'tEXt') return true;
    const sepIdx = c.data.indexOf(0);
    if (sepIdx === -1) return true;
    const keyword = uint8ArrayToString(c.data.slice(0, sepIdx));
    return keyword !== 'chara' && keyword !== 'ccv3';
  });

  const jsonStr = JSON.stringify(cardJson);
  const base64Value = utf8ToBase64(jsonStr);
  const charaChunk = { type: 'tEXt', data: buildKeywordChunk('chara', base64Value) };

  const iendIdx = filtered.findIndex(c => c.type === 'IEND');
  if (iendIdx !== -1) filtered.splice(iendIdx, 0, charaChunk);
  else filtered.push(charaChunk);

  return encodeChunks(filtered);
}

function buildKeywordChunk(keyword, value) {
  const keywordBytes = stringToUint8Array(keyword);
  const valueBytes = stringToUint8Array(value);
  const out = new Uint8Array(keywordBytes.length + 1 + valueBytes.length);
  out.set(keywordBytes, 0);
  out[keywordBytes.length] = 0;
  out.set(valueBytes, keywordBytes.length + 1);
  return out;
}

function extractChunks(data) {
  const chunks = [];
  let offset = 8; // bỏ qua signature PNG
  while (offset < data.length) {
    const length = readUint32(data, offset);
    const type = uint8ArrayToString(data.slice(offset + 4, offset + 8));
    const chunkData = data.slice(offset + 8, offset + 8 + length);
    chunks.push({ type, data: chunkData });
    offset += 12 + length;
  }
  return chunks;
}

function encodeChunks(chunks) {
  const parts = [PNG_SIGNATURE];
  for (const chunk of chunks) {
    const typeBytes = stringToUint8Array(chunk.type);
    const lengthBytes = writeUint32(chunk.data.length);
    const crcInput = new Uint8Array(4 + chunk.data.length);
    crcInput.set(typeBytes, 0);
    crcInput.set(chunk.data, 4);
    const crcBytes = writeUint32(crc32(crcInput));
    parts.push(lengthBytes, typeBytes, chunk.data, crcBytes);
  }
  let totalLength = 0;
  for (const p of parts) totalLength += p.length;
  const result = new Uint8Array(totalLength);
  let pos = 0;
  for (const p of parts) { result.set(p, pos); pos += p.length; }
  return result.buffer;
}

function readUint32(data, offset) {
  return (data[offset] << 24) | (data[offset + 1] << 16) | (data[offset + 2] << 8) | data[offset + 3];
}
function writeUint32(value) {
  return new Uint8Array([(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff]);
}
function uint8ArrayToString(arr) {
  let s = '';
  for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
  return s;
}
function stringToUint8Array(str) {
  const arr = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) arr[i] = str.charCodeAt(i);
  return arr;
}
function base64ToUtf8(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder('utf-8').decode(bytes);
}
function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

const crc32Table = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c;
  }
  return table;
})();
function crc32(data) {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) crc = crc32Table[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

export function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}
