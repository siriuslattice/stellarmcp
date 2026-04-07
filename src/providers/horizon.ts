import { cache } from "../utils/cache.js";
import { logger } from "../utils/logger.js";
import type { Config } from "../config.js";
import type {
  HorizonAccount,
  HorizonPage,
  HorizonTransaction,
  HorizonOperation,
  HorizonOrderbook,
  HorizonTradeAggregation,
  HorizonAsset,
  HorizonRoot,
  HorizonLedger,
} from "../types.js";

export class HorizonClient {
  private baseUrl: string;

  constructor(config: Config) {
    this.baseUrl = config.horizonUrl;
  }

  async get<T>(path: string, params?: Record<string, string>, cacheTtlMs = 15_000): Promise<T> {
    const url = new URL(path, this.baseUrl);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined) url.searchParams.set(k, v);
      }
    }

    const cacheKey = url.toString();
    const cached = cache.get<T>(cacheKey);
    if (cached) return cached;

    let attempt = 0;
    const maxRetries = 3;

    while (true) {
      const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });

      if (res.status === 429) {
        attempt++;
        if (attempt > maxRetries) throw new Error(`Horizon rate limited after ${maxRetries} retries`);
        const delay = Math.min(1000 * 2 ** attempt, 10_000);
        logger.warn(`Horizon 429, retry ${attempt} in ${delay}ms`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Horizon ${res.status}: ${body.slice(0, 200)}`);
      }

      const data = (await res.json()) as T;
      cache.set(cacheKey, data, cacheTtlMs);
      return data;
    }
  }

  async getAccount(accountId: string) {
    return this.get<HorizonAccount>(`/accounts/${accountId}`);
  }

  async getTransactions(accountId: string, limit = 10, order = "desc") {
    return this.get<HorizonPage<HorizonTransaction>>(`/accounts/${accountId}/transactions`, {
      limit: String(limit),
      order,
    });
  }

  async getPayments(accountId: string, limit = 10, order = "desc") {
    return this.get<HorizonPage<HorizonOperation>>(`/accounts/${accountId}/payments`, {
      limit: String(limit),
      order,
    });
  }

  async getRoot() {
    return this.get<HorizonRoot>("/", undefined, 10_000);
  }

  async getLedger(sequence: number) {
    return this.get<HorizonLedger>(`/ledgers/${sequence}`, undefined, 30_000);
  }

  async getAssets(assetCode: string, assetIssuer?: string) {
    const params: Record<string, string> = { asset_code: assetCode };
    if (assetIssuer) params.asset_issuer = assetIssuer;
    return this.get<HorizonPage<HorizonAsset>>("/assets", params, 60_000);
  }

  async getOrderbook(params: Record<string, string>) {
    return this.get<HorizonOrderbook>("/order_book", params, 5_000);
  }

  async getTradeAggregations(params: Record<string, string>) {
    return this.get<HorizonPage<HorizonTradeAggregation>>("/trade_aggregations", params);
  }
}
