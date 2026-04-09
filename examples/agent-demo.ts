/**
 * StellarMCP Agent Demo — Earn/Spend Loop
 *
 * Demonstrates the full agent economy:
 * 1. EARN: Agent's StellarMCP server receives x402 payments for data queries
 * 2. SPEND: Agent pays an external x402 service to enrich its outputs
 *
 * If STELLAR_SECRET_KEY is set in .env, the EARN side uses real x402 payments
 * (signed Soroban USDC transfers on Stellar testnet). Otherwise falls back to
 * plain HTTP requests with a warning.
 *
 * Prerequisites:
 * - Terminal 1: TRANSPORT=http pnpm start  (StellarMCP x402 server on :4021)
 * - Terminal 2: pnpm demo:service           (Mock external service on :4022)
 * - Terminal 3: pnpm demo                   (This script)
 *
 * For real x402 payments, also set in .env:
 * - STELLAR_SECRET_KEY  (client wallet secret key)
 * - Client wallet must have testnet XLM + USDC trustline + USDC balance
 *   (Get USDC from Circle testnet faucet: https://faucet.circle.com — select Stellar)
 *
 * Usage: pnpm demo
 */

import "dotenv/config";

const STELLARMCP_URL = process.env.STELLARMCP_URL || "http://localhost:4021";
const EXTERNAL_SERVICE_URL = process.env.EXTERNAL_SERVICE_URL || "http://localhost:4022";
const SECRET_KEY = process.env.STELLAR_SECRET_KEY;

// Well-known Stellar testnet accounts for demo
const DEMO_ACCOUNTS = [
  "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7",
  "GALPCCZN4YXA3YMJHKL6CVIEZ64TPNO2RCVLVFVYKY5CJPBRSDO6HKQL",
];

interface DemoResult {
  step: string;
  status: "success" | "error";
  data?: unknown;
  error?: string;
  payment?: string;
}

const results: DemoResult[] = [];

function log(msg: string) {
  console.error(`\n[agent] ${msg}`);
}

function logResult(result: DemoResult) {
  results.push(result);
  const icon = result.status === "success" ? "+" : "!";
  console.error(`  [${icon}] ${result.step}: ${result.status}`);
  if (result.payment) console.error(`      Payment: ${result.payment}`);
}

// --- x402 client setup (lazy-loaded only when SECRET_KEY is available) ---

let httpClient: any = null;
let signerAddress: string | null = null;

async function initX402Client(): Promise<boolean> {
  if (!SECRET_KEY) return false;
  try {
    const { x402Client } = await import("@x402/core/client");
    const { x402HTTPClient } = await import("@x402/core/http");
    const { ExactStellarScheme } = await import("@x402/stellar/exact/client");
    const { createEd25519Signer } = await import("@x402/stellar");

    const signer = createEd25519Signer(SECRET_KEY, "stellar:testnet");
    const coreClient = new x402Client().register("stellar:*", new ExactStellarScheme(signer));
    httpClient = new x402HTTPClient(coreClient);
    signerAddress = signer.address;
    return true;
  } catch (err) {
    console.error(`  [!] Failed to initialize x402 client: ${err}`);
    console.error(`      Falling back to plain HTTP requests`);
    return false;
  }
}

/**
 * Make an x402-paid request: hit endpoint, handle 402, sign payment, retry.
 * Falls back to plain fetch if x402 client is not available.
 */
async function paidFetch(url: string): Promise<{ data: unknown; paid: boolean }> {
  const res = await fetch(url, { headers: { Accept: "application/json" } });

  // If not 402 or no x402 client, return as-is
  if (res.status !== 402 || !httpClient) {
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    return { data: await res.json(), paid: false };
  }

  // x402 flow: parse 402, sign payment, retry
  log("  Received 402 Payment Required — signing payment...");

  const paymentRequired = httpClient.getPaymentRequiredResponse(
    (name: string) => res.headers.get(name),
    await res.json(),
  );

  const price = paymentRequired.accepts?.[0]?.price || "unknown";
  console.error(`    Price: ${JSON.stringify(price)}`);

  const paymentPayload = await httpClient.createPaymentPayload(paymentRequired);
  const paymentHeaders = httpClient.encodePaymentSignatureHeader(paymentPayload);

  console.error("    Retrying with signed payment header...");
  const paidRes = await fetch(url, {
    headers: { Accept: "application/json", ...paymentHeaders },
  });

  if (!paidRes.ok) {
    const errBody = await paidRes.text();
    throw new Error(`Payment failed (${paidRes.status}): ${errBody.slice(0, 200)}`);
  }

  // Try to extract settlement info
  try {
    const settlement = httpClient.getPaymentSettleResponse(
      (name: string) => paidRes.headers.get(name),
    );
    if (settlement.transaction) {
      console.error(`    Settled on-chain: ${settlement.transaction}`);
    }
  } catch {
    // Settlement header may not be present in all configurations
  }

  return { data: await paidRes.json(), paid: true };
}

// --- EARN SIDE: Query StellarMCP (client paying for data via x402) ---

async function earnNetworkStatus(): Promise<DemoResult> {
  try {
    const { data } = await paidFetch(`${STELLARMCP_URL}/tools/getNetworkStatus`);
    return { step: "getNetworkStatus (free)", status: "success", data, payment: "free" };
  } catch (error) {
    return { step: "getNetworkStatus", status: "error", error: String(error) };
  }
}

async function earnAccountQuery(accountId: string): Promise<DemoResult> {
  try {
    const { data, paid } = await paidFetch(
      `${STELLARMCP_URL}/tools/getAccount?accountId=${accountId}`,
    );
    return {
      step: `getAccount(${accountId.slice(0, 8)}...)`,
      status: "success",
      data,
      payment: paid ? "$0.001 USDC via x402 (real)" : "$0.001 USDC via x402 (simulated)",
    };
  } catch (error) {
    return { step: `getAccount(${accountId.slice(0, 8)}...)`, status: "error", error: String(error) };
  }
}

async function earnOrderbook(): Promise<DemoResult> {
  try {
    const { data, paid } = await paidFetch(
      `${STELLARMCP_URL}/tools/getOrderbook?sellingAsset=XLM&buyingAsset=USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN&limit=5`,
    );
    return {
      step: "getOrderbook(XLM/USDC)",
      status: "success",
      data,
      payment: paid ? "$0.002 USDC via x402 (real)" : "$0.002 USDC via x402 (simulated)",
    };
  } catch (error) {
    return { step: "getOrderbook(XLM/USDC)", status: "error", error: String(error) };
  }
}

async function earnPricing(): Promise<DemoResult> {
  try {
    const { data } = await paidFetch(`${STELLARMCP_URL}/pricing`);
    return { step: "GET /pricing (free)", status: "success", data, payment: "free" };
  } catch (error) {
    return { step: "GET /pricing", status: "error", error: String(error) };
  }
}

// --- SPEND SIDE: Pay external x402 service for enrichment ---

async function spendEnrichTimestamp(): Promise<DemoResult> {
  try {
    // First attempt without payment — expect 402
    const unpaid = await fetch(`${EXTERNAL_SERVICE_URL}/enrich/timestamp`, {
      headers: { Accept: "application/json" },
    });

    if (unpaid.status === 402) {
      log("Received 402 Payment Required from external service — paying...");
    }

    // Second attempt with payment header (simulated for mock service)
    const res = await fetch(`${EXTERNAL_SERVICE_URL}/enrich/timestamp`, {
      headers: {
        Accept: "application/json",
        "x-402-payment": "simulated-stellar-usdc-payment-for-demo",
      },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    const data = await res.json();

    return {
      step: "External enrichment (timestamp)",
      status: "success",
      data,
      payment: "$0.0005 USDC spent",
    };
  } catch (error) {
    return {
      step: "External enrichment (timestamp)",
      status: "error",
      error: String(error),
    };
  }
}

// --- MAIN ---

async function main() {
  console.error("=".repeat(60));
  console.error("  StellarMCP Agent Demo — Earn/Spend Loop");
  console.error("=".repeat(60));

  // Initialize x402 client if secret key is available
  const x402Ready = await initX402Client();
  if (x402Ready) {
    console.error(`  x402 mode: REAL payments (client: ${signerAddress})`);
  } else {
    console.error("  x402 mode: SIMULATED (set STELLAR_SECRET_KEY for real payments)");
  }
  console.error("");

  // Phase 1: EARN — receive payments for data queries
  log("Phase 1: EARN — Selling Stellar data via x402");

  logResult(await earnPricing());
  logResult(await earnNetworkStatus());

  for (const account of DEMO_ACCOUNTS) {
    logResult(await earnAccountQuery(account));
  }

  logResult(await earnOrderbook());

  // Phase 2: SPEND — pay external services
  log("Phase 2: SPEND — Buying enrichment data via x402");

  logResult(await spendEnrichTimestamp());

  // Summary
  log("Demo Complete — Summary");
  console.error("-".repeat(60));

  const earned = results.filter(
    (r) => r.status === "success" && r.payment && r.payment.includes("$") && !r.payment.includes("spent"),
  );
  const spent = results.filter((r) => r.status === "success" && r.payment?.includes("spent"));
  const free = results.filter((r) => r.status === "success" && r.payment === "free");
  const errors = results.filter((r) => r.status === "error");

  console.error(`  Earn calls:  ${earned.length} paid queries served`);
  console.error(`  Free calls:  ${free.length}`);
  console.error(`  Spend calls: ${spent.length} external services consumed`);
  console.error(`  Errors:      ${errors.length}`);
  console.error(`  x402 mode:   ${x402Ready ? "REAL (on-chain payments)" : "SIMULATED"}`);
  console.error("");
  console.error("  The agent earned USDC by selling Stellar data,");
  console.error("  and spent USDC consuming external x402 services.");
  console.error("  This is the agent economy on Stellar.");

  if (x402Ready && signerAddress) {
    console.error("");
    console.error("  Verify on-chain:");
    console.error(`  https://stellar.expert/explorer/testnet/account/${signerAddress}`);
  }

  console.error("=".repeat(60));
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
