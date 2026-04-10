import { describe, it, expect, vi } from "vitest";
import { PriceAggregator } from "../../../src/providers/aggregator.js";
import type { OracleProvider } from "../../../src/providers/oracle.js";

vi.mock("../../../src/utils/logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

function mockOracle(
  name: string,
  available: boolean,
  price: string | null,
): OracleProvider {
  return {
    name,
    isAvailable: vi.fn().mockResolvedValue(available),
    getPrice: vi.fn().mockResolvedValue(
      price === null ? null : { price, timestamp: new Date().toISOString() },
    ),
  };
}

describe("PriceAggregator", () => {
  it("should aggregate prices from multiple available oracles", async () => {
    const agg = new PriceAggregator([
      mockOracle("a", true, "1.0000000"),
      mockOracle("b", true, "1.1000000"),
      mockOracle("c", true, "0.9000000"),
    ]);
    const result = await agg.getPrice("XLM", "USDC:GA5Z");
    expect(result.sources).toHaveLength(3);
    expect(parseFloat(result.price)).toBeCloseTo(1.0, 5);
    expect(result.base).toBe("XLM");
    expect(result.counter).toBe("USDC:GA5Z");
  });

  it("should compute median for even count (average of two middles)", async () => {
    const agg = new PriceAggregator([
      mockOracle("a", true, "1.0000000"),
      mockOracle("b", true, "2.0000000"),
    ]);
    const result = await agg.getPrice("XLM", "USDC:GA5Z");
    expect(parseFloat(result.price)).toBeCloseTo(1.5, 5);
    expect(result.sources).toHaveLength(2);
  });

  it("should skip unavailable oracles", async () => {
    const agg = new PriceAggregator([
      mockOracle("a", true, "1.0000000"),
      mockOracle("b", false, "999.0000000"),
    ]);
    const result = await agg.getPrice("XLM", "USDC:GA5Z");
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0].name).toBe("a");
  });

  it("should skip oracles that return null", async () => {
    const agg = new PriceAggregator([
      mockOracle("a", true, "1.0000000"),
      mockOracle("b", true, null),
    ]);
    const result = await agg.getPrice("XLM", "USDC:GA5Z");
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0].name).toBe("a");
  });

  it("should throw if no oracles return data", async () => {
    const agg = new PriceAggregator([
      mockOracle("a", true, null),
      mockOracle("b", false, "1.0"),
    ]);
    await expect(agg.getPrice("XLM", "USDC:GA5Z")).rejects.toThrow(
      /No oracle data/,
    );
  });

  it("should handle oracle errors gracefully (Promise.allSettled)", async () => {
    const errorOracle: OracleProvider = {
      name: "broken",
      isAvailable: vi.fn().mockResolvedValue(true),
      getPrice: vi.fn().mockRejectedValue(new Error("network error")),
    };
    const agg = new PriceAggregator([
      mockOracle("a", true, "1.0000000"),
      errorOracle,
    ]);
    const result = await agg.getPrice("XLM", "USDC:GA5Z");
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0].name).toBe("a");
  });

  it("getAvailableOracles should return only available ones", async () => {
    const agg = new PriceAggregator([
      mockOracle("a", true, "1.0"),
      mockOracle("b", false, "2.0"),
      mockOracle("c", true, "3.0"),
    ]);
    const available = await agg.getAvailableOracles();
    expect(available).toEqual(["a", "c"]);
  });
});
