# StellarMCP

**Data Merchant for the Agent Economy**

MCP server giving AI agents access to Stellar blockchain data — accounts, DEX orderbooks, transactions, trade history, asset metadata, and network status — with every tool call monetized via [x402](https://www.x402.org/) micropayments settled on Stellar.

Built for the [Stellar Hacks: Agents](https://dorahacks.io/hackathon/stellar-hacks-agents) hackathon.

## Features

- **17 MCP tools** querying Stellar Horizon REST + Soroban contracts (SEP-41 tokens)
- **Multi-oracle price aggregation** with median computation and source attribution across SDEX and Reflector
- **PriceService** with VWAP, OHLC history, and oracle abstraction layer
- **x402 micropayments** on Stellar — agents pay per call in USDC
- **Triple transport** — stdio for local MCP clients, HTTP REST for x402-gated access, MCP-over-HTTP at `/mcp` (StreamableHTTPServerTransport with stateful sessions) for remote MCP clients
- **132 tests** — 106 unit + 26 live testnet integration
- **Production-ready** — multi-stage Dockerfile, mainnet auto-defaults, enriched `/health`, self-service `/docs` page with embedded Swagger UI
- **Earn/spend demo + trading strategies** — SMA crossover, cross-pair arbitrage, real x402 settlement loop
- **OpenClaw compatible** — permissionless agent discovery via `GET /skill.md`
- **Zero `@stellar/stellar-sdk` in production bundle** — raw `fetch` to Horizon, dynamic import only for Soroban contract simulation

## Quick Start

### MCP Client (stdio — free, local)

```bash
npx stellar-mcp-x402
```

Or add to your MCP client config:

```json
{
  "mcpServers": {
    "stellarmcp": {
      "command": "npx",
      "args": ["stellar-mcp-x402"],
      "env": {
        "STELLAR_NETWORK": "testnet"
      }
    }
  }
}
```

### MCP Client (HTTP — remote)

Connect to a running StellarMCP HTTP server from any MCP client that supports the StreamableHTTP transport. Point your client at `http://<host>:4021/mcp` — the same McpServer instance with all 17 tools is shared between the stdio and HTTP transports.

```bash
# Start the HTTP server (also serves /mcp)
TRANSPORT=http pnpm start

# MCP clients connect via POST/GET/DELETE http://localhost:4021/mcp
# Stateful sessions are tracked via the mcp-session-id header.
```

The `/mcp` endpoint is free (not x402-gated). Per-tool x402 gating applies to the REST endpoints under `/tools/*`.

### HTTP Server (x402-monetized)

```bash
git clone https://github.com/siriuslattice/stellarmcp.git
cd stellarmcp
pnpm install
cp .env.example .env
# Edit .env with your Stellar testnet wallet and OZ facilitator key
TRANSPORT=http pnpm start
```

Then query:
```bash
# Free endpoint
curl http://localhost:4021/tools/getNetworkStatus

# Paid endpoint (requires x402 payment header)
curl http://localhost:4021/tools/getAccount?accountId=GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7

# View pricing
curl http://localhost:4021/pricing

# Connect an MCP client via MCP-over-HTTP
# POST http://localhost:4021/mcp  (JSON-RPC)
# GET  http://localhost:4021/mcp  (SSE stream)
```

## Tools

### Horizon Data Tools

| Tool | Description | Price |
|------|-------------|-------|
| `getAccount` | Account balances, thresholds, signers | $0.001 |
| `getTransactions` | Recent transactions for an account | $0.001 |
| `getPayments` | Recent payments for an account | $0.001 |
| `getOrderbook` | DEX orderbook with spread and midprice | $0.002 |
| `getTradeAggregations` | OHLC candle data for a trading pair | $0.002 |
| `getAssetInfo` | Asset metadata, supply, flags | $0.001 |
| `getNetworkStatus` | Network health and protocol version | **Free** |
| `getLedger` | Ledger details by sequence number | $0.001 |
| `getEffects` | Account effects (balance changes, trades, etc.) | $0.001 |
| `getOffers` | Open DEX offers for an account | $0.001 |
| `getOperations` | All operations for an account | $0.001 |
| `getLiquidityPools` | Stellar AMM liquidity pools | $0.002 |
| `getClaimableBalances` | Claimable balances by claimant or asset | $0.001 |

### Price Tools

| Tool | Description | Price |
|------|-------------|-------|
| `getPrice` | Current price for any Stellar asset pair with multi-oracle aggregation (median + `sources[]` attribution) | $0.002 |
| `getPriceHistory` | OHLC price history with VWAP | $0.002 |
| `getVWAP` | Volume-weighted average price | $0.002 |

The price tools are powered by PriceService, which aggregates data from the Stellar SDEX via trade aggregations. A PriceAggregator layer combines multiple oracle sources (currently SdexOracle + ReflectorOracle stub) and returns a median price along with a `sources[]` array containing `{name, price, timestamp}` entries for full attribution. Additional oracles (Chainlink, Redstone, Band) plug into the same OracleProvider interface.

### Soroban Token Tools

| Tool | Description | Price |
|------|-------------|-------|
| `getSorobanTokenInfo` | SEP-41 token metadata (symbol, name, decimals) and optional balance lookup | $0.002 |

Requires `SOROBAN_RPC_URL` to be configured. Uses Soroban contract simulation (read-only, no fees).

## Asset Format

| Type | Format | Example |
|------|--------|---------|
| Native | `XLM` | `XLM` |
| Classic | `CODE:ISSUER` | `USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN` |

## Agent Demo

The earn/spend loop demonstrates the full agent economy:

```bash
# Terminal 1: Start the x402 HTTP server (earn side)
TRANSPORT=http pnpm start

# Terminal 2: Start a mock external x402 service (spend side)
pnpm demo:service

# Terminal 3: Run the agent demo
pnpm demo
```

The agent:
1. **Earns** USDC by receiving x402 payments from clients querying Stellar data
2. **Spends** USDC by paying external x402 services to enrich its outputs

## Development

```bash
pnpm install
pnpm typecheck    # Type check (zero errors required)
pnpm test         # Run unit tests
pnpm build        # Build for production
pnpm inspect      # Open MCP Inspector at localhost:6274
```

## Architecture

```
stdio transport ──> McpServer ──> 17 tools ──> HorizonClient ──> Stellar Horizon REST API
                        │                          │
                        │                          ├── PriceService
HTTP transport  ──> Express ──┬── /tools/* (REST + x402)
                              ├── /mcp (StreamableHTTPServerTransport)
                              └── /pricing, /health, /skill.md (free)
                        │
                        └── PriceAggregator → [SdexOracle, ReflectorOracle]
```

Both the stdio and HTTP transports share the **same McpServer instance** with all 17 tools registered. The `/mcp` endpoint is a MCP-over-HTTP bridge (POST/GET/DELETE) using `StreamableHTTPServerTransport` with stateful sessions tracked via the `mcp-session-id` header — giving remote MCP clients the full protocol (tools, resources, prompts) without stdio.

The PriceService sits on top of HorizonClient and provides normalized price data (current price, OHLC history, VWAP). The PriceAggregator layer fans out queries to multiple OracleProviders (SdexOracle + ReflectorOracle today) and computes a median with per-source attribution. Additional oracles (Chainlink, Redstone) plug in via the same interface.

## Tech Stack

- **TypeScript** with strict mode
- **Node.js 22+**
- **MCP SDK** (`@modelcontextprotocol/sdk`)
- **x402** (`@x402/express`, `@x402/stellar`, `@x402/core`)
- **Express 4** with CORS and rate limiting
- **Vitest** for testing
- **tsup** for bundling

## Environment Variables

See [.env.example](.env.example) for all options.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `STELLAR_NETWORK` | No | `testnet` | `testnet` or `pubnet` |
| `HORIZON_URL` | No | `https://horizon-testnet.stellar.org` | Horizon API URL |
| `TRANSPORT` | No | `stdio` | `stdio` or `http` |
| `STELLAR_PAYEE_ADDRESS` | HTTP mode | — | Your Stellar address for receiving payments |
| `OZ_FACILITATOR_URL` | HTTP mode | — | OpenZeppelin x402 facilitator URL |
| `OZ_API_KEY` | HTTP mode | — | OpenZeppelin facilitator API key |
| `PORT` | No | `4021` | HTTP server port |
| `LOG_LEVEL` | No | `info` | `debug`, `info`, `warn`, `error` |
| `SOROBAN_RPC_URL` | No | — | Soroban RPC URL (used by ReflectorOracle and future SEP-41 support) |
| `REFLECTOR_CONTRACT_ID` | No | — | Reflector oracle contract ID on Stellar (enables ReflectorOracle in PriceAggregator) |

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — component map, data flow, key design decisions (8 Mermaid diagrams)
- [Metrics](docs/METRICS.md) — verifiable current state evidence (every metric reproducible from this repo)
- [Deployment](docs/DEPLOYMENT.md) — production deployment guide (Docker, PM2, systemd, nginx, Caddy, monitoring, security)
- [MCP Registry submission](docs/MCP_REGISTRY.md) — guide for publishing to the official MCP Registry
- [x402 Bazaar registration](docs/X402_BAZAAR.md) — guide for registering on the Coinbase CDP x402 Bazaar
- [OpenAPI spec](openapi.yaml) — full OpenAPI 3.1 spec for all 22 endpoints
- Live `/docs` page — when the HTTP server is running, visit `http://localhost:4021/docs` for an embedded Swagger UI

## License

MIT
