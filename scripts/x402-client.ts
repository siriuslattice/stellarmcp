/**
 * x402 Client — Make a real paid request to StellarMCP
 *
 * This script demonstrates the full x402 payment flow:
 * 1. Hit a paid endpoint → receive 402 Payment Required
 * 2. Parse payment requirements from the response
 * 3. Sign a Soroban USDC transfer transaction
 * 4. Retry with the signed payment header
 * 5. Receive data + settlement confirmation (USDC transferred on-chain)
 *
 * Prerequisites:
 * - StellarMCP HTTP server running: TRANSPORT=http pnpm start
 * - Client wallet funded with testnet XLM + USDC trustline + USDC balance
 *   (Get USDC from Circle testnet faucet: https://faucet.circle.com — select Stellar)
 * - STELLAR_SECRET_KEY set in .env (client's secret key)
 *
 * Usage: pnpm x402:client
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

console.error("=".repeat(60));
console.error("  x402 Client — Paid Request to StellarMCP");
console.error("=".repeat(60));
console.error(`  Client address: ${signer.address}`);
console.error(`  Server: ${SERVER_URL}`);
console.error("");

async function paidRequest(path: string, description: string) {
  const url = `${SERVER_URL}${path}`;
  console.error(`  [${description}]`);
  console.error(`  → GET ${path}`);

  // Step 1: Initial request — expect 402
  const res = await fetch(url, { headers: { Accept: "application/json" } });

  if (res.status !== 402) {
    // Not paywalled (free endpoint or x402 not configured)
    console.error(`  ← ${res.status} (no payment required)`);
    const data = await res.json();
    console.error(`  Data: ${JSON.stringify(data).slice(0, 100)}...`);
    return data;
  }

  console.error("  ← 402 Payment Required");

  // Step 2: Parse payment requirements
  const paymentRequired = httpClient.getPaymentRequiredResponse(
    (name) => res.headers.get(name),
    await res.json(),
  );
  console.error(`  Payment: ${JSON.stringify(paymentRequired.accepts?.[0]?.price || "unknown")}`);

  // Step 3: Create signed payment payload
  console.error("  Signing payment...");
  const paymentPayload = await httpClient.createPaymentPayload(paymentRequired);
  const paymentHeaders = httpClient.encodePaymentSignatureHeader(paymentPayload);

  // Step 4: Retry with payment
  console.error("  → Retrying with payment header...");
  const paidRes = await fetch(url, {
    headers: { Accept: "application/json", ...paymentHeaders },
  });

  if (!paidRes.ok) {
    const errBody = await paidRes.text();
    console.error(`  ← ${paidRes.status} Payment failed: ${errBody.slice(0, 200)}`);
    return null;
  }

  // Step 5: Extract settlement info
  const data = await paidRes.json();
  try {
    const settlement = httpClient.getPaymentSettleResponse(
      (name) => paidRes.headers.get(name),
    );
    console.error(`  ← 200 OK — Payment settled!`);
    console.error(`  Transaction: ${settlement.transaction || "N/A"}`);
  } catch {
    console.error(`  ← 200 OK — Data received (settlement header not found)`);
  }
  console.error(`  Data: ${JSON.stringify(data).slice(0, 120)}...`);
  console.error("");
  return data;
}

async function main() {
  // Free endpoint first
  await paidRequest("/tools/getNetworkStatus", "Network Status (free)");
  console.error("");

  // Paid endpoint — this triggers the x402 flow
  await paidRequest(
    `/tools/getAccount?accountId=${signer.address}`,
    "Get Own Account ($0.001)",
  );

  // Another paid endpoint
  await paidRequest(
    "/tools/getOrderbook?sellingAsset=XLM&buyingAsset=USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN&limit=5",
    "DEX Orderbook ($0.002)",
  );

  console.error("=".repeat(60));
  console.error("  Done. Check Stellar testnet explorer for transactions:");
  console.error("  https://stellar.expert/explorer/testnet/account/" + signer.address);
  console.error("=".repeat(60));
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
