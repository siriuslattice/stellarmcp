import { describe, it, expect } from "vitest";
import { HorizonClient } from "../../src/providers/horizon.js";

const SKIP = !process.env.TEST_INTEGRATION;
const TESTNET_ACCOUNT =
  "GAQB35PQQ5Z7BVOFQE5F2AAAYGU34OIMON5NDJEMIQBEBY46WWHOCLJN";

const config = {
  stellarNetwork: "testnet" as const,
  horizonUrl: "https://horizon-testnet.stellar.org",
  transport: "stdio" as const,
  port: 4021,
  host: "0.0.0.0",
  logLevel: "info" as const,
};

describe.skipIf(SKIP)("HorizonClient integration (live testnet)", () => {
  const client = new HorizonClient(config);

  it(
    "should fetch account from testnet",
    async () => {
      const account = await client.getAccount(TESTNET_ACCOUNT);
      expect(account.account_id).toBe(TESTNET_ACCOUNT);
      expect(Array.isArray(account.balances)).toBe(true);
      expect(account.balances.length).toBeGreaterThan(0);
    },
    15000,
  );

  it(
    "should fetch network root",
    async () => {
      const root = await client.getRoot();
      expect(root.network_passphrase).toBe(
        "Test SDF Network ; September 2015",
      );
      expect(root.history_latest_ledger).toBeGreaterThan(0);
    },
    15000,
  );

  it(
    "should fetch transactions",
    async () => {
      const txs = await client.getTransactions(TESTNET_ACCOUNT, 3);
      expect(txs._embedded.records.length).toBeGreaterThan(0);
      expect(txs._embedded.records[0].hash).toBeDefined();
    },
    15000,
  );

  it(
    "should fetch payments",
    async () => {
      const payments = await client.getPayments(TESTNET_ACCOUNT, 3);
      expect(payments._embedded.records.length).toBeGreaterThan(0);
      const first = payments._embedded.records[0];
      expect(first.type).toBeDefined();
    },
    15000,
  );

  it(
    "should fetch latest ledger",
    async () => {
      const root = await client.getRoot();
      const ledger = await client.getLedger(root.history_latest_ledger);
      expect(ledger.sequence).toBe(root.history_latest_ledger);
      expect(ledger.hash).toBeDefined();
      expect(ledger.closed_at).toBeDefined();
    },
    15000,
  );

  it(
    "should fetch effects",
    async () => {
      const effects = await client.getEffects(TESTNET_ACCOUNT, 3);
      expect(effects._embedded.records.length).toBeGreaterThan(0);
      expect(effects._embedded.records[0].type).toBeDefined();
    },
    15000,
  );

  it(
    "should fetch operations",
    async () => {
      const ops = await client.getOperations(TESTNET_ACCOUNT, 3);
      expect(ops._embedded.records.length).toBeGreaterThan(0);
      expect(ops._embedded.records[0].type).toBeDefined();
    },
    15000,
  );

  it(
    "should fetch assets by code",
    async () => {
      const assets = await client.getAssets("USDC");
      expect(assets._embedded.records.length).toBeGreaterThan(0);
      expect(assets._embedded.records[0].asset_code).toBe("USDC");
    },
    15000,
  );

  it(
    "should fetch orderbook for XLM/USDC",
    async () => {
      const orderbook = await client.getOrderbook({
        selling_asset_type: "native",
        buying_asset_type: "credit_alphanum4",
        buying_asset_code: "USDC",
        buying_asset_issuer:
          "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
        limit: "5",
      });
      expect(Array.isArray(orderbook.bids)).toBe(true);
      expect(Array.isArray(orderbook.asks)).toBe(true);
    },
    15000,
  );

  it(
    "should return 404 for nonexistent account",
    async () => {
      // Use a valid Strkey that is extremely unlikely to be funded on testnet
      // (random unfunded Stellar address)
      await expect(
        client.getAccount(
          "GBLHFXG5JCGAHTKKIDSPCNFUIDYAJLOGO2CE3KTZZYCRHTZHZR3DRFED",
        ),
      ).rejects.toThrow("404");
    },
    15000,
  );
});
