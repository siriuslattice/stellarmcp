import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerPaymentTools } from "../../../src/tools/payments.js";
import type { HorizonClient } from "../../../src/providers/horizon.js";

const mockConfig = {
  stellarNetwork: "testnet" as const,
  horizonUrl: "https://horizon-testnet.stellar.org",
  transport: "stdio" as const,
  port: 4021,
  host: "0.0.0.0",
  logLevel: "info" as const,
};

const mockPayments = {
  _embedded: {
    records: [
      {
        id: "1",
        type: "payment",
        created_at: "2026-04-07T00:00:00Z",
        transaction_hash: "abc",
        from: "GABC",
        to: "GDEF",
        asset_type: "native" as const,
        amount: "100.0000000",
        source_account: "GABC",
      },
      {
        id: "2",
        type: "create_account",
        created_at: "2026-04-06T00:00:00Z",
        transaction_hash: "def",
        source_account: "GABC",
        asset_type: undefined,
      },
    ],
  },
  _links: { self: { href: "" } },
};

describe("getPayments tool", () => {
  let toolHandler: (args: { accountId: string; limit: number }) => Promise<unknown>;

  beforeEach(() => {
    const server = new McpServer({ name: "test", version: "0.1.0" });
    const mockHorizon = { getPayments: vi.fn().mockResolvedValue(mockPayments) } as unknown as HorizonClient;

    const origTool = server.tool.bind(server);
    vi.spyOn(server, "tool").mockImplementation((...args: unknown[]) => {
      const handler = args[args.length - 1];
      if (typeof handler === "function") toolHandler = handler as typeof toolHandler;
      return origTool(...(args as Parameters<typeof origTool>));
    });

    registerPaymentTools(server, mockHorizon, mockConfig);
  });

  it("should return formatted payment data", async () => {
    const result = (await toolHandler({ accountId: "GABC", limit: 10 })) as {
      content: { type: string; text: string }[];
    };
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].type).toBe("payment");
    expect(parsed[0].asset).toBe("XLM");
    expect(parsed[0].amount).toBe("100.0000000");
  });

  it("should handle create_account type with no asset", async () => {
    const result = (await toolHandler({ accountId: "GABC", limit: 10 })) as {
      content: { type: string; text: string }[];
    };
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed[1].type).toBe("create_account");
    expect(parsed[1].from).toBe("GABC");
  });
});
