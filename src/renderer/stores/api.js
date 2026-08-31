import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';

export function resolveModelContextTokens(model) {
  const m = String(model || '').toLowerCase();
  if (m.includes('gemini-2.5') || m.includes('gemini-1.5')) return 1000000;
  if (m.includes('gemini-2') || m.includes('claude-4') || m.includes('sonnet-4') || m.includes('opus-4')) return 200000;
  if (m.includes('gpt-4o') || m.includes('gpt-4-turbo') || m.includes('o1') || m.includes('o3') || m.includes('o4')) return 128000;
  if (m.includes('deepseek') || m.includes('qwen')) return 64000;
  if (m.includes('claude-3')) return 200000;
  if (m.includes('gpt-4')) return 32000;
  return 32000;
}

export const useApiStore = defineStore('api', () => {
  // Trạng thái (State)
  const providers = ref([]);
  const activeProviderId = ref(null);
  const activeTasks = ref([]);
  const activeRequestCount = computed(() => activeTasks.value.length);
  const usageStats = ref({ requests: 0, failures: 0, inputTokens: 0, outputTokens: 0, estimatedRequests: 0, totalDurationMs: 0 });
  let _autoSaveLoaded = false;
  let _saveTimer = null;

  function inferTaskLabel(messages, explicitLabel) {
    if (explicitLabel) return String(explicitLabel).trim().slice(0, 32);
    const prompt = (Array.isArray(messages) ? messages : [])
      .map(message => String(message?.content || ''))
      .join('\n')
      .slice(0, 4000);
    const categories = [
      [/状态栏|MVU|变量方案|thanh trạng thái|biến/i, 'Tạo thanh trạng thái'],
      [/世界书|lorebook|worldbook/i, 'Tạo Worldbook'],
      [/NPC|非玩家角色|nhân vật/i, 'Tạo NPC'],
      [/开场白|greeting|lời mở đầu/i, 'Tạo lời mở đầu'],
      [/对话样本|dialogue|đối thoại/i, 'Tạo mẫu đối thoại'],
      [/EJS|模板|mẫu ejs/i, 'Tạo mẫu EJS'],
      [/正则|regex/i, 'Tạo script Regex'],
      [/诊断|检查角色卡|chẩn đoán/i, 'Chẩn đoán AI'],
      [/小说|提取|tiểu thuyết/i, 'Phân tích nội dung tiểu thuyết']
    ];
    return categories.find(([pattern]) => pattern.test(prompt))?.[1] || 'Nhiệm vụ AI tạo';
  }

  // Khởi tạo các nhà cung cấp mặc định
  function initDefaults() {
    if (providers.value.length === 0) {
      providers.value = [
        {
          id: 'openai',
          name: 'Tương thích OpenAI',
          type: 'openai',
          baseUrl: 'https://api.openai.com/v1',
          apiKey: '',
          model: 'gpt-4o',
          temperature: 0.8,
          enabled: true
        },
        {
          id: 'claude',
          name: 'Claude (Anthropic)',
          type: 'claude',
          baseUrl: 'https://api.anthropic.com',
          apiKey: '',
          model: 'claude-sonnet-4-20250514',
          temperature: 0.8,
          enabled: false
        },
        {
          id: 'gemini',
          name: 'Gemini (Google)',
          type: 'gemini',
          baseUrl: 'https://generativelanguage.googleapis.com',
          apiKey: '',
          model: 'gemini-2.0-flash',
          temperature: 0.8,
          enabled: false
        }
      ];
    }
  }

  const activeProvider = computed(() => {
    if (activeProviderId.value) {
      const p = providers.value.find(p => p.id === activeProviderId.value);
      if (p && p.apiKey) return p;
    }
    return providers.value.find(p => p.enabled && p.apiKey);
  });

  const isConfigured = computed(() => {
    return !!activeProvider.value;
  });

  // Gọi API AI
  async function chat(messages, options = {}) {
    const provider = activeProvider.value;
    if (!provider || !provider.apiKey) {
      throw new Error('Vui lòng cấu hình API Key cho ít nhất một nhà cung cấp AI trong cài đặt API');
    }
    return _callProvider(provider, messages, options);
  }

  // Gọi trực tiếp với provider chỉ định (dùng cho cấu hình riêng của trợ lý AI)
  async function chatWithProvider(provider, messages, options = {}) {
    if (!provider || !provider.apiKey) {
      throw new Error('provider thiếu apiKey');
    }
    return _callProvider(provider, messages, options);
  }

  function getModelMaxTokens(model) {
    const m = (model || '').toLowerCase();
    // Claude
    if (m.includes('opus') || m.includes('sonnet-4') || m.includes('claude-4')) return 16384;
    if (m.includes('claude-3-5') || m.includes('claude-3.5')) return 8192;
    if (m.includes('claude')) return 4096;
    // OpenAI
    if (m.includes('gpt-4o') || m.includes('gpt-4-turbo') || m.includes('o1') || m.includes('o3') || m.includes('o4')) return 16384;
    if (m.includes('gpt-4')) return 8192;
    if (m.includes('gpt-3.5')) return 4096;
    // Gemini
    if (m.includes('gemini-3') || m.includes('gemini-4')) return 65536;
    if (m.includes('gemini-2.5') || m.includes('gemini-2-5')) return 65536;
    if (m.includes('gemini-2')) return 32768;
    if (m.includes('gemini-1.5-pro')) return 8192;
    if (m.includes('gemini')) return 8192;
    // DeepSeek / Qwen
    if (m.includes('deepseek')) return 8192;
    if (m.includes('qwen')) return 8192;
    return 4096;
  }

  function getModelContextTokens(model) {
    return resolveModelContextTokens(model);
  }

  async function _callProvider(provider, messages, options) {
    const temperature = options.temperature ?? provider.temperature ?? 0.8;
    const modelMax = getModelMaxTokens(provider.model);
    const maxTokens = Math.min(options.maxTokens ?? modelMax, modelMax);
    const onChunk = options.onChunk || null;
    const requestId = globalThis.crypto?.randomUUID?.() || `ai_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const payload = {
      requestId,
      provider: JSON.parse(JSON.stringify(provider)),
      messages: JSON.parse(JSON.stringify(messages)),
      options: {
        temperature,
        maxTokens,
        timeoutMs: options.timeoutMs,
        retries: options.retries,
        stream: Boolean(onChunk)
      }
    };
    const startedAt = Date.now();
    activeTasks.value.push({
      id: requestId,
      label: inferTaskLabel(messages, options.taskLabel),
      providerName: provider.name || provider.type || 'Dịch vụ AI',
      model: provider.model || '',
      startedAt,
      state: 'running'
    });
    const abortHandler = () => window.cardForgeAPI.cancelAiRequest(requestId);
    options.signal?.addEventListener('abort', abortHandler, { once: true });
    try {
      const result = await window.cardForgeAPI.aiChat(payload, onChunk);
      if (!result?.success) throw new Error(result?.error || 'Yêu cầu AI thất bại');
      usageStats.value.requests++;
      usageStats.value.inputTokens += result.usage?.inputTokens || 0;
      usageStats.value.outputTokens += result.usage?.outputTokens || 0;
      if (result.usage?.estimated) usageStats.value.estimatedRequests++;
      usageStats.value.totalDurationMs += Date.now() - startedAt;
      scheduleSave();
      return result.content;
    } catch (error) {
      usageStats.value.requests++;
      usageStats.value.failures++;
      usageStats.value.totalDurationMs += Date.now() - startedAt;
      scheduleSave();
      throw error;
    } finally {
      activeTasks.value = activeTasks.value.filter(task => task.id !== requestId);
      options.signal?.removeEventListener('abort', abortHandler);
    }
  }

  async function cancelRequest(requestId) {
    const task = activeTasks.value.find(item => item.id === requestId);
    if (!task || task.state === 'stopping') return false;
    task.state = 'stopping';
    try {
      const result = await window.cardForgeAPI.cancelAiRequest(requestId);
      if (result?.success === false) task.state = 'running';
      return result?.success !== false;
    } catch (error) {
      task.state = 'running';
      throw error;
    }
  }

  async function cancelAllRequests() {
    const ids = activeTasks.value.map(task => task.id);
    await Promise.allSettled(ids.map(cancelRequest));
    return ids.length;
  }

  function resetUsageStats() {
    usageStats.value = { requests: 0, failures: 0, inputTokens: 0, outputTokens: 0, estimatedRequests: 0, totalDurationMs: 0 };
    scheduleSave();
  }

  // Lưu trữ
  async function loadFromDisk() {
    try {
      const settings = await window.cardForgeAPI.loadSettings();
      if (settings.apiProviders) providers.value = settings.apiProviders;
      if (settings.activeProviderId) activeProviderId.value = settings.activeProviderId;
      if (settings.aiUsageStats) {
        usageStats.value = { ...usageStats.value, ...settings.aiUsageStats };
        if (!settings.aiUsageStats.inputTokens && settings.aiUsageStats.inputChars) {
          usageStats.value.inputTokens = Math.ceil(settings.aiUsageStats.inputChars / 4);
          usageStats.value.outputTokens = Math.ceil((settings.aiUsageStats.outputChars || 0) / 4);
          usageStats.value.estimatedRequests = settings.aiUsageStats.requests || 0;
        }
      }
    } catch (e) {}
    initDefaults();
    await nextTickSafe();
    _autoSaveLoaded = true;
  }

  function nextTickSafe() {
    return new Promise(r => setTimeout(r, 0));
  }

  async function saveToDisk() {
    let lastErr;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        let settings = {};
        try {
          settings = await window.cardForgeAPI.loadSettings() || {};
        } catch (e) {}
        settings.apiProviders = JSON.parse(JSON.stringify(providers.value));
        settings.activeProviderId = activeProviderId.value;
        settings.aiUsageStats = JSON.parse(JSON.stringify(usageStats.value));
        const result = await window.cardForgeAPI.saveSettings(settings);
        if (result && result.success === false) {
          throw new Error(result.error || 'Lưu thất bại');
        }
        return;
      } catch (e) {
        lastErr = e;
      }
    }
    throw new Error(`Lưu cài đặt API thất bại (đã thử lại): ${lastErr?.message || 'Lỗi không xác định'}.`);
  }

  function scheduleSave() {
    if (!_autoSaveLoaded) return;
    if (_saveTimer) clearTimeout(_saveTimer);
    _saveTimer = setTimeout(() => {
      saveToDisk().catch(e => {
        import('./app.js').then(({ useAppStore }) => {
          try { useAppStore().toastError('Lưu cài đặt API thất bại: ' + e.message); } catch {}
        });
      });
      _saveTimer = null;
    }, 300);
  }

  watch(providers, scheduleSave, { deep: true });
  watch(activeProviderId, scheduleSave);

  function setActiveProvider(id) {
    activeProviderId.value = id;
  }

  function addProvider() {
    const id = 'custom_' + Date.now();
    providers.value.push({
      id,
      name: 'Dịch vụ tùy chỉnh',
      type: 'openai',
      baseUrl: '',
      apiKey: '',
      model: '',
      temperature: 0.8,
      enabled: true
    });
    return id;
  }

  function removeProvider(id) {
    const idx = providers.value.findIndex(p => p.id === id);
    if (idx !== -1) providers.value.splice(idx, 1);
    if (activeProviderId.value === id) activeProviderId.value = null;
  }

  async function fetchModels(provider) {
    if (!provider || !provider.apiKey) return [];
    try {
      const result = await window.cardForgeAPI.fetchAiModels(JSON.parse(JSON.stringify(provider)));
      return result?.success ? result.models : [];
    } catch (e) {}
    return [];
  }

  return {
    providers, activeProviderId, activeProvider, isConfigured, activeTasks, activeRequestCount, usageStats,
    chat, chatWithProvider, cancelRequest, cancelAllRequests, resetUsageStats, getModelMaxTokens, getModelContextTokens, fetchModels, loadFromDisk, saveToDisk, addProvider, removeProvider, initDefaults,
    setActiveProvider
  };
});