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
});
