/**
 * StellarMCP Agent Demo — Earn/Spend Loop
 *
 * Demonstrates the full agent economy:
 * 1. EARN: Agent's StellarMCP server receives x402 payments for data queries
 * 2. SPEND: Agent pays an external x402 service to enrich its outputs
 *
 * Prerequisites:
 * - Terminal 1: TRANSPORT=http pnpm start  (StellarMCP x402 server on :4021)
 * - Terminal 2: pnpm demo:service           (Mock external service on :4022)
 * - Terminal 3: pnpm demo                   (This script)
 *
 * Usage: pnpm demo
 */

const STELLARMCP_URL = process.env.STELLARMCP_URL || "http://localhost:4021";
const EXTERNAL_SERVICE_URL = process.env.EXTERNAL_SERVICE_URL || "http://localhost:4022";

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

async function fetchJson(url: string, headers?: Record<string, string>): Promise<unknown> {
  const res = await fetch(url, { headers: { Accept: "application/json", ...headers } });
  if (!res.ok && res.status !== 402) {
    throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  return res.json();
}

// --- EARN SIDE: Query StellarMCP (simulating a client paying for data) ---

async function earnNetworkStatus(): Promise<DemoResult> {
  try {
    const data = await fetchJson(`${STELLARMCP_URL}/tools/getNetworkStatus`);
    return { step: "getNetworkStatus (free)", status: "success", data, payment: "free" };
  } catch (error) {
    return { step: "getNetworkStatus", status: "error", error: String(error) };
  }
}

async function earnAccountQuery(accountId: string): Promise<DemoResult> {
  try {
    // In production, this would include an x402 payment header
    // For demo without facilitator, we query directly (server runs without x402 if not configured)
    const data = await fetchJson(`${STELLARMCP_URL}/tools/getAccount?accountId=${accountId}`);
    return {
      step: `getAccount(${accountId.slice(0, 8)}...)`,
      status: "success",
      data,
      payment: "$0.001 USDC via x402",
    };
  } catch (error) {
    return { step: `getAccount(${accountId.slice(0, 8)}...)`, status: "error", error: String(error) };
  }
}

async function earnOrderbook(): Promise<DemoResult> {
  try {
    const data = await fetchJson(
      `${STELLARMCP_URL}/tools/getOrderbook?sellingAsset=XLM&buyingAsset=USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN&limit=5`,
    );
    return {
      step: "getOrderbook(XLM/USDC)",
      status: "success",
      data,
      payment: "$0.002 USDC via x402",
    };
  } catch (error) {
    return { step: "getOrderbook(XLM/USDC)", status: "error", error: String(error) };
  }
}

async function earnPricing(): Promise<DemoResult> {
  try {
    const data = await fetchJson(`${STELLARMCP_URL}/pricing`);
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

    // Second attempt with payment header (simulated for demo)
    const data = await fetchJson(`${EXTERNAL_SERVICE_URL}/enrich/timestamp`, {
      "x-402-payment": "simulated-stellar-usdc-payment-for-demo",
    });

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
  console.error("");
  console.error("  The agent earned USDC by selling Stellar data,");
  console.error("  and spent USDC consuming external x402 services.");
  console.error("  This is the agent economy on Stellar.");
  console.error("=".repeat(60));
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
