import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { HorizonClient } from "../../src/providers/horizon.js";
import { registerAllTools } from "../../src/tools/index.js";
import { createHttpServer } from "../../src/transports/http.js";
import type { Server } from "node:http";

const SKIP = !process.env.TEST_INTEGRATION;

const config = {
  stellarNetwork: "testnet" as const,
  horizonUrl: "https://horizon-testnet.stellar.org",
  transport: "http" as const,
  port: 0,
  host: "127.0.0.1",
  logLevel: "error" as const,
};

describe.skipIf(SKIP)("Self-service docs (integration)", () => {
  let httpServer: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const mcpServer = new McpServer({
      name: "stellarmcp-docs-test",
      version: "0.0.0-test",
      description: "test instance",
    });
    const horizon = new HorizonClient(config);
    registerAllTools(mcpServer, horizon, config);

    const app = await createHttpServer(config, horizon, mcpServer);

    await new Promise<void>((resolve) => {
      httpServer = app.listen(0, "127.0.0.1", () => {
        const addr = httpServer.address();
        if (typeof addr === "object" && addr !== null) {
          baseUrl = `http://127.0.0.1:${addr.port}`;
        }
        resolve();
      });
    });
  }, 30000);

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      if (httpServer) httpServer.close(() => resolve());
      else resolve();
    });
  });

  it("should serve the OpenAPI YAML at /openapi.yaml", async () => {
    const res = await fetch(`${baseUrl}/openapi.yaml`);
    expect(res.status).toBe(200);
    const contentType = res.headers.get("content-type") || "";
    expect(contentType).toContain("yaml");
    const body = await res.text();
    expect(body).toContain("openapi:");
    expect(body).toContain("StellarMCP");
  });

  it("should serve the docs HTML page at /docs", async () => {
    const res = await fetch(`${baseUrl}/docs`);
    expect(res.status).toBe(200);
    const contentType = res.headers.get("content-type") || "";
    expect(contentType).toContain("html");
    const body = await res.text();
    expect(body).toContain("StellarMCP");
    expect(body).toContain("swagger-ui");
    expect(body).toContain("/openapi.yaml"); // confirms Swagger UI fetches our spec
  });

  it("should return enriched health info at /health", async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
    const data = await res.json() as Record<string, unknown>;
    expect(data.status).toBe("ok");
    expect(data.version).toBeDefined();
    expect(data.tools).toBeDefined();
    expect(data.transports).toBeDefined();
    expect(data.x402).toBeDefined();
    expect(data.oracles).toBeDefined();
    expect(typeof data.uptime).toBe("number");
  });
});
