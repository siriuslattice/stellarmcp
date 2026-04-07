import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { HorizonClient } from "../providers/horizon.js";
import type { Config } from "../config.js";
import { toolError } from "../utils/errors.js";

export function registerNetworkTools(server: McpServer, horizon: HorizonClient, config: Config) {
  server.tool(
    "getNetworkStatus",
    "Get Stellar network status (free — no payment required)",
    {},
    async () => {
      try {
        const data = await horizon.getRoot();
        const formatted = {
          network: config.stellarNetwork,
          horizonVersion: data.horizon_version,
          coreVersion: data.core_version,
          protocolVersion: data.current_protocol_version,
          latestLedger: data.history_latest_ledger,
          closedAt: data.history_latest_ledger_closed_at,
          networkPassphrase: data.network_passphrase,
        };
        return { content: [{ type: "text", text: JSON.stringify(formatted, null, 2) }] };
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        return toolError("horizon_error", msg.slice(0, 200));
      }
    },
  );

  server.tool(
    "getLedger",
    "Get details of a specific Stellar ledger by sequence number",
    {
      sequence: z
        .number()
        .optional()
        .describe("Ledger sequence number (defaults to latest)"),
    },
    async ({ sequence }) => {
      try {
        let seq = sequence;
        if (!seq) {
          const root = await horizon.getRoot();
          seq = root.history_latest_ledger;
        }
        const data = await horizon.getLedger(seq);
        const formatted = {
          sequence: data.sequence,
          hash: data.hash,
          closedAt: data.closed_at,
          txCount: data.transaction_count,
          opCount: data.operation_count,
          baseFee: data.base_fee_in_stroops,
          totalCoins: data.total_coins,
          protocolVersion: data.protocol_version,
        };
        return { content: [{ type: "text", text: JSON.stringify(formatted, null, 2) }] };
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        if (msg.includes("404")) return toolError("not_found", `Ledger not found`);
        return toolError("horizon_error", msg.slice(0, 200));
      }
    },
  );
}
