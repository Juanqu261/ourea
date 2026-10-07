import { useCallback, useEffect, useRef, useState } from 'react';
import { AI_DECISION_CONTRACT, AI_REVIEW_COPY, resolveAiApiUrl } from '../config/aiReview.js';
import { requestDecisionReview } from '../services/decisionReviewClient.js';

export function useDecisionReview({ snapshot = null } = {}) {
  const apiUrl = resolveAiApiUrl();
  const fingerprint = snapshot?.snapshot_id ?? null;
  const [status, setStatus] = useState(apiUrl ? 'idle' : 'unconfigured');
  const [synthesis, setSynthesis] = useState(null);
  const [generatedAt, setGeneratedAt] = useState(null);
  const [error, setError] = useState(null);
  const cacheRef = useRef(new Map());
  const abortRef = useRef(null);
  const inFlightRef = useRef(false);
  const lastRequestRef = useRef(0);
  const fingerprintRef = useRef(fingerprint);
  fingerprintRef.current = fingerprint;

  useEffect(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    inFlightRef.current = false;
    setError(null);
    setSynthesis(null);
    setGeneratedAt(null);
    setStatus(apiUrl ? 'idle' : 'unconfigured');
  }, [fingerprint, apiUrl]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    inFlightRef.current = false;
    setStatus(apiUrl ? 'idle' : 'unconfigured');
  }, [apiUrl]);

  const generate = useCallback(async ({ force = false } = {}) => {
    if (!apiUrl) {
      setStatus('unconfigured');
      return;
    }
    if (!snapshot || inFlightRef.current) return;
    const cached = cacheRef.current.get(fingerprint);
    if (!force && cached) {
      setSynthesis(cached.synthesis);
      setGeneratedAt(cached.generatedAt);
      setError(null);
      setStatus('success');
      return;
    }
    const now = Date.now();
    if (now - lastRequestRef.current < AI_DECISION_CONTRACT.client_cooldown_ms) {
      setError({ code: 'cooldown', message: AI_REVIEW_COPY.cooldown });
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    inFlightRef.current = true;
    lastRequestRef.current = now;
    setStatus('loading');
    setError(null);
    const timer = setTimeout(() => controller.abort(), AI_DECISION_CONTRACT.timeout_ms);
    try {
      const result = await requestDecisionReview({
        apiUrl,
        snapshot,
        signal: controller.signal,
      });
      if (fingerprintRef.current !== fingerprint) return;
      if (!result.ok) {
        setStatus('error');
        setError(result.error);
        return;
      }
      cacheRef.current.set(fingerprint, result);
      setSynthesis(result.synthesis);
      setGeneratedAt(result.generatedAt);
      setStatus('success');
    } catch (caught) {
      if (caught?.name === 'AbortError') {
        if (fingerprintRef.current === fingerprint) setStatus('idle');
        return;
      }
      setStatus('error');
      setError({ code: 'unreachable', message: AI_REVIEW_COPY.unreachable });
    } finally {
      clearTimeout(timer);
      inFlightRef.current = false;
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, [apiUrl, fingerprint, snapshot]);

  useEffect(() => () => abortRef.current?.abort(), []);

  return {
    apiUrl,
    status,
    synthesis,
    generatedAt,
    error,
    generate,
    regenerate: () => generate({ force: true }),
    cancel,
  };
}
