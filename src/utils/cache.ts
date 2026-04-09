const MAX_SIZE = 1000;
const store = new Map<string, { value: unknown; expiresAt: number }>();

export const cache = {
  get<T>(key: string): T | undefined {
    const entry = store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      store.delete(key);
      return undefined;
    }
    return entry.value as T;
  },
  set(key: string, value: unknown, ttlMs: number): void {
    if (store.size >= MAX_SIZE && !store.has(key)) {
      const oldest = store.keys().next().value;
      if (oldest !== undefined) store.delete(oldest);
    }
    store.set(key, { value, expiresAt: Date.now() + ttlMs });
  },
  clear(): void {
    store.clear();
  },
  size(): number {
    return store.size;
  },
  prune(): void {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now > entry.expiresAt) {
        store.delete(key);
      }
    }
  },
  /** Exposed for testing only */
  get maxSize(): number {
    return MAX_SIZE;
  },
};
