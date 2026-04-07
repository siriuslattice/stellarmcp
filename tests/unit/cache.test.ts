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
});
