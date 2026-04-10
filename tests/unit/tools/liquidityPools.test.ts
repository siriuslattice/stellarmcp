import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerLiquidityPoolTools } from "../../../src/tools/liquidityPools.js";
import type { HorizonClient } from "../../../src/providers/horizon.js";

const mockConfig = {
  stellarNetwork: "testnet" as const,
  horizonUrl: "https://horizon-testnet.stellar.org",
  transport: "stdio" as const,
  port: 4021,
  host: "0.0.0.0",
  logLevel: "info" as const,
};

const mockPoolsResponse = {
  _embedded: {
    records: [
      {
        id: "pool001abc",
        paging_token: "pool001abc",
        fee_bp: 30,
        type: "constant_product",
        total_trustlines: "150",
        total_shares: "5000.0000000",
        reserves: [
          { asset: "native", amount: "10000.0000000" },
          { asset: "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN", amount: "25000.0000000" },
        ],
        last_modified_ledger: 500,
      },
    ],
  },
  _links: { self: { href: "" } },
};

describe("getLiquidityPools tool", () => {
  let server: McpServer;
  let mockHorizon: HorizonClient;
  let toolHandler: (args: { account?: string; limit: number }) => Promise<unknown>;

  beforeEach(() => {
    server = new McpServer({ name: "test", version: "0.1.0" });
    mockHorizon = {
      getLiquidityPools: vi.fn(),
    } as unknown as HorizonClient;

    const origTool = server.tool.bind(server);
    vi.spyOn(server, "tool").mockImplementation((...args: unknown[]) => {
      const handler = args[args.length - 1];
      if (typeof handler === "function") {
        toolHandler = handler as typeof toolHandler;
      }
      return origTool(...(args as Parameters<typeof origTool>));
    });

    registerLiquidityPoolTools(server, mockHorizon, mockConfig);
  });

  it("should return formatted liquidity pool data", async () => {
    vi.mocked(mockHorizon.getLiquidityPools).mockResolvedValueOnce(mockPoolsResponse);

    const result = (await toolHandler({ limit: 10 })) as {
      content: { type: string; text: string }[];
    };
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].id).toBe("pool001abc");
    expect(parsed[0].type).toBe("constant_product");
    expect(parsed[0].feeBp).toBe(30);
    expect(parsed[0].totalShares).toBe("5000.0000000");
    expect(parsed[0].totalTrustlines).toBe("150");
    expect(parsed[0].reserves).toHaveLength(2);
    expect(parsed[0].reserves[0].asset).toBe("native");
    expect(parsed[0].reserves[0].amount).toBe("10000.0000000");
  });

  it("should return error on failure", async () => {
    vi.mocked(mockHorizon.getLiquidityPools).mockRejectedValueOnce(new Error("Horizon 500: internal error"));

    const result = (await toolHandler({ limit: 10 })) as {
      content: { type: string; text: string }[];
      isError: boolean;
    };
    expect(result.isError).toBe(true);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error).toBe("pool_error");
  });
});
