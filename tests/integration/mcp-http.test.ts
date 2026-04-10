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
  port: 0, // random port
  host: "127.0.0.1",
  logLevel: "error" as const,
};

describe.skipIf(SKIP)("MCP-over-HTTP transport (integration)", () => {
  let httpServer: Server;
  let baseUrl: string;
  let sessionId: string | null = null;

  beforeAll(async () => {
    const mcpServer = new McpServer({
      name: "stellarmcp-test",
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

  it("should respond to initialize JSON-RPC request with a session ID", async () => {
    const res = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "test-client", version: "1.0.0" },
        },
      }),
    });

    expect(res.status).toBe(200);
    sessionId = res.headers.get("mcp-session-id");
    expect(sessionId).toBeTruthy();
  }, 15000);

  it("should list all tools via tools/list", async () => {
    expect(sessionId).toBeTruthy();
    const res = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        "mcp-session-id": sessionId!,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
        params: {},
      }),
    });

    expect(res.status).toBe(200);

    // Response may be SSE-formatted; parse accordingly
    const text = await res.text();
    let payload: any;
    if (text.startsWith("event:") || text.startsWith("data:")) {
      // SSE format: extract data line
      const dataLine = text.split("\n").find((l) => l.startsWith("data:"));
      payload = JSON.parse(dataLine!.replace(/^data:\s*/, ""));
    } else {
      payload = JSON.parse(text);
    }

    expect(payload.result).toBeDefined();
    expect(Array.isArray(payload.result.tools)).toBe(true);
    expect(payload.result.tools.length).toBeGreaterThanOrEqual(16);

    const toolNames = payload.result.tools.map((t: { name: string }) => t.name);
    expect(toolNames).toContain("getAccount");
    expect(toolNames).toContain("getPrice");
    expect(toolNames).toContain("getNetworkStatus");
  }, 15000);

  it("should call getNetworkStatus tool via tools/call", async () => {
    expect(sessionId).toBeTruthy();
    const res = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        "mcp-session-id": sessionId!,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: {
          name: "getNetworkStatus",
          arguments: {},
        },
      }),
    });

    expect(res.status).toBe(200);

    const text = await res.text();
    let payload: any;
    if (text.startsWith("event:") || text.startsWith("data:")) {
      const dataLine = text.split("\n").find((l) => l.startsWith("data:"));
      payload = JSON.parse(dataLine!.replace(/^data:\s*/, ""));
    } else {
      payload = JSON.parse(text);
    }

    expect(payload.result).toBeDefined();
    expect(Array.isArray(payload.result.content)).toBe(true);
    const textContent = payload.result.content[0];
    expect(textContent.type).toBe("text");
    const data = JSON.parse(textContent.text);
    expect(data.network).toBeDefined();
    expect(data.networkPassphrase).toBe("Test SDF Network ; September 2015");
  }, 15000);
});
