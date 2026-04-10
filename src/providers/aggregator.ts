import type { OracleProvider } from "./oracle.js";
import { logger } from "../utils/logger.js";

export interface AggregatedPrice {
  base: string;
  counter: string;
  price: string;
  sources: { name: string; price: string; timestamp: string }[];
  timestamp: string;
}

export class PriceAggregator {
  constructor(private oracles: OracleProvider[]) {}

  async getPrice(base: string, counter: string): Promise<AggregatedPrice> {
    // 1. Check which oracles are available
    const availability = await Promise.all(
      this.oracles.map(async (o) => ({
        oracle: o,
        available: await o.isAvailable(),
      })),
    );
    const available = availability.filter((a) => a.available).map((a) => a.oracle);

    // 2. Query all available oracles in parallel (fault-tolerant)
    const results = await Promise.allSettled(
      available.map(async (o) => {
        const result = await o.getPrice(base, counter);
        return result === null ? null : { name: o.name, ...result };
      }),
    );

    // 3. Collect successful non-null sources
    const sources: { name: string; price: string; timestamp: string }[] = [];
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.status === "fulfilled" && r.value !== null) {
        sources.push(r.value);
      } else if (r.status === "rejected") {
        logger.warn("Oracle query failed", {
          oracle: available[i].name,
          error: r.reason instanceof Error ? r.reason.message : String(r.reason),
        });
      }
    }

    if (sources.length === 0) {
      throw new Error(`No oracle data available for ${base}/${counter}`);
    }

    // 4. Compute median
    const prices = sources.map((s) => parseFloat(s.price)).sort((a, b) => a - b);
    let median: number;
    if (prices.length % 2 === 1) {
      median = prices[Math.floor(prices.length / 2)];
    } else {
      const mid = prices.length / 2;
      median = (prices[mid - 1] + prices[mid]) / 2;
    }

    return {
      base,
      counter,
      price: median.toFixed(7),
      sources,
      timestamp: new Date().toISOString(),
    };
  }

  async getAvailableOracles(): Promise<string[]> {
    const checks = await Promise.all(
      this.oracles.map(async (o) => ({
        name: o.name,
        available: await o.isAvailable(),
      })),
    );
    return checks.filter((c) => c.available).map((c) => c.name);
  }
}
