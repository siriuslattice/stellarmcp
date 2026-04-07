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

export function registerAllTools(server: McpServer, horizon: HorizonClient, config: Config) {
  registerAccountTools(server, horizon, config);
  registerTransactionTools(server, horizon, config);
  registerPaymentTools(server, horizon, config);
  registerOrderbookTools(server, horizon, config);
  registerTradeTools(server, horizon, config);
  registerAssetTools(server, horizon, config);
  registerNetworkTools(server, horizon, config);
}
