export function isExpired(expiresAtMs: number, nowMs: number): boolean {
  return expiresAtMs < nowMs;
}
