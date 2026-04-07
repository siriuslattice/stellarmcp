import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerOrderbookTools } from "../../../src/tools/orderbook.js";
import type { HorizonClient } from "../../../src/providers/horizon.js";

const mockConfig = {
  stellarNetwork: "testnet" as const,
  horizonUrl: "https://horizon-testnet.stellar.org",
  transport: "stdio" as const,
  port: 4021,
  host: "0.0.0.0",
  logLevel: "info" as const,
};

const mockOrderbook = {
  bids: [
    { price: "0.1000000", price_r: { n: 1, d: 10 }, amount: "500.0000000" },
    { price: "0.0900000", price_r: { n: 9, d: 100 }, amount: "1000.0000000" },
  ],
  asks: [
    { price: "0.1100000", price_r: { n: 11, d: 100 }, amount: "300.0000000" },
    { price: "0.1200000", price_r: { n: 12, d: 100 }, amount: "200.0000000" },
  ],
  base: { asset_type: "native" },
  counter: { asset_type: "credit_alphanum4", asset_code: "USDC", asset_issuer: "GA5Z..." },
};

describe("getOrderbook tool", () => {
  let server: McpServer;
  let mockHorizon: HorizonClient;
  let toolHandler: (args: {
    sellingAsset: string;
    buyingAsset: string;
    limit: number;
  }) => Promise<unknown>;

  beforeEach(() => {
    server = new McpServer({ name: "test", version: "0.1.0" });
    mockHorizon = {
      getOrderbook: vi.fn(),
    } as unknown as HorizonClient;

    const origTool = server.tool.bind(server);
    vi.spyOn(server, "tool").mockImplementation((...args: unknown[]) => {
      const handler = args[args.length - 1];
      if (typeof handler === "function") {
        toolHandler = handler as typeof toolHandler;
      }
      return origTool(...(args as Parameters<typeof origTool>));
    });

    registerOrderbookTools(server, mockHorizon, mockConfig);
  });

  it("should return orderbook with spread and midprice", async () => {
    vi.mocked(mockHorizon.getOrderbook).mockResolvedValueOnce(mockOrderbook);

    const result = (await toolHandler({
      sellingAsset: "XLM",
      buyingAsset: "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
      limit: 20,
    })) as { content: { type: string; text: string }[] };
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.bids).toHaveLength(2);
    expect(parsed.asks).toHaveLength(2);
    expect(parseFloat(parsed.spread)).toBeCloseTo(0.01, 5);
    expect(parseFloat(parsed.midPrice)).toBeCloseTo(0.105, 5);
  });

  it("should handle empty orderbook", async () => {
    vi.mocked(mockHorizon.getOrderbook).mockResolvedValueOnce({
      bids: [],
      asks: [],
      base: { asset_type: "native" },
      counter: { asset_type: "credit_alphanum4" },
    });

    const result = (await toolHandler({
      sellingAsset: "XLM",
      buyingAsset: "USDC:GA5Z",
      limit: 20,
    })) as { content: { type: string; text: string }[] };
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.bids).toHaveLength(0);
    expect(parsed.asks).toHaveLength(0);
    expect(parsed.spread).toBeNull();
    expect(parsed.midPrice).toBeNull();
  });
});
