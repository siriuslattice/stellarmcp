import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { HorizonClient } from "../providers/horizon.js";
import type { Config } from "../config.js";
import { toolError } from "../utils/errors.js";

export function registerAccountTools(server: McpServer, horizon: HorizonClient, _config: Config) {
  server.tool(
    "getAccount",
    "Get Stellar account details including balances, thresholds, and signers",
    { accountId: z.string().describe("Stellar account ID (G... address)") },
    async ({ accountId }) => {
      try {
        const data = await horizon.getAccount(accountId);
        const formatted = {
          address: data.account_id,
          sequence: data.sequence,
          balances: data.balances.map((b) => ({
            asset: b.asset_type === "native" ? "XLM" : `${b.asset_code}:${b.asset_issuer}`,
            balance: b.balance,
            limit: b.limit,
            buyingLiabilities: b.buying_liabilities,
            sellingLiabilities: b.selling_liabilities,
          })),
          thresholds: data.thresholds,
          signerCount: data.signers.length,
          numSponsoring: data.num_sponsoring,
          numSponsored: data.num_sponsored,
        };
        return { content: [{ type: "text", text: JSON.stringify(formatted, null, 2) }] };
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        if (msg.includes("404")) return toolError("not_found", `Account ${accountId} not found`);
        return toolError("horizon_error", msg.slice(0, 200));
      }
    },
  );
}
