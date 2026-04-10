import type { HorizonClient } from "./horizon.js";
import { parseAsset } from "../utils/formatters.js";

const RESOLUTION_MAP: Record<string, number> = {
  "1m": 60000,
  "5m": 300000,
  "15m": 900000,
  "1h": 3600000,
  "1d": 86400000,
  "1w": 604800000,
};

function buildAssetParams(
  prefix: string,
  asset: ReturnType<typeof parseAsset>,
): Record<string, string> {
  const params: Record<string, string> = {
    [`${prefix}_asset_type`]: asset.assetType,
  };
  if (!asset.isNative) {
    params[`${prefix}_asset_code`] = asset.code;
    params[`${prefix}_asset_issuer`] = asset.issuer!;
  }
  return params;
}

export class PriceService {
  constructor(private horizon: HorizonClient) {}

  async getPrice(
    baseAsset: string,
    counterAsset: string,
  ): Promise<{ price: string; source: string; timestamp: string }> {
    const base = parseAsset(baseAsset);
    const counter = parseAsset(counterAsset);

    // Try orderbook mid-price first
    const orderbookParams: Record<string, string> = {
      ...buildAssetParams("selling", base),
      ...buildAssetParams("buying", counter),
      limit: "1",
    };

    const orderbook = await this.horizon.getOrderbook(orderbookParams);

    const lowestAsk =
      orderbook.asks.length > 0 ? parseFloat(orderbook.asks[0].price) : null;
    const highestBid =
      orderbook.bids.length > 0 ? parseFloat(orderbook.bids[0].price) : null;

    if (lowestAsk !== null && highestBid !== null) {
      const midPrice = (lowestAsk + highestBid) / 2;
      return {
        price: midPrice.toFixed(7),
        source: "sdex_orderbook",
        timestamp: new Date().toISOString(),
      };
    }

    // Fall back to trade aggregations (last close price)
    const tradeParams: Record<string, string> = {
      ...buildAssetParams("base", base),
      ...buildAssetParams("counter", counter),
      resolution: String(RESOLUTION_MAP["1h"]),
      limit: "1",
      order: "desc",
    };

    const trades = await this.horizon.getTradeAggregations(tradeParams);
    const records = trades._embedded.records;

    if (records.length === 0) {
      throw new Error(
        `No price data available for ${baseAsset}/${counterAsset}`,
      );
    }

    return {
      price: parseFloat(records[0].close).toFixed(7),
      source: "sdex_trades",
      timestamp: new Date(parseInt(records[0].timestamp, 10)).toISOString(),
    };
  }

  async getPriceHistory(
    baseAsset: string,
    counterAsset: string,
    resolution: string,
    limit: number,
  ): Promise<{
    candles: {
      timestamp: string;
      open: string;
      high: string;
      low: string;
      close: string;
      volume: string;
      tradeCount: string;
    }[];
  }> {
    const base = parseAsset(baseAsset);
    const counter = parseAsset(counterAsset);

    const resolutionMs = RESOLUTION_MAP[resolution];
    if (!resolutionMs) {
      throw new Error(
        `Invalid resolution: ${resolution}. Use: ${Object.keys(RESOLUTION_MAP).join(", ")}`,
      );
    }

    const params: Record<string, string> = {
      ...buildAssetParams("base", base),
      ...buildAssetParams("counter", counter),
      resolution: String(resolutionMs),
      limit: String(limit),
      order: "desc",
    };

    const data = await this.horizon.getTradeAggregations(params);

    const candles = data._embedded.records.map((r) => ({
      timestamp: new Date(parseInt(r.timestamp, 10)).toISOString(),
      open: r.open,
      high: r.high,
      low: r.low,
      close: r.close,
      volume: r.base_volume,
      tradeCount: r.trade_count,
    }));

    return { candles };
  }

  async getVWAP(
    baseAsset: string,
    counterAsset: string,
    resolution: string,
    limit: number,
  ): Promise<{ vwap: string; volume: string; candles: number }> {
    const base = parseAsset(baseAsset);
    const counter = parseAsset(counterAsset);

    const resolutionMs = RESOLUTION_MAP[resolution];
    if (!resolutionMs) {
      throw new Error(
        `Invalid resolution: ${resolution}. Use: ${Object.keys(RESOLUTION_MAP).join(", ")}`,
      );
    }

    const params: Record<string, string> = {
      ...buildAssetParams("base", base),
      ...buildAssetParams("counter", counter),
      resolution: String(resolutionMs),
      limit: String(limit),
      order: "desc",
    };

    const data = await this.horizon.getTradeAggregations(params);
    const records = data._embedded.records;

    if (records.length === 0) {
      throw new Error(
        `No trade data available for ${baseAsset}/${counterAsset}`,
      );
    }

    let weightedSum = 0;
    let totalVolume = 0;

    for (const r of records) {
      const avg = parseFloat(r.avg);
      const vol = parseFloat(r.base_volume);
      weightedSum += avg * vol;
      totalVolume += vol;
    }

    const vwap = totalVolume > 0 ? weightedSum / totalVolume : 0;

    return {
      vwap: vwap.toFixed(7),
      volume: totalVolume.toFixed(7),
      candles: records.length,
    };
  }
}
