// Bản chạy trong trình duyệt (renderer) của src/main/ai-service.js — logic gọi AI
// (fetch trực tiếp OpenAI-compatible / Claude / Gemini, xử lý stream, retry, hàng đợi)
// không hề dùng API riêng của Node.js nên port gần như nguyên xi, chỉ đổi
// `module.exports` thành `export` ở cuối file.

const activeRequests = new Map();
const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);
const MAX_CONCURRENT_REQUESTS = 3;
const requestQueue = [];
let runningRequests = 0;

function buildRequest(provider, messages, options, stream) {
  const baseUrl = String(provider.baseUrl || '').replace(/\/+$/, '');
  const temperature = options.temperature ?? provider.temperature ?? 0.8;
  const maxTokens = options.maxTokens;
  if (provider.type === 'openai') return {
    url: `${baseUrl}/chat/completions`,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${provider.apiKey}` },
    body: { model: provider.model, messages, temperature, max_tokens: maxTokens, stream }
  };
  if (provider.type === 'claude') {
    const system = messages.find(message => message.role === 'system')?.content;
    const body = {
      model: provider.model,
      max_tokens: maxTokens,
      temperature,
      stream,
      messages: messages.filter(message => message.role !== 'system').map(message => ({ role: message.role, content: message.content }))
    };
    if (system) body.system = system;
    return {
      url: `${baseUrl}/v1/messages`,
      // 'anthropic-dangerous-direct-browser-access': API của Anthropic mặc định chặn
      // CORS khi gọi trực tiếp từ trình duyệt (khác với Electron main process, vốn
      // không bị giới hạn CORS) — header này là bắt buộc để vượt qua khi chạy trên web.
      headers: { 'Content-Type': 'application/json', 'x-api-key': provider.apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body
    };
  }
  if (provider.type === 'gemini') {
    const system = messages.find(message => message.role === 'system')?.content;
    const contents = messages.filter(message => message.role !== 'system').map(message => ({
      role: message.role === 'assistant' ? 'model' : 'user', parts: [{ text: message.content }]
    }));
    const body = { contents, generationConfig: { temperature, maxOutputTokens: maxTokens } };
    if (system) body.systemInstruction = { parts: [{ text: system }] };
    return {
      url: `${baseUrl}/v1beta/models/${provider.model}:${stream ? 'streamGenerateContent' : 'generateContent'}`,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': provider.apiKey },
      body
    };
  }
  throw new Error(`Không hỗ trợ loại API: ${provider.type}`);
}

function parseResponse(provider, data) {
  if (provider.type === 'openai') return data?.choices?.[0]?.message?.content;
  if (provider.type === 'claude') return data?.content?.[0]?.text;
  if (provider.type === 'gemini') return data?.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('');
  return null;
}

function usageFromData(provider, data) {
  if (provider.type === 'openai' && data?.usage) return {
    inputTokens: data.usage.prompt_tokens || 0,
    outputTokens: data.usage.completion_tokens || 0,
    totalTokens: data.usage.total_tokens || 0,
    estimated: false
  };
  if (provider.type === 'claude' && data?.usage) return {
    inputTokens: data.usage.input_tokens || 0,
    outputTokens: data.usage.output_tokens || 0,
    totalTokens: (data.usage.input_tokens || 0) + (data.usage.output_tokens || 0),
    estimated: false
  };
  if (provider.type === 'gemini' && data?.usageMetadata) return {
    inputTokens: data.usageMetadata.promptTokenCount || 0,
    outputTokens: data.usageMetadata.candidatesTokenCount || 0,
    totalTokens: data.usageMetadata.totalTokenCount || 0,
    estimated: false
  };
  return null;
}

function estimatedUsage(messages, content) {
  const inputChars = messages.reduce((sum, message) => sum + String(message.content || '').length, 0);
  const inputTokens = Math.ceil(inputChars / 4);
  const outputTokens = Math.ceil(String(content || '').length / 4);
  return { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens, estimated: true };
}

async function readStream(provider, response, messages, onChunk) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';
  let geminiOffset = 0;
  let usage = null;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    if (provider.type === 'gemini') {
      const matches = [...buffer.matchAll(/"text"\s*:\s*"((?:[^"\\]|\\.)*)"/g)];
      for (let index = geminiOffset; index < matches.length; index++) {
        let chunk;
        try { chunk = JSON.parse(`"${matches[index][1]}"`); } catch { chunk = matches[index][1]; }
        if (chunk) { fullText += chunk; onChunk(chunk); }
      }
      geminiOffset = matches.length;
      continue;
    }
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      try {
        const data = JSON.parse(payload);
        const eventUsage = usageFromData(provider, data?.message || data);
        if (eventUsage) {
          const inputTokens = eventUsage.inputTokens || usage?.inputTokens || 0;
          const outputTokens = eventUsage.outputTokens || usage?.outputTokens || 0;
          usage = { inputTokens, outputTokens, totalTokens: eventUsage.totalTokens || inputTokens + outputTokens, estimated: false };
        }
        const chunk = provider.type === 'openai'
          ? data?.choices?.[0]?.delta?.content
          : data?.type === 'content_block_delta' && data?.delta?.type === 'text_delta' ? data.delta.text : null;
        if (chunk) { fullText += chunk; onChunk(chunk); }
      } catch {}
    }
  }
  if (provider.type === 'gemini') {
    try {
      const parts = JSON.parse(buffer);
      const last = Array.isArray(parts) ? parts.at(-1) : parts;
      usage = usageFromData(provider, last) || usage;
    } catch {}
  }
  return { content: fullText, usage: usage || estimatedUsage(messages, fullText) };
}

async function attempt(provider, messages, options, signal, onChunk) {
  const stream = typeof onChunk === 'function';
  const request = buildRequest(provider, messages, options, stream);
  const response = await fetch(request.url, {
    method: 'POST', headers: request.headers, body: JSON.stringify(request.body), signal
  });
  if (!response.ok) {
    const error = new Error(`${provider.name || provider.type} Lỗi API (${response.status}): ${await response.text()}`);
    error.status = response.status;
    throw error;
  }
  if (stream) return readStream(provider, response, messages, onChunk);
  const data = await response.json();
  const content = parseResponse(provider, data);
  if (typeof content !== 'string') throw new Error(`${provider.name || provider.type} Dữ liệu trả về bất thường`);
  return { content, usage: usageFromData(provider, data) || estimatedUsage(messages, content) };
}

function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => { clearTimeout(timer); reject(signal.reason); }, { once: true });
  });
}

async function executeChat({ requestId, provider, messages, options = {} }, onChunk, controller) {
  const timeoutMs = Math.max(1000, Number(options.timeoutMs) || 90000);
  const retries = Math.max(0, Math.min(5, Number(options.retries) || 2));
  const timer = setTimeout(() => controller.abort(new Error(`Yêu cầu AI quá thời gian chờ (${Math.round(timeoutMs / 1000)} giây)`)), timeoutMs);
  try {
    for (let retry = 0; ; retry++) {
      try { return await attempt(provider, messages, options, controller.signal, onChunk); }
      catch (error) {
        if (controller.signal.aborted) throw controller.signal.reason || error;
        if (retry >= retries || (error.status && !RETRYABLE_STATUS.has(error.status))) throw error;
        await wait(Math.min(8000, 800 * (2 ** retry)) + Math.floor(Math.random() * 250), controller.signal);
      }
    }
  } finally {
    clearTimeout(timer);
  }
}

function drainQueue() {
  while (runningRequests < MAX_CONCURRENT_REQUESTS && requestQueue.length > 0) {
    const job = requestQueue.shift();
    const record = activeRequests.get(job.payload.requestId);
    if (!record || record.controller.signal.aborted) continue;
    record.state = 'running';
    runningRequests++;
    executeChat(job.payload, job.onChunk, record.controller)
      .then(job.resolve, job.reject)
      .finally(() => {
        activeRequests.delete(job.payload.requestId);
        runningRequests--;
        drainQueue();
      });
  }
}

function chat(payload, onChunk) {
  if (!payload?.requestId || !payload.provider?.apiKey) {
    return Promise.reject(new Error('Yêu cầu AI thiếu requestId hoặc API Key'));
  }
  if (activeRequests.has(payload.requestId)) {
    return Promise.reject(new Error(`Trùng lặp ID yêu cầu AI: ${payload.requestId}`));
  }
  const controller = new AbortController();
  return new Promise((resolve, reject) => {
    activeRequests.set(payload.requestId, { controller, state: 'queued', reject });
    requestQueue.push({ payload, onChunk, resolve, reject });
    drainQueue();
  });
}

function cancel(requestId) {
  const record = activeRequests.get(requestId);
  if (!record) return false;
  const error = new Error('Yêu cầu AI đã bị hủy');
  record.controller.abort(error);
  if (record.state === 'queued') {
    const index = requestQueue.findIndex(job => job.payload.requestId === requestId);
    if (index !== -1) requestQueue.splice(index, 1);
    activeRequests.delete(requestId);
    record.reject(error);
  }
  return true;
}

function getQueueStatus() {
  return { running: runningRequests, queued: requestQueue.length, limit: MAX_CONCURRENT_REQUESTS };
}

async function fetchModels(provider) {
  if (!provider?.apiKey) return [];
  const baseUrl = String(provider.baseUrl || '').replace(/\/+$/, '');
  let url; let headers;
  if (provider.type === 'openai') { url = `${baseUrl}/models`; headers = { Authorization: `Bearer ${provider.apiKey}` }; }
  else if (provider.type === 'claude') { url = `${baseUrl}/v1/models`; headers = { 'x-api-key': provider.apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' }; }
  else if (provider.type === 'gemini') { url = `${baseUrl}/v1beta/models`; headers = { 'x-goog-api-key': provider.apiKey }; }
  else return [];
  const response = await fetch(url, { headers });
  if (!response.ok) return [];
  const data = await response.json();
  const models = provider.type === 'gemini'
    ? (data.models || []).map(model => String(model.name || '').replace('models/', ''))
    : (data.data || []).map(model => model.id);
  return models.filter(Boolean).sort();
}

export { chat, cancel, fetchModels, getQueueStatus };