interface ContactRateLimiter {
  consume(clientId: string, now: number): { allowed: boolean; retryAfterSeconds?: number };
}

function createInMemoryContactRateLimiter({
  limit = 5,
  maximumClients = 10_000,
  windowMs = 15 * 60 * 1000,
}: {
  limit?: number;
  maximumClients?: number;
  windowMs?: number;
} = {}): ContactRateLimiter {
  const requests = new Map<string, number[]>();

  return {
    consume(clientId, now) {
      const windowStart = now - windowMs;
      pruneExpiredRequests(requests, windowStart);
      if (!requests.has(clientId) && requests.size >= maximumClients) {
        const oldestClientId = requests.keys().next().value;
        if (oldestClientId) requests.delete(oldestClientId);
      }
      const recentRequests = (requests.get(clientId) ?? []).filter(
        (timestamp) => timestamp > windowStart,
      );

      if (recentRequests.length >= limit) {
        requests.set(clientId, recentRequests);
        const oldestRequest = recentRequests[0] ?? now;
        return {
          allowed: false,
          retryAfterSeconds: Math.max(1, Math.ceil((oldestRequest + windowMs - now) / 1000)),
        };
      }

      recentRequests.push(now);
      requests.set(clientId, recentRequests);
      return { allowed: true };
    },
  };
}

function pruneExpiredRequests(requests: Map<string, number[]>, windowStart: number) {
  for (const [clientId, timestamps] of requests) {
    const recentRequests = timestamps.filter((timestamp) => timestamp > windowStart);
    if (recentRequests.length === 0) requests.delete(clientId);
    else requests.set(clientId, recentRequests);
  }
}

export { createInMemoryContactRateLimiter, type ContactRateLimiter };
