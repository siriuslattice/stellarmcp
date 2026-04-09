import express, { type Express, type Request, type Response } from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import type { Config } from "../config.js";
import type { HorizonClient } from "../providers/horizon.js";
import { parseAsset } from "../utils/formatters.js";
import { TOOL_PRICES, FREE_ROUTES } from "../x402/pricing.js";
import { logger } from "../utils/logger.js";

function validateAccountId(accountId: unknown): string | null {
  if (typeof accountId !== "string" || !accountId.match(/^G[A-Z2-7]{55}$/)) return null;
  return accountId;
}

function parseLimit(raw: unknown, defaultVal: number, max: number): number {
  const n = parseInt(String(raw), 10);
  if (isNaN(n) || n < 1) return defaultVal;
  return Math.min(n, max);
}

const RESOLUTION_MAP: Record<string, number> = {
  "1m": 60000,
  "5m": 300000,
  "15m": 900000,
  "1h": 3600000,
  "1d": 86400000,
  "1w": 604800000,
};

function errJson(res: Response, error: unknown) {
  const msg = error instanceof Error ? error.message : "Unknown error";
  logger.error("Request error", { error: msg });
  if (msg.includes("404")) { res.status(404).json({ error: "Not found" }); return; }
  if (msg.includes("429")) { res.status(429).json({ error: "Rate limited — try again later" }); return; }
  if (msg.includes("400")) { res.status(400).json({ error: "Invalid request" }); return; }
  res.status(500).json({ error: "Internal server error" });
}

export async function createHttpServer(config: Config, horizon: HorizonClient): Promise<Express> {
  const app = express();
  app.use(cors({
    origin: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(",") : "*",
  }));
  app.use(rateLimit({ windowMs: 60_000, max: 60, message: { error: "rate_limited" }, keyGenerator: (req) => req.ip || "unknown" }));

  // x402 payment middleware (when facilitator is configured)
  // MUST be awaited before route registration so middleware runs first
  if (config.stellarPayeeAddress && config.ozFacilitatorUrl && config.ozApiKey) {
    await setupX402(app, config);
  } else {
    logger.warn("x402 not configured — all endpoints are free");
  }

  // --- Free endpoints ---

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", network: config.stellarNetwork });
  });

  app.get("/tools/getNetworkStatus", async (_req: Request, res: Response) => {
    try {
      const data = await horizon.getRoot();
      res.json({
        network: config.stellarNetwork,
        horizonVersion: data.horizon_version,
        coreVersion: data.core_version,
        protocolVersion: data.current_protocol_version,
        latestLedger: data.history_latest_ledger,
        closedAt: data.history_latest_ledger_closed_at,
        networkPassphrase: data.network_passphrase,
      });
    } catch (error) {
      errJson(res, error);
    }
  });

  // Serve OpenClaw skill file
  app.get("/skill.md", (_req, res) => {
    res.sendFile("skill.md", { root: process.cwd() });
  });

  // --- Paid endpoints ---

  app.get("/tools/getAccount", async (req: Request, res: Response) => {
    try {
      const accountId = validateAccountId(req.query.accountId);
      if (!accountId) { res.status(400).json({ error: "invalid accountId" }); return; }
      const data = await horizon.getAccount(accountId);
      res.json({
        address: data.account_id,
        sequence: data.sequence,
        balances: data.balances.map((b) => ({
          asset: b.asset_type === "native" ? "XLM" : `${b.asset_code}:${b.asset_issuer}`,
          balance: b.balance,
          limit: b.limit,
        })),
        thresholds: data.thresholds,
        signerCount: data.signers.length,
      });
    } catch (error) {
      errJson(res, error);
    }
  });

  app.get("/tools/getTransactions", async (req: Request, res: Response) => {
    try {
      const accountId = validateAccountId(req.query.accountId);
      if (!accountId) { res.status(400).json({ error: "invalid accountId" }); return; }
      const limit = parseLimit(req.query.limit, 10, 50);
      const data = await horizon.getTransactions(accountId, limit);
      res.json(
        data._embedded.records.map((tx) => ({
          hash: tx.hash,
          ledger: tx.ledger,
          createdAt: tx.created_at,
          fee: tx.fee_charged,
          opCount: tx.operation_count,
          successful: tx.successful,
          memo: tx.memo ?? null,
        })),
      );
    } catch (error) {
      errJson(res, error);
    }
  });

  app.get("/tools/getPayments", async (req: Request, res: Response) => {
    try {
      const accountId = validateAccountId(req.query.accountId);
      if (!accountId) { res.status(400).json({ error: "invalid accountId" }); return; }
      const limit = parseLimit(req.query.limit, 10, 50);
      const data = await horizon.getPayments(accountId, limit);
      res.json(
        data._embedded.records.map((op) => ({
          type: op.type,
          from: op.from ?? op.source_account,
          to: op.to ?? null,
          asset:
            op.asset_type === "native"
              ? "XLM"
              : op.asset_code && op.asset_issuer
                ? `${op.asset_code}:${op.asset_issuer}`
                : null,
          amount: op.amount ?? null,
          createdAt: op.created_at,
        })),
      );
    } catch (error) {
      errJson(res, error);
    }
  });

  app.get("/tools/getOrderbook", async (req: Request, res: Response) => {
    try {
      const sellingAsset = req.query.sellingAsset as string;
      const buyingAsset = req.query.buyingAsset as string;
      if (!sellingAsset || !buyingAsset) {
        res.status(400).json({ error: "missing sellingAsset or buyingAsset" });
        return;
      }
      const limit = parseLimit(req.query.limit, 20, 200);
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

      res.json({
        bids: data.bids.map((b) => ({ price: b.price, amount: b.amount })),
        asks: data.asks.map((a) => ({ price: a.price, amount: a.amount })),
        spread: lowestAsk !== null && highestBid !== null ? (lowestAsk - highestBid).toFixed(7) : null,
        midPrice: lowestAsk !== null && highestBid !== null ? ((lowestAsk + highestBid) / 2).toFixed(7) : null,
      });
    } catch (error) {
      errJson(res, error);
    }
  });

  app.get("/tools/getTradeAggregations", async (req: Request, res: Response) => {
    try {
      const baseAsset = req.query.baseAsset as string;
      const counterAsset = req.query.counterAsset as string;
      if (!baseAsset || !counterAsset) {
        res.status(400).json({ error: "missing baseAsset or counterAsset" });
        return;
      }
      const resolution = (req.query.resolution as string) || "1h";
      const resolutionMs = RESOLUTION_MAP[resolution];
      if (!resolutionMs) { res.status(400).json({ error: "invalid resolution" }); return; }
      const limit = parseLimit(req.query.limit, 24, 200);

      const base = parseAsset(baseAsset);
      const counter = parseAsset(counterAsset);

      const params: Record<string, string> = {
        base_asset_type: base.assetType,
        counter_asset_type: counter.assetType,
        resolution: String(resolutionMs),
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
      res.json(
        data._embedded.records.map((r) => ({
          timestamp: r.timestamp,
          open: r.open,
          high: r.high,
          low: r.low,
          close: r.close,
          baseVolume: r.base_volume,
          counterVolume: r.counter_volume,
          tradeCount: r.trade_count,
          avg: r.avg,
        })),
      );
    } catch (error) {
      errJson(res, error);
    }
  });

  app.get("/tools/getAssetInfo", async (req: Request, res: Response) => {
    try {
      const assetCode = req.query.assetCode as string;
      if (!assetCode) { res.status(400).json({ error: "missing assetCode" }); return; }

      if (assetCode.toUpperCase() === "XLM") {
        res.json({
          code: "XLM",
          issuer: null,
          type: "native",
          totalSupply: "105443902087.3472865",
          numAccounts: null,
          flags: { authRequired: false, authRevocable: false, authImmutable: false, authClawbackEnabled: false },
        });
        return;
      }

      const assetIssuer = req.query.assetIssuer as string | undefined;
      const data = await horizon.getAssets(assetCode, assetIssuer);
      const records = data._embedded.records;
      if (records.length === 0) { res.status(404).json({ error: `Asset ${assetCode} not found` }); return; }

      res.json(
        records.map((asset) => ({
          code: asset.asset_code,
          issuer: asset.asset_issuer,
          type: asset.asset_type,
          totalSupply: asset.amount,
          numAccounts: asset.num_accounts,
          flags: {
            authRequired: asset.flags.auth_required,
            authRevocable: asset.flags.auth_revocable,
            authImmutable: asset.flags.auth_immutable,
            authClawbackEnabled: asset.flags.auth_clawback_enabled,
          },
        })),
      );
    } catch (error) {
      errJson(res, error);
    }
  });

  app.get("/tools/getLedger", async (req: Request, res: Response) => {
    try {
      let seq = Number(req.query.sequence);
      if (!seq || isNaN(seq)) {
        const root = await horizon.getRoot();
        seq = root.history_latest_ledger;
      }
      const data = await horizon.getLedger(seq);
      res.json({
        sequence: data.sequence,
        hash: data.hash,
        closedAt: data.closed_at,
        txCount: data.transaction_count,
        opCount: data.operation_count,
        baseFee: data.base_fee_in_stroops,
        totalCoins: data.total_coins,
        protocolVersion: data.protocol_version,
      });
    } catch (error) {
      errJson(res, error);
    }
  });

  // Pricing info endpoint
  app.get("/pricing", (_req, res) => {
    res.json({
      paid: TOOL_PRICES,
      free: [...FREE_ROUTES],
      currency: "USD",
      settlement: "x402 on Stellar",
    });
  });

  return app;
}

async function setupX402(app: Express, config: Config) {
  try {
    const { paymentMiddleware, x402ResourceServer } = await import("@x402/express");
    const { ExactStellarScheme } = await import("@x402/stellar/exact/server");
    const { HTTPFacilitatorClient } = await import("@x402/core/server");

    const facilitatorClient = new HTTPFacilitatorClient({
      url: config.ozFacilitatorUrl!,
      createAuthHeaders: async () => {
        const headers = { Authorization: `Bearer ${config.ozApiKey}` };
        return { verify: headers, settle: headers, supported: headers };
      },
    });

    const network = config.stellarNetwork === "testnet" ? "stellar:testnet" : "stellar:pubnet";
    const resourceServer = new x402ResourceServer(facilitatorClient).register(
      network,
      new ExactStellarScheme(),
    );

    const routePricing: Record<string, { accepts: { scheme: string; price: string; network: string; payTo: string }[]; description: string; mimeType: string }> = {};
    for (const [route, price] of Object.entries(TOOL_PRICES)) {
      routePricing[`GET ${route}`] = {
        accepts: [
          {
            scheme: "exact",
            price,
            network,
            payTo: config.stellarPayeeAddress!,
          },
        ],
        description: "Stellar data query",
        mimeType: "application/json",
      };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    app.use(paymentMiddleware(routePricing as any, resourceServer));
    logger.info("x402 payment middleware enabled");
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error("x402 setup failed", { error: msg });
    throw new Error(`x402 configuration provided but setup failed: ${msg}`);
  }
}
