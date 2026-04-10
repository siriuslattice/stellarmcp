import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerSorobanTokenTools } from "../../../src/tools/sorobanTokens.js";
import type { HorizonClient } from "../../../src/providers/horizon.js";

vi.mock("../../../src/providers/soroban.js", () => ({
  SorobanClient: vi.fn(),
}));

import { SorobanClient } from "../../../src/providers/soroban.js";

const mockConfigBase = {
  stellarNetwork: "testnet" as const,
  horizonUrl: "https://horizon-testnet.stellar.org",
  transport: "stdio" as const,
  port: 4021,
  host: "0.0.0.0",
  logLevel: "info" as const,
  sorobanRpcUrl: "https://soroban-testnet.stellar.org",
};

const VALID_CONTRACT = "CABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW";
const VALID_ACCOUNT = "GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW";

describe("getSorobanTokenInfo tool", () => {
  let toolHandler: (args: { contractId: string; accountId?: string }) => Promise<unknown>;

  function setupServer(config: typeof mockConfigBase, mockClient: Partial<SorobanClient>) {
    vi.mocked(SorobanClient).mockImplementation(
      () => mockClient as unknown as SorobanClient,
    );
    const server = new McpServer({ name: "test", version: "0.1.0" });
    const mockHorizon = {} as unknown as HorizonClient;

    const origTool = server.tool.bind(server);
    vi.spyOn(server, "tool").mockImplementation((...args: unknown[]) => {
      const handler = args[args.length - 1];
      if (typeof handler === "function") {
        toolHandler = handler as typeof toolHandler;
      }
      return origTool(...(args as Parameters<typeof origTool>));
    });

    registerSorobanTokenTools(server, mockHorizon, config);
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return formatted metadata when sorobanRpcUrl is configured", async () => {
    setupServer(mockConfigBase, {
      simulateContractCall: vi.fn().mockImplementation(async (_id, method) => {
        if (method === "symbol") return "USDC";
        if (method === "name") return "USD Coin";
        if (method === "decimals") return 7;
        return null;
      }),
      encodeAddress: vi.fn(),
      encodeU32: vi.fn(),
    });

    const result = (await toolHandler({ contractId: VALID_CONTRACT })) as {
      content: { type: string; text: string }[];
    };
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.contractId).toBe(VALID_CONTRACT);
    expect(parsed.symbol).toBe("USDC");
    expect(parsed.name).toBe("USD Coin");
    expect(parsed.decimals).toBe(7);
  });

  it("should include balance and displayBalance when accountId is provided", async () => {
    setupServer(mockConfigBase, {
      simulateContractCall: vi.fn().mockImplementation(async (_id, method) => {
        if (method === "symbol") return "USDC";
        if (method === "name") return "USD Coin";
        if (method === "decimals") return 7;
        if (method === "balance") return 12345678n; // 1.2345678 USDC
        return null;
      }),
      encodeAddress: vi.fn().mockResolvedValue({}),
      encodeU32: vi.fn(),
    });

    const result = (await toolHandler({
      contractId: VALID_CONTRACT,
      accountId: VALID_ACCOUNT,
    })) as { content: { type: string; text: string }[] };
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.accountId).toBe(VALID_ACCOUNT);
    expect(parsed.balance).toBe("12345678");
    expect(parsed.displayBalance).toBe("1.2345678");
  });

  it("should return not_configured error when sorobanRpcUrl is missing", async () => {
    const noRpcConfig = { ...mockConfigBase, sorobanRpcUrl: undefined };
    setupServer(noRpcConfig as typeof mockConfigBase, {});

    const result = (await toolHandler({ contractId: VALID_CONTRACT })) as {
      content: { type: string; text: string }[];
      isError: boolean;
    };
    expect(result.isError).toBe(true);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error).toBe("not_configured");
  });

  it("should return invalid_contract_id error when contractId is malformed", async () => {
    setupServer(mockConfigBase, {});

    const result = (await toolHandler({ contractId: "INVALID" })) as {
      content: { type: string; text: string }[];
      isError: boolean;
    };
    expect(result.isError).toBe(true);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error).toBe("invalid_contract_id");
  });

  it("should return invalid_account_id error when accountId is malformed", async () => {
    setupServer(mockConfigBase, {});

    const result = (await toolHandler({
      contractId: VALID_CONTRACT,
      accountId: "INVALID",
    })) as {
      content: { type: string; text: string }[];
      isError: boolean;
    };
    expect(result.isError).toBe(true);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error).toBe("invalid_account_id");
  });

  it("should return not_a_token error when all three metadata calls fail", async () => {
    setupServer(mockConfigBase, {
      simulateContractCall: vi.fn().mockRejectedValue(new Error("contract panicked")),
      encodeAddress: vi.fn(),
      encodeU32: vi.fn(),
    });

    const result = (await toolHandler({ contractId: VALID_CONTRACT })) as {
      content: { type: string; text: string }[];
      isError: boolean;
    };
    expect(result.isError).toBe(true);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error).toBe("not_a_token");
  });
});
