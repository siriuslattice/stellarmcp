import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerClaimableBalanceTools } from "../../../src/tools/claimableBalances.js";
import type { HorizonClient } from "../../../src/providers/horizon.js";

const mockConfig = {
  stellarNetwork: "testnet" as const,
  horizonUrl: "https://horizon-testnet.stellar.org",
  transport: "stdio" as const,
  port: 4021,
  host: "0.0.0.0",
  logLevel: "info" as const,
};

const mockClaimableResponse = {
  _embedded: {
    records: [
      {
        id: "cb001",
        paging_token: "cb001",
        asset: "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
        amount: "50.0000000",
        sponsor: "GSPONSOR123",
        claimants: [
          { destination: "GABC123", predicate: { unconditional: true } },
          { destination: "GXYZ789", predicate: { unconditional: true } },
        ],
        last_modified_ledger: 300,
      },
      {
        id: "cb002",
        paging_token: "cb002",
        asset: "native",
        amount: "1000.0000000",
        claimants: [
          { destination: "GABC123", predicate: { unconditional: true } },
        ],
        last_modified_ledger: 301,
      },
    ],
  },
  _links: { self: { href: "" } },
};

describe("getClaimableBalances tool", () => {
  let server: McpServer;
  let mockHorizon: HorizonClient;
  let toolHandler: (args: { claimant?: string; asset?: string; limit: number }) => Promise<unknown>;

  beforeEach(() => {
    server = new McpServer({ name: "test", version: "0.1.0" });
    mockHorizon = {
      getClaimableBalances: vi.fn(),
    } as unknown as HorizonClient;

    const origTool = server.tool.bind(server);
    vi.spyOn(server, "tool").mockImplementation((...args: unknown[]) => {
      const handler = args[args.length - 1];
      if (typeof handler === "function") {
        toolHandler = handler as typeof toolHandler;
      }
      return origTool(...(args as Parameters<typeof origTool>));
    });

    registerClaimableBalanceTools(server, mockHorizon, mockConfig);
  });

  it("should return formatted claimable balances", async () => {
    vi.mocked(mockHorizon.getClaimableBalances).mockResolvedValueOnce(mockClaimableResponse);

    const result = (await toolHandler({ claimant: "GABC123", limit: 10 })) as {
      content: { type: string; text: string }[];
    };
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].id).toBe("cb001");
    expect(parsed[0].asset).toContain("USDC:");
    expect(parsed[0].amount).toBe("50.0000000");
    expect(parsed[0].sponsor).toBe("GSPONSOR123");
    expect(parsed[0].claimants).toHaveLength(2);
    expect(parsed[0].claimants[0].destination).toBe("GABC123");
    expect(parsed[1].asset).toBe("native");
    expect(parsed[1].sponsor).toBeUndefined();
  });

  it("should return error on failure", async () => {
    vi.mocked(mockHorizon.getClaimableBalances).mockRejectedValueOnce(new Error("Horizon 400: bad request"));

    const result = (await toolHandler({ limit: 10 })) as {
      content: { type: string; text: string }[];
      isError: boolean;
    };
    expect(result.isError).toBe(true);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error).toBe("claimable_error");
  });
});
