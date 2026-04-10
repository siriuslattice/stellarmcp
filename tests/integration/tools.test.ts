import { describe, it, expect, vi, beforeAll } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { HorizonClient } from "../../src/providers/horizon.js";
import { registerAccountTools } from "../../src/tools/account.js";
import { registerNetworkTools } from "../../src/tools/network.js";
import { registerOrderbookTools } from "../../src/tools/orderbook.js";
import { registerAssetTools } from "../../src/tools/assets.js";

const SKIP = !process.env.TEST_INTEGRATION;
const TESTNET_ACCOUNT =
  "GAQB35PQQ5Z7BVOFQE5F2AAAYGU34OIMON5NDJEMIQBEBY46WWHOCLJN";
const USDC_ISSUER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";

const config = {
  stellarNetwork: "testnet" as const,
  horizonUrl: "https://horizon-testnet.stellar.org",
  transport: "stdio" as const,
  port: 4021,
  host: "0.0.0.0",
  logLevel: "info" as const,
};

type ToolResult = {
  content: { type: string; text: string }[];
  isError?: boolean;
};

/**
 * Captures tool handlers registered via server.tool() so we can call them directly.
 */
function captureToolHandlers(
  server: McpServer,
): Map<string, (...args: unknown[]) => Promise<ToolResult>> {
  const handlers = new Map<
    string,
    (...args: unknown[]) => Promise<ToolResult>
  >();
  const origTool = server.tool.bind(server);
  vi.spyOn(server, "tool").mockImplementation((...args: unknown[]) => {
    const name = args[0] as string;
    const handler = args[args.length - 1];
    if (typeof handler === "function") {
      handlers.set(name, handler as (...a: unknown[]) => Promise<ToolResult>);
    }
    return origTool(...(args as Parameters<typeof origTool>));
  });
  return handlers;
}

describe.skipIf(SKIP)("MCP tool handlers integration (live testnet)", () => {
  const horizon = new HorizonClient(config);
  let handlers: Map<
    string,
    (...args: unknown[]) => Promise<ToolResult>
  >;

  beforeAll(() => {
    const server = new McpServer({ name: "test-integration", version: "0.1.0" });
    handlers = captureToolHandlers(server);
    registerAccountTools(server, horizon, config);
    registerNetworkTools(server, horizon, config);
    registerOrderbookTools(server, horizon, config);
    registerAssetTools(server, horizon, config);
  });

  it(
    "getAccount tool returns formatted data for real account",
    async () => {
      const handler = handlers.get("getAccount")!;
      expect(handler).toBeDefined();

      const result = await handler({ accountId: TESTNET_ACCOUNT });
      expect(result.isError).toBeUndefined();

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.address).toBe(TESTNET_ACCOUNT);
      expect(Array.isArray(parsed.balances)).toBe(true);
      expect(parsed.balances.length).toBeGreaterThan(0);
      expect(parsed.sequence).toBeDefined();
      expect(parsed.thresholds).toBeDefined();

      // Should have XLM balance
      const xlm = parsed.balances.find(
        (b: { asset: string }) => b.asset === "XLM",
      );
      expect(xlm).toBeDefined();
      expect(parseFloat(xlm.balance)).toBeGreaterThan(0);
    },
    15000,
  );

  it(
    "getAccount tool returns error for nonexistent account",
    async () => {
      const handler = handlers.get("getAccount")!;
      const result = await handler({
        accountId: "GBLHFXG5JCGAHTKKIDSPCNFUIDYAJLOGO2CE3KTZZYCRHTZHZR3DRFED",
      });
      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBe("not_found");
    },
    15000,
  );

  it(
    "getNetworkStatus tool returns live network data",
    async () => {
      const handler = handlers.get("getNetworkStatus")!;
      expect(handler).toBeDefined();

      const result = await handler({});
      expect(result.isError).toBeUndefined();

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.network).toBeDefined();
      expect(parsed.latestLedger).toBeGreaterThan(0);
      expect(parsed.networkPassphrase).toBe(
        "Test SDF Network ; September 2015",
      );
    },
    15000,
  );

  it(
    "getOrderbook tool returns orderbook for XLM/USDC",
    async () => {
      const handler = handlers.get("getOrderbook")!;
      expect(handler).toBeDefined();

      const result = await handler({
        sellingAsset: "XLM",
        buyingAsset: `USDC:${USDC_ISSUER}`,
        limit: 5,
      });
      expect(result.isError).toBeUndefined();

      const parsed = JSON.parse(result.content[0].text);
      expect(Array.isArray(parsed.bids)).toBe(true);
      expect(Array.isArray(parsed.asks)).toBe(true);
      // Spread and midPrice may be null if orderbook is empty on testnet
      expect("spread" in parsed).toBe(true);
      expect("midPrice" in parsed).toBe(true);
    },
    15000,
  );

  it(
    "getAssetInfo tool returns USDC asset info",
    async () => {
      const handler = handlers.get("getAssetInfo")!;
      expect(handler).toBeDefined();

      const result = await handler({
        assetCode: "USDC",
        assetIssuer: USDC_ISSUER,
      });
      expect(result.isError).toBeUndefined();

      const parsed = JSON.parse(result.content[0].text);
      // getAssetInfo may return an array (multiple matches) or an error if no asset found
      // Testnet USDC issuer may not be indexed at the time of test
      if (parsed.error) {
        expect(parsed.error).toBeDefined(); // acceptable on testnet
      } else {
        const asset = Array.isArray(parsed) ? parsed[0] : parsed;
        expect(asset.code).toBe("USDC");
        expect(asset.issuer).toBe(USDC_ISSUER);
        expect(asset.type).toBeDefined();
      }
    },
    15000,
  );

  it(
    "getAssetInfo tool returns XLM metadata",
    async () => {
      const handler = handlers.get("getAssetInfo")!;
      const result = await handler({ assetCode: "XLM" });
      expect(result.isError).toBeUndefined();

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.code).toBe("XLM");
      expect(parsed.type).toBe("native");
      expect(parsed.issuer).toBeNull();
    },
    15000,
  );
});
