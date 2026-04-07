# AGENTS.md — StellarMCP

## Agent Identity
- **Name**: StellarMCP
- **Type**: Data Merchant
- **Version**: 0.1.0
- **Description**: Sells Stellar blockchain data to AI agents via x402 micropayments

## Capabilities
- **Reads**: Stellar accounts, transactions, payments, DEX orderbooks, trade aggregations, asset metadata, network status, ledger details
- **Writes**: None (read-only)
- **Settlement**: x402 on Stellar (USDC)

## Interfaces

### MCP (stdio)
Full Model Context Protocol server with 8 tools. Connect via any MCP client.

```json
{
  "mcpServers": {
    "stellarmcp": {
      "command": "npx",
      "args": ["stellarmcp"],
      "env": {
        "STELLAR_NETWORK": "testnet"
      }
    }
  }
}
```

### HTTP REST (x402-gated)
Each tool exposed as a GET endpoint. Paid endpoints require x402 payment header.

| Endpoint | Price | Params |
|----------|-------|--------|
| GET /tools/getAccount | $0.001 | accountId |
| GET /tools/getTransactions | $0.001 | accountId, limit? |
| GET /tools/getPayments | $0.001 | accountId, limit? |
| GET /tools/getOrderbook | $0.002 | sellingAsset, buyingAsset, limit? |
| GET /tools/getTradeAggregations | $0.002 | baseAsset, counterAsset, resolution?, limit? |
| GET /tools/getAssetInfo | $0.001 | assetCode, assetIssuer? |
| GET /tools/getNetworkStatus | free | — |
| GET /tools/getLedger | $0.001 | sequence? |
| GET /pricing | free | — |
| GET /health | free | — |

## Discovery
- **OpenClaw**: Served at `GET /skill.md`
- **MCP Registry**: See `server.json`

## Economics
- **Earns**: USDC via x402 micropayments per tool call
- **Spends**: USDC consuming external x402 services (demo mode)
- **Network**: Stellar testnet (Phase 0), mainnet (Phase 2)
