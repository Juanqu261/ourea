// Client for the local decision AI service (services/decision_ai). Empty URL → no service UI.
// window.__OUREA_AI_API_URL lets the e2e spec point a build made with a blank URL at a mocked service.
const RAW_BASE = (typeof window !== 'undefined' && window.__OUREA_AI_API_URL) || import.meta.env.VITE_OUREA_AI_API_URL || '';

export const AI_BASE = RAW_BASE.replace(/\/+$/, '');

export async function serviceHealth(base = AI_BASE) {
  if (!base) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    const response = await fetch(`${base}/health`, { signal: controller.signal });
    clearTimeout(timer);
    if (!response.ok) return null;
    const body = await response.json();
    return body?.ok ? body : null;
  } catch {
    return null;
  }
}

async function postJson(path, payload) {
  const response = await fetch(`${AI_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.detail ?? `HTTP ${response.status}`);
  return body;
}

export const auditBundle = (bundle) => postJson('/audit', bundle);
export const startInterview = (synthetic = true) => postJson('/agents/interview/start', { synthetic });
export const answerInterview = (threadId, answer) => postJson('/agents/interview/answer', { thread_id: threadId, answer });

export function parseSse(text) {
  return text.split('\n\n').filter((block) => block.trim()).map((block) => {
    const fields = Object.fromEntries(block.split('\n').map((line) => {
      const at = line.indexOf(': ');
      return [line.slice(0, at), line.slice(at + 2)];
    }));
    return { event: fields.event, data: JSON.parse(fields.data ?? '{}') };
  });
}

// Calls onEvent({event, data}) for each server-sent event: start · tool · node · retry · answer · error.
export async function askCopilot(question, threadId, onEvent) {
  const response = await fetch(`${AI_BASE}/agents/copilot`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, thread_id: threadId }),
  });
  if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const cut = buffer.lastIndexOf('\n\n');
    if (cut < 0) continue;
    parseSse(buffer.slice(0, cut)).forEach(onEvent);
    buffer = buffer.slice(cut + 2);
  }
  if (buffer.trim()) parseSse(buffer).forEach(onEvent);
}
