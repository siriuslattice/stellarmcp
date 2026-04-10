import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { HorizonClient } from "../providers/horizon.js";
import type { Config } from "../config.js";
import { toolError } from "../utils/errors.js";

export function registerClaimableBalanceTools(server: McpServer, horizon: HorizonClient, _config: Config) {
  server.tool(
    "getClaimableBalances",
    "Get claimable balances for a Stellar account",
    {
      claimant: z.string().optional().describe("Filter by claimant account ID (G... address)"),
      asset: z.string().optional().describe("Filter by asset (CODE:ISSUER or native)"),
      limit: z.number().min(1).max(200).default(10).describe("Number of balances to return (1-200)"),
    },
    async ({ claimant, asset, limit }) => {
      try {
        const params: Record<string, string> = { limit: String(limit) };
        if (claimant) params.claimant = claimant;
        if (asset) params.asset = asset;
        const data = await horizon.getClaimableBalances(params);
        const formatted = data._embedded.records.map((r) => ({
          id: r.id,
          asset: r.asset,
          amount: r.amount,
          sponsor: r.sponsor,
          claimants: r.claimants.map((c) => ({
            destination: c.destination,
          })),
        }));
        return { content: [{ type: "text", text: JSON.stringify(formatted, null, 2) }] };
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        return toolError("claimable_error", msg.slice(0, 200));
      }
    },
  );
}
