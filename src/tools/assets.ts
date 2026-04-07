import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { HorizonClient } from "../providers/horizon.js";
import type { Config } from "../config.js";
import { toolError } from "../utils/errors.js";

export function registerAssetTools(server: McpServer, horizon: HorizonClient, _config: Config) {
  server.tool(
    "getAssetInfo",
    "Get metadata for a Stellar asset including supply, accounts, and flags",
    {
      assetCode: z.string().describe("Asset code (e.g. USDC, XLM)"),
      assetIssuer: z.string().optional().describe("Asset issuer address (not needed for XLM)"),
    },
    async ({ assetCode, assetIssuer }) => {
      try {
        if (assetCode.toUpperCase() === "XLM") {
          const formatted = {
            code: "XLM",
            issuer: null,
            type: "native",
            totalSupply: "105443902087.3472865",
            numAccounts: null,
            flags: {
              authRequired: false,
              authRevocable: false,
              authImmutable: false,
              authClawbackEnabled: false,
            },
          };
          return { content: [{ type: "text", text: JSON.stringify(formatted, null, 2) }] };
        }

        const data = await horizon.getAssets(assetCode, assetIssuer);
        const records = data._embedded.records;

        if (records.length === 0) {
          return toolError("not_found", `Asset ${assetCode} not found`);
        }

        const formatted = records.map((asset) => ({
          code: asset.asset_code,
          issuer: asset.asset_issuer,
          type: asset.asset_type,
          totalSupply: asset.amount,
          numAccounts: asset.num_accounts,
          flags: {
            authRequired: asset.flags.auth_required,
            authRevocable: asset.flags.auth_revocable,
            authImmutable: asset.flags.auth_immutable,
            authClawbackEnabled: asset.flags.auth_clawback_enabled,
          },
        }));
        return { content: [{ type: "text", text: JSON.stringify(formatted, null, 2) }] };
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        return toolError("asset_error", msg.slice(0, 200));
      }
    },
  );
}
