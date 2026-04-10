# StellarMCP

**Data Merchant for the Agent Economy**

MCP server giving AI agents access to Stellar blockchain data — accounts, DEX orderbooks, transactions, trade history, asset metadata, and network status — with every tool call monetized via [x402](https://www.x402.org/) micropayments settled on Stellar.

Built for the [Stellar Hacks: Agents](https://dorahacks.io/hackathon/stellar-hacks-agents) hackathon.

## Features

- **16 MCP tools** querying the Stellar Horizon REST API
- **PriceService** with VWAP, OHLC history, and oracle abstraction layer
- **x402 micropayments** on Stellar — agents pay per call in USDC
- **Dual transport** — stdio for MCP clients, HTTP REST for x402-gated access
- **Earn/spend demo** — agent earns USDC selling data, spends USDC on external services
- **OpenClaw registered** — permissionless agent discovery via `GET /skill.md`
- **Zero dependencies on `@stellar/stellar-sdk`** — raw `fetch` to Horizon

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
| `getPrice` | Current price for any Stellar asset pair | $0.002 |
| `getPriceHistory` | OHLC price history with VWAP | $0.002 |
| `getVWAP` | Volume-weighted average price | $0.002 |

The price tools are powered by PriceService, which aggregates data from the Stellar SDEX via trade aggregations. The oracle abstraction layer supports multiple price sources (SDEX, Reflector) with source attribution.

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
                                                   +--> PriceService ──> OracleProvider(s)
                                                   |
stdio transport ──> McpServer ──> 16 tools ──> HorizonClient ──> Stellar Horizon REST API
                                                   |
HTTP transport  ──> Express ──> x402 middleware ────+
                       |
                       +-- /tools/* (paid endpoints)
                       +-- /tools/getNetworkStatus (free)
                       +-- /health (free)
                       +-- /pricing (free)
                       +-- /skill.md (OpenClaw discovery)
```

The PriceService sits on top of HorizonClient and provides normalized price data (current price, OHLC history, VWAP) through an oracle abstraction layer. The SDEX oracle queries Horizon trade aggregations; future oracles (Reflector, Chainlink) plug in via the same OracleProvider interface.

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
| `SOROBAN_RPC_URL` | No | — | Soroban RPC URL (for future SEP-41 token support) |

## License

MIT
