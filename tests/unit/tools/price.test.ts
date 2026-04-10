import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerPriceTools } from "../../../src/tools/price.js";
import type { HorizonClient } from "../../../src/providers/horizon.js";
import type { Config } from "../../../src/config.js";

const mockConfig = {
  stellarNetwork: "testnet" as const,
  horizonUrl: "https://horizon-testnet.stellar.org",
  transport: "stdio" as const,
  port: 4021,
  host: "0.0.0.0",
  logLevel: "info" as const,
};

function createMockHorizon(): HorizonClient {
  return {
    getOrderbook: vi.fn(),
    getTradeAggregations: vi.fn(),
  } as unknown as HorizonClient;
}

describe("price tools", () => {
  let server: McpServer;
  let horizon: ReturnType<typeof createMockHorizon>;
  const toolHandlers: Record<string, (...args: unknown[]) => Promise<unknown>> = {};

  beforeEach(() => {
    server = new McpServer({ name: "test", version: "0.0.1" });
    horizon = createMockHorizon();

    // Capture tool handlers via spy
    const origTool = server.tool.bind(server);
    vi.spyOn(server, "tool").mockImplementation((...args: unknown[]) => {
      const name = args[0] as string;
      const handler = args[args.length - 1];
      if (typeof handler === "function") {
        toolHandlers[name] = handler as (...a: unknown[]) => Promise<unknown>;
      }
      return origTool(...(args as Parameters<typeof origTool>));
    });

    registerPriceTools(server, horizon, mockConfig as Config);
  });

  describe("getPrice", () => {
    it("returns formatted price from orderbook", async () => {
      vi.mocked(horizon.getOrderbook).mockResolvedValue({
        bids: [{ price: "0.1000000", price_r: { n: 1, d: 10 }, amount: "500" }],
        asks: [{ price: "0.1020000", price_r: { n: 102, d: 1000 }, amount: "300" }],
        base: { asset_type: "native" },
        counter: { asset_type: "credit_alphanum4" },
      });

      const result = await toolHandlers["getPrice"](
        { baseAsset: "XLM", counterAsset: "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN" },
        {},
      ) as { content: { type: string; text: string }[]; isError?: boolean };

      expect(result.isError).toBeUndefined();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.base).toBe("XLM");
      expect(parsed.counter).toBe("USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN");
      expect(parsed.price).toBe("0.1010000");
      expect(parsed.source).toBe("sdex_orderbook");
    });

    it("returns error on invalid asset format", async () => {
      const result = await toolHandlers["getPrice"](
        { baseAsset: "INVALID:FORMAT:EXTRA", counterAsset: "XLM" },
        {},
      ) as { content: { type: string; text: string }[]; isError?: boolean };

      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBe("price_error");
    });
  });

  describe("getVWAP", () => {
    it("returns computed VWAP from trade aggregations", async () => {
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

      const result = await toolHandlers["getVWAP"](
        { baseAsset: "XLM", counterAsset: "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN", resolution: "1h", limit: 24 },
        {},
      ) as { content: { type: string; text: string }[]; isError?: boolean };

      expect(result.isError).toBeUndefined();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.vwap).toBe("0.0933333");
      expect(parsed.volume).toBe("3000.0000000");
      expect(parsed.candles).toBe(2);
    });

    it("returns error when no trade data available", async () => {
      vi.mocked(horizon.getTradeAggregations).mockResolvedValue({
        _embedded: { records: [] },
        _links: { self: { href: "" } },
      });

      const result = await toolHandlers["getVWAP"](
        { baseAsset: "XLM", counterAsset: "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN", resolution: "1h", limit: 24 },
        {},
      ) as { content: { type: string; text: string }[]; isError?: boolean };

      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBe("vwap_error");
    });
  });

  describe("getPriceHistory", () => {
    it("returns formatted candles", async () => {
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
          ],
        },
        _links: { self: { href: "" } },
      });

      const result = await toolHandlers["getPriceHistory"](
        { baseAsset: "XLM", counterAsset: "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN", resolution: "1h", limit: 24 },
        {},
      ) as { content: { type: string; text: string }[]; isError?: boolean };

      expect(result.isError).toBeUndefined();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.candles).toHaveLength(1);
      expect(parsed.candles[0].open).toBe("0.0950000");
      expect(parsed.candles[0].close).toBe("0.1050000");
    });
  });
});
