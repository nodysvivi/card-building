import assert from 'node:assert/strict';
import http from 'node:http';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const aiService = require('../src/main/ai-service.js');
let retryCount = 0;
let slowRunning = 0;
let maxSlowRunning = 0;

const server = http.createServer((request, response) => {
  if (request.url === '/v1/models') {
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ data: [{ id: 'model-b' }, { id: 'model-a' }] }));
    return;
  }
  if (request.url !== '/v1/chat/completions') {
    response.writeHead(404).end();
    return;
  }
  let body = '';
  request.on('data', chunk => { body += chunk; });
  request.on('end', () => {
    const payload = JSON.parse(body);
    if (payload.messages[0]?.content === 'retry' && retryCount++ === 0) {
      response.writeHead(429).end('rate limited');
      return;
    }
    if (payload.messages[0]?.content?.startsWith('slow')) {
      slowRunning++;
      maxSlowRunning = Math.max(maxSlowRunning, slowRunning);
      setTimeout(() => {
        slowRunning--;
        response.end(JSON.stringify({ choices: [{ message: { content: 'late' } }], usage: { prompt_tokens: 2, completion_tokens: 1, total_tokens: 3 } }));
      }, 300);
      return;
    }
    if (payload.stream) {
      response.setHeader('Content-Type', 'text/event-stream');
      response.write('data: {"choices":[{"delta":{"content":"Chào"}}]}\n\n');
      response.end('data: {"choices":[{"delta":{"content":" bạn"}}]}\n\ndata: {"choices":[],"usage":{"prompt_tokens":2,"completion_tokens":2,"total_tokens":4}}\n\ndata: [DONE]\n\n');
      return;
    }
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ choices: [{ message: { content: 'ok' } }], usage: { prompt_tokens: 2, completion_tokens: 1, total_tokens: 3 } }));
  });
});

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();
const provider = { type: 'openai', name: 'mock', baseUrl: `http://127.0.0.1:${port}/v1`, apiKey: 'test', model: 'mock' };

try {
  const retried = await aiService.chat({
    requestId: 'retry-test', provider, messages: [{ role: 'user', content: 'retry' }],
    options: { maxTokens: 100, retries: 1, timeoutMs: 3000 }
  });
  assert.equal(retried.content, 'ok');
  assert.deepEqual(retried.usage, { inputTokens: 2, outputTokens: 1, totalTokens: 3, estimated: false });
  assert.equal(retryCount, 2);

  const chunks = [];
  const streamed = await aiService.chat({
    requestId: 'stream-test', provider, messages: [{ role: 'user', content: 'stream' }],
    options: { maxTokens: 100, retries: 0, timeoutMs: 3000 }
  }, chunk => chunks.push(chunk));
  assert.equal(streamed.content, 'Chào bạn');
  assert.deepEqual(streamed.usage, { inputTokens: 2, outputTokens: 2, totalTokens: 4, estimated: false });
  assert.deepEqual(chunks, ['Chào', ' bạn']);

  const models = await aiService.fetchModels(provider);
  assert.deepEqual(models, ['model-a', 'model-b']);

  const pending = aiService.chat({
    requestId: 'cancel-test', provider, messages: [{ role: 'user', content: 'slow' }],
    options: { maxTokens: 100, retries: 0, timeoutMs: 3000 }
  });
  setTimeout(() => aiService.cancel('cancel-test'), 30);
  await assert.rejects(pending, /hủy|cancel|取消/i);
  await new Promise(resolve => setTimeout(resolve, 320));
  maxSlowRunning = 0;

  const queued = Array.from({ length: 5 }, (_, index) => aiService.chat({
    requestId: `queue-${index}`, provider, messages: [{ role: 'user', content: `slow-${index}` }],
    options: { maxTokens: 100, retries: 0, timeoutMs: 3000 }
  }));
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.deepEqual(aiService.getQueueStatus(), { running: 3, queued: 2, limit: 3 });
  assert.equal(aiService.cancel('queue-4'), true);
  await assert.rejects(queued[4], /hủy|cancel|取消/i);
  await Promise.all(queued.slice(0, 4));
  assert.equal(maxSlowRunning, 3);

  console.log('Dịch vụ AI: thử lại, stream, danh sách mô hình, hủy, hàng đợi đã vượt qua kiểm thử');
} finally {
  server.close();
}