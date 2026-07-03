/** Sync flush registry — ensures drawn ink is exported before submit. */
const flushers = new Map<string, () => string>();

export function registerHandwritingFlush(key: string, flush: () => string): () => void {
  flushers.set(key, flush);
  return () => {
    flushers.delete(key);
  };
}

export function flushHandwriting(key: string): string {
  return flushers.get(key)?.() ?? "";
}

export function flushAllHandwriting(): void {
  for (const flush of flushers.values()) {
    flush();
  }
}
