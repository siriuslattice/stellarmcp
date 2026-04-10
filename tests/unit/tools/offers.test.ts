import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerOfferTools } from "../../../src/tools/offers.js";
import type { HorizonClient } from "../../../src/providers/horizon.js";

const mockConfig = {
  stellarNetwork: "testnet" as const,
  horizonUrl: "https://horizon-testnet.stellar.org",
  transport: "stdio" as const,
  port: 4021,
  host: "0.0.0.0",
  logLevel: "info" as const,
};

const mockOffersResponse = {
  _embedded: {
    records: [
      {
        id: "12345",
        paging_token: "12345",
        seller: "GABC123",
        selling: {
          asset_type: "credit_alphanum4" as const,
          asset_code: "USDC",
          asset_issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
        },
        buying: {
          asset_type: "native" as const,
        },
        amount: "100.0000000",
        price: "0.1234567",
        price_r: { n: 1234567, d: 10000000 },
        last_modified_ledger: 100,
        last_modified_time: "2024-01-01T00:00:00Z",
      },
      {
        id: "12346",
        paging_token: "12346",
        seller: "GABC123",
        selling: {
          asset_type: "native" as const,
        },
        buying: {
          asset_type: "credit_alphanum4" as const,
          asset_code: "USDC",
          asset_issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
        },
        amount: "500.0000000",
        price: "8.1000000",
        price_r: { n: 81, d: 10 },
        last_modified_ledger: 101,
        last_modified_time: "2024-01-02T00:00:00Z",
      },
    ],
  },
  _links: { self: { href: "" } },
};

describe("getOffers tool", () => {
  let server: McpServer;
  let mockHorizon: HorizonClient;
  let toolHandler: (args: { accountId: string; limit: number }) => Promise<unknown>;

  beforeEach(() => {
    server = new McpServer({ name: "test", version: "0.1.0" });
    mockHorizon = {
      getOffers: vi.fn(),
    } as unknown as HorizonClient;

    const origTool = server.tool.bind(server);
    vi.spyOn(server, "tool").mockImplementation((...args: unknown[]) => {
      const handler = args[args.length - 1];
      if (typeof handler === "function") {
        toolHandler = handler as typeof toolHandler;
      }
      return origTool(...(args as Parameters<typeof origTool>));
    });

    registerOfferTools(server, mockHorizon, mockConfig);
  });

  it("should return formatted offers with asset strings", async () => {
    vi.mocked(mockHorizon.getOffers).mockResolvedValueOnce(mockOffersResponse);

    const result = (await toolHandler({ accountId: "GABC123", limit: 10 })) as {
      content: { type: string; text: string }[];
    };
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].id).toBe("12345");
    expect(parsed[0].seller).toBe("GABC123");
    expect(parsed[0].selling).toContain("USDC:");
    expect(parsed[0].buying).toBe("XLM");
    expect(parsed[0].amount).toBe("100.0000000");
    expect(parsed[0].price).toBe("0.1234567");
    expect(parsed[1].selling).toBe("XLM");
    expect(parsed[1].buying).toContain("USDC:");
  });

  it("should return error for 404", async () => {
    vi.mocked(mockHorizon.getOffers).mockRejectedValueOnce(new Error("Horizon 404: not found"));

    const result = (await toolHandler({ accountId: "GINVALID", limit: 10 })) as {
      content: { type: string; text: string }[];
      isError: boolean;
    };
    expect(result.isError).toBe(true);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error).toBe("not_found");
  });
});
