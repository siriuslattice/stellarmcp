import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { HorizonClient } from "../providers/horizon.js";
import type { Config } from "../config.js";
import { registerAccountTools } from "./account.js";
import { registerTransactionTools } from "./transactions.js";
import { registerPaymentTools } from "./payments.js";
import { registerOrderbookTools } from "./orderbook.js";
import { registerTradeTools } from "./trades.js";
import { registerAssetTools } from "./assets.js";
import { registerNetworkTools } from "./network.js";
import { registerEffectTools } from "./effects.js";
import { registerOfferTools } from "./offers.js";
import { registerOperationTools } from "./operations.js";
import { registerLiquidityPoolTools } from "./liquidityPools.js";
import { registerClaimableBalanceTools } from "./claimableBalances.js";
import { registerPriceTools } from "./price.js";
import { registerSorobanTokenTools } from "./sorobanTokens.js";

export function registerAllTools(server: McpServer, horizon: HorizonClient, config: Config) {
  registerAccountTools(server, horizon, config);
  registerTransactionTools(server, horizon, config);
  registerPaymentTools(server, horizon, config);
  registerOrderbookTools(server, horizon, config);
  registerTradeTools(server, horizon, config);
  registerAssetTools(server, horizon, config);
  registerNetworkTools(server, horizon, config);
  registerEffectTools(server, horizon, config);
  registerOfferTools(server, horizon, config);
  registerOperationTools(server, horizon, config);
  registerLiquidityPoolTools(server, horizon, config);
  registerClaimableBalanceTools(server, horizon, config);
  registerPriceTools(server, horizon, config);
  registerSorobanTokenTools(server, horizon, config);
}
