import { parseDecisionSynthesis } from '../domain/aiDecisionSynthesis.js';
import { snapshotByteSize } from '../domain/aiDecisionSnapshot.js';
import { AI_DECISION_CONTRACT, AI_REVIEW_COPY } from '../config/aiReview.js';

function errorFromStatus(status, code) {
  if (code === 'incomplete') return { code, message: AI_REVIEW_COPY.incomplete };
  if (code === 'schema') return { code, message: AI_REVIEW_COPY.schema };
  if (code === 'refused') return { code, message: AI_REVIEW_COPY.refused };
  if (status === 429) return { code: 'busy', message: AI_REVIEW_COPY.busy };
  if (status === 408) return { code: 'timeout', message: AI_REVIEW_COPY.timeout };
  if (status === 400) return { code: 'rejected', message: AI_REVIEW_COPY.rejected };
  if (status === 422) return { code: code || 'schema', message: AI_REVIEW_COPY.schema };
  return { code: 'unavailable', message: AI_REVIEW_COPY.unavailable };
}

export async function requestDecisionReview({ apiUrl, snapshot, signal }) {
  const bytes = snapshotByteSize(snapshot);
  if (bytes > AI_DECISION_CONTRACT.snapshot_max_bytes) {
    return { ok: false, error: errorFromStatus(400, 'payload') };
  }
  let response;
  try {
    response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ snapshot }),
      signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    return { ok: false, error: { code: 'unreachable', message: AI_REVIEW_COPY.unreachable } };
  }
  let body = null;
  try {
    body = await response.json();
  } catch {
    if (!response.ok) {
      return { ok: false, error: errorFromStatus(response.status) };
    }
    return { ok: false, error: errorFromStatus(500) };
  }
  if (!response.ok) {
    const mapped = errorFromStatus(response.status, body?.error?.code);
    return {
      ok: false,
      error: {
        ...mapped,
        request_id: body?.error?.request_id ?? null,
      },
    };
  }
  const parsed = parseDecisionSynthesis(body.synthesis ?? body);
  if (!parsed.ok) {
    return { ok: false, error: { ...errorFromStatus(422, 'schema'), request_id: body.request_id ?? null } };
  }
  return {
    ok: true,
    synthesis: parsed.value,
    generatedAt: typeof body.generated_at === 'string' ? body.generated_at : new Date().toISOString(),
    requestId: body.request_id ?? null,
  };
}
