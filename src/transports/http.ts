import express, { type Express, type Request, type Response } from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Config } from "../config.js";
import type { HorizonClient } from "../providers/horizon.js";
import { PriceService } from "../providers/price.js";
import { SdexOracle, ReflectorOracle } from "../providers/oracle.js";
import { PriceAggregator } from "../providers/aggregator.js";
import { SorobanClient } from "../providers/soroban.js";
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

const CONTRACT_ID_REGEX = /^C[A-Z2-7]{55}$/;

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

export async function createHttpServer(
  config: Config,
  horizon: HorizonClient,
  mcpServer: McpServer,
): Promise<Express> {
  const app = express();
  const serverStartTime = Date.now();
  app.use(cors({
    origin: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(",") : "*",
  }));

  // Per-tool rate limits: free routes get a lower bucket, paid routes get higher.
  // /mcp is exempt entirely (MCP clients are stateful and may spike legitimately).
  const freeRouteLimiter = rateLimit({
    windowMs: 60_000,
    max: 60,
    keyGenerator: (req) => req.ip || "unknown",
    message: { error: "rate_limited" },
  });

  const paidRouteLimiter = rateLimit({
    windowMs: 60_000,
    max: 120,
    keyGenerator: (req) => req.ip || "unknown",
    message: { error: "rate_limited" },
  });

  const FREE_PATHS = new Set([
    "/health",
    "/tools/getNetworkStatus",
    "/pricing",
    "/skill.md",
    "/docs",
    "/openapi.yaml",
  ]);

  app.use((req, res, next) => {
    // /mcp is exempt — MCP clients are stateful and bursts are normal
    if (req.path.startsWith("/mcp")) return next();
    if (FREE_PATHS.has(req.path)) return freeRouteLimiter(req, res, next);
    return paidRouteLimiter(req, res, next);
  });

  // Body parser for /mcp POST requests (must be registered before MCP routes)
  app.use(express.json({ limit: "1mb" }));

  // --- MCP-over-HTTP transport (mounted before x402 so it stays free) ---
  const mcpTransport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
  });
  await mcpServer.connect(mcpTransport);

  app.post("/mcp", async (req, res) => {
    try {
      await mcpTransport.handleRequest(req, res, req.body);
    } catch (err) {
      logger.error("MCP POST error", { error: err instanceof Error ? err.message : String(err) });
      if (!res.headersSent) res.status(500).json({ error: "internal_error" });
    }
  });

  app.get("/mcp", async (req, res) => {
    try {
      await mcpTransport.handleRequest(req, res);
    } catch (err) {
      logger.error("MCP GET error", { error: err instanceof Error ? err.message : String(err) });
      if (!res.headersSent) res.status(500).json({ error: "internal_error" });
    }
  });

  app.delete("/mcp", async (req, res) => {
    try {
      await mcpTransport.handleRequest(req, res);
    } catch (err) {
      logger.error("MCP DELETE error", { error: err instanceof Error ? err.message : String(err) });
      if (!res.headersSent) res.status(500).json({ error: "internal_error" });
    }
  });

  logger.info("MCP-over-HTTP transport mounted at /mcp");

  // --- Self-service developer documentation ---

  // Serve the OpenAPI spec from disk for Swagger UI / external tooling
  app.get("/openapi.yaml", async (_req, res) => {
    try {
      const specPath = path.join(process.cwd(), "openapi.yaml");
      const yaml = await readFile(specPath, "utf8");
      res.type("application/yaml").send(yaml);
    } catch (err) {
      logger.error("Failed to serve openapi.yaml", {
        error: err instanceof Error ? err.message : String(err),
      });
      res.status(500).json({ error: "spec_not_available" });
    }
  });

  // Self-service developer docs — embeds Swagger UI via public CDN
  app.get("/docs", (_req, res) => {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>StellarMCP — API Documentation</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  <style>
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #fafafa; }
    .header { background: #08090a; color: #fff; padding: 32px 24px; }
    .header h1 { margin: 0 0 8px 0; font-size: 28px; }
    .header p { margin: 0; opacity: 0.85; max-width: 800px; }
    .header a { color: #6cf; text-decoration: none; }
    .quickstart { padding: 24px; background: #fff; border-bottom: 1px solid #e5e5e5; }
    .quickstart h2 { margin-top: 0; }
    .quickstart pre { background: #f6f8fa; padding: 12px 16px; border-radius: 6px; overflow-x: auto; border: 1px solid #e5e5e5; font-size: 13px; }
    .quickstart code { font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; }
    .quickstart .row { display: grid; grid-template-columns: 200px 1fr; gap: 16px; align-items: start; margin-bottom: 12px; }
    .quickstart .row strong { font-weight: 600; }
    #swagger-ui { padding-top: 16px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>StellarMCP API</h1>
    <p>17 MCP tools for Stellar blockchain data, monetized via <a href="https://www.x402.org/">x402</a> micropayments settled on Stellar. Read-only access to accounts, transactions, DEX orderbooks, trade history, asset metadata, normalized prices, and SEP-41 Soroban tokens.</p>
  </div>
  <div class="quickstart">
    <h2>Quick Start</h2>
    <div class="row">
      <strong>Free endpoint:</strong>
      <pre><code>curl http://localhost:4021/tools/getNetworkStatus</code></pre>
    </div>
    <div class="row">
      <strong>List tool prices:</strong>
      <pre><code>curl http://localhost:4021/pricing</code></pre>
    </div>
    <div class="row">
      <strong>Server health:</strong>
      <pre><code>curl http://localhost:4021/health</code></pre>
    </div>
    <div class="row">
      <strong>MCP-over-HTTP:</strong>
      <pre><code>curl -X POST http://localhost:4021/mcp \\
  -H "Content-Type: application/json" \\
  -H "Accept: application/json, text/event-stream" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"my-client","version":"1.0.0"}}}'</code></pre>
    </div>
    <div class="row">
      <strong>npm install:</strong>
      <pre><code>npx stellar-mcp-x402</code></pre>
    </div>
  </div>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.onload = function() {
      window.ui = SwaggerUIBundle({
        url: "/openapi.yaml",
        dom_id: "#swagger-ui",
        deepLinking: true,
        presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
        layout: "StandaloneLayout",
      });
    };
  </script>
</body>
</html>`;
    res.type("html").send(html);
  });

  // x402 payment middleware (when facilitator is configured)
  // MUST be awaited before route registration so middleware runs first
  if (config.stellarPayeeAddress && config.ozFacilitatorUrl && config.ozApiKey) {
    await setupX402(app, config);
  } else {
    logger.warn("x402 not configured — all endpoints are free");
  }

  // --- Free endpoints ---

  app.get("/health", (_req, res) => {
    const uptimeSeconds = Math.floor((Date.now() - serverStartTime) / 1000);
    const paidToolCount = Object.keys(TOOL_PRICES).length;
    const freeToolNames = ["getNetworkStatus"];
    const x402Configured = !!(
      config.stellarPayeeAddress &&
      config.ozFacilitatorUrl &&
      config.ozApiKey
    );
    const payeeShort = config.stellarPayeeAddress
      ? `${config.stellarPayeeAddress.slice(0, 8)}...${config.stellarPayeeAddress.slice(-4)}`
      : null;

    res.json({
      status: "ok",
      version: "0.2.0",
      network: config.stellarNetwork,
      horizonUrl: config.horizonUrl,
      uptime: uptimeSeconds,
      tools: {
        count: paidToolCount + freeToolNames.length,
        free: freeToolNames,
        paid: paidToolCount,
      },
      transports: {
        stdio: false,
        http: true,
        mcpOverHttp: true,
      },
      x402: {
        enabled: x402Configured,
        facilitator: config.ozFacilitatorUrl
          ? new URL(config.ozFacilitatorUrl).hostname
          : null,
        payee: payeeShort,
      },
      oracles: {
        sdex: true,
        reflector: !!config.reflectorContractId,
      },
      soroban: {
        configured: !!config.sorobanRpcUrl,
      },
    });
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

  // --- New Horizon tools ---

  app.get("/tools/getEffects", async (req: Request, res: Response) => {
    try {
      const accountId = validateAccountId(req.query.accountId);
      if (!accountId) { res.status(400).json({ error: "invalid accountId" }); return; }
      const limit = parseLimit(req.query.limit, 10, 50);
      const data = await horizon.getEffects(accountId, limit);
      res.json(
        data._embedded.records.map((e) => ({
          id: e.id,
          type: e.type,
          account: e.account,
          createdAt: e.created_at,
        })),
      );
    } catch (error) {
      errJson(res, error);
    }
  });

  app.get("/tools/getOffers", async (req: Request, res: Response) => {
    try {
      const accountId = validateAccountId(req.query.accountId);
      if (!accountId) { res.status(400).json({ error: "invalid accountId" }); return; }
      const limit = parseLimit(req.query.limit, 10, 50);
      const data = await horizon.getOffers(accountId, limit);
      res.json(
        data._embedded.records.map((o) => ({
          id: o.id,
          seller: o.seller,
          selling:
            o.selling.asset_type === "native"
              ? "XLM"
              : `${o.selling.asset_code}:${o.selling.asset_issuer}`,
          buying:
            o.buying.asset_type === "native"
              ? "XLM"
              : `${o.buying.asset_code}:${o.buying.asset_issuer}`,
          amount: o.amount,
          price: o.price,
          lastModifiedLedger: o.last_modified_ledger,
        })),
      );
    } catch (error) {
      errJson(res, error);
    }
  });

  app.get("/tools/getOperations", async (req: Request, res: Response) => {
    try {
      const accountId = validateAccountId(req.query.accountId);
      if (!accountId) { res.status(400).json({ error: "invalid accountId" }); return; }
      const limit = parseLimit(req.query.limit, 10, 50);
      const data = await horizon.getOperations(accountId, limit);
      res.json(
        data._embedded.records.map((op) => ({
          id: op.id,
          type: op.type,
          sourceAccount: op.source_account,
          createdAt: op.created_at,
          transactionHash: op.transaction_hash,
          ...(op.from ? { from: op.from } : {}),
          ...(op.to ? { to: op.to } : {}),
          ...(op.amount ? { amount: op.amount } : {}),
          ...(op.asset_type
            ? {
                asset:
                  op.asset_type === "native"
                    ? "XLM"
                    : op.asset_code && op.asset_issuer
                      ? `${op.asset_code}:${op.asset_issuer}`
                      : null,
              }
            : {}),
        })),
      );
    } catch (error) {
      errJson(res, error);
    }
  });

  app.get("/tools/getLiquidityPools", async (req: Request, res: Response) => {
    try {
      const limit = parseLimit(req.query.limit, 10, 50);
      const params: Record<string, string> = { limit: String(limit) };
      const account = req.query.account as string | undefined;
      if (account) {
        const validAccount = validateAccountId(account);
        if (!validAccount) { res.status(400).json({ error: "invalid account" }); return; }
        params.account = validAccount;
      }
      const data = await horizon.getLiquidityPools(params);
      res.json(
        data._embedded.records.map((p) => ({
          id: p.id,
          fee: p.fee_bp,
          totalTrustlines: p.total_trustlines,
          totalShares: p.total_shares,
          reserves: p.reserves,
        })),
      );
    } catch (error) {
      errJson(res, error);
    }
  });

  app.get("/tools/getClaimableBalances", async (req: Request, res: Response) => {
    try {
      const limit = parseLimit(req.query.limit, 10, 50);
      const params: Record<string, string> = { limit: String(limit) };
      const claimant = req.query.claimant as string | undefined;
      if (claimant) {
        const validClaimant = validateAccountId(claimant);
        if (!validClaimant) { res.status(400).json({ error: "invalid claimant" }); return; }
        params.claimant = validClaimant;
      }
      const asset = req.query.asset as string | undefined;
      if (asset) {
        const parsed = parseAsset(asset);
        if (parsed.isNative) {
          params.asset = "native";
        } else {
          params.asset = `${parsed.code}:${parsed.issuer}`;
        }
      }
      const data = await horizon.getClaimableBalances(params);
      res.json(
        data._embedded.records.map((cb) => ({
          id: cb.id,
          amount: cb.amount,
          asset: cb.asset,
          sponsor: cb.sponsor,
          claimants: cb.claimants,
          lastModifiedLedger: cb.last_modified_ledger,
        })),
      );
    } catch (error) {
      errJson(res, error);
    }
  });

  // --- Price tools ---

  const priceService = new PriceService(horizon);
  const sdexOracle = new SdexOracle(priceService);
  const reflectorOracle = new ReflectorOracle({
    contractId: config.reflectorContractId,
    sorobanRpcUrl: config.sorobanRpcUrl,
  });
  const aggregator = new PriceAggregator([sdexOracle, reflectorOracle]);

  app.get("/tools/getPrice", async (req: Request, res: Response) => {
    try {
      const baseAsset = req.query.baseAsset as string;
      const counterAsset = req.query.counterAsset as string;
      if (!baseAsset || !counterAsset) {
        res.status(400).json({ error: "missing baseAsset or counterAsset" });
        return;
      }
      parseAsset(baseAsset);
      parseAsset(counterAsset);
      const result = await aggregator.getPrice(baseAsset, counterAsset);
      res.json(result);
    } catch (error) {
      errJson(res, error);
    }
  });

  app.get("/tools/getPriceHistory", async (req: Request, res: Response) => {
    try {
      const baseAsset = req.query.baseAsset as string;
      const counterAsset = req.query.counterAsset as string;
      if (!baseAsset || !counterAsset) {
        res.status(400).json({ error: "missing baseAsset or counterAsset" });
        return;
      }
      parseAsset(baseAsset);
      parseAsset(counterAsset);
      const resolution = (req.query.resolution as string) || "1h";
      if (!RESOLUTION_MAP[resolution]) { res.status(400).json({ error: "invalid resolution" }); return; }
      const limit = parseLimit(req.query.limit, 24, 200);
      const result = await priceService.getPriceHistory(baseAsset, counterAsset, resolution, limit);
      res.json(result);
    } catch (error) {
      errJson(res, error);
    }
  });

  app.get("/tools/getVWAP", async (req: Request, res: Response) => {
    try {
      const baseAsset = req.query.baseAsset as string;
      const counterAsset = req.query.counterAsset as string;
      if (!baseAsset || !counterAsset) {
        res.status(400).json({ error: "missing baseAsset or counterAsset" });
        return;
      }
      parseAsset(baseAsset);
      parseAsset(counterAsset);
      const resolution = (req.query.resolution as string) || "1h";
      if (!RESOLUTION_MAP[resolution]) { res.status(400).json({ error: "invalid resolution" }); return; }
      const limit = parseLimit(req.query.limit, 24, 200);
      const result = await priceService.getVWAP(baseAsset, counterAsset, resolution, limit);
      res.json(result);
    } catch (error) {
      errJson(res, error);
    }
  });

  // --- Soroban token tools ---

  app.get("/tools/getSorobanTokenInfo", async (req: Request, res: Response) => {
    try {
      if (!config.sorobanRpcUrl) {
        res.status(503).json({ error: "soroban_not_configured", message: "Soroban RPC URL not configured" });
        return;
      }

      const contractId = req.query.contractId as string;
      if (!contractId || !CONTRACT_ID_REGEX.test(contractId)) {
        res.status(400).json({ error: "invalid contractId" });
        return;
      }

      let accountId: string | undefined = undefined;
      if (req.query.accountId) {
        const candidate = validateAccountId(req.query.accountId);
        if (!candidate) {
          res.status(400).json({ error: "invalid accountId" });
          return;
        }
        accountId = candidate;
      }

      const networkPassphrase =
        config.stellarNetwork === "testnet"
          ? "Test SDF Network ; September 2015"
          : "Public Global Stellar Network ; September 2015";

      const sorobanClient = new SorobanClient(config.sorobanRpcUrl, networkPassphrase);

      const [symbolResult, nameResult, decimalsResult] = await Promise.allSettled([
        sorobanClient.simulateContractCall(contractId, "symbol"),
        sorobanClient.simulateContractCall(contractId, "name"),
        sorobanClient.simulateContractCall(contractId, "decimals"),
      ]);

      const symbol = symbolResult.status === "fulfilled" ? String(symbolResult.value) : null;
      const name = nameResult.status === "fulfilled" ? String(nameResult.value) : null;
      const decimals =
        decimalsResult.status === "fulfilled" ? Number(decimalsResult.value) : null;

      if (symbol === null && name === null && decimals === null) {
        res.status(404).json({ error: "not_a_token", message: "Contract did not respond to SEP-41 metadata methods" });
        return;
      }

      const result: Record<string, unknown> = { contractId, symbol, name, decimals };

      if (accountId) {
        try {
          const addressArg = await sorobanClient.encodeAddress(accountId);
          const rawBalance = await sorobanClient.simulateContractCall(contractId, "balance", [addressArg]);
          const balanceBig = typeof rawBalance === "bigint" ? rawBalance : BigInt(String(rawBalance));
          result.accountId = accountId;
          result.balance = balanceBig.toString();
          if (decimals !== null && decimals >= 0) {
            const scale = 10n ** BigInt(decimals);
            const whole = balanceBig / scale;
            const frac = balanceBig % scale;
            const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
            result.displayBalance = fracStr ? `${whole}.${fracStr}` : whole.toString();
          }
        } catch (balErr) {
          result.accountId = accountId;
          result.balanceError = balErr instanceof Error ? balErr.message.slice(0, 100) : String(balErr).slice(0, 100);
        }
      }

      res.json(result);
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
