import { describe, it, expect, vi, beforeEach } from "vitest";
import { PriceService } from "../../../src/providers/price.js";
import type { HorizonClient } from "../../../src/providers/horizon.js";

function createMockHorizon(): HorizonClient {
  return {
    getOrderbook: vi.fn(),
    getTradeAggregations: vi.fn(),
  } as unknown as HorizonClient;
}

describe("PriceService", () => {
  let horizon: ReturnType<typeof createMockHorizon>;
  let service: PriceService;

  beforeEach(() => {
    horizon = createMockHorizon();
    service = new PriceService(horizon);
  });

  describe("getPrice", () => {
    it("returns mid-price from orderbook when both sides have orders", async () => {
      vi.mocked(horizon.getOrderbook).mockResolvedValue({
        bids: [{ price: "0.1000000", price_r: { n: 1, d: 10 }, amount: "500" }],
        asks: [{ price: "0.1020000", price_r: { n: 102, d: 1000 }, amount: "300" }],
        base: { asset_type: "native" },
        counter: { asset_type: "credit_alphanum4", asset_code: "USDC", asset_issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN" },
      });

      const result = await service.getPrice("XLM", "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN");

      expect(result.source).toBe("sdex_orderbook");
      // mid = (0.102 + 0.1) / 2 = 0.101
      expect(result.price).toBe("0.1010000");
      expect(result.timestamp).toBeDefined();
    });

    it("falls back to trade aggregations when orderbook is empty", async () => {
      vi.mocked(horizon.getOrderbook).mockResolvedValue({
        bids: [],
        asks: [],
        base: { asset_type: "native" },
        counter: { asset_type: "credit_alphanum4" },
      });

      vi.mocked(horizon.getTradeAggregations).mockResolvedValue({
        _embedded: {
          records: [
            {
              timestamp: "1712700000000",
              trade_count: "5",
              base_volume: "1000.0000000",
              counter_volume: "100.0000000",
              avg: "0.1000000",
              high: "0.1100000",
              low: "0.0900000",
              open: "0.0950000",
              close: "0.1050000",
            },
          ],
        },
        _links: { self: { href: "" } },
      });

      const result = await service.getPrice("XLM", "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN");

      expect(result.source).toBe("sdex_trades");
      expect(result.price).toBe("0.1050000");
    });

    it("throws when no price data exists at all", async () => {
      vi.mocked(horizon.getOrderbook).mockResolvedValue({
        bids: [],
        asks: [],
        base: { asset_type: "native" },
        counter: { asset_type: "credit_alphanum4" },
      });

      vi.mocked(horizon.getTradeAggregations).mockResolvedValue({
        _embedded: { records: [] },
        _links: { self: { href: "" } },
      });

      await expect(
        service.getPrice("XLM", "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"),
      ).rejects.toThrow("No price data available");
    });

    it("uses only asks when no bids exist (falls back to trades)", async () => {
      vi.mocked(horizon.getOrderbook).mockResolvedValue({
        bids: [],
        asks: [{ price: "0.1020000", price_r: { n: 102, d: 1000 }, amount: "300" }],
        base: { asset_type: "native" },
        counter: { asset_type: "credit_alphanum4" },
      });

      vi.mocked(horizon.getTradeAggregations).mockResolvedValue({
        _embedded: {
          records: [
            {
              timestamp: "1712700000000",
              trade_count: "3",
              base_volume: "500.0000000",
              counter_volume: "50.0000000",
              avg: "0.1000000",
              high: "0.1050000",
              low: "0.0950000",
              open: "0.0960000",
              close: "0.1040000",
            },
          ],
        },
        _links: { self: { href: "" } },
      });

      const result = await service.getPrice("XLM", "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN");

      expect(result.source).toBe("sdex_trades");
      expect(result.price).toBe("0.1040000");
    });
  });

  describe("getPriceHistory", () => {
    it("returns formatted candles from trade aggregations", async () => {
      vi.mocked(horizon.getTradeAggregations).mockResolvedValue({
        _embedded: {
          records: [
            {
              timestamp: "1712700000000",
              trade_count: "10",
              base_volume: "5000.0000000",
              counter_volume: "500.0000000",
              avg: "0.1000000",
              high: "0.1100000",
              low: "0.0900000",
              open: "0.0950000",
              close: "0.1050000",
            },
            {
              timestamp: "1712696400000",
              trade_count: "7",
              base_volume: "3000.0000000",
              counter_volume: "300.0000000",
              avg: "0.0980000",
              high: "0.1020000",
              low: "0.0920000",
              open: "0.0940000",
              close: "0.0990000",
            },
          ],
        },
        _links: { self: { href: "" } },
      });

      const result = await service.getPriceHistory(
        "XLM",
        "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
        "1h",
        24,
      );

      expect(result.candles).toHaveLength(2);
      expect(result.candles[0].open).toBe("0.0950000");
      expect(result.candles[0].close).toBe("0.1050000");
      expect(result.candles[0].volume).toBe("5000.0000000");
      expect(result.candles[0].tradeCount).toBe("10");
      expect(result.candles[0].timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it("throws on invalid resolution", async () => {
      await expect(
        service.getPriceHistory("XLM", "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN", "2h", 24),
      ).rejects.toThrow("Invalid resolution");
    });
  });

  describe("getVWAP", () => {
    it("computes VWAP as sum(avg*vol)/sum(vol)", async () => {
      vi.mocked(horizon.getTradeAggregations).mockResolvedValue({
        _embedded: {
          records: [
            {
              timestamp: "1712700000000",
              trade_count: "10",
              base_volume: "1000.0000000",
              counter_volume: "100.0000000",
              avg: "0.1000000",
              high: "0.1100000",
              low: "0.0900000",
              open: "0.0950000",
              close: "0.1050000",
            },
            {
              timestamp: "1712696400000",
              trade_count: "5",
              base_volume: "2000.0000000",
              counter_volume: "180.0000000",
              avg: "0.0900000",
              high: "0.0950000",
              low: "0.0850000",
              open: "0.0860000",
              close: "0.0940000",
            },
          ],
        },
        _links: { self: { href: "" } },
      });

      const result = await service.getVWAP(
        "XLM",
        "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
        "1h",
        24,
      );

      // VWAP = (0.1 * 1000 + 0.09 * 2000) / (1000 + 2000)
      //      = (100 + 180) / 3000 = 280 / 3000 = 0.0933333
      expect(result.vwap).toBe("0.0933333");
      expect(result.volume).toBe("3000.0000000");
      expect(result.candles).toBe(2);
    });

    it("throws when no trade data available", async () => {
      vi.mocked(horizon.getTradeAggregations).mockResolvedValue({
        _embedded: { records: [] },
        _links: { self: { href: "" } },
      });

      await expect(
        service.getVWAP("XLM", "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN", "1h", 24),
      ).rejects.toThrow("No trade data available");
    });
  });
});
