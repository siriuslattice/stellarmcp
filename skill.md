# StellarMCP

## Description
MCP server providing AI agents with read-only access to Stellar blockchain data.
Query accounts, transactions, DEX orderbooks, trade history, asset metadata,
liquidity pools, claimable balances, and normalized prices with VWAP.
x402-monetized on Stellar.

## Endpoints
- GET /tools/getAccount ($0.001)
- GET /tools/getTransactions ($0.001)
- GET /tools/getPayments ($0.001)
- GET /tools/getOrderbook ($0.002)
- GET /tools/getTradeAggregations ($0.002)
- GET /tools/getAssetInfo ($0.001)
- GET /tools/getNetworkStatus (free)
- GET /tools/getLedger ($0.001)
- GET /tools/getEffects ($0.001)
- GET /tools/getOffers ($0.001)
- GET /tools/getOperations ($0.001)
- GET /tools/getLiquidityPools ($0.002)
- GET /tools/getClaimableBalances ($0.001)
- GET /tools/getPrice ($0.002)
- GET /tools/getPriceHistory ($0.002)
- GET /tools/getVWAP ($0.002)

## Payment
x402 on Stellar (testnet). USDC.

## MCP
Compatible with Claude Desktop, Claude Code, Cursor, and any MCP client via stdio.
