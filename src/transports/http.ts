import express, { type Express } from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import type { Config } from "../config.js";
import type { HorizonClient } from "../providers/horizon.js";

export function createHttpServer(config: Config, horizon: HorizonClient): Express {
  const app = express();
  app.use(cors());
  app.use(rateLimit({ windowMs: 60_000, max: 60, message: { error: "rate_limited" } }));

  // Health check
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", network: config.stellarNetwork });
  });

  // Tool endpoints (x402 gating added in Phase 0 expansion)
  app.get("/tools/getAccount", async (req, res) => {
    try {
      const accountId = req.query.accountId as string;
      if (!accountId) { res.status(400).json({ error: "missing accountId" }); return; }
      const data = await horizon.getAccount(accountId);
      res.json(data);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      res.status(msg.includes("404") ? 404 : 500).json({ error: msg.slice(0, 200) });
    }
  });

  app.get("/tools/getNetworkStatus", async (_req, res) => {
    try {
      const data = await horizon.getRoot();
      res.json({
        network: config.stellarNetwork,
        horizonVersion: data.horizon_version,
        coreVersion: data.core_version,
        protocolVersion: data.current_protocol_version,
        latestLedger: data.history_latest_ledger,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ error: msg.slice(0, 200) });
    }
  });

  return app;
}
