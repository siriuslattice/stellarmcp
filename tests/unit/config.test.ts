import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("config defaults", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    // Clear all relevant env vars
    delete process.env.STELLAR_NETWORK;
    delete process.env.HORIZON_URL;
    delete process.env.SOROBAN_RPC_URL;
    delete process.env.REFLECTOR_CONTRACT_ID;
    delete process.env.STELLAR_PAYEE_ADDRESS;
    delete process.env.OZ_FACILITATOR_URL;
    delete process.env.OZ_API_KEY;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("defaults to testnet with testnet horizon URL", async () => {
    const { config } = await import("../../src/config.js");
    expect(config.stellarNetwork).toBe("testnet");
    expect(config.horizonUrl).toBe("https://horizon-testnet.stellar.org");
    expect(config.sorobanRpcUrl).toBe("https://soroban-testnet.stellar.org");
  });

  it("uses pubnet horizon URL when STELLAR_NETWORK=pubnet", async () => {
    process.env.STELLAR_NETWORK = "pubnet";
    const { config } = await import("../../src/config.js");
    expect(config.stellarNetwork).toBe("pubnet");
    expect(config.horizonUrl).toBe("https://horizon.stellar.org");
    expect(config.sorobanRpcUrl).toBe("https://soroban-rpc.stellar.org");
  });

  it("preserves explicit HORIZON_URL even when network is pubnet", async () => {
    process.env.STELLAR_NETWORK = "pubnet";
    process.env.HORIZON_URL = "https://custom.horizon.example.com";
    const { config } = await import("../../src/config.js");
    expect(config.stellarNetwork).toBe("pubnet");
    expect(config.horizonUrl).toBe("https://custom.horizon.example.com");
  });

  it("preserves explicit SOROBAN_RPC_URL", async () => {
    process.env.STELLAR_NETWORK = "pubnet";
    process.env.SOROBAN_RPC_URL = "https://custom-soroban.example.com";
    const { config } = await import("../../src/config.js");
    expect(config.sorobanRpcUrl).toBe("https://custom-soroban.example.com");
  });
});
