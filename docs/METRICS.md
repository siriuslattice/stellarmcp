# StellarMCP — Project Metrics

Verifiable current state of StellarMCP as of **2026-04-10**.
Every metric below is reproducible from the public repository at
<https://github.com/siriuslattice/stellarmcp>.

This document is generated as a Day 11 deliverable for the SCF grant proposal
polish pass. It is intended to be cited from the SCF submission as evidence of
project state — every claim here is testable from the public repo with the
commands in the rightmost column.

## Status

| Metric | Value | How to verify |
|--------|-------|---------------|
| Version | `0.2.0` | `cat package.json \| grep version` |
| Tools (total) | **17** (16 paid + 1 free) | `cat src/x402/pricing.ts` |
| Tool registration modules | 14 | `grep -c "register.*Tools" src/tools/index.ts` |
| Test files (unit) | 20 | `find tests/unit -name '*.test.ts' \| wc -l` |
| Test files (integration) | 5 | `find tests/integration -name '*.test.ts' \| wc -l` |
| Tests (unit) | **106** | `pnpm test` |
| Tests (integration) | **26** (skip-by-default) | `pnpm test:integration` |
| Tests (total) | **132** | both above |
| OpenAPI spec | 1046 lines | `wc -l openapi.yaml` |
| npm package | `stellar-mcp-x402@0.2.0` | `npm view stellar-mcp-x402` |
| License | MIT | `cat LICENSE` |
| Node engine | `>=22.0.0` | `cat package.json` |
| Hackathon snapshot tag | `v0.1.1-hackathon` → `70a5a17` | `git tag`, `git rev-parse v0.1.1-hackathon` |
| Hackathon submission | DoraHacks BUIDL submitted 2026-04-10 | DoraHacks profile |
| On-chain x402 settlements | 15+ on Stellar testnet | [Stellar testnet explorer](https://stellar.expert/explorer/testnet/account/GAQB35PQQ5Z7BVOFQE5F2AAAYGU34OIMON5NDJEMIQBEBY46WWHOCLJN) |

## Tool inventory

All 17 tools across 14 registration modules. Prices pulled directly from
`src/x402/pricing.ts`. `getNetworkStatus` is the only free route (required
for agent service discovery before payment negotiation).

### Account & Transactions (6 tools)

| Tool | Price | REST endpoint | Module |
|------|-------|---------------|--------|
| `getAccount` | $0.001 | `GET /tools/getAccount` | `src/tools/account.ts` |
| `getTransactions` | $0.001 | `GET /tools/getTransactions` | `src/tools/transactions.ts` |
| `getPayments` | $0.001 | `GET /tools/getPayments` | `src/tools/payments.ts` |
| `getEffects` | $0.001 | `GET /tools/getEffects` | `src/tools/effects.ts` |
| `getOperations` | $0.001 | `GET /tools/getOperations` | `src/tools/operations.ts` |
| `getOffers` | $0.001 | `GET /tools/getOffers` | `src/tools/offers.ts` |

### DEX & Prices (5 tools)

| Tool | Price | REST endpoint | Module |
|------|-------|---------------|--------|
| `getOrderbook` | $0.002 | `GET /tools/getOrderbook` | `src/tools/orderbook.ts` |
| `getTradeAggregations` | $0.002 | `GET /tools/getTradeAggregations` | `src/tools/trades.ts` |
| `getPrice` | $0.002 | `GET /tools/getPrice` | `src/tools/price.ts` |
| `getPriceHistory` | $0.002 | `GET /tools/getPriceHistory` | `src/tools/price.ts` |
| `getVWAP` | $0.002 | `GET /tools/getVWAP` | `src/tools/price.ts` |

### Assets & Pools (4 tools)

| Tool | Price | REST endpoint | Module |
|------|-------|---------------|--------|
| `getAssetInfo` | $0.001 | `GET /tools/getAssetInfo` | `src/tools/assets.ts` |
| `getLiquidityPools` | $0.001 | `GET /tools/getLiquidityPools` | `src/tools/liquidityPools.ts` |
| `getClaimableBalances` | $0.001 | `GET /tools/getClaimableBalances` | `src/tools/claimableBalances.ts` |
| `getSorobanTokenInfo` | $0.002 | `GET /tools/getSorobanTokenInfo` | `src/tools/sorobanTokens.ts` |

### Network (2 tools)

| Tool | Price | REST endpoint | Module |
|------|-------|---------------|--------|
| `getNetworkStatus` | **free** | `GET /tools/getNetworkStatus` | `src/tools/network.ts` |
| `getLedger` | $0.001 | `GET /tools/getLedger` | `src/tools/network.ts` |

### Free non-tool routes

| Route | Purpose |
|-------|---------|
| `GET /health` | Liveness + enriched operational metadata (cache size, uptime, version) |
| `GET /skill.md` | OpenClaw agent discovery metadata |
| `GET /docs` | Self-service Swagger UI |
| `GET /openapi.yaml` | OpenAPI 3.1 spec (1046 lines) |
| `POST /mcp` | MCP-over-HTTP transport (JSON-RPC) |

## Test coverage

Test counts extracted via `grep -cE "^\s+(it|test)\(" <file>` across every
test file. Integration tests are skipped by default (require `TEST_INTEGRATION=1`)
because they make live calls to Stellar testnet Horizon.

### Unit tests (106 total, 20 files)

| File | Tests |
|------|-------|
| `tests/unit/cache.test.ts` | 8 |
| `tests/unit/config.test.ts` | 4 |
| `tests/unit/formatters.test.ts` | 17 |
| `tests/unit/providers/aggregator.test.ts` | 7 |
| `tests/unit/providers/horizon.test.ts` | 10 |
| `tests/unit/providers/oracle.test.ts` | 15 |
| `tests/unit/providers/price.test.ts` | 8 |
| `tests/unit/providers/soroban.test.ts` | 5 |
| `tests/unit/tools/account.test.ts` | 2 |
| `tests/unit/tools/assets.test.ts` | 3 |
| `tests/unit/tools/claimableBalances.test.ts` | 2 |
| `tests/unit/tools/effects.test.ts` | 2 |
| `tests/unit/tools/liquidityPools.test.ts` | 2 |
| `tests/unit/tools/offers.test.ts` | 2 |
| `tests/unit/tools/operations.test.ts` | 2 |
| `tests/unit/tools/orderbook.test.ts` | 2 |
| `tests/unit/tools/payments.test.ts` | 2 |
| `tests/unit/tools/price.test.ts` | 5 |
| `tests/unit/tools/sorobanTokens.test.ts` | 6 |
| `tests/unit/tools/trades.test.ts` | 2 |
| **Total** | **106** |

### Integration tests (26 total, 5 files, skip-by-default)

| File | Tests | What it proves |
|------|-------|----------------|
| `tests/integration/horizon.test.ts` | 10 | HorizonClient works against live testnet |
| `tests/integration/tools.test.ts` | 6 | Real MCP tool handlers + live Horizon data |
| `tests/integration/price.test.ts` | 4 | PriceService computes VWAP/OHLC from live SDEX trades |
| `tests/integration/mcp-http.test.ts` | 3 | MCP-over-HTTP `initialize` handshake over JSON-RPC |
| `tests/integration/docs.test.ts` | 3 | `/docs`, `/openapi.yaml`, `/health` served correctly |
| **Total** | **26** |

Run integration suite:
```bash
TEST_INTEGRATION=1 pnpm test:integration
# or
pnpm test:integration
```

## Build artifacts

Output from `ls -lh dist/` after `pnpm build`:

```
-rwxr-xr-x  index.js                34K   # main entry (stdio)
-rw-r--r--  index.d.ts              13 B  # type declaration
-rwxr-xr-x  http-E4WOR7IA.js        29K   # HTTP transport (code-split, loaded only for TRANSPORT=http)
-rwxr-xr-x  chunk-RXL6OST3.js       14K   # shared chunk
-rw-r--r--  index.js.map            67K   # sourcemap (not shipped to runtime)
-rw-r--r--  http-*.js.map           51K
-rw-r--r--  chunk-*.js.map          29K
```

The production runtime is three JS files totaling **~77 KB** uncompressed
(`index.js` + `http-*.js` + `chunk-*.js`). Sourcemaps are not required at
runtime.

`@stellar/stellar-sdk` is declared as an **optional** `peerDependency` (~2 MB)
and is **not** bundled into the production output. It is loaded dynamically
only when `SOROBAN_RPC_URL` is configured (for `getSorobanTokenInfo`
contract-simulation calls). HorizonClient uses raw `fetch()` — no SDK
dependency.

## Phase 0 → Phase 1 timeline

Pulled from `CLAUDE.md` Build Status block. The hackathon shipped on
Day 4 (April 10) and the SCF-expansion phase runs from Day 7 through
Day 12 (April 14–26).

| Day | Date | Deliverable | Status |
|-----|------|-------------|--------|
| 1 | Apr 7 | Scaffold, utils, HorizonClient, 4 tools, HTTP stub, 23 tests | Complete |
| 2 | Apr 8 | All 8 Phase-0 tools, full x402 HTTP server, 30 tests | Complete |
| 3 | Apr 9 | Agent earn/spend demo, mock external service, README, AGENTS.md, skill.md, server.json, LICENSE | Complete |
| 4 | Apr 10 | Demo video, BUIDL submission, keygen script, testnet wallet, USDC trustline, real x402 end-to-end verified, published to npm | Complete |
| 5 | Apr 11 | Real x402 payments in demo, 8/8 stress test, 15+ on-chain USDC settlements, security hardening, 40 tests | Complete |
| 6 | Apr 12–13 | Hackathon buffer. **Deadline: April 13 17:00 UTC** | Complete |
| 7 | Apr 14 | Phase 1 — 3 new Horizon tools (`getEffects`, `getOffers`, `getOperations`), SCF interest form drafted | Complete |
| 8 | Apr 15 | Price API foundation — `PriceService`, `getPrice`, `getPriceHistory`, VWAP, bumped to 0.2.0, **SCF interest form submitted** | Complete |
| 9 | Apr 16 | `getLiquidityPools`, `getClaimableBalances`, integration test scaffold | Complete |
| 10 | Apr 17 | Oracle abstraction — `SdexOracle`, `ReflectorOracle`, multi-oracle aggregator in `PriceService` | Complete |
| 11 | Apr 18 | MCP-over-HTTP transport, JSON-RPC x402 pre-handler, `/mcp` endpoint | Complete |
| 11 | Apr 19 | Documentation pass — OpenAPI (1046 lines), updated README/AGENTS/server.json/skill.md, SCF full proposal draft v1 | Complete |
| 12 | Apr 20 | SEP-41 Soroban token support — `SorobanClient`, `getSorobanTokenInfo` | Complete |
| 13 | Apr 21 | Trading strategy examples — SMA crossover, cross-pair arbitrage | Complete |
| 14 | Apr 22 | Mainnet readiness — auto network defaults, enriched `/health`, `/docs`, per-path rate limits | Complete |
| 15 | Apr 23 | Production deployment + MCP Registry + x402 Bazaar submission prep docs | Complete |
| 16 | Apr 24–25 | SCF full proposal polish, this METRICS doc, ARCHITECTURE, DEPLOYMENT | In progress |
| 17 | Apr 26 | **SCF proposal submission deadline** | Pending |

## Repository activity

| Metric | Value |
|--------|-------|
| First commit | 2026-04-07 |
| Latest commit | 2026-04-10 |
| Days of active development | 10+ (Phase 0: 5 days, Phase 1: ongoing) |
| npm versions published | `0.1.0`, `0.1.1`, `0.2.0` |
| Git tag (hackathon snapshot) | `v0.1.1-hackathon` (commit `70a5a17`) |

The hackathon submission state is preserved at git tag `v0.1.1-hackathon` so
grant reviewers can verify exactly what was shipped during the hackathon vs
what was added during Phase 1 expansion:

```bash
git checkout v0.1.1-hackathon  # snapshot of hackathon submission
git checkout main              # current SCF-expansion state
```

## Source tree size

Approximate line counts from `ls -la src/`:

| Directory | Files | Notes |
|-----------|-------|-------|
| `src/tools/` | 15 .ts files | 14 registration modules + `index.ts` barrel |
| `src/providers/` | 5 .ts files | `horizon`, `price`, `oracle`, `aggregator`, `soroban` |
| `src/utils/` | 4 .ts files | `cache`, `errors`, `formatters`, `logger` |
| `src/transports/` | 1 .ts file | `http.ts` (~31 KB — largest file) |
| `src/x402/` | 1 .ts file | `pricing.ts` |
| `src/resources/` | 1 .ts file | stub (Phase 1 expansion point) |
| `src/prompts/` | 1 .ts file | stub (Phase 1 expansion point) |
| `src/` root | 3 .ts files | `index.ts`, `config.ts`, `types.ts` |
| **Total** | **31 .ts files** | |

`src/transports/http.ts` (~31 KB) is the largest source file — it contains
the Express app, x402 resource-server wiring, all 16 REST endpoint handlers,
the MCP-over-HTTP pre-handler, Swagger UI hosting, and per-path rate limits.

## On-chain evidence

The hackathon-funded testnet payee account

    GAQB35PQQ5Z7BVOFQE5F2AAAYGU34OIMON5NDJEMIQBEBY46WWHOCLJN

has **15+ real x402 USDC settlements** visible on the Stellar testnet
explorer:

<https://stellar.expert/explorer/testnet/account/GAQB35PQQ5Z7BVOFQE5F2AAAYGU34OIMON5NDJEMIQBEBY46WWHOCLJN>

These settlements were generated by the `pnpm x402:client` and
`pnpm x402:stress` scripts during Day 4–5 testing. They are real Soroban
USDC token transfers driven by the x402 protocol — not testnet faucet
drops, not simulated. Each call follows the real `402 → sign → pay → 200`
flow:

1. Client calls `GET /tools/getAccount`
2. Server responds `402 Payment Required` with an x402 payment requirement
3. Client signs a Soroban auth entry with its Stellar secret key
4. Client retries with the `X-PAYMENT` header
5. OpenZeppelin facilitator submits the USDC transfer on Stellar testnet
6. Server verifies settlement with the facilitator, returns `200 OK` + data

The stress test (`pnpm x402:stress`) hits all 8 monetized Phase-0 endpoints
in sequence — 8/8 pass with on-chain settlements confirmed.

## Dependencies

### Production dependencies (bundled into npm package)

| Package | Version | Purpose |
|---------|---------|---------|
| `@modelcontextprotocol/sdk` | `^1.28.0` | MCP server framework (stdio + Streamable HTTP) |
| `@x402/core` | `^2.9.0` | x402 protocol core + facilitator client |
| `@x402/express` | `^2.9.0` | x402 Express middleware |
| `@x402/stellar` | `^2.9.0` | x402 Stellar scheme (Soroban USDC transfers) |
| `express` | `^4.21.0` | HTTP server (Express 4 — x402 middleware is Express 4) |
| `cors` | `^2.8.5` | CORS middleware |
| `express-rate-limit` | `^7.5.0` | Rate limiting |
| `zod` | `^3.25.0` | Schema validation for tool parameters |
| `dotenv` | `^16.4.0` | Env var loading |

### Optional peer dependency

| Package | Version | Purpose |
|---------|---------|---------|
| `@stellar/stellar-sdk` | `^15.0.1` | Soroban contract simulation for `getSorobanTokenInfo`. Loaded dynamically only when `SOROBAN_RPC_URL` is configured. Not bundled. |

### Dev dependencies (not shipped)

`typescript`, `vitest`, `tsup`, `tsx`, `eslint`, `typescript-eslint`,
`prettier`, `@types/node`, `@types/express`, `@types/cors`,
`@stellar/stellar-sdk` (also a dev dep for scripts: `keygen`, `setup:usdc`,
`x402:client`, `x402:stress`).

## Reproducibility

Every metric in this document can be verified by any reviewer:

```bash
git clone https://github.com/siriuslattice/stellarmcp.git
cd stellarmcp

# Option A: verify hackathon-snapshot state
git checkout v0.1.1-hackathon
pnpm install
pnpm typecheck    # zero errors
pnpm test         # 40 tests pass (Phase 0 snapshot)
pnpm build

# Option B: verify current SCF-expansion state
git checkout main
pnpm install
pnpm typecheck                       # zero errors
pnpm test                            # 106 unit tests pass
TEST_INTEGRATION=1 pnpm test:integration  # 26 integration tests pass
pnpm build                           # clean ESM build with sourcemaps
ls -lh dist/                         # verify bundle sizes (~77 KB runtime)
wc -l openapi.yaml                   # 1046
cat src/x402/pricing.ts              # 16 paid routes + 6 free routes
```

To verify on-chain evidence independently (no StellarMCP code required):

```bash
# Browse settlements on the Stellar testnet explorer
open "https://stellar.expert/explorer/testnet/account/GAQB35PQQ5Z7BVOFQE5F2AAAYGU34OIMON5NDJEMIQBEBY46WWHOCLJN"

# Or reproduce the stress test yourself (requires a funded Stellar testnet wallet with USDC)
cp .env.example .env
# Fill in STELLAR_SECRET_KEY, OZ_API_KEY, STELLAR_PAYEE_ADDRESS
pnpm keygen          # generate + Friendbot-fund a new testnet wallet
pnpm setup:usdc      # add USDC trustline + claim from Circle faucet
TRANSPORT=http pnpm start &
pnpm x402:stress     # 8/8 endpoints settle real USDC on-chain
```

## References

- **GitHub**: <https://github.com/siriuslattice/stellarmcp>
- **npm**: <https://www.npmjs.com/package/stellar-mcp-x402>
- **Hackathon snapshot**: <https://github.com/siriuslattice/stellarmcp/tree/v0.1.1-hackathon>
- **Stellar testnet payee account** (on-chain evidence): <https://stellar.expert/explorer/testnet/account/GAQB35PQQ5Z7BVOFQE5F2AAAYGU34OIMON5NDJEMIQBEBY46WWHOCLJN>
- **OpenZeppelin x402 facilitator**: <https://channels.openzeppelin.com/x402/testnet>
- **README**: [../README.md](../README.md)
- **Architecture**: [./ARCHITECTURE.md](./ARCHITECTURE.md)
- **Deployment**: [./DEPLOYMENT.md](./DEPLOYMENT.md)
- **SCF proposal draft**: [./SCF_PROPOSAL.md](./SCF_PROPOSAL.md)
- **MCP Registry submission**: [./MCP_REGISTRY.md](./MCP_REGISTRY.md)
- **x402 Bazaar submission**: [./X402_BAZAAR.md](./X402_BAZAAR.md)
