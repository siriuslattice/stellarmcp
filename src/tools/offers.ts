import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { HorizonClient } from "../providers/horizon.js";
import type { Config } from "../config.js";
import { toolError } from "../utils/errors.js";

function formatAssetRef(asset: { asset_type: string; asset_code?: string; asset_issuer?: string }): string {
  if (asset.asset_type === "native") return "XLM";
  return `${asset.asset_code}:${asset.asset_issuer}`;
}

export function registerOfferTools(server: McpServer, horizon: HorizonClient, _config: Config) {
  server.tool(
    "getOffers",
    "Get open DEX offers for a Stellar account",
    {
      accountId: z.string().describe("Stellar account ID (G... address)"),
      limit: z.number().min(1).max(50).default(10).describe("Number of offers to return (1-50)"),
    },
    async ({ accountId, limit }) => {
      try {
        const data = await horizon.getOffers(accountId, limit);
        const formatted = data._embedded.records.map((r) => ({
          id: r.id,
          seller: r.seller,
          selling: formatAssetRef(r.selling),
          buying: formatAssetRef(r.buying),
          amount: r.amount,
          price: r.price,
        }));
        return { content: [{ type: "text", text: JSON.stringify(formatted, null, 2) }] };
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        if (msg.includes("404")) return toolError("not_found", `Account ${accountId} not found`);
        return toolError("horizon_error", msg.slice(0, 200));
      }
    },
  );
}
