import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { HorizonClient } from "../providers/horizon.js";
import type { Config } from "../config.js";
import { toolError } from "../utils/errors.js";
import { parseAsset } from "../utils/formatters.js";

export function registerOrderbookTools(
  server: McpServer,
  horizon: HorizonClient,
  _config: Config,
) {
  server.tool(
    "getOrderbook",
    "Get Stellar DEX orderbook for an asset pair with spread and midprice",
    {
      sellingAsset: z
        .string()
        .describe('Selling asset: "XLM" or "CODE:ISSUER" (e.g. "USDC:GA5Z...")'),
      buyingAsset: z
        .string()
        .describe('Buying asset: "XLM" or "CODE:ISSUER" (e.g. "USDC:GA5Z...")'),
      limit: z.number().min(1).max(200).default(20).describe("Number of orders per side"),
    },
    async ({ sellingAsset, buyingAsset, limit }) => {
      try {
        const selling = parseAsset(sellingAsset);
        const buying = parseAsset(buyingAsset);

        const params: Record<string, string> = {
          selling_asset_type: selling.assetType,
          buying_asset_type: buying.assetType,
          limit: String(limit),
        };
        if (!selling.isNative) {
          params.selling_asset_code = selling.code;
          params.selling_asset_issuer = selling.issuer!;
        }
        if (!buying.isNative) {
          params.buying_asset_code = buying.code;
          params.buying_asset_issuer = buying.issuer!;
        }

        const data = await horizon.getOrderbook(params);

        const lowestAsk = data.asks.length > 0 ? parseFloat(data.asks[0].price) : null;
        const highestBid = data.bids.length > 0 ? parseFloat(data.bids[0].price) : null;
        const spread = lowestAsk !== null && highestBid !== null ? lowestAsk - highestBid : null;
        const midPrice =
          lowestAsk !== null && highestBid !== null ? (lowestAsk + highestBid) / 2 : null;

        const formatted = {
          bids: data.bids.map((b) => ({ price: b.price, amount: b.amount })),
          asks: data.asks.map((a) => ({ price: a.price, amount: a.amount })),
          spread: spread !== null ? spread.toFixed(7) : null,
          midPrice: midPrice !== null ? midPrice.toFixed(7) : null,
        };
        return { content: [{ type: "text", text: JSON.stringify(formatted, null, 2) }] };
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        return toolError("orderbook_error", msg.slice(0, 200));
      }
    },
  );
}
