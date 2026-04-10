import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { HorizonClient } from "../providers/horizon.js";
import type { Config } from "../config.js";
import { PriceService } from "../providers/price.js";
import { toolError } from "../utils/errors.js";

export function registerPriceTools(
  server: McpServer,
  horizon: HorizonClient,
  _config: Config,
) {
  const priceService = new PriceService(horizon);

  server.tool(
    "getPrice",
    "Get the current price for a Stellar asset pair from SDEX orderbook or recent trades",
    {
      baseAsset: z
        .string()
        .describe('Base asset: "XLM" or "CODE:ISSUER" (e.g. "USDC:GA5Z...")'),
      counterAsset: z
        .string()
        .describe(
          'Counter asset: "XLM" or "CODE:ISSUER" (e.g. "USDC:GA5Z...")',
        ),
    },
    async ({ baseAsset, counterAsset }) => {
      try {
        const result = await priceService.getPrice(baseAsset, counterAsset);
        const formatted = {
          base: baseAsset,
          counter: counterAsset,
          price: result.price,
          source: result.source,
          timestamp: result.timestamp,
        };
        return {
          content: [
            { type: "text", text: JSON.stringify(formatted, null, 2) },
          ],
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        return toolError("price_error", msg.slice(0, 200));
      }
    },
  );

  server.tool(
    "getPriceHistory",
    "Get OHLC price history for a Stellar asset pair from SDEX trade aggregations",
    {
      baseAsset: z
        .string()
        .describe('Base asset: "XLM" or "CODE:ISSUER"'),
      counterAsset: z
        .string()
        .describe('Counter asset: "XLM" or "CODE:ISSUER"'),
      resolution: z
        .enum(["1m", "5m", "15m", "1h", "1d", "1w"])
        .default("1h")
        .describe("Candle resolution"),
      limit: z
        .number()
        .min(1)
        .max(200)
        .default(24)
        .describe("Number of candles"),
    },
    async ({ baseAsset, counterAsset, resolution, limit }) => {
      try {
        const result = await priceService.getPriceHistory(
          baseAsset,
          counterAsset,
          resolution,
          limit,
        );
        return {
          content: [
            { type: "text", text: JSON.stringify(result, null, 2) },
          ],
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        return toolError("price_history_error", msg.slice(0, 200));
      }
    },
  );

  server.tool(
    "getVWAP",
    "Get volume-weighted average price for a Stellar asset pair from SDEX trade aggregations",
    {
      baseAsset: z
        .string()
        .describe('Base asset: "XLM" or "CODE:ISSUER"'),
      counterAsset: z
        .string()
        .describe('Counter asset: "XLM" or "CODE:ISSUER"'),
      resolution: z
        .enum(["1m", "5m", "15m", "1h", "1d", "1w"])
        .default("1h")
        .describe("Candle resolution"),
      limit: z
        .number()
        .min(1)
        .max(200)
        .default(24)
        .describe("Number of candles to aggregate"),
    },
    async ({ baseAsset, counterAsset, resolution, limit }) => {
      try {
        const result = await priceService.getVWAP(
          baseAsset,
          counterAsset,
          resolution,
          limit,
        );
        const formatted = {
          base: baseAsset,
          counter: counterAsset,
          vwap: result.vwap,
          volume: result.volume,
          candles: result.candles,
          timestamp: new Date().toISOString(),
        };
        return {
          content: [
            { type: "text", text: JSON.stringify(formatted, null, 2) },
          ],
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        return toolError("vwap_error", msg.slice(0, 200));
      }
    },
  );
}
