# x402 Bazaar Registration Guide

This guide covers registering StellarMCP on the **x402 Bazaar** — the permissionless
service directory where AI agents discover x402-monetized APIs. It also covers the
adjacent Stellar-native discovery surface (OpenClaw + `skill.md`) that we already
serve today.

> **TL;DR**: StellarMCP already exposes every discovery artifact a Bazaar client
> needs (`/skill.md`, `/pricing`, `/openapi.yaml`, `/health`). The outstanding work
> is (1) a public HTTPS URL, (2) declaring the `bazaar` extension with
> `discoverable: true` in our route pricing config, and (3) making at least one
> real settlement through a facilitator that indexes into the Bazaar. Everything
> else is already in place.

---

## Status

| Item                                           | Status                       |
| ---------------------------------------------- | ---------------------------- |
| `skill.md` served at `/skill.md`               | Yes                          |
| `/pricing` endpoint                            | Yes                          |
| `/health` endpoint                             | Yes                          |
| `/openapi.yaml` (OpenAPI 3.1 spec)             | Yes                          |
| `/docs` (Swagger UI)                           | Yes                          |
| x402 payment middleware wired                  | Yes (`src/transports/http.ts`) |
| OpenClaw-compatible `skill.md`                 | Yes                          |
| x402 endpoints live on testnet                 | Yes (OZ facilitator)         |
| x402 endpoints live on mainnet                 | Pending Phase 2              |
| `bazaar` route extension with `discoverable`   | Pending (one-line change)    |
| Public domain with HTTPS                       | Pending                      |
| Bazaar listing verified                        | Pending submission           |

---

## What is the x402 Bazaar?

The x402 Bazaar is a **machine-readable discovery layer** for x402-monetized
services. AI agents query it to find paid APIs they can call, pay for, and
consume — without any human wiring up API keys or integrations beforehand.

Key properties:

- **Permissionless** — no gatekeeping. Services opt in by declaring a `bazaar`
  extension on their route pricing config.
- **Auto-cataloging** — there is no separate registration form. When a facilitator
  processes a payment (verify + settle) for a discoverable route, that route is
  added to the catalog.
- **CDP-backed for EVM today** — the production Coinbase Developer Platform (CDP)
  facilitator exposes the canonical discovery endpoint at
  `https://api.cdp.coinbase.com/platform/v2/x402/discovery/resources`.
- **Per-facilitator catalogs** — facilitators that don't publish discovery data
  (which currently includes OpenZeppelin's Stellar facilitator) don't feed the
  CDP Bazaar directly. Stellar services are typically discovered via OpenClaw
  (`skill.md`) instead — see [Discovery on Stellar](#discovery-on-stellar-openclaw--skillmd) below.

Think of it as the "Google for agentic endpoints". The vision is global
discovery; the reality today is closer to "Yahoo search" — functional but
evolving.

References:

- [x402 Bazaar docs (Coinbase)](https://docs.cdp.coinbase.com/x402/bazaar)
- [Bazaar (Discovery Layer) — x402 gitbook](https://x402.gitbook.io/x402/core-concepts/bazaar-discovery-layer)
- [x402 V2 launch post](https://www.x402.org/writing/x402-v2-launch)

---

## Discovery on Stellar: OpenClaw + `skill.md`

While the CDP Bazaar indexes services via the Coinbase facilitator, Stellar
services using the OpenZeppelin facilitator are primarily discovered via
**OpenClaw** — an open agent-discovery convention built around a Markdown file
named `skill.md` served at a well-known path (`/skill.md`).

StellarMCP already serves this file. When the HTTP server is running, any agent
or crawler hitting `GET /skill.md` receives a human- and machine-readable
description of every tool we offer, its price, and its payment requirements.

OpenClaw-compatible discovery clients:

1. Fetch `GET /skill.md` from the service URL.
2. Parse the tools + price list.
3. Optionally fetch `GET /openapi.yaml` for full schemas.
4. Issue requests to paid endpoints and handle the `402 Payment Required` flow.

There is **no centralized OpenClaw registry** required — the convention is
peer-discoverable. Listing on a "Bazaar-like" index for Stellar is currently
done by advertising the skill URL in directories such as the awesome-x402
registry, Stellar's ecosystem page, and social posts tagged with `#x402`.

---

## What we already serve

StellarMCP exposes the standard discovery endpoints that Bazaar clients consume:

| Endpoint            | Purpose                                                  |
| ------------------- | -------------------------------------------------------- |
| `GET /skill.md`     | OpenClaw skill discovery (Markdown)                      |
| `GET /pricing`      | JSON list of tool prices and free routes                 |
| `GET /health`       | Liveness + version + x402 config summary                 |
| `GET /openapi.yaml` | Full OpenAPI 3.1 spec                                    |
| `GET /docs`         | Swagger UI (human-readable docs page)                    |
| `GET /mcp`          | MCP-over-HTTP (StreamableHTTPServerTransport)            |
| `POST /mcp`         | MCP JSON-RPC endpoint                                    |

When the server is running with x402 configured, hitting any paid endpoint
without a payment header returns a standard `402 Payment Required` response
with x402 payment requirements, which is what Bazaar crawlers probe for.

### Current `skill.md`

This file is served verbatim at `/skill.md`:

```markdown
# StellarMCP

## Description
MCP server providing AI agents with read-only access to Stellar blockchain data.
Query accounts, transactions, DEX orderbooks, trade history, asset metadata,
liquidity pools, claimable balances, and normalized prices with VWAP.
Multi-oracle price aggregation (SdexOracle + ReflectorOracle) with median and
per-source attribution. Exposes a MCP-over-HTTP endpoint at /mcp
(StreamableHTTPServerTransport) for remote MCP clients in addition to the
stdio transport and x402-gated REST API. x402-monetized on Stellar.

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
- GET /tools/getSorobanTokenInfo ($0.002) — SEP-41 token metadata + optional balance
- POST /mcp (free) — MCP-over-HTTP JSON-RPC endpoint (StreamableHTTPServerTransport)
- GET /mcp (free) — SSE stream for server-initiated messages

## Payment
x402 on Stellar (testnet). USDC.

## MCP
Compatible with Claude Desktop, Claude Code, Cursor, and any MCP client via stdio.
```

---

## Pre-submission Checklist

Before attempting to list the service, verify the following:

- [x] HTTP server builds and starts with `pnpm build && pnpm start`
- [x] `GET /skill.md` returns Markdown describing all 17 tools and prices
- [x] `GET /pricing` returns valid JSON matching `TOOL_PRICES` / `FREE_ROUTES`
- [x] `GET /health` returns 200 OK with version + x402 config summary
- [x] `GET /openapi.yaml` returns the full OpenAPI 3.1 spec
- [x] x402 middleware is registered (any paid route returns 402 without a valid payment)
- [x] Testnet payee `GAQB35PQQ5Z7BVOFQE5F2AAAYGU34OIMON5NDJEMIQBEBY46WWHOCLJN` funded (10K XLM + 20 USDC)
- [x] At least one real USDC settlement has been verified on Stellar testnet
  (see [explorer](https://stellar.expert/explorer/testnet/account/GAQB35PQQ5Z7BVOFQE5F2AAAYGU34OIMON5NDJEMIQBEBY46WWHOCLJN))
- [ ] Public domain with HTTPS (Let's Encrypt is fine)
- [ ] Mainnet payee wallet funded with USDC trustline (optional — testnet
      listing is still valuable for discovery)
- [ ] `bazaar` extension added to route pricing with `discoverable: true`
- [x] Tool list matches across `skill.md`, `/pricing`, `server.json`, and `openapi.yaml`

---

## Bazaar Submission Process

There are three plausible paths to visibility. Pursue them in order.

### Option A — Declare the `bazaar` extension on paid routes (CDP-style)

This is the canonical x402 v2 mechanism. On a service using a Bazaar-indexing
facilitator (today: Coinbase CDP), **no form submission is required** — the
facilitator crawls routes flagged `discoverable: true` and auto-catalogs them
the first time it processes a payment.

StellarMCP currently uses the **OpenZeppelin Stellar facilitator**, which does
not (as of April 2026) publish a public discovery endpoint that feeds the CDP
Bazaar directly. Even so, declaring the extension is a one-line change and
future-proofs the service for any facilitator that starts indexing.

Change required in `src/transports/http.ts` inside `setupX402()`:

```typescript
const routePricing: Record<string, { /* ... */ }> = {};
for (const [route, price] of Object.entries(TOOL_PRICES)) {
  routePricing[`GET ${route}`] = {
    accepts: [
      {
        scheme: "exact",
        price,
        network,
        payTo: config.stellarPayeeAddress!,
      },
    ],
    description: "Stellar data query",
    mimeType: "application/json",
    // --- add this block ---
    extensions: {
      bazaar: {
        discoverable: true,
        // Optional: input/output schema refs for richer catalog entries.
        // Agents use these to decide whether to call the tool.
        inputSchema: { $ref: "/openapi.yaml#/components/schemas/" + routeToSchemaName(route) },
        outputSchema: { $ref: "/openapi.yaml#/components/schemas/" + routeToSchemaName(route) + "Response" },
      },
    },
  };
}
```

> **Verify before shipping**: the exact shape of the `extensions.bazaar` block
> lives in `@x402/core` and `@x402/express`. Read the types from the installed
> package version before committing (`node_modules/@x402/core/dist/index.d.ts`).
> The Coinbase Go reference implementation is at
> [`coinbase/x402/go/extensions/bazaar`](https://pkg.go.dev/github.com/coinbase/x402/go/extensions/bazaar).

### Option B — Submit to community indexes

Several independent directories crawl x402 services manually or via pull request:

- **awesome-x402** (GitHub): [xpaysh/awesome-x402](https://github.com/xpaysh/awesome-x402)
  — curated list. Add StellarMCP via PR to the appropriate section (MCP
  servers, Stellar, data APIs).
- **x402.direct** — "The Search Engine for the Agent Economy"
  ([https://x402.direct](https://x402.direct)). May accept listings via form or
  auto-crawl; verify at submission time.
- **402index.io** — domain-verified index ([https://402index.io/verify](https://402index.io/verify)).
  Requires proof of domain control; follow their flow.
- **Stellar ecosystem page** — may accept entries for x402-on-Stellar services.
  Submit via [stellar.org/ecosystem](https://stellar.org/ecosystem) contact or the
  Stellar Hacks: Agents showcase.

### Option C — On-chain registration

As of April 2026 there is **no Soroban contract-based registry** for the x402
Bazaar. If one ships (e.g. a decentralized discovery contract on Stellar
mainnet), update this section with the contract ID and the call signature for
registering a service.

---

## Sample Registration Payload

This is the union of fields used across known Bazaar-style indexes. Not every
index needs every field — tailor to the target.

```json
{
  "name": "StellarMCP",
  "description": "MCP server giving AI agents access to Stellar blockchain data — accounts, DEX, transactions, assets, normalized prices — with x402 micropayments settled on Stellar.",
  "url": "https://api.stellarmcp.example.com",
  "skillMd": "https://api.stellarmcp.example.com/skill.md",
  "pricing": "https://api.stellarmcp.example.com/pricing",
  "openapi": "https://api.stellarmcp.example.com/openapi.yaml",
  "health": "https://api.stellarmcp.example.com/health",
  "docs": "https://api.stellarmcp.example.com/docs",
  "mcp": "https://api.stellarmcp.example.com/mcp",
  "payee": "GAQB35PQQ5Z7BVOFQE5F2AAAYGU34OIMON5NDJEMIQBEBY46WWHOCLJN",
  "network": "stellar:testnet",
  "facilitator": "https://channels.openzeppelin.com/x402/testnet",
  "settlementAsset": "USDC",
  "scheme": "exact",
  "tools": [
    { "name": "getAccount",          "route": "/tools/getAccount",          "price": "$0.001", "method": "GET" },
    { "name": "getTransactions",     "route": "/tools/getTransactions",     "price": "$0.001", "method": "GET" },
    { "name": "getPayments",         "route": "/tools/getPayments",         "price": "$0.001", "method": "GET" },
    { "name": "getOrderbook",        "route": "/tools/getOrderbook",        "price": "$0.002", "method": "GET" },
    { "name": "getTradeAggregations","route": "/tools/getTradeAggregations","price": "$0.002", "method": "GET" },
    { "name": "getAssetInfo",        "route": "/tools/getAssetInfo",        "price": "$0.001", "method": "GET" },
    { "name": "getNetworkStatus",    "route": "/tools/getNetworkStatus",    "price": "free",   "method": "GET" },
    { "name": "getLedger",           "route": "/tools/getLedger",           "price": "$0.001", "method": "GET" },
    { "name": "getEffects",          "route": "/tools/getEffects",          "price": "$0.001", "method": "GET" },
    { "name": "getOffers",           "route": "/tools/getOffers",           "price": "$0.001", "method": "GET" },
    { "name": "getOperations",       "route": "/tools/getOperations",       "price": "$0.001", "method": "GET" },
    { "name": "getLiquidityPools",   "route": "/tools/getLiquidityPools",   "price": "$0.002", "method": "GET" },
    { "name": "getClaimableBalances","route": "/tools/getClaimableBalances","price": "$0.001", "method": "GET" },
    { "name": "getPrice",            "route": "/tools/getPrice",            "price": "$0.002", "method": "GET" },
    { "name": "getPriceHistory",     "route": "/tools/getPriceHistory",     "price": "$0.002", "method": "GET" },
    { "name": "getVWAP",             "route": "/tools/getVWAP",             "price": "$0.002", "method": "GET" },
    { "name": "getSorobanTokenInfo", "route": "/tools/getSorobanTokenInfo", "price": "$0.002", "method": "GET" }
  ],
  "categories": ["blockchain", "stellar", "data", "defi", "mcp", "ai-agents"],
  "tags": ["stellar", "mcp", "x402", "claude", "agents", "dex", "horizon", "soroban", "sep-41"],
  "license": "MIT",
  "repository": "https://github.com/siriuslattice/stellarmcp",
  "npm": "https://www.npmjs.com/package/stellar-mcp-x402",
  "version": "0.2.0",
  "maintainer": "siriuslattice"
}
```

### Sample request / response pair for Bazaar entries that want one

```bash
# Free request (no payment required)
curl https://api.stellarmcp.example.com/tools/getNetworkStatus
# -> { "network": "testnet", "horizonVersion": "...", "latestLedger": 12345678, ... }

# Paid request — first attempt returns 402
curl -i "https://api.stellarmcp.example.com/tools/getAccount?accountId=GAQB35PQQ5Z7BVOFQE5F2AAAYGU34OIMON5NDJEMIQBEBY46WWHOCLJN"
# HTTP/1.1 402 Payment Required
# x-payment-requirements: { "scheme": "exact", "network": "stellar:testnet", "price": "$0.001", "payTo": "G..." }

# After signing + paying via @x402/stellar client, same request returns 200 with the account data
```

---

## Post-Submission Verification

After a listing goes live (or after deploying the `bazaar` extension):

1. **Query the catalog** — for CDP-backed indexes, query the discovery endpoint
   and grep for `stellarmcp`:
   ```bash
   curl -H "Authorization: Bearer $CDP_KEY" \
     https://api.cdp.coinbase.com/platform/v2/x402/discovery/resources \
     | jq '.resources[] | select(.url | contains("stellarmcp"))'
   ```
2. **Use a Bazaar discovery client** — fetch `skill.md` via the directory
   indirection to confirm the crawl worked.
3. **Make a test x402 payment** — run `pnpm x402:stress` against the public
   endpoint; confirm the payee balance increments on the
   [Stellar explorer](https://stellar.expert/explorer/testnet/account/GAQB35PQQ5Z7BVOFQE5F2AAAYGU34OIMON5NDJEMIQBEBY46WWHOCLJN).
4. **Monitor `/health`** — many Bazaar clients probe health and delist services
   that fail repeated checks. Set up UptimeRobot or an equivalent on
   `GET /health` with a 5-minute interval.

---

## Maintenance

| Change                          | Action                                                                                         |
| ------------------------------- | ---------------------------------------------------------------------------------------------- |
| New tool added                  | Update `skill.md`, `src/x402/pricing.ts`, `server.json`, `openapi.yaml`. Redeploy. Bazaar re-crawls on next payment. |
| Price change                    | Update `src/x402/pricing.ts`. Clients re-fetch `/pricing` on each session. No Bazaar re-submit. |
| URL / domain change             | **Requires re-registration** on any directory that stores a cached URL. Update `server.json` and resubmit. |
| Network switch (testnet→pubnet) | Update `STELLAR_NETWORK`, `STELLAR_PAYEE_ADDRESS`, `OZ_FACILITATOR_URL`. Probably list as a new entry (different payee). |
| Shutdown                        | Send a delisting request to each directory. Return `410 Gone` on all routes for at least one week before tearing down DNS. |

---

## Known Gaps and Uncertainties

This section is honest about what we don't know yet. Verify before relying on
anything here.

1. **Does the OpenZeppelin Stellar facilitator feed the CDP Bazaar?**
   Not confirmed. The CDP Bazaar docs imply the discovery crawl is tied to the
   CDP facilitator specifically. Until OZ publishes a discovery endpoint, our
   listing may need to go through OpenClaw indexes and community directories
   (Option B) rather than auto-cataloging (Option A).

2. **Exact `extensions.bazaar` schema in `@x402/stellar`.**
   Read the installed TypeScript types before coding the change. The Go and
   TypeScript implementations have drifted slightly across versions.

3. **Does `@x402/express` pass arbitrary `extensions` through?**
   The version we pin (`^2.9.0`) may strip unknown fields. If so, the change
   may require an upgrade or a PR upstream.

4. **Is there a Stellar-native Bazaar replacement?**
   Not as of April 2026. The Stellar community currently relies on `skill.md`
   + manual submission to awesome-x402 and similar curated lists. Watch for
   announcements from SDF or OpenZeppelin about a Stellar-hosted index.

5. **Domain verification for 402index.io and similar.**
   Flow is unknown until we have a real domain. Expected to involve a TXT
   record or a well-known HTTP file.

When any of these gaps close, update this document in the same PR.

---

## References

- x402 protocol: [https://www.x402.org/](https://www.x402.org/)
- x402 Bazaar (CDP): [https://docs.cdp.coinbase.com/x402/bazaar](https://docs.cdp.coinbase.com/x402/bazaar)
- x402 Bazaar (gitbook): [https://x402.gitbook.io/x402/core-concepts/bazaar-discovery-layer](https://x402.gitbook.io/x402/core-concepts/bazaar-discovery-layer)
- x402 V2 launch: [https://www.x402.org/writing/x402-v2-launch](https://www.x402.org/writing/x402-v2-launch)
- x402 on Stellar (Stellar Docs): [https://developers.stellar.org/docs/build/agentic-payments/x402](https://developers.stellar.org/docs/build/agentic-payments/x402)
- x402 on Stellar (Stellar blog): [https://stellar.org/blog/foundation-news/x402-on-stellar](https://stellar.org/blog/foundation-news/x402-on-stellar)
- Built on Stellar x402 facilitator: [https://developers.stellar.org/docs/build/apps/x402/built-on-stellar](https://developers.stellar.org/docs/build/apps/x402/built-on-stellar)
- OpenZeppelin Relayer x402 plugin: [https://github.com/OpenZeppelin/relayer-plugin-x402-facilitator](https://github.com/OpenZeppelin/relayer-plugin-x402-facilitator)
- coinbase/x402 monorepo: [https://github.com/coinbase/x402](https://github.com/coinbase/x402)
- Go Bazaar extension reference: [https://pkg.go.dev/github.com/coinbase/x402/go/extensions/bazaar](https://pkg.go.dev/github.com/coinbase/x402/go/extensions/bazaar)
- awesome-x402: [https://github.com/xpaysh/awesome-x402](https://github.com/xpaysh/awesome-x402)
- x402.direct: [https://x402.direct](https://x402.direct)
- 402index.io: [https://402index.io/verify](https://402index.io/verify)
- Our `skill.md`: [`../skill.md`](../skill.md)
- Our `server.json`: [`../server.json`](../server.json)
- Our x402 pricing config: [`../src/x402/pricing.ts`](../src/x402/pricing.ts)
- Our HTTP transport (serves all discovery endpoints): [`../src/transports/http.ts`](../src/transports/http.ts)
- Testnet payee on Stellar.expert: [https://stellar.expert/explorer/testnet/account/GAQB35PQQ5Z7BVOFQE5F2AAAYGU34OIMON5NDJEMIQBEBY46WWHOCLJN](https://stellar.expert/explorer/testnet/account/GAQB35PQQ5Z7BVOFQE5F2AAAYGU34OIMON5NDJEMIQBEBY46WWHOCLJN)
