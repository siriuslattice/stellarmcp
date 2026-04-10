import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { HorizonClient } from "../providers/horizon.js";
import type { Config } from "../config.js";
import { SorobanClient } from "../providers/soroban.js";
import { toolError } from "../utils/errors.js";

const CONTRACT_ID_REGEX = /^C[A-Z2-7]{55}$/;
const ACCOUNT_ID_REGEX = /^G[A-Z2-7]{55}$/;

export function registerSorobanTokenTools(
  server: McpServer,
  _horizon: HorizonClient,
  config: Config,
) {
  server.tool(
    "getSorobanTokenInfo",
    "Get SEP-41 Soroban token metadata (symbol, name, decimals) and optionally a balance for a Stellar account. Requires SOROBAN_RPC_URL to be configured.",
    {
      contractId: z
        .string()
        .describe("Soroban contract address (C... format, 56 chars)"),
      accountId: z
        .string()
        .optional()
        .describe(
          "Optional Stellar account address (G... format, 56 chars) — if provided, also fetches the balance",
        ),
    },
    async ({ contractId, accountId }) => {
      try {
        if (!config.sorobanRpcUrl) {
          return toolError(
            "not_configured",
            "Soroban RPC URL not configured. Set SOROBAN_RPC_URL env var.",
          );
        }

        if (!CONTRACT_ID_REGEX.test(contractId)) {
          return toolError(
            "invalid_contract_id",
            `Invalid contract ID: must match /^C[A-Z2-7]{55}$/`,
          );
        }

        if (accountId && !ACCOUNT_ID_REGEX.test(accountId)) {
          return toolError(
            "invalid_account_id",
            `Invalid account ID: must match /^G[A-Z2-7]{55}$/`,
          );
        }

        const networkPassphrase =
          config.stellarNetwork === "testnet"
            ? "Test SDF Network ; September 2015"
            : "Public Global Stellar Network ; September 2015";

        const client = new SorobanClient(config.sorobanRpcUrl, networkPassphrase);

        // Fetch metadata in parallel — but each can fail individually
        const [symbolResult, nameResult, decimalsResult] = await Promise.allSettled([
          client.simulateContractCall(contractId, "symbol"),
          client.simulateContractCall(contractId, "name"),
          client.simulateContractCall(contractId, "decimals"),
        ]);

        const symbol =
          symbolResult.status === "fulfilled" ? String(symbolResult.value) : null;
        const name =
          nameResult.status === "fulfilled" ? String(nameResult.value) : null;
        const decimals =
          decimalsResult.status === "fulfilled"
            ? Number(decimalsResult.value)
            : null;

        // If all three failed, the contract is probably not a SEP-41 token
        if (symbol === null && name === null && decimals === null) {
          return toolError(
            "not_a_token",
            "Contract did not respond to symbol/name/decimals — not a SEP-41 token, or contract ID is wrong",
          );
        }

        const result: {
          contractId: string;
          symbol: string | null;
          name: string | null;
          decimals: number | null;
          accountId?: string;
          balance?: string;
          displayBalance?: string;
        } = {
          contractId,
          symbol,
          name,
          decimals,
        };

        // Optionally fetch balance
        if (accountId) {
          try {
            const addressArg = await client.encodeAddress(accountId);
            const rawBalance = await client.simulateContractCall(
              contractId,
              "balance",
              [addressArg],
            );
            const balanceBig =
              typeof rawBalance === "bigint"
                ? rawBalance
                : BigInt(String(rawBalance));
            result.accountId = accountId;
            result.balance = balanceBig.toString();
            // Display balance: divide by 10^decimals if decimals known
            if (decimals !== null && decimals >= 0) {
              const scale = 10n ** BigInt(decimals);
              const whole = balanceBig / scale;
              const frac = balanceBig % scale;
              const fracStr = frac
                .toString()
                .padStart(decimals, "0")
                .replace(/0+$/, "");
              result.displayBalance = fracStr
                ? `${whole}.${fracStr}`
                : whole.toString();
            }
          } catch (balanceErr) {
            // Balance fetch failed — return metadata anyway
            const msg =
              balanceErr instanceof Error
                ? balanceErr.message
                : String(balanceErr);
            result.accountId = accountId;
            result.balance = null as unknown as string;
            result.displayBalance = `error: ${msg.slice(0, 100)}`;
          }
        }

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        return toolError("soroban_error", msg.slice(0, 200));
      }
    },
  );
}
