import { describe, it, expect, vi, beforeEach } from "vitest";
import { SorobanClient } from "../../../src/providers/soroban.js";

vi.mock("../../../src/utils/logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("SorobanClient", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doUnmock("@stellar/stellar-sdk");
  });

  it("should construct with rpcUrl and networkPassphrase", () => {
    const client = new SorobanClient("https://soroban-testnet.stellar.org", "Test SDF Network ; September 2015");
    expect(client).toBeDefined();
  });

  it("should encode an address via the SDK", async () => {
    const mockNativeToScVal = vi.fn().mockReturnValue({ type: "scvAddress" });
    vi.doMock("@stellar/stellar-sdk", () => ({
      nativeToScVal: mockNativeToScVal,
    }));
    const { SorobanClient: FreshClient } = await import("../../../src/providers/soroban.js");
    const client = new FreshClient("https://soroban-testnet.stellar.org", "Test SDF Network ; September 2015");
    const result = await client.encodeAddress("GABCDEFG");
    expect(mockNativeToScVal).toHaveBeenCalledWith("GABCDEFG", { type: "address" });
    expect(result).toEqual({ type: "scvAddress" });
  });

  it("should encode a u32 via the SDK", async () => {
    const mockNativeToScVal = vi.fn().mockReturnValue({ type: "scvU32" });
    vi.doMock("@stellar/stellar-sdk", () => ({
      nativeToScVal: mockNativeToScVal,
    }));
    const { SorobanClient: FreshClient } = await import("../../../src/providers/soroban.js");
    const client = new FreshClient("https://soroban-testnet.stellar.org", "Test SDF Network ; September 2015");
    const result = await client.encodeU32(42);
    expect(mockNativeToScVal).toHaveBeenCalledWith(42, { type: "u32" });
    expect(result).toEqual({ type: "scvU32" });
  });

  it("should simulate a contract call and return the parsed value", async () => {
    const simulateTransaction = vi.fn().mockResolvedValue({
      result: { retval: { fake: "retval" } },
    });
    const isSimulationError = vi.fn().mockReturnValue(false);
    const isSimulationSuccess = vi.fn().mockReturnValue(true);

    vi.doMock("@stellar/stellar-sdk", () => ({
      Account: vi.fn().mockImplementation((pk) => ({ accountId: () => pk, sequenceNumber: () => "0", incrementSequenceNumber: () => {} })),
      Contract: vi.fn().mockImplementation(() => ({
        call: vi.fn().mockReturnValue({ type: "operation" }),
      })),
      Networks: { TESTNET: "Test SDF Network ; September 2015", PUBLIC: "Public Global Stellar Network ; September 2015" },
      TransactionBuilder: vi.fn().mockImplementation(() => ({
        addOperation: vi.fn().mockReturnThis(),
        setTimeout: vi.fn().mockReturnThis(),
        build: vi.fn().mockReturnValue({ tx: "fake" }),
      })),
      Keypair: { random: vi.fn().mockReturnValue({ publicKey: () => "GTEST" }) },
      nativeToScVal: vi.fn(),
      scValToNative: vi.fn().mockReturnValue("USDC"),
      rpc: {
        Server: vi.fn().mockImplementation(() => ({
          simulateTransaction,
        })),
        Api: { isSimulationError, isSimulationSuccess },
      },
    }));

    const { SorobanClient: FreshClient } = await import("../../../src/providers/soroban.js");
    const client = new FreshClient("https://soroban-testnet.stellar.org", "Test SDF Network ; September 2015");
    const result = await client.simulateContractCall("CABCDEF", "symbol");

    expect(result).toBe("USDC");
    expect(simulateTransaction).toHaveBeenCalled();
  });

  it("should throw on simulation error", async () => {
    vi.doMock("@stellar/stellar-sdk", () => ({
      Account: vi.fn().mockImplementation((pk) => ({ accountId: () => pk, sequenceNumber: () => "0", incrementSequenceNumber: () => {} })),
      Contract: vi.fn().mockImplementation(() => ({ call: vi.fn().mockReturnValue({}) })),
      Networks: { TESTNET: "Test SDF Network ; September 2015", PUBLIC: "Public Global Stellar Network ; September 2015" },
      TransactionBuilder: vi.fn().mockImplementation(() => ({
        addOperation: vi.fn().mockReturnThis(),
        setTimeout: vi.fn().mockReturnThis(),
        build: vi.fn().mockReturnValue({}),
      })),
      Keypair: { random: vi.fn().mockReturnValue({ publicKey: () => "GTEST" }) },
      nativeToScVal: vi.fn(),
      scValToNative: vi.fn(),
      rpc: {
        Server: vi.fn().mockImplementation(() => ({
          simulateTransaction: vi.fn().mockResolvedValue({ error: "contract panicked" }),
        })),
        Api: {
          isSimulationError: vi.fn().mockReturnValue(true),
          isSimulationSuccess: vi.fn().mockReturnValue(false),
        },
      },
    }));

    const { SorobanClient: FreshClient } = await import("../../../src/providers/soroban.js");
    const client = new FreshClient("https://soroban-testnet.stellar.org", "Test SDF Network ; September 2015");

    await expect(client.simulateContractCall("CABCDEF", "symbol")).rejects.toThrow(/Soroban simulation failed/);
  });
});
