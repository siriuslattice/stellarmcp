import { describe, it, expect, vi, beforeEach } from "vitest";
import { HorizonClient } from "../../../src/providers/horizon.js";
import { cache } from "../../../src/utils/cache.js";

const mockConfig = {
  stellarNetwork: "testnet" as const,
  horizonUrl: "https://horizon-testnet.stellar.org",
  transport: "stdio" as const,
  port: 4021,
  host: "0.0.0.0",
  logLevel: "info" as const,
};

describe("HorizonClient", () => {
  let client: HorizonClient;

  beforeEach(() => {
    cache.clear();
    vi.restoreAllMocks();
  });

  it("should construct with config URL", () => {
    client = new HorizonClient(mockConfig);
    expect(client).toBeDefined();
  });

  it("should fetch and cache data", async () => {
    client = new HorizonClient(mockConfig);
    const mockData = { account_id: "GABC", sequence: "123" };

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockData), { status: 200 }),
    );

    const result = await client.get("/accounts/GABC");
    expect(result).toEqual(mockData);

    // Second call should use cache
    const result2 = await client.get("/accounts/GABC");
    expect(result2).toEqual(mockData);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("should throw on non-429 error", async () => {
    client = new HorizonClient(mockConfig);

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: "not found" }), { status: 404 }),
    );

    await expect(client.get("/accounts/INVALID")).rejects.toThrow("Horizon 404");
  });

  it("should retry on 429", async () => {
    client = new HorizonClient(mockConfig);
    const mockData = { ok: true };

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("", { status: 429 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(mockData), { status: 200 }));

    const result = await client.get("/test", undefined, 1000);
    expect(result).toEqual(mockData);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it("should call /accounts/{id}/effects for getEffects", async () => {
    client = new HorizonClient(mockConfig);
    const mockPage = { _embedded: { records: [] }, _links: { self: { href: "" } } };

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockPage), { status: 200 }),
    );

    const result = await client.getEffects("GABC", 5, "asc");
    expect(result).toEqual(mockPage);
    const calledUrl = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(calledUrl.pathname).toBe("/accounts/GABC/effects");
    expect(calledUrl.searchParams.get("limit")).toBe("5");
    expect(calledUrl.searchParams.get("order")).toBe("asc");
  });

  it("should call /accounts/{id}/offers for getOffers", async () => {
    client = new HorizonClient(mockConfig);
    const mockPage = { _embedded: { records: [] }, _links: { self: { href: "" } } };

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockPage), { status: 200 }),
    );

    const result = await client.getOffers("GXYZ", 20, "desc");
    expect(result).toEqual(mockPage);
    const calledUrl = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(calledUrl.pathname).toBe("/accounts/GXYZ/offers");
    expect(calledUrl.searchParams.get("limit")).toBe("20");
    expect(calledUrl.searchParams.get("order")).toBe("desc");
  });

  it("should call /accounts/{id}/operations for getOperations", async () => {
    client = new HorizonClient(mockConfig);
    const mockPage = { _embedded: { records: [] }, _links: { self: { href: "" } } };

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockPage), { status: 200 }),
    );

    const result = await client.getOperations("GABC", 15, "asc");
    expect(result).toEqual(mockPage);
    const calledUrl = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(calledUrl.pathname).toBe("/accounts/GABC/operations");
    expect(calledUrl.searchParams.get("limit")).toBe("15");
    expect(calledUrl.searchParams.get("order")).toBe("asc");
  });

  it("should call /liquidity_pools for getLiquidityPools", async () => {
    client = new HorizonClient(mockConfig);
    const mockPage = { _embedded: { records: [] }, _links: { self: { href: "" } } };

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockPage), { status: 200 }),
    );

    const result = await client.getLiquidityPools({ reserves: "native", limit: "10" });
    expect(result).toEqual(mockPage);
    const calledUrl = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(calledUrl.pathname).toBe("/liquidity_pools");
    expect(calledUrl.searchParams.get("reserves")).toBe("native");
    expect(calledUrl.searchParams.get("limit")).toBe("10");
  });

  it("should call /claimable_balances for getClaimableBalances", async () => {
    client = new HorizonClient(mockConfig);
    const mockPage = { _embedded: { records: [] }, _links: { self: { href: "" } } };

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockPage), { status: 200 }),
    );

    const result = await client.getClaimableBalances({ claimant: "GABC", limit: "5" });
    expect(result).toEqual(mockPage);
    const calledUrl = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(calledUrl.pathname).toBe("/claimable_balances");
    expect(calledUrl.searchParams.get("claimant")).toBe("GABC");
    expect(calledUrl.searchParams.get("limit")).toBe("5");
  });

  it("should cache getEffects results", async () => {
    client = new HorizonClient(mockConfig);
    const mockPage = { _embedded: { records: [{ id: "1" }] }, _links: { self: { href: "" } } };

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockPage), { status: 200 }),
    );

    await client.getEffects("GABC");
    const result2 = await client.getEffects("GABC");
    expect(result2).toEqual(mockPage);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });
});
