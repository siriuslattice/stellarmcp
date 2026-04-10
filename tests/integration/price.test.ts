import { describe, it, expect } from "vitest";
import { HorizonClient } from "../../src/providers/horizon.js";
import { PriceService } from "../../src/providers/price.js";

const SKIP = !process.env.TEST_INTEGRATION;
const USDC_ISSUER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";

const config = {
  stellarNetwork: "testnet" as const,
  horizonUrl: "https://horizon-testnet.stellar.org",
  transport: "stdio" as const,
  port: 4021,
  host: "0.0.0.0",
  logLevel: "info" as const,
};

describe.skipIf(SKIP)("PriceService integration (live testnet)", () => {
  const client = new HorizonClient(config);
  const priceService = new PriceService(client);

  it(
    "should get XLM/USDC price from SDEX",
    async () => {
      const result = await priceService.getPrice(
        "XLM",
        `USDC:${USDC_ISSUER}`,
      );
      expect(result.price).toBeDefined();
      expect(parseFloat(result.price)).toBeGreaterThan(0);
      expect(result.source).toMatch(/sdex/);
      expect(result.timestamp).toBeDefined();
    },
    30000,
  );

  it(
    "should get price history",
    async () => {
      const result = await priceService.getPriceHistory(
        "XLM",
        `USDC:${USDC_ISSUER}`,
        "1h",
        5,
      );
      expect(result.candles).toBeDefined();
      expect(Array.isArray(result.candles)).toBe(true);
      // Testnet may have sparse data, so just verify structure
      if (result.candles.length > 0) {
        const candle = result.candles[0];
        expect(candle.open).toBeDefined();
        expect(candle.high).toBeDefined();
        expect(candle.low).toBeDefined();
        expect(candle.close).toBeDefined();
        expect(candle.volume).toBeDefined();
        expect(candle.timestamp).toBeDefined();
      }
    },
    30000,
  );

  it(
    "should get VWAP",
    async () => {
      const result = await priceService.getVWAP(
        "XLM",
        `USDC:${USDC_ISSUER}`,
        "1d",
        7,
      );
      expect(result.vwap).toBeDefined();
      expect(result.volume).toBeDefined();
      expect(typeof result.candles).toBe("number");
      // VWAP might be 0 if no trades, but should be a valid number string
      expect(parseFloat(result.vwap)).toBeGreaterThanOrEqual(0);
    },
    30000,
  );

  it(
    "should throw for nonexistent asset pair",
    async () => {
      await expect(
        priceService.getPrice(
          "ZZZZZZ:GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
          `USDC:${USDC_ISSUER}`,
        ),
      ).rejects.toThrow();
    },
    30000,
  );
});
