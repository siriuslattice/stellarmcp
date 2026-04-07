import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { HorizonClient } from "../providers/horizon.js";
import type { Config } from "../config.js";
import { toolError } from "../utils/errors.js";

export function registerPaymentTools(
  server: McpServer,
  horizon: HorizonClient,
  _config: Config,
) {
  server.tool(
    "getPayments",
    "Get recent payments for a Stellar account",
    {
      accountId: z.string().describe("Stellar account ID (G... address)"),
      limit: z.number().min(1).max(50).default(10).describe("Number of payments to return"),
    },
    async ({ accountId, limit }) => {
      try {
        const data = await horizon.getPayments(accountId, limit);
        const formatted = data._embedded.records.map((op) => ({
          type: op.type,
          from: op.from ?? op.source_account,
          to: op.to ?? null,
          asset:
            op.asset_type === "native"
              ? "XLM"
              : op.asset_code && op.asset_issuer
                ? `${op.asset_code}:${op.asset_issuer}`
                : null,
          amount: op.amount ?? null,
          createdAt: op.created_at,
        }));
        return { content: [{ type: "text", text: JSON.stringify(formatted, null, 2) }] };
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        if (msg.includes("404"))
          return toolError("not_found", `Account ${accountId} not found`);
        return toolError("horizon_error", msg.slice(0, 200));
      }
    },
  );
}
