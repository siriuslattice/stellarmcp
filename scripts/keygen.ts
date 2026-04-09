/**
 * Generate a Stellar keypair and fund it on testnet via Friendbot.
 *
 * Usage: pnpm keygen
 */

import { Keypair } from "@stellar/stellar-sdk";

const pair = Keypair.random();
const publicKey = pair.publicKey();
const secret = pair.secret();

console.error("=".repeat(60));
console.error("  Stellar Testnet Keypair Generated");
console.error("=".repeat(60));
console.error("");
console.error(`  Public Key:  ${publicKey}`);
console.error(`  Secret Key:  ${secret}`);
console.error("");
console.error("  SAVE YOUR SECRET KEY — it cannot be recovered.");
console.error("");

// Fund via Friendbot
console.error("  Funding via Friendbot...");
try {
  const res = await fetch(`https://friendbot.stellar.org?addr=${publicKey}`);
  if (res.ok) {
    console.error("  Funded with 10,000 XLM on testnet.");
  } else {
    const body = await res.text();
    console.error(`  Friendbot error (${res.status}): ${body.slice(0, 200)}`);
  }
} catch (err) {
  console.error(`  Friendbot request failed: ${err}`);
}

console.error("");
console.error("  Add to your .env:");
console.error("  ─────────────────");
console.error(`  STELLAR_PAYEE_ADDRESS=${publicKey}`);
console.error(`  STELLAR_SECRET_KEY=${secret}`);
console.error(`  TRANSPORT=http`);
console.error(`  OZ_FACILITATOR_URL=https://channels.openzeppelin.com/x402/testnet`);
console.error(`  OZ_API_KEY=<get from https://channels.openzeppelin.com/testnet/gen>`);
console.error("");
console.error("=".repeat(60));
