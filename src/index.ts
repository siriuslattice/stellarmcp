import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { config } from "./config.js";
import { HorizonClient } from "./providers/horizon.js";
import { registerAllTools } from "./tools/index.js";
import { registerResources } from "./resources/index.js";
import { registerPrompts } from "./prompts/index.js";
import { logger } from "./utils/logger.js";

const server = new McpServer({
  name: "stellarmcp",
  version: "0.1.1",
  description: "Stellar blockchain data for AI agents — x402 monetized",
});

const horizon = new HorizonClient(config);

registerAllTools(server, horizon, config);
registerResources(server, horizon, config);
registerPrompts(server);

if (config.transport === "stdio") {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("StellarMCP started (stdio)");
} else {
  const { createHttpServer } = await import("./transports/http.js");
  const app = await createHttpServer(config, horizon, server);
  app.listen(config.port, config.host, () => {
    logger.info(`StellarMCP started (HTTP) on ${config.host}:${config.port}`);
    logger.info(`x402 payee: ${config.stellarPayeeAddress?.slice(0, 8)}...${config.stellarPayeeAddress?.slice(-4)}`);
  });
}
