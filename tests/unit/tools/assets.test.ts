import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAssetTools } from "../../../src/tools/assets.js";
import type { HorizonClient } from "../../../src/providers/horizon.js";

const mockConfig = {
  stellarNetwork: "testnet" as const,
  horizonUrl: "https://horizon-testnet.stellar.org",
  transport: "stdio" as const,
  port: 4021,
  host: "0.0.0.0",
  logLevel: "info" as const,
};

const mockAssets = {
  _embedded: {
    records: [
      {
        asset_type: "credit_alphanum4",
        asset_code: "USDC",
        asset_issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
        amount: "1000000.0000000",
        num_accounts: 5000,
        flags: {
          auth_required: false,
          auth_revocable: false,
          auth_immutable: false,
          auth_clawback_enabled: false,
        },
      },
    ],
  },
  _links: { self: { href: "" } },
};

describe("getAssetInfo tool", () => {
  let toolHandler: (args: { assetCode: string; assetIssuer?: string }) => Promise<unknown>;

  beforeEach(() => {
    const server = new McpServer({ name: "test", version: "0.1.0" });
    const mockHorizon = {
      getAssets: vi.fn().mockResolvedValue(mockAssets),
    } as unknown as HorizonClient;

    const origTool = server.tool.bind(server);
    vi.spyOn(server, "tool").mockImplementation((...args: unknown[]) => {
      const handler = args[args.length - 1];
      if (typeof handler === "function") toolHandler = handler as typeof toolHandler;
      return origTool(...(args as Parameters<typeof origTool>));
    });

    registerAssetTools(server, mockHorizon, mockConfig);
  });

  it("should return XLM metadata without calling Horizon", async () => {
    const result = (await toolHandler({ assetCode: "XLM" })) as {
      content: { type: string; text: string }[];
    };
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.code).toBe("XLM");
    expect(parsed.type).toBe("native");
    expect(parsed.issuer).toBeNull();
  });

  it("should return asset data from Horizon", async () => {
    const result = (await toolHandler({ assetCode: "USDC" })) as {
      content: { type: string; text: string }[];
    };
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].code).toBe("USDC");
    expect(parsed[0].numAccounts).toBe(5000);
    expect(parsed[0].totalSupply).toBe("1000000.0000000");
  });

  it("should return error for unknown asset", async () => {
    const server = new McpServer({ name: "test", version: "0.1.0" });
    const mockHorizon = {
      getAssets: vi.fn().mockResolvedValue({ _embedded: { records: [] }, _links: { self: { href: "" } } }),
    } as unknown as HorizonClient;

    const origTool = server.tool.bind(server);
    vi.spyOn(server, "tool").mockImplementation((...args: unknown[]) => {
      const handler = args[args.length - 1];
      if (typeof handler === "function") toolHandler = handler as typeof toolHandler;
      return origTool(...(args as Parameters<typeof origTool>));
    });
    registerAssetTools(server, mockHorizon, mockConfig);

    const result = (await toolHandler({ assetCode: "FAKE" })) as {
      content: { type: string; text: string }[];
      isError: boolean;
    };
    expect(result.isError).toBe(true);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error).toBe("not_found");
  });
});
