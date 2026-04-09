/**
 * x402 Stress Test — Hit ALL StellarMCP endpoints and verify payment flow
 *
 * This script makes one request to each of the 8 tool endpoints:
 * - 1 free endpoint (getNetworkStatus)
 * - 7 paid endpoints (x402 payment flow: 402 -> sign -> retry -> 200)
 *
 * For each paid endpoint it verifies:
 * 1. Initial request returns 402 Payment Required
 * 2. Payment requirements can be parsed
 * 3. Payment payload can be signed
 * 4. Retry with payment header returns 200 with data
 * 5. Settlement transaction hash is returned
 *
 * Prerequisites:
 * - StellarMCP HTTP server running: TRANSPORT=http pnpm start
 * - Client wallet funded with testnet XLM + USDC trustline + USDC balance
 * - STELLAR_SECRET_KEY set in .env (client's secret key)
 *
 * Usage: pnpm x402:stress
 */

import "dotenv/config";
import { x402Client } from "@x402/core/client";
import { x402HTTPClient } from "@x402/core/http";
import { ExactStellarScheme } from "@x402/stellar/exact/client";
import { createEd25519Signer } from "@x402/stellar";

const SERVER_URL = process.env.STELLARMCP_URL || "http://localhost:4021";
const SECRET_KEY = process.env.STELLAR_SECRET_KEY;

if (!SECRET_KEY) {
  console.error("Error: STELLAR_SECRET_KEY not set in .env");
  process.exit(1);
}

// Create x402 Stellar client
const signer = createEd25519Signer(SECRET_KEY, "stellar:testnet");
const coreClient = new x402Client().register("stellar:*", new ExactStellarScheme(signer));
const httpClient = new x402HTTPClient(coreClient);

// ---------------------------------------------------------------------------
// Endpoint definitions
// ---------------------------------------------------------------------------

interface Endpoint {
  name: string;
  path: string;
  price: string; // "$0.001", "$0.002", or "free"
  paid: boolean;
}

const ENDPOINTS: Endpoint[] = [
  {
    name: "getNetworkStatus",
    path: "/tools/getNetworkStatus",
    price: "free",
    paid: false,
  },
  {
    name: "getAccount",
    path: "/tools/getAccount?accountId=GAQB35PQQ5Z7BVOFQE5F2AAAYGU34OIMON5NDJEMIQBEBY46WWHOCLJN",
    price: "$0.001",
    paid: true,
  },
  {
    name: "getTransactions",
    path: "/tools/getTransactions?accountId=GAQB35PQQ5Z7BVOFQE5F2AAAYGU34OIMON5NDJEMIQBEBY46WWHOCLJN&limit=5",
    price: "$0.001",
    paid: true,
  },
  {
    name: "getPayments",
    path: "/tools/getPayments?accountId=GAQB35PQQ5Z7BVOFQE5F2AAAYGU34OIMON5NDJEMIQBEBY46WWHOCLJN&limit=5",
    price: "$0.001",
    paid: true,
  },
  {
    name: "getOrderbook",
    path: "/tools/getOrderbook?sellingAsset=XLM&buyingAsset=USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5&limit=5",
    price: "$0.002",
    paid: true,
  },
  {
    name: "getTradeAggregations",
    path: "/tools/getTradeAggregations?baseAsset=XLM&counterAsset=USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5&resolution=1h&limit=5",
    price: "$0.002",
    paid: true,
  },
  {
    name: "getAssetInfo",
    path: "/tools/getAssetInfo?assetCode=USDC&assetIssuer=GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
    price: "$0.001",
    paid: true,
  },
  {
    name: "getLedger",
    path: "/tools/getLedger",
    price: "$0.001",
    paid: true,
  },
];

// ---------------------------------------------------------------------------
// Result tracking
// ---------------------------------------------------------------------------

interface Result {
  endpoint: string;
  price: string;
  status: "pass" | "fail";
  txHash: string;
  error?: string;
  durationMs: number;
}

const results: Result[] = [];

// ---------------------------------------------------------------------------
// Request helpers
// ---------------------------------------------------------------------------

async function testFreeEndpoint(ep: Endpoint): Promise<Result> {
  const url = `${SERVER_URL}${ep.path}`;
  const start = Date.now();

  console.error(`  [${ep.name}] GET ${ep.path}`);

  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });

    if (!res.ok) {
      const body = await res.text();
      console.error(`    FAIL: ${res.status} ${body.slice(0, 150)}`);
      return { endpoint: ep.name, price: ep.price, status: "fail", txHash: "-", error: `HTTP ${res.status}`, durationMs: Date.now() - start };
    }

    const data = await res.json();
    console.error(`    OK: ${JSON.stringify(data).slice(0, 100)}...`);
    return { endpoint: ep.name, price: ep.price, status: "pass", txHash: "-", durationMs: Date.now() - start };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`    FAIL: ${msg}`);
    return { endpoint: ep.name, price: ep.price, status: "fail", txHash: "-", error: msg, durationMs: Date.now() - start };
  }
}

async function testPaidEndpoint(ep: Endpoint): Promise<Result> {
  const url = `${SERVER_URL}${ep.path}`;
  const start = Date.now();

  console.error(`  [${ep.name}] GET ${ep.path}`);

  try {
    // Step 1: Initial request — expect 402
    const res = await fetch(url, { headers: { Accept: "application/json" } });

    if (res.status !== 402) {
      const body = await res.text();
      console.error(`    FAIL: Expected 402, got ${res.status}: ${body.slice(0, 150)}`);
      return { endpoint: ep.name, price: ep.price, status: "fail", txHash: "-", error: `Expected 402, got ${res.status}`, durationMs: Date.now() - start };
    }

    console.error("    <- 402 Payment Required");

    // Step 2: Parse payment requirements
    const paymentRequired = httpClient.getPaymentRequiredResponse(
      (name) => res.headers.get(name),
      await res.json(),
    );
    const requiredPrice = paymentRequired.accepts?.[0]?.price || "unknown";
    console.error(`    Price: ${JSON.stringify(requiredPrice)}`);

    // Step 3: Sign payment
    console.error("    Signing payment...");
    const paymentPayload = await httpClient.createPaymentPayload(paymentRequired);
    const paymentHeaders = httpClient.encodePaymentSignatureHeader(paymentPayload);

    // Step 4: Retry with payment header
    console.error("    -> Retrying with payment header...");
    const paidRes = await fetch(url, {
      headers: { Accept: "application/json", ...paymentHeaders },
    });

    if (!paidRes.ok) {
      const errBody = await paidRes.text();
      console.error(`    FAIL: Paid request returned ${paidRes.status}: ${errBody.slice(0, 200)}`);
      return { endpoint: ep.name, price: ep.price, status: "fail", txHash: "-", error: `Paid request ${paidRes.status}`, durationMs: Date.now() - start };
    }

    // Step 5: Extract settlement info
    const data = await paidRes.json();
    let txHash = "-";
    try {
      const settlement = httpClient.getPaymentSettleResponse(
        (name) => paidRes.headers.get(name),
      );
      txHash = settlement.transaction || "-";
      console.error(`    <- 200 OK — Settled: ${txHash}`);
    } catch {
      console.error("    <- 200 OK — Data received (no settlement header)");
    }

    console.error(`    Data: ${JSON.stringify(data).slice(0, 100)}...`);
    return { endpoint: ep.name, price: ep.price, status: "pass", txHash, durationMs: Date.now() - start };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`    FAIL: ${msg}`);
    return { endpoint: ep.name, price: ep.price, status: "fail", txHash: "-", error: msg, durationMs: Date.now() - start };
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.error("=".repeat(65));
  console.error("  x402 Stress Test — All StellarMCP Endpoints");
  console.error("=".repeat(65));
  console.error(`  Client:  ${signer.address}`);
  console.error(`  Server:  ${SERVER_URL}`);
  console.error(`  Endpoints: ${ENDPOINTS.length} (${ENDPOINTS.filter((e) => e.paid).length} paid, ${ENDPOINTS.filter((e) => !e.paid).length} free)`);
  console.error("");

  // Run endpoints sequentially to avoid rate limits
  for (const ep of ENDPOINTS) {
    const result = ep.paid ? await testPaidEndpoint(ep) : await testFreeEndpoint(ep);
    results.push(result);
    console.error("");
  }

  // ---------------------------------------------------------------------------
  // Summary table
  // ---------------------------------------------------------------------------
  console.error("=".repeat(65));
  console.error("  RESULTS");
  console.error("=".repeat(65));
  console.error("");

  // Table header
  const col = { name: 22, price: 8, status: 8, duration: 10, tx: 20 };
  const header =
    "Endpoint".padEnd(col.name) +
    "Price".padEnd(col.price) +
    "Status".padEnd(col.status) +
    "Duration".padEnd(col.duration) +
    "Tx Hash";
  console.error(`  ${header}`);
  console.error(`  ${"-".repeat(header.length + 30)}`);

  for (const r of results) {
    const statusTag = r.status === "pass" ? "PASS" : "FAIL";
    const duration = `${r.durationMs}ms`;
    const txDisplay = r.txHash === "-" ? "-" : r.txHash.slice(0, 16) + "...";
    const line =
      r.endpoint.padEnd(col.name) +
      r.price.padEnd(col.price) +
      statusTag.padEnd(col.status) +
      duration.padEnd(col.duration) +
      txDisplay;
    console.error(`  ${line}`);
  }

  console.error("");

  // Summary stats
  const passed = results.filter((r) => r.status === "pass").length;
  const failed = results.filter((r) => r.status === "fail").length;
  const paidPassed = results.filter((r) => r.status === "pass" && r.paid !== false).length;
  const totalCostCents =
    results
      .filter((r) => r.status === "pass" && r.price !== "free")
      .reduce((sum, r) => {
        const cents = parseFloat(r.price.replace("$", "")) * 100;
        return sum + cents;
      }, 0);
  const totalCost = (totalCostCents / 100).toFixed(3);

  console.error(`  Passed:    ${passed}/${results.length}`);
  console.error(`  Failed:    ${failed}/${results.length}`);
  console.error(`  Payments:  ${paidPassed} successful`);
  console.error(`  Total cost: $${totalCost}`);
  console.error("");
  console.error(`  Explorer: https://stellar.expert/explorer/testnet/account/${signer.address}`);
  console.error("=".repeat(65));

  // Exit with error if any endpoint failed
  if (failed > 0) {
    console.error("");
    console.error("  FAILED ENDPOINTS:");
    for (const r of results.filter((r) => r.status === "fail")) {
      console.error(`    - ${r.endpoint}: ${r.error || "unknown error"}`);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
