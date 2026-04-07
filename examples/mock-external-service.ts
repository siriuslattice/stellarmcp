/**
 * Mock External x402 Service — Spend Side
 *
 * A trivial Express server that returns enrichment data for a fee.
 * Used by the agent demo to demonstrate the spend side of the earn/spend loop.
 *
 * In production, this would be a real x402 service on the Bazaar.
 * For the hackathon demo, it simulates an x402 paywall with a simple
 * payment header check.
 *
 * Usage: pnpm demo:service
 */

import express from "express";

const app = express();
const PORT = 4022;

// Simulated x402 paywall — in production this would use @x402/express middleware
app.get("/enrich/timestamp", (req, res) => {
  const paymentHeader = req.headers["x-payment"] || req.headers["x-402-payment"];

  if (!paymentHeader) {
    res.status(402).json({
      error: "payment_required",
      price: "$0.0005",
      network: "stellar:testnet",
      message: "Send x402 payment to access this endpoint",
    });
    return;
  }

  // In production, verify the payment via facilitator
  // For demo, accept any payment header as valid
  console.error(
    `[mock-service] Payment received: ${typeof paymentHeader === "string" ? paymentHeader.slice(0, 40) : "..."}...`,
  );

  res.json({
    service: "mock-enrichment",
    data: {
      utcTimestamp: new Date().toISOString(),
      unixMs: Date.now(),
      source: "mock-external-service",
    },
    payment: {
      amount: "$0.0005",
      status: "settled",
    },
  });
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "mock-external-service", price: "$0.0005/call" });
});

app.listen(PORT, () => {
  console.error(`[mock-service] External x402 service running on http://localhost:${PORT}`);
  console.error(`[mock-service] GET /enrich/timestamp — $0.0005 per call`);
  console.error(`[mock-service] GET /health — free`);
});
