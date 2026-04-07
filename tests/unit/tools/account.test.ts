import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAccountTools } from "../../../src/tools/account.js";
import type { HorizonClient } from "../../../src/providers/horizon.js";

const mockConfig = {
  stellarNetwork: "testnet" as const,
  horizonUrl: "https://horizon-testnet.stellar.org",
  transport: "stdio" as const,
  port: 4021,
  host: "0.0.0.0",
  logLevel: "info" as const,
};

const mockAccount = {
  account_id: "GABC123",
  sequence: "12345",
  balances: [
    {
      balance: "100.0000000",
      asset_type: "native" as const,
      buying_liabilities: "0.0000000",
      selling_liabilities: "0.0000000",
    },
    {
      balance: "50.0000000",
      asset_type: "credit_alphanum4" as const,
      asset_code: "USDC",
      asset_issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
      limit: "922337203685.4775807",
      buying_liabilities: "0.0000000",
      selling_liabilities: "0.0000000",
    },
  ],
  thresholds: { low_threshold: 0, med_threshold: 0, high_threshold: 0 },
  signers: [{ weight: 1, key: "GABC123", type: "ed25519_public_key" }],
  num_sponsoring: 0,
  num_sponsored: 0,
};

describe("getAccount tool", () => {
  let server: McpServer;
  let mockHorizon: HorizonClient;
  let toolHandler: (args: { accountId: string }) => Promise<unknown>;

  beforeEach(() => {
    server = new McpServer({ name: "test", version: "0.1.0" });
    mockHorizon = {
      getAccount: vi.fn(),
    } as unknown as HorizonClient;

    // Capture the tool handler
    const origTool = server.tool.bind(server);
    vi.spyOn(server, "tool").mockImplementation((...args: unknown[]) => {
      // The handler is the last argument
      const handler = args[args.length - 1];
      if (typeof handler === "function") {
        toolHandler = handler as typeof toolHandler;
      }
      return origTool(...(args as Parameters<typeof origTool>));
    });

    registerAccountTools(server, mockHorizon, mockConfig);
  });

  it("should return formatted account data", async () => {
    vi.mocked(mockHorizon.getAccount).mockResolvedValueOnce(mockAccount);

    const result = (await toolHandler({ accountId: "GABC123" })) as {
      content: { type: string; text: string }[];
    };
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.address).toBe("GABC123");
    expect(parsed.balances).toHaveLength(2);
    expect(parsed.balances[0].asset).toBe("XLM");
    expect(parsed.balances[1].asset).toContain("USDC:");
  });

  it("should return error for 404", async () => {
    vi.mocked(mockHorizon.getAccount).mockRejectedValueOnce(new Error("Horizon 404: not found"));

    const result = (await toolHandler({ accountId: "GINVALID" })) as {
      content: { type: string; text: string }[];
      isError: boolean;
    };
    expect(result.isError).toBe(true);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error).toBe("not_found");
  });
});
