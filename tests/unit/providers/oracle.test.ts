import { describe, it, expect, vi } from "vitest";
import { SdexOracle, ReflectorOracle } from "../../../src/providers/oracle.js";
import type { PriceService } from "../../../src/providers/price.js";

// Mock logger to prevent stderr output during tests
vi.mock("../../../src/utils/logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

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
  describe("isAvailable", () => {
    it("returns false when no contractId is configured", async () => {
      const oracle = new ReflectorOracle();
      expect(await oracle.isAvailable()).toBe(false);
    });

    it("returns false when contractId is empty string", async () => {
      const oracle = new ReflectorOracle({ contractId: "" });
      expect(await oracle.isAvailable()).toBe(false);
    });

    it("returns true when contractId is configured", async () => {
      const oracle = new ReflectorOracle({
        contractId: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
      });
      expect(await oracle.isAvailable()).toBe(true);
    });
  });

  describe("getPrice", () => {
    it("returns null when not available (no contractId)", async () => {
      const oracle = new ReflectorOracle();
      const result = await oracle.getPrice("XLM", "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN");
      expect(result).toBeNull();
    });

    it("returns null for unsupported asset pairs", async () => {
      const oracle = new ReflectorOracle({
        contractId: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
      });
      // "DOGE" is not in REFLECTOR_ASSET_INDEX
      const result = await oracle.getPrice("DOGE", "USDC");
      expect(result).toBeNull();
    });

    it("strips issuer from asset code before lookup", async () => {
      const oracle = new ReflectorOracle({
        contractId: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
      });
      // "UNKNOWN:GABC..." should extract "UNKNOWN" which is unsupported
      const result = await oracle.getPrice(
        "UNKNOWN:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
        "USDC",
      );
      expect(result).toBeNull();
    });

    it("returns null when Soroban simulation throws", async () => {
      // Mock the SDK to throw during simulation
      vi.doMock("@stellar/stellar-sdk", () => ({
        Account: class { constructor(_id: string, _seq: string) {} },
        Contract: class {
          constructor(_id: string) {}
          call() { return {}; }
        },
        Networks: { TESTNET: "Test SDF Network ; September 2015" },
        TransactionBuilder: class {
          constructor() {}
          addOperation() { return this; }
          setTimeout() { return this; }
          build() { return {}; }
        },
        Keypair: { random: () => ({ publicKey: () => "GABC123" }) },
        nativeToScVal: () => ({}),
        scValToNative: () => ({}),
        rpc: {
          Server: class {
            constructor() {}
            simulateTransaction() { return Promise.reject(new Error("RPC unavailable")); }
          },
          Api: {
            isSimulationError: () => false,
            isSimulationSuccess: () => false,
          },
        },
      }));

      // Re-import to pick up mock
      const { ReflectorOracle: Mocked } = await import("../../../src/providers/oracle.js");
      const oracle = new Mocked({
        contractId: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
      });
      const result = await oracle.getPrice("XLM", "USDC");
      expect(result).toBeNull();

      vi.doUnmock("@stellar/stellar-sdk");
    });

    it("returns null when simulation returns error", async () => {
      vi.doMock("@stellar/stellar-sdk", () => ({
        Account: class { constructor(_id: string, _seq: string) {} },
        Contract: class {
          constructor(_id: string) {}
          call() { return {}; }
        },
        Networks: { TESTNET: "Test SDF Network ; September 2015" },
        TransactionBuilder: class {
          constructor() {}
          addOperation() { return this; }
          setTimeout() { return this; }
          build() { return {}; }
        },
        Keypair: { random: () => ({ publicKey: () => "GABC123" }) },
        nativeToScVal: () => ({}),
        scValToNative: () => ({}),
        rpc: {
          Server: class {
            constructor() {}
            simulateTransaction() { return Promise.resolve({ error: "contract trap" }); }
          },
          Api: {
            isSimulationError: () => true,
            isSimulationSuccess: () => false,
          },
        },
      }));

      const { ReflectorOracle: Mocked } = await import("../../../src/providers/oracle.js");
      const oracle = new Mocked({
        contractId: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
      });
      const result = await oracle.getPrice("XLM", "USDC");
      expect(result).toBeNull();

      vi.doUnmock("@stellar/stellar-sdk");
    });

    it("parses struct result with price and timestamp", async () => {
      vi.doMock("@stellar/stellar-sdk", () => ({
        Account: class { constructor(_id: string, _seq: string) {} },
        Contract: class {
          constructor(_id: string) {}
          call() { return {}; }
        },
        Networks: { TESTNET: "Test SDF Network ; September 2015" },
        TransactionBuilder: class {
          constructor() {}
          addOperation() { return this; }
          setTimeout() { return this; }
          build() { return {}; }
        },
        Keypair: { random: () => ({ publicKey: () => "GABC123" }) },
        nativeToScVal: () => ({}),
        scValToNative: () => ({
          // price = 1.5 * 10^14 = 150000000000000n
          price: 150000000000000n,
          // timestamp in seconds
          timestamp: 1712700000n,
        }),
        rpc: {
          Server: class {
            constructor() {}
            simulateTransaction() {
              return Promise.resolve({ result: { retval: {} } });
            }
          },
          Api: {
            isSimulationError: () => false,
            isSimulationSuccess: () => true,
          },
        },
      }));

      const { ReflectorOracle: Mocked } = await import("../../../src/providers/oracle.js");
      const oracle = new Mocked({
        contractId: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
      });
      const result = await oracle.getPrice("XLM", "USDC");

      expect(result).not.toBeNull();
      expect(result!.price).toBe("1.5");
      // Timestamp: 1712700000 seconds = April 10, 2024
      expect(result!.timestamp).toContain("2024-04-");

      vi.doUnmock("@stellar/stellar-sdk");
    });
  });

  describe("constructor", () => {
    it("has name 'reflector'", () => {
      const oracle = new ReflectorOracle();
      expect(oracle.name).toBe("reflector");
    });

    it("accepts custom sorobanRpcUrl", () => {
      const oracle = new ReflectorOracle({
        sorobanRpcUrl: "https://custom-rpc.example.com",
      });
      expect(oracle.name).toBe("reflector");
    });

    it("accepts custom networkPassphrase", () => {
      const oracle = new ReflectorOracle({
        networkPassphrase: "Public Global Stellar Network ; September 2015",
      });
      expect(oracle.name).toBe("reflector");
    });
  });
});
