import { describe, it, expect, beforeEach, vi } from "vitest";
import { cache } from "../../src/utils/cache.js";

describe("cache", () => {
  beforeEach(() => {
    cache.clear();
  });

  it("should set and get a value", () => {
    cache.set("key1", { data: "hello" }, 10_000);
    expect(cache.get("key1")).toEqual({ data: "hello" });
  });

  it("should return undefined for missing key", () => {
    expect(cache.get("nonexistent")).toBeUndefined();
  });

  it("should expire entries after TTL", () => {
    vi.useFakeTimers();
    cache.set("key1", "value", 1000);
    expect(cache.get("key1")).toBe("value");

    vi.advanceTimersByTime(1001);
    expect(cache.get("key1")).toBeUndefined();
    vi.useRealTimers();
  });

  it("should report correct size", () => {
    cache.set("a", 1, 10_000);
    cache.set("b", 2, 10_000);
    expect(cache.size()).toBe(2);
  });

  it("should clear all entries", () => {
    cache.set("a", 1, 10_000);
    cache.set("b", 2, 10_000);
    cache.clear();
    expect(cache.size()).toBe(0);
    expect(cache.get("a")).toBeUndefined();
  });

  it("should evict oldest entry when max size is reached", () => {
    const max = cache.maxSize;
    for (let i = 0; i < max; i++) {
      cache.set(`key-${i}`, i, 60_000);
    }
    expect(cache.size()).toBe(max);

    // Adding one more should evict key-0 (oldest)
    cache.set("overflow", "new", 60_000);
    expect(cache.size()).toBe(max);
    expect(cache.get("key-0")).toBeUndefined();
    expect(cache.get("overflow")).toBe("new");
    // key-1 should still exist
    expect(cache.get("key-1")).toBe(1);
  });

  it("should not evict when updating an existing key at max size", () => {
    const max = cache.maxSize;
    for (let i = 0; i < max; i++) {
      cache.set(`key-${i}`, i, 60_000);
    }
    // Update existing key — should not evict anything
    cache.set("key-0", "updated", 60_000);
    expect(cache.size()).toBe(max);
    expect(cache.get("key-0")).toBe("updated");
    expect(cache.get("key-1")).toBe(1);
  });

  it("prune() should remove all expired entries", () => {
    vi.useFakeTimers();
    cache.set("short1", "a", 500);
    cache.set("short2", "b", 500);
    cache.set("long", "c", 60_000);

    vi.advanceTimersByTime(600);
    cache.prune();

    expect(cache.size()).toBe(1);
    expect(cache.get("short1")).toBeUndefined();
    expect(cache.get("short2")).toBeUndefined();
    expect(cache.get("long")).toBe("c");
    vi.useRealTimers();
  });
});
