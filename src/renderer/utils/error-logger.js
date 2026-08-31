// Bắt lỗi tiến trình kết xuất — Bản desktop
// Bắt lỗi xong gửi qua IPC cho tiến trình chính ghi file, đồng thời lưu bộ đệm vòng cục bộ để UI xem tức thì (không cần đợi IPC)

const MAX_BUFFER = 200;
const buffer = []; // { time, source, type, message, stack, extra }

function pushBuffer(entry) {
  buffer.push(entry);
  if (buffer.length > MAX_BUFFER) buffer.shift();
}

function buildEntry(type, message, stack, extra) {
  return {
    time: new Date().toISOString(),
    source: 'renderer',
    type,
    message: String(message || ''),
    stack: stack ? String(stack) : '',
    extra: extra || null
  };
}

async function sendToMain(entry) {
  try {
    if (window.cardForgeAPI && window.cardForgeAPI.appendErrorLog) {
      await window.cardForgeAPI.appendErrorLog(entry);
    }
  } catch (e) {
    // Bỏ qua để tránh lặp vô hạn
  }
}

function record(type, message, stack, extra) {
  const entry = buildEntry(type, message, stack, extra);
  pushBuffer(entry);
  sendToMain(entry);
}

// API công khai: Ghi thủ công một mục
function logManual(message, extra) {
  record('manual', message, '', extra);
}

// Bọc console.error — Giữ nguyên hành vi gốc đồng thời ghi log
function patchConsoleError() {
  const original = console.error.bind(console);
  console.error = function (...args) {
    try {
      const msg = args.map(a => {
        if (a instanceof Error) return a.message;
        if (typeof a === 'object') {
          try { return JSON.stringify(a); } catch (e) { return String(a); }
        }
        return String(a);
      }).join(' ');
      const stack = args.find(a => a instanceof Error)?.stack || '';
      record('console.error', msg, stack);
    } catch (e) {}
    original(...args);
  };
}

function install() {
  // Bắt ngoại lệ đồng bộ
  window.addEventListener('error', (event) => {
    const err = event.error;
    record('window.error', event.message || (err && err.message), err && err.stack, {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno
    });
  });

  // Bắt Promise rejection chưa được xử lý
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const msg = reason && reason.message ? reason.message : String(reason);
    const stack = reason && reason.stack ? reason.stack : '';
    record('unhandledRejection', msg, stack);
  });

  // Xử lý lỗi Vue — Được gọi từ app.config.errorHandler trong main.js
  patchConsoleError();
}

function logVueError(err, instance, info) {
  const msg = err && err.message ? err.message : String(err);
  const stack = err && err.stack ? err.stack : '';
  record('vue', msg, stack, { hookInfo: info });
}

function getBuffer() {
  return buffer.slice();
}

function clearBuffer() {
  buffer.length = 0;
}

export default {
  install,
  logManual,
  logVueError,
  getBuffer,
  clearBuffer
};