import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { HorizonClient } from "../providers/horizon.js";
import type { Config } from "../config.js";
import { toolError } from "../utils/errors.js";
import { parseAsset } from "../utils/formatters.js";

const RESOLUTION_MAP: Record<string, number> = {
  "1m": 60000,
  "5m": 300000,
  "15m": 900000,
  "1h": 3600000,
  "1d": 86400000,
  "1w": 604800000,
};

export function registerTradeTools(server: McpServer, horizon: HorizonClient, _config: Config) {
  server.tool(
    "getTradeAggregations",
    "Get OHLC trade aggregation data for a Stellar DEX asset pair",
    {
      baseAsset: z.string().describe('Base asset: "XLM" or "CODE:ISSUER"'),
      counterAsset: z.string().describe('Counter asset: "XLM" or "CODE:ISSUER"'),
      resolution: z
        .enum(["1m", "5m", "15m", "1h", "1d", "1w"])
        .default("1h")
        .describe("Candle resolution"),
      limit: z.number().min(1).max(200).default(24).describe("Number of candles"),
    },
    async ({ baseAsset, counterAsset, resolution, limit }) => {
      try {
        const base = parseAsset(baseAsset);
        const counter = parseAsset(counterAsset);

        const params: Record<string, string> = {
          base_asset_type: base.assetType,
          counter_asset_type: counter.assetType,
          resolution: String(RESOLUTION_MAP[resolution]),
          limit: String(limit),
          order: "desc",
        };
        if (!base.isNative) {
          params.base_asset_code = base.code;
          params.base_asset_issuer = base.issuer!;
        }
        if (!counter.isNative) {
          params.counter_asset_code = counter.code;
          params.counter_asset_issuer = counter.issuer!;
        }

        const data = await horizon.getTradeAggregations(params);
        const formatted = data._embedded.records.map((r) => ({
          timestamp: r.timestamp,
          open: r.open,
          high: r.high,
          low: r.low,
          close: r.close,
          baseVolume: r.base_volume,
          counterVolume: r.counter_volume,
          tradeCount: r.trade_count,
          avg: r.avg,
        }));
        return { content: [{ type: "text", text: JSON.stringify(formatted, null, 2) }] };
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        return toolError("trade_error", msg.slice(0, 200));
      }
    },
  );
}
