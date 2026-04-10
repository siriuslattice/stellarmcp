import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { HorizonClient } from "../providers/horizon.js";
import type { Config } from "../config.js";
import { toolError } from "../utils/errors.js";

export function registerLiquidityPoolTools(server: McpServer, horizon: HorizonClient, _config: Config) {
  server.tool(
    "getLiquidityPools",
    "Get Stellar liquidity pools",
    {
      account: z.string().optional().describe("Filter by participant account ID (G... address)"),
      limit: z.number().min(1).max(200).default(10).describe("Number of pools to return (1-200)"),
    },
    async ({ account, limit }) => {
      try {
        const params: Record<string, string> = { limit: String(limit) };
        if (account) params.account = account;
        const data = await horizon.getLiquidityPools(params);
        const formatted = data._embedded.records.map((r) => ({
          id: r.id,
          type: r.type,
          feeBp: r.fee_bp,
          totalShares: r.total_shares,
          totalTrustlines: r.total_trustlines,
          reserves: r.reserves.map((res) => ({
            asset: res.asset,
            amount: res.amount,
          })),
        }));
        return { content: [{ type: "text", text: JSON.stringify(formatted, null, 2) }] };
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        return toolError("pool_error", msg.slice(0, 200));
      }
    },
  );
}
