/**
 * Setup USDC trustline on Stellar testnet
 *
 * Adds a Soroban USDC trustline to the wallet so it can receive x402 payments.
 * After running this, get testnet USDC from: https://faucet.circle.com (select Stellar)
 *
 * Usage: pnpm setup:usdc
 */

import "dotenv/config";
import {
  Keypair,
  TransactionBuilder,
  Networks,
  Operation,
  Asset,
  Horizon,
} from "@stellar/stellar-sdk";

const SECRET_KEY = process.env.STELLAR_SECRET_KEY;
if (!SECRET_KEY) {
  console.error("Error: STELLAR_SECRET_KEY not set in .env");
  process.exit(1);
}

const keypair = Keypair.fromSecret(SECRET_KEY);
const publicKey = keypair.publicKey();

// Circle testnet USDC issuer (classic asset, not Soroban contract)
// The Soroban contract CBIELTK6... wraps this classic asset
const USDC_ISSUER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";

console.error("=".repeat(60));
console.error("  Setup USDC Trustline on Stellar Testnet");
console.error("=".repeat(60));
console.error(`  Account: ${publicKey}`);
console.error("");

const server = new Horizon.Server("https://horizon-testnet.stellar.org");

try {
  const account = await server.loadAccount(publicKey);

  // Check if trustline already exists
  const hasUSDC = account.balances.some(
    (b: Horizon.HorizonApi.BalanceLine) =>
      "asset_code" in b && b.asset_code === "USDC" && b.asset_issuer === USDC_ISSUER,
  );

  if (hasUSDC) {
    console.error("  USDC trustline already exists!");
    const usdcBalance = account.balances.find(
      (b: Horizon.HorizonApi.BalanceLine) => "asset_code" in b && b.asset_code === "USDC",
    );
    if (usdcBalance) {
      console.error(`  Balance: ${usdcBalance.balance} USDC`);
    }
  } else {
    console.error("  Adding USDC trustline...");
    const usdcAsset = new Asset("USDC", USDC_ISSUER);
    const tx = new TransactionBuilder(account, {
      fee: "100",
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(Operation.changeTrust({ asset: usdcAsset }))
      .setTimeout(30)
      .build();

    tx.sign(keypair);
    const result = await server.submitTransaction(tx);
    console.error(`  Trustline added! TX: ${result.hash}`);
  }

  console.error("");
  console.error("  Next step: Get testnet USDC from Circle Faucet");
  console.error("  → https://faucet.circle.com");
  console.error("  → Select 'Stellar' network");
  console.error(`  → Paste address: ${publicKey}`);
  console.error("  → Request USDC");
  console.error("");
  console.error("  Then run: pnpm x402:client");
  console.error("=".repeat(60));
} catch (err) {
  console.error("Error:", err instanceof Error ? err.message : err);
  process.exit(1);
}
