const { app, BrowserWindow, ipcMain, dialog, shell, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const logger = require('./logger');
const aiService = require('./ai-service');
const { autoUpdater } = require('electron-updater');

const isDev = process.env.NODE_ENV === 'development';

// Công tắc tự động cập nhật: CardBuilding chưa cấu hình nguồn cập nhật riêng (nguồn GitHub cũ của CardForge đã bị ngắt).
// Sau khi cấu hình mục tiêu publish mới chuyển thành true là có thể khôi phục cập nhật tự động.
const ENABLE_AUTO_UPDATE = false;

// Bắt lỗi toàn cục của tiến trình chính — Bắt buộc phải đăng ký trước app.whenReady
logger.installGlobalHandlers();

let mainWindow;

// ============ Cập nhật tự động ============
autoUpdater.autoDownload = false;          // Để người dùng xác nhận trước khi tải
autoUpdater.autoInstallOnAppQuit = true;   // Tự động cài đặt khi thoát ứng dụng sau khi tải xong
autoUpdater.logger = {
  info: () => {},
  warn: () => {},
  error: (msg) => logger.logError('main', 'updater', String(msg)),
  debug: () => {}
};

autoUpdater.on('update-available', (info) => {
  if (!mainWindow) return;
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'CardBuilding có phiên bản mới',
    message: `Phát hiện phiên bản mới ${info.version} (Hiện tại ${app.getVersion()})`,
    detail: 'Bạn có muốn tải xuống ngay không? Quá trình tải sẽ chạy ngầm, sau khi hoàn tất sẽ hỏi lại về việc khởi động lại để cài đặt.',
    buttons: ['Tải xuống ngay', 'Để sau'],
    defaultId: 0,
    cancelId: 1
  }).then(result => {
    if (result.response === 0) {
      autoUpdater.downloadUpdate().catch(err => {
        logger.logError('main', 'updater-download', err && err.message, err && err.stack);
      });
    }
  });
});

autoUpdater.on('update-downloaded', (info) => {
  if (!mainWindow) return;
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'Tải xuống hoàn tất',
    message: `Phiên bản mới ${info.version} đã tải xong`,
    detail: 'Bạn có muốn khởi động lại để cài đặt ngay không? Bạn cũng có thể chọn để sau, phần mềm sẽ tự động cài đặt khi thoát.',
    buttons: ['Khởi động lại cài đặt ngay', 'Để sau'],
    defaultId: 0,
    cancelId: 1
  }).then(result => {
    if (result.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });
});

autoUpdater.on('error', (err) => {
  logger.logError('main', 'updater-error', err && err.message, err && err.stack);
});

function checkForUpdates(silent) {
  if (!ENABLE_AUTO_UPDATE) return Promise.resolve({ skipped: 'disabled' });
  if (isDev) return Promise.resolve({ skipped: 'dev' });
  return autoUpdater.checkForUpdates().catch(err => {
    logger.logError('main', 'updater-check', err && err.message, err && err.stack);
    if (!silent && mainWindow) {
      dialog.showMessageBox(mainWindow, {
        type: 'error',
        title: 'Kiểm tra cập nhật thất bại',
        message: 'Không thể kết nối đến máy chủ cập nhật',
        detail: err && err.message ? err.message : 'Vui lòng kiểm tra kết nối mạng rồi thử lại.'
      });
    }
    return { error: err };
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 750,
    minWidth: 900,
    minHeight: 600,
    title: 'CardBuilding - Công cụ tạo thẻ nhân vật SillyTavern',
    icon: path.join(__dirname, '../../public/icon.png'),
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      // webSecurity bắt buộc là false: Mô hình Live2D tải tài nguyên cục bộ qua giao thức file://
      // Ứng dụng này không tải trang web từ xa nào, chỉ nạp file HTML cục bộ sau khi đóng gói, không có rủi ro XSS跨域
      webSecurity: false
    },
    backgroundColor: '#0a0a0f',
    show: false
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // F12 mở DevTools — chỉ trong môi trường phát triển
  if (isDev) {
    mainWindow.webContents.on('before-input-event', (event, input) => {
      if (input.key === 'F12') {
        mainWindow.webContents.toggleDevTools();
      }
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();
  // Khởi động sau 5 giây sẽ kiểm tra cập nhật ngầm (không làm gián đoạn luồng khởi động)
  setTimeout(() => checkForUpdates(true), 5000);
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ============ Trình xử lý IPC ============

// Điều khiển cửa sổ
ipcMain.on('window:minimize', () => mainWindow?.minimize());
ipcMain.on('window:maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.on('window:close', () => mainWindow?.close());
ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized());

// Hộp thoại tệp tin
ipcMain.handle('dialog:openFile', async (event, options) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: options?.filters || [
      { name: 'File thẻ nhân vật', extensions: ['png', 'json'] },
      { name: 'Ảnh PNG', extensions: ['png'] },
      { name: 'File JSON', extensions: ['json'] },
      { name: 'Tất cả file', extensions: ['*'] }
    ]
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

ipcMain.handle('dialog:openImage', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'File hình ảnh', extensions: ['png', 'jpg', 'jpeg', 'webp'] }
    ]
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

ipcMain.handle('dialog:saveFile', async (event, options) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: options?.defaultPath || 'character.png',
    filters: options?.filters || [
      { name: 'Thẻ nhân vật PNG', extensions: ['png'] },
      { name: 'File JSON', extensions: ['json'] }
    ]
  });
  if (result.canceled) return null;
  return result.filePath;
});

ipcMain.handle('dialog:selectDirectory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

// Thao tác tệp tin
ipcMain.handle('fs:readFile', async (event, filePath) => {
  try {
    const buffer = fs.readFileSync(filePath);
    return { success: true, data: buffer.toString('base64'), isBuffer: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('fs:readTextFile', async (event, filePath) => {
  try {
    const text = fs.readFileSync(filePath, 'utf-8');
    return { success: true, data: text };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('fs:writeFile', async (event, filePath, data, encoding) => {
  try {
    if (encoding === 'base64') {
      fs.writeFileSync(filePath, Buffer.from(data, 'base64'));
    } else {
      fs.writeFileSync(filePath, data, encoding || 'utf-8');
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('fs:exists', async (event, filePath) => {
  return fs.existsSync(filePath);
});

// Thao tác thẻ nhân vật PNG
ipcMain.handle('png:extractCharaData', async (event, filePath) => {
  try {
    const extract = require('png-chunks-extract');
    const text = require('png-chunk-text');
    const buffer = fs.readFileSync(filePath);
    const chunks = extract(new Uint8Array(buffer));

    // Thử ccv3 trước, sau đó thử chara
    for (const key of ['ccv3', 'chara']) {
      const tEXtChunk = chunks.find(c =>
        c.name === 'tEXt' && text.decode(c.data)?.keyword === key
      );
      if (tEXtChunk) {
        const decoded = text.decode(tEXtChunk.data);
        const jsonStr = Buffer.from(decoded.text, 'base64').toString('utf-8');
        const data = JSON.parse(jsonStr);
        return { success: true, data, format: key };
      }
    }
    return { success: false, error: 'Không tìm thấy dữ liệu thẻ nhân vật trong file PNG này' };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('png:embedCharaData', async (event, pngPath, cardJson, outputPath) => {
  try {
    // Kiểm tra sự tồn tại của file
    if (!fs.existsSync(pngPath)) {
      return { success: false, error: `File ảnh bìa nguồn không tồn tại: ${pngPath}` };
    }

    const extract = require('png-chunks-extract');
    const encode = require('png-chunks-encode');
    const text = require('png-chunk-text');

    let buffer;
    try {
      buffer = fs.readFileSync(pngPath);
    } catch (readErr) {
      return { success: false, error: `Đọc file nguồn thất bại: ${readErr.message}` };
    }

    // Kiểm tra chữ ký file PNG (8 byte đầu)
    const PNG_SIGNATURE = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
    for (let i = 0; i < 8; i++) {
      if (buffer[i] !== PNG_SIGNATURE[i]) {
        return { success: false, error: 'File nguồn không phải định dạng PNG hợp lệ (vui lòng dùng file PNG, không dùng JPG/WEBP)' };
      }
    }

    let chunks;
    try {
      chunks = extract(new Uint8Array(buffer));
    } catch (parseErr) {
      return { success: false, error: `Phân tích file PNG thất bại: ${parseErr.message}` };
    }

    // Loại bỏ các chunk chara/ccv3 cũ
    chunks = chunks.filter(c => {
      if (c.name !== 'tEXt') return true;
      try {
        const decoded = text.decode(c.data);
        return decoded.keyword !== 'chara' && decoded.keyword !== 'ccv3';
      } catch { return true; }
    });

    // Thêm chunk chara mới (định dạng V2)
    const base64Data = Buffer.from(JSON.stringify(cardJson)).toString('base64');
    const charaChunk = text.encode('chara', base64Data);

    // Chèn vào trước IEND
    const iendIndex = chunks.findIndex(c => c.name === 'IEND');
    if (iendIndex === -1) {
      return { success: false, error: 'Cấu trúc file PNG bất thường (không tìm thấy chunk IEND)' };
    }
    chunks.splice(iendIndex, 0, charaChunk);

    const outputBuffer = Buffer.from(encode(chunks));

    try {
      fs.writeFileSync(outputPath, outputBuffer);
    } catch (writeErr) {
      return { success: false, error: `Ghi file thất bại: ${writeErr.message} (có thể do thiếu quyền hạn hoặc file đang bị chiếm dụng)` };
    }

    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// Lưu trữ cài đặt ứng dụng
const settingsPath = path.join(app.getPath('userData'), 'settings.json');

function protectSecret(value) {
  if (!value || !safeStorage.isEncryptionAvailable()) return value || '';
  return { __encrypted: true, value: safeStorage.encryptString(String(value)).toString('base64') };
}

function revealSecret(value) {
  if (!value || typeof value !== 'object' || !value.__encrypted) return value || '';
  try { return safeStorage.decryptString(Buffer.from(value.value, 'base64')); } catch { return ''; }
}

function transformSettingsSecrets(settings, transform) {
  const copy = JSON.parse(JSON.stringify(settings || {}));
  if (Array.isArray(copy.apiProviders)) {
    for (const provider of copy.apiProviders) provider.apiKey = transform(provider.apiKey);
  }
  if (copy.aiNiangYouxi?.apiKey !== undefined) {
    copy.aiNiangYouxi.apiKey = transform(copy.aiNiangYouxi.apiKey);
  }
  return copy;
}

ipcMain.handle('settings:load', async () => {
  try {
    if (fs.existsSync(settingsPath)) {
      return transformSettingsSecrets(JSON.parse(fs.readFileSync(settingsPath, 'utf-8')), revealSecret);
    }
  } catch (e) {}
  return {};
});

ipcMain.handle('settings:save', async (event, settings) => {
  try {
    const protectedSettings = transformSettingsSecrets(settings, protectSecret);
    fs.writeFileSync(settingsPath, JSON.stringify(protectedSettings, null, 2), 'utf-8');
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// Kênh yêu cầu AI thống nhất. Các trang tính năng sử dụng qua apiStore mà không trực tiếp chạm vào Node.
ipcMain.handle('ai:chat', async (event, payload) => {
  try {
    const result = await aiService.chat(payload, payload.options?.stream ? chunk => {
      if (!event.sender.isDestroyed()) {
        event.sender.send('ai:chunk', { requestId: payload.requestId, chunk });
      }
    } : null);
    return { success: true, ...result };
  } catch (error) {
    return { success: false, error: error?.message || String(error) };
  }
});

ipcMain.handle('ai:cancel', (_event, requestId) => ({ success: aiService.cancel(requestId) }));

ipcMain.handle('ai:models', async (_event, provider) => {
  try { return { success: true, models: await aiService.fetchModels(provider) }; }
  catch (error) { return { success: false, error: error?.message || String(error), models: [] }; }
});

// Mở liên kết ngoài — Chỉ cho phép http/https để ngăn chặn các giao thức độc hại
ipcMain.on('shell:openExternal', (event, url) => {
  if (typeof url !== 'string') return;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      shell.openExternal(url);
    }
  } catch (e) {
    // Bỏ qua URL không hợp lệ
  }
});

// Lấy đường dẫn tài nguyên (cho Live2D...)
ipcMain.handle('app:getResourcePath', () => {
  if (isDev) {
    return path.join(__dirname, '../../public');
  }
  return process.resourcesPath;
});

// ============ IPC Cập nhật tự động ============
ipcMain.handle('update:check', async () => {
  try {
    const result = await checkForUpdates(false);
    if (result && result.skipped === 'dev') {
      return { success: true, skipped: 'dev', message: 'Bỏ qua kiểm tra cập nhật trong môi trường phát triển' };
    }
    if (result && result.error) {
      return { success: false, error: result.error.message };
    }
    if (result && result.updateInfo) {
      return { success: true, version: result.updateInfo.version, current: app.getVersion() };
    }
    return { success: true, current: app.getVersion() };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('update:getVersion', () => app.getVersion());

// ============ IPC Log lỗi ============
ipcMain.handle('log:read', async () => {
  try {
    return { success: true, entries: logger.readAll(), dir: logger.getLogDir() };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('log:append', async (event, entry) => {
  try {
    const e = entry || {};
    logger.logError(e.source || 'renderer', e.type || 'manual', e.message || '', e.stack || '', e.extra || null);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('log:clear', async () => {
  try {
    logger.clear();
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('log:openFolder', async () => {
  return logger.openLogFolder();
});