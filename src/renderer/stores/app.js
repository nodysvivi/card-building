import { defineStore } from 'pinia';
import { ref } from 'vue';
import errorLogger from '../utils/error-logger.js';

export const useAppStore = defineStore('app', () => {
  const theme = ref('dark');
  const sidebarCollapsed = ref(false);
  const wallpaperEnabled = ref(false);
  const toasts = ref([]);

  // Trạng thái hộp thoại xác nhận tùy biến
  const confirmVisible = ref(false);
  const confirmMessage = ref('');
  let _confirmResolve = null;

  // Trạng thái hộp thoại đa lựa chọn (3 nút trở lên)
  const chooseVisible = ref(false);
  const chooseMessage = ref('');
  const chooseOptions = ref([]);
  let _chooseResolve = null;

  function toggleTheme() {
    theme.value = theme.value === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', theme.value);
    saveTheme();
  }

  function setTheme(t) {
    theme.value = t;
    document.documentElement.setAttribute('data-theme', t);
    saveTheme();
  }

  async function saveTheme() {
    try {
      const settings = await window.cardForgeAPI.loadSettings();
      settings.theme = theme.value;
      await window.cardForgeAPI.saveSettings(settings);
    } catch (e) {}
  }

  async function loadTheme() {
    try {
      const settings = await window.cardForgeAPI.loadSettings();
      if (settings.theme) {
        theme.value = settings.theme;
        document.documentElement.setAttribute('data-theme', settings.theme);
      }
      wallpaperEnabled.value = settings.wallpaperEnabled === true;
    } catch (e) {}
  }

  function toggleWallpaper() {
    wallpaperEnabled.value = !wallpaperEnabled.value;
    saveWallpaper();
  }

  async function saveWallpaper() {
    try {
      const settings = await window.cardForgeAPI.loadSettings() || {};
      settings.wallpaperEnabled = wallpaperEnabled.value;
      delete settings.glowEnabled;
      await window.cardForgeAPI.saveSettings(settings);
    } catch (e) {}
  }

  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value;
  }

  // Thông báo Toast
  let toastId = 0;
  function toast(message, type = 'info', duration = 3000) {
    const id = ++toastId;
    toasts.value.push({ id, message, type });
    setTimeout(() => {
      toasts.value = toasts.value.filter(t => t.id !== id);
    }, duration);
  }

  // Hộp thoại xác nhận tùy biến (không dùng window.confirm để tránh mất tiêu điểm)
  function confirmAction(msg, callback) {
    confirmMessage.value = msg;
    confirmVisible.value = true;
    _confirmResolve = callback;
  }

  function confirmYes() {
    confirmVisible.value = false;
    if (_confirmResolve) {
      _confirmResolve();
      _confirmResolve = null;
    }
  }

  function confirmNo() {
    confirmVisible.value = false;
    _confirmResolve = null;
  }

  function toastSuccess(msg) { toast(msg, 'success'); }
  function toastError(msg) { toast(msg, 'error', 5000); errorLogger.logManual(msg, { level: 'error' }); }
  function toastWarning(msg) { toast(msg, 'warning'); errorLogger.logManual(msg, { level: 'warning' }); }
  function toastInfo(msg) { toast(msg, 'info'); }

  // Hộp thoại từ 3 lựa chọn trở lên
  // options có dạng [{ value, label, cls?: 'btn--primary'|'btn--secondary'|'btn--danger'|'btn--ghost' }]
  // Người dùng nhấp lớp phủ hoặc hủy thì callback nhận null
  function chooseAction(msg, options, callback) {
    chooseMessage.value = msg;
    chooseOptions.value = options || [];
    chooseVisible.value = true;
    _chooseResolve = callback;
  }

  function chooseResolve(value) {
    chooseVisible.value = false;
    if (_chooseResolve) {
      _chooseResolve(value);
      _chooseResolve = null;
    }
  }

  return {
    theme, sidebarCollapsed, wallpaperEnabled, toasts,
    confirmVisible, confirmMessage,
    chooseVisible, chooseMessage, chooseOptions,
    toggleTheme, setTheme, loadTheme, toggleSidebar, toggleWallpaper,
    toast, toastSuccess, toastError, toastWarning, toastInfo,
    confirmAction, confirmYes, confirmNo,
    chooseAction, chooseResolve
  };
});