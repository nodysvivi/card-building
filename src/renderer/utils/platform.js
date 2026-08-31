// Phát hiện môi trường chạy (Electron desktop hay trình duyệt/web) và cung cấp
// một bản triển khai window.cardForgeAPI THẬT cho web (không chỉ là stub báo lỗi):
// - Chọn/đọc/ghi file dùng <input type=file> + tải xuống (download) của trình duyệt
// - Đọc/ghi dữ liệu thẻ nhân vật trong PNG bằng JS thuần (utils/png-browser.js)
// - Cài đặt lưu vào localStorage thay cho file settings.json
//
// File này PHẢI được import sớm nhất có thể trong main.js (trước khi mount App).

import { readPngCardData, writePngCardData, arrayBufferToBase64 } from './png-browser.js';
import * as aiServiceBrowser from './ai-service-browser.js';

const hasElectronApi = typeof window !== 'undefined' && !!window.cardForgeAPI && window.cardForgeAPI.isElectron === true;

const NOT_AVAILABLE_WEB = 'Tính năng này chưa hỗ trợ trên bản web.';

function fail(error) {
  return { success: false, error };
}

// ---------------------------------------------------------------------------
// Cài đặt (localStorage thay cho file settings.json trên đĩa)
// ---------------------------------------------------------------------------
const WEB_SETTINGS_KEY = 'cardbuilding:web-settings';

function loadWebSettings() {
  try {
    const raw = localStorage.getItem(WEB_SETTINGS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}
function saveWebSettings(settings) {
  try {
    localStorage.setItem(WEB_SETTINGS_KEY, JSON.stringify(settings || {}));
    return { success: true };
  } catch (e) {
    return fail(e.message);
  }
}

// ---------------------------------------------------------------------------
// "Hệ thống file ảo": trình duyệt không cho JS truy cập đường dẫn thật trên máy,
// nên khi người dùng chọn 1 file qua <input type=file>, ta lưu tạm File object đó
// trong bộ nhớ (Map) và cấp một "đường dẫn giả" (webfile://<id>/<tên file gốc>)
// để phần còn lại của ứng dụng (vốn được viết cho Electron) vẫn hoạt động bình
// thường mà không cần sửa logic ở các view/store.
// Giới hạn: đường dẫn giả này chỉ tồn tại trong phiên làm việc hiện tại (mất khi
// tải lại trang), và "lưu nhanh vào file gốc" trên web sẽ tải xuống file mới thay
// vì ghi đè file gốc (trình duyệt không cho phép ghi đè file tuỳ ý trên máy).
// ---------------------------------------------------------------------------
const virtualFiles = new Map(); // đường dẫn giả -> File

function registerVirtualFile(file) {
  const id = 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const path = `webfile://${id}/${file.name}`;
  virtualFiles.set(path, file);
  return path;
}

function pickFile(accept) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    if (accept) input.accept = accept;
    input.style.display = 'none';
    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      document.body.removeChild(input);
      resolve(file || null);
    }, { once: true });
    document.body.appendChild(input);
    input.click();
  });
}

function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('Đọc file thất bại'));
    reader.readAsArrayBuffer(file);
  });
}
function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('Đọc file thất bại'));
    reader.readAsText(file);
  });
}

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

function basename(path) {
  return String(path || '').split('/').pop();
}

// ---------------------------------------------------------------------------
// Shim cardForgeAPI cho web
// ---------------------------------------------------------------------------
const webShim = {
  isElectron: false,

  minimize: () => {},
  maximize: () => {},
  close: () => {},
  isMaximized: async () => false,

  openFile: async () => {
    const file = await pickFile('.png,.json,image/png,application/json');
    return file ? registerVirtualFile(file) : null;
  },
  openImage: async () => {
    const file = await pickFile('.png,.jpg,.jpeg,.webp,image/*');
    return file ? registerVirtualFile(file) : null;
  },
  saveFile: async (options) => options?.defaultPath || 'character.png',
  selectDirectory: async () => null,

  readFile: async (path) => {
    const file = virtualFiles.get(path);
    if (!file) return fail('Không tìm thấy file trong phiên làm việc (có thể trang đã tải lại) — hãy chọn lại file.');
    try {
      const buf = await readFileAsArrayBuffer(file);
      return { success: true, data: arrayBufferToBase64(buf), isBuffer: true };
    } catch (e) { return fail(e.message); }
  },
  readTextFile: async (path) => {
    const file = virtualFiles.get(path);
    if (!file) return fail('Không tìm thấy file trong phiên làm việc (có thể trang đã tải lại) — hãy chọn lại file.');
    try {
      const text = await readFileAsText(file);
      return { success: true, data: text };
    } catch (e) { return fail(e.message); }
  },
  writeFile: async (path, data, encoding) => {
    try {
      const blob = encoding === 'base64'
        ? new Blob([Uint8Array.from(atob(data), c => c.charCodeAt(0))])
        : new Blob([data], { type: 'text/plain' });
      downloadBlob(basename(path), blob);
      return { success: true };
    } catch (e) { return fail(e.message); }
  },
  fileExists: async (path) => virtualFiles.has(path),

  extractCharaData: async (path) => {
    const file = virtualFiles.get(path);
    if (!file) return fail('Không tìm thấy file trong phiên làm việc (có thể trang đã tải lại) — hãy chọn lại file.');
    try {
      const buf = await readFileAsArrayBuffer(file);
      const data = readPngCardData(buf);
      if (!data) return fail('File PNG này không chứa dữ liệu thẻ nhân vật');
      return { success: true, data };
    } catch (e) { return fail(e.message); }
  },
  embedCharaData: async (pngPath, cardJson, outputPath) => {
    const file = virtualFiles.get(pngPath);
    if (!file) return fail('Không tìm thấy ảnh bìa nguồn trong phiên làm việc (có thể trang đã tải lại) — hãy chọn lại ảnh bìa.');
    try {
      const buf = await readFileAsArrayBuffer(file);
      const outBuf = writePngCardData(buf, cardJson);
      downloadBlob(basename(outputPath) || 'character.png', new Blob([outBuf], { type: 'image/png' }));
      return { success: true };
    } catch (e) { return fail(e.message); }
  },

  // Lưu ý: giống hệt shape trả về của Electron ('settings:load' trả thẳng object
  // settings, không bọc {success, settings}) — apiStore/appStore/cardStore đều
  // đọc trực tiếp settings.apiProviders, settings.theme, v.v.
  loadSettings: async () => loadWebSettings(),
  saveSettings: async (settings) => saveWebSettings(settings),

  // AI: gọi thẳng fetch() từ trình duyệt tới API của provider — không qua IPC
  // nữa nên còn đơn giản hơn bản Electron (onChunk truyền thẳng, không cần
  // dựng kênh sự kiện riêng).
  aiChat: async (payload, onChunk) => {
    try {
      const result = await aiServiceBrowser.chat(payload, payload?.options?.stream ? onChunk : null);
      return { success: true, ...result };
    } catch (error) {
      return fail(error?.message || String(error));
    }
  },
  cancelAiRequest: async (requestId) => ({ success: aiServiceBrowser.cancel(requestId) }),
  fetchAiModels: async (provider) => {
    try {
      return { success: true, models: await aiServiceBrowser.fetchModels(provider) };
    } catch (error) {
      return { success: false, error: error?.message || String(error), models: [] };
    }
  },

  openExternal: (url) => { try { window.open(url, '_blank', 'noopener'); } catch (e) {} },

  getResourcePath: async () => '',

  readErrorLog: async () => ({ success: true, entries: [], dir: '' }),
  appendErrorLog: async () => ({ success: true }),
  clearErrorLog: async () => ({ success: true }),
  openLogFolder: async () => fail(NOT_AVAILABLE_WEB),

  checkForUpdates: async () => fail(NOT_AVAILABLE_WEB),
  getAppVersion: async () => ''
};

if (typeof window !== 'undefined' && !hasElectronApi) {
  window.cardForgeAPI = webShim;
}

export const isElectron = hasElectronApi;
