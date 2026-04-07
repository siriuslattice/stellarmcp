import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { HorizonClient } from "../providers/horizon.js";
import type { Config } from "../config.js";
import { toolError } from "../utils/errors.js";

export function registerTransactionTools(
  server: McpServer,
  horizon: HorizonClient,
  _config: Config,
) {
  server.tool(
    "getTransactions",
    "Get recent transactions for a Stellar account",
    {
      accountId: z.string().describe("Stellar account ID (G... address)"),
      limit: z.number().min(1).max(50).default(10).describe("Number of transactions to return"),
    },
    async ({ accountId, limit }) => {
      try {
        const data = await horizon.getTransactions(accountId, limit);
        const formatted = data._embedded.records.map((tx) => ({
          hash: tx.hash,
          ledger: tx.ledger,
          createdAt: tx.created_at,
          fee: tx.fee_charged,
          opCount: tx.operation_count,
          successful: tx.successful,
          memo: tx.memo ?? null,
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
