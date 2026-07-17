import { timingSafeEqual } from "node:crypto";

function isRefreshAuthorized(header: string | null, secret: string | undefined) {
  if (!secret || secret.trim().length !== secret.length || secret.trim().length < 32) return false;
  const match = /^Bearer ([^\s]+)$/.exec(header ?? "");
  if (!match) return false;
  const expected = Buffer.from(secret);
  const received = Buffer.from(match[1]);
  const padded = Buffer.alloc(expected.length);
  received.copy(padded, 0, 0, expected.length);
  return received.length === expected.length && timingSafeEqual(expected, padded);
}

export { isRefreshAuthorized };
