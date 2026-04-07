import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { HorizonClient } from "../providers/horizon.js";
import type { Config } from "../config.js";
import { registerAccountTools } from "./account.js";
import { registerTransactionTools } from "./transactions.js";
import { registerOrderbookTools } from "./orderbook.js";
import { registerNetworkTools } from "./network.js";

export function registerAllTools(server: McpServer, horizon: HorizonClient, config: Config) {
  registerAccountTools(server, horizon, config);
  registerTransactionTools(server, horizon, config);
  registerOrderbookTools(server, horizon, config);
  registerNetworkTools(server, horizon, config);
}
