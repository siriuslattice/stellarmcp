import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerOperationTools } from "../../../src/tools/operations.js";
import type { HorizonClient } from "../../../src/providers/horizon.js";

const mockConfig = {
  stellarNetwork: "testnet" as const,
  horizonUrl: "https://horizon-testnet.stellar.org",
  transport: "stdio" as const,
  port: 4021,
  host: "0.0.0.0",
  logLevel: "info" as const,
};

const mockOperationsResponse = {
  _embedded: {
    records: [
      {
        id: "op001",
        type: "payment",
        created_at: "2024-01-01T00:00:00Z",
        transaction_hash: "abc123def456",
        source_account: "GABC123",
        from: "GABC123",
        to: "GXYZ789",
        asset_type: "native",
        amount: "100.0000000",
      },
      {
        id: "op002",
        type: "create_account",
        created_at: "2024-01-02T00:00:00Z",
        transaction_hash: "def789ghi012",
        source_account: "GABC123",
      },
    ],
  },
  _links: { self: { href: "" } },
};

describe("getOperations tool", () => {
  let server: McpServer;
  let mockHorizon: HorizonClient;
  let toolHandler: (args: { accountId: string; limit: number }) => Promise<unknown>;

  beforeEach(() => {
    server = new McpServer({ name: "test", version: "0.1.0" });
    mockHorizon = {
      getOperations: vi.fn(),
    } as unknown as HorizonClient;

    const origTool = server.tool.bind(server);
    vi.spyOn(server, "tool").mockImplementation((...args: unknown[]) => {
      const handler = args[args.length - 1];
      if (typeof handler === "function") {
        toolHandler = handler as typeof toolHandler;
      }
      return origTool(...(args as Parameters<typeof origTool>));
    });

    registerOperationTools(server, mockHorizon, mockConfig);
  });

  it("should return formatted operations data", async () => {
    vi.mocked(mockHorizon.getOperations).mockResolvedValueOnce(mockOperationsResponse);

    const result = (await toolHandler({ accountId: "GABC123", limit: 10 })) as {
      content: { type: string; text: string }[];
    };
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].id).toBe("op001");
    expect(parsed[0].type).toBe("payment");
    expect(parsed[0].sourceAccount).toBe("GABC123");
    expect(parsed[0].createdAt).toBe("2024-01-01T00:00:00Z");
    expect(parsed[0].transactionHash).toBe("abc123def456");
    expect(parsed[1].type).toBe("create_account");
  });

  it("should return error for 404", async () => {
    vi.mocked(mockHorizon.getOperations).mockRejectedValueOnce(new Error("Horizon 404: not found"));

    const result = (await toolHandler({ accountId: "GINVALID", limit: 10 })) as {
      content: { type: string; text: string }[];
      isError: boolean;
    };
    expect(result.isError).toBe(true);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error).toBe("not_found");
  });
});
