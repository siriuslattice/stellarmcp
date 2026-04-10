import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerEffectTools } from "../../../src/tools/effects.js";
import type { HorizonClient } from "../../../src/providers/horizon.js";

const mockConfig = {
  stellarNetwork: "testnet" as const,
  horizonUrl: "https://horizon-testnet.stellar.org",
  transport: "stdio" as const,
  port: 4021,
  host: "0.0.0.0",
  logLevel: "info" as const,
};

const mockEffectsResponse = {
  _embedded: {
    records: [
      {
        id: "0000000001",
        paging_token: "0000000001",
        account: "GABC123",
        type: "account_created",
        type_i: 0,
        created_at: "2024-01-01T00:00:00Z",
      },
      {
        id: "0000000002",
        paging_token: "0000000002",
        account: "GABC123",
        type: "account_credited",
        type_i: 2,
        created_at: "2024-01-02T00:00:00Z",
      },
    ],
  },
  _links: { self: { href: "" } },
};

describe("getEffects tool", () => {
  let server: McpServer;
  let mockHorizon: HorizonClient;
  let toolHandler: (args: { accountId: string; limit: number }) => Promise<unknown>;

  beforeEach(() => {
    server = new McpServer({ name: "test", version: "0.1.0" });
    mockHorizon = {
      getEffects: vi.fn(),
    } as unknown as HorizonClient;

    const origTool = server.tool.bind(server);
    vi.spyOn(server, "tool").mockImplementation((...args: unknown[]) => {
      const handler = args[args.length - 1];
      if (typeof handler === "function") {
        toolHandler = handler as typeof toolHandler;
      }
      return origTool(...(args as Parameters<typeof origTool>));
    });

    registerEffectTools(server, mockHorizon, mockConfig);
  });

  it("should return formatted effects data", async () => {
    vi.mocked(mockHorizon.getEffects).mockResolvedValueOnce(mockEffectsResponse);

    const result = (await toolHandler({ accountId: "GABC123", limit: 10 })) as {
      content: { type: string; text: string }[];
    };
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].id).toBe("0000000001");
    expect(parsed[0].type).toBe("account_created");
    expect(parsed[0].account).toBe("GABC123");
    expect(parsed[0].createdAt).toBe("2024-01-01T00:00:00Z");
    expect(parsed[1].type).toBe("account_credited");
  });

  it("should return error for 404", async () => {
    vi.mocked(mockHorizon.getEffects).mockRejectedValueOnce(new Error("Horizon 404: not found"));

    const result = (await toolHandler({ accountId: "GINVALID", limit: 10 })) as {
      content: { type: string; text: string }[];
      isError: boolean;
    };
    expect(result.isError).toBe(true);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error).toBe("not_found");
  });
});
