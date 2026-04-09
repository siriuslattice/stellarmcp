import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTradeTools } from "../../../src/tools/trades.js";
import type { HorizonClient } from "../../../src/providers/horizon.js";

const mockConfig = {
  stellarNetwork: "testnet" as const,
  horizonUrl: "https://horizon-testnet.stellar.org",
  transport: "stdio" as const,
  port: 4021,
  host: "0.0.0.0",
  logLevel: "info" as const,
};

const mockAggregations = {
  _embedded: {
    records: [
      {
        timestamp: "1712448000000",
        trade_count: "15",
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
};

describe("getTradeAggregations tool", () => {
  let toolHandler: (args: {
    baseAsset: string;
    counterAsset: string;
    resolution: string;
    limit: number;
  }) => Promise<unknown>;

  beforeEach(() => {
    const server = new McpServer({ name: "test", version: "0.1.0" });
    const mockHorizon = {
      getTradeAggregations: vi.fn().mockResolvedValue(mockAggregations),
    } as unknown as HorizonClient;

    const origTool = server.tool.bind(server);
    vi.spyOn(server, "tool").mockImplementation((...args: unknown[]) => {
      const handler = args[args.length - 1];
      if (typeof handler === "function") toolHandler = handler as typeof toolHandler;
      return origTool(...(args as Parameters<typeof origTool>));
    });

    registerTradeTools(server, mockHorizon, mockConfig);
  });

  it("should return formatted trade aggregation data", async () => {
    const result = (await toolHandler({
      baseAsset: "XLM",
      counterAsset: "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
      resolution: "1h",
      limit: 24,
    })) as { content: { type: string; text: string }[] };
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed).toHaveLength(1);
    expect(parsed[0].open).toBe("0.0950000");
    expect(parsed[0].close).toBe("0.1050000");
    expect(parsed[0].tradeCount).toBe("15");
    expect(parsed[0].baseVolume).toBe("5000.0000000");
  });

  it("should handle empty results", async () => {
    const server = new McpServer({ name: "test", version: "0.1.0" });
    const mockHorizon = {
      getTradeAggregations: vi.fn().mockResolvedValue({
        _embedded: { records: [] },
        _links: { self: { href: "" } },
      }),
    } as unknown as HorizonClient;

    const origTool = server.tool.bind(server);
    vi.spyOn(server, "tool").mockImplementation((...args: unknown[]) => {
      const handler = args[args.length - 1];
      if (typeof handler === "function") toolHandler = handler as typeof toolHandler;
      return origTool(...(args as Parameters<typeof origTool>));
    });
    registerTradeTools(server, mockHorizon, mockConfig);

    const result = (await toolHandler({
      baseAsset: "XLM",
      counterAsset: "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
      resolution: "1d",
      limit: 10,
    })) as { content: { type: string; text: string }[] };
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed).toHaveLength(0);
  });
});
