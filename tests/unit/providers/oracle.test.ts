import { describe, it, expect, vi } from "vitest";
import { SdexOracle, ReflectorOracle } from "../../../src/providers/oracle.js";
import type { PriceService } from "../../../src/providers/price.js";

describe("SdexOracle", () => {
  it("wraps PriceService.getPrice and returns price + timestamp", async () => {
    const mockPriceService = {
      getPrice: vi.fn().mockResolvedValue({
        price: "0.1010000",
        source: "sdex_orderbook",
        timestamp: "2026-04-09T12:00:00.000Z",
      }),
    } as unknown as PriceService;

    const oracle = new SdexOracle(mockPriceService);
    const result = await oracle.getPrice("XLM", "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN");

    expect(result).toEqual({
      price: "0.1010000",
      timestamp: "2026-04-09T12:00:00.000Z",
    });
    expect(mockPriceService.getPrice).toHaveBeenCalledWith(
      "XLM",
      "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
    );
  });

  it("returns null when PriceService throws", async () => {
    const mockPriceService = {
      getPrice: vi.fn().mockRejectedValue(new Error("No price data")),
    } as unknown as PriceService;

    const oracle = new SdexOracle(mockPriceService);
    const result = await oracle.getPrice("XLM", "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN");

    expect(result).toBeNull();
  });

  it("isAvailable always returns true", async () => {
    const mockPriceService = {} as unknown as PriceService;
    const oracle = new SdexOracle(mockPriceService);
    expect(await oracle.isAvailable()).toBe(true);
  });
});

describe("ReflectorOracle", () => {
  it("returns null for getPrice (stub)", async () => {
    const oracle = new ReflectorOracle();
    const result = await oracle.getPrice("XLM", "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN");
    expect(result).toBeNull();
  });

  it("isAvailable returns false (stub)", async () => {
    const oracle = new ReflectorOracle();
    expect(await oracle.isAvailable()).toBe(false);
  });
});
