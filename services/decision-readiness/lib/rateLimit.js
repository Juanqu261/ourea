const WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS = 30;

export function createMemoryLimiter({
  windowMs = WINDOW_MS,
  maxRequests = MAX_REQUESTS,
  now = () => Date.now(),
} = {}) {
  const hits = [];
  return {
    windowMs,
    maxRequests,
    allow() {
      const cutoff = now() - windowMs;
      while (hits.length && hits[0] < cutoff) hits.shift();
      if (hits.length >= maxRequests) return false;
      hits.push(now());
      return true;
    },
  };
}
