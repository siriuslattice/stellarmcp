# MCP Registry Submission Guide

This guide covers submitting **StellarMCP** to the official Model Context Protocol
Registry at <https://github.com/modelcontextprotocol/registry>, where MCP clients
(Claude Desktop, Cursor, Claude Code, etc.) discover available servers.

## Status

| Item            | Status                                                           |
|-----------------|------------------------------------------------------------------|
| server.json     | Present at repo root, aligned to 2025-12-11 schema               |
| npm published   | `stellar-mcp-x402@0.2.0` (also `@siriuslattice/stellarmcp@0.1.0`)|
| GitHub repo     | Public — <https://github.com/siriuslattice/stellarmcp>           |
| Tools           | 17                                                               |
| Description     | Up to date with Phase 1 scope (Prices API + Soroban)             |
| License         | MIT                                                              |
| Tests           | 132 passing                                                      |
| Submission      | **Pending** — awaiting manual PR + `mcp-publisher` CLI run       |

## What is the MCP Registry?

The MCP Registry is the community-maintained directory of Model Context Protocol
servers, hosted at <https://github.com/modelcontextprotocol/registry>. Its purpose:

- **Agent-discoverable** — clients can query it to find servers matching a capability
  (e.g. "Stellar blockchain data", "GitHub issues", "Google Drive files").
- **Single source of truth** — a `server.json` file describes the server's name,
  version, packages, transports, and runtime configuration so clients can install
  and launch it without per-client setup.
- **Public API** — the registry exposes a read API at
  <https://registry.modelcontextprotocol.io>. Listed servers show up in client
  directories and marketplace-style UIs.

StellarMCP is a strong fit: it is npm-published, MIT licensed, uses the official
`@modelcontextprotocol/sdk`, runs via stdio, and advertises a well-defined set of
17 Stellar blockchain tools.

## Prerequisites

- [x] Public GitHub repository: <https://github.com/siriuslattice/stellarmcp>
- [x] npm published package: `stellar-mcp-x402@0.2.0`
- [x] `server.json` present at repo root
- [x] All tools implement the MCP protocol via `@modelcontextprotocol/sdk`
- [x] License: MIT (`LICENSE` file at repo root)
- [x] Tests passing (132 unit + integration tests)
- [ ] `mcpName` field added to `package.json` matching `server.json.name`
      (see **Publishing Steps** below — required by the registry for npm ownership
      verification)
- [ ] GitHub authentication set up for `mcp-publisher` CLI

## Server.json Schema (2025-12-11)

The current canonical schema lives at:

```
https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json
```

### Required top-level fields

| Field          | Type   | Notes                                                                                 |
|----------------|--------|---------------------------------------------------------------------------------------|
| `$schema`      | string | Must point to the canonical schema URL above.                                         |
| `name`         | string | Namespaced identifier. For GitHub auth must start with `io.github.<user>/`.           |
| `description`  | string | Human-readable description of what the server does.                                   |
| `version`      | string | SemVer string, must match the published package version.                              |
| `packages`     | array  | At least one entry. Each describes how to install/launch the server from a registry.  |

### Optional top-level fields

| Field          | Type   | Notes                                                                   |
|----------------|--------|-------------------------------------------------------------------------|
| `title`        | string | Human-friendly display name (may differ from `name`).                   |
| `homepage`     | string | URL to the project homepage.                                            |
| `repository`   | object | `{ type, url, source }` — `source` is typically `"github"`.             |
| `license`      | string | SPDX identifier, e.g. `"MIT"`.                                          |
| `remotes`      | array  | Remote (HTTP/SSE) endpoints where the server is hosted.                 |
| `_meta`        | object | Free-form vendor metadata — custom fields go here, keyed by namespace.  |

### Package entry fields

Each `packages[]` entry describes how to fetch the server from a language registry.

| Field                 | Type    | Required | Notes                                                                      |
|-----------------------|---------|----------|----------------------------------------------------------------------------|
| `registryType`        | string  | yes      | `"npm"`, `"pypi"`, `"nuget"`, `"oci"`, `"mcpb"`, `"github"`, etc.          |
| `registryBaseUrl`     | string  | no       | Override the default registry URL (e.g. private registry).                 |
| `identifier`          | string  | yes      | Package identifier (npm package name, PyPI name, OCI image, etc.).         |
| `version`             | string  | yes      | Version to install — must match the published release.                    |
| `transport`           | object  | yes      | `{ type: "stdio" }`, `{ type: "streamable-http", url }`, or `{ type: "sse", url }`. |
| `runtimeHint`         | string  | no       | How to execute the package (e.g. `"npx"`, `"uvx"`, `"docker"`).            |
| `runtimeArguments`    | array   | no       | CLI arguments passed to the runtime (e.g. the package name for `npx`).    |
| `packageArguments`    | array   | no       | Arguments passed to the server itself.                                     |
| `environmentVariables`| array   | no       | Env vars the server reads. Each is `{ name, description, default?, isRequired?, isSecret?, choices? }`. |

### Remote entry fields

| Field          | Type   | Notes                                                             |
|----------------|--------|-------------------------------------------------------------------|
| `type`         | string | `"streamable-http"` or `"sse"`.                                  |
| `url`          | string | Full endpoint URL.                                                |
| `description`  | string | Optional — human description of the remote.                       |

## Current StellarMCP server.json

The file at [`../server.json`](../server.json) now aligns to the 2025-12-11 schema.
Key points:

- `$schema` pinned to the canonical URL.
- `name` is `io.github.siriuslattice/stellarmcp` (GitHub namespace matches the repo
  owner, which is required for GitHub-auth publishing).
- `version` (`0.2.0`) matches `package.json`.
- `packages[0]` describes the npm package `stellar-mcp-x402` with:
  - `registryType: "npm"`
  - `transport.type: "stdio"`
  - `runtimeHint: "npx"` and positional argument `stellar-mcp-x402`
  - Full `environmentVariables` list for `STELLAR_NETWORK`, `HORIZON_URL`,
    `TRANSPORT`, `STELLAR_PAYEE_ADDRESS`, `OZ_FACILITATOR_URL`, `OZ_API_KEY`
    (the x402 secret is marked `isSecret: true`).
- `remotes[0]` describes the local MCP-over-HTTP endpoint at
  `http://localhost:4021/mcp` (informational — the registry will not attempt to
  contact it).
- `_meta["io.github.siriuslattice/stellarmcp"]` carries StellarMCP-specific extras
  that do not have a formal place in the schema:
  - `tags` — searchable keywords
  - `tools` — the 17-tool list with per-tool descriptions and x402 prices
  - `transports` — the three supported modes
  - `runtime` / `command` — legacy discovery fields kept for back-compat

> `_meta` is the schema's official escape hatch for custom fields — anything
> project-specific should be nested under a reverse-DNS or GitHub-style namespace
> inside `_meta` so it does not collide with future schema additions.

## Publishing Steps

The official registry uses the **`mcp-publisher` CLI** to push `server.json` into
the registry backend. There is no PR-against-a-repo flow for new listings anymore —
publishing is API-based.

### 1. Fork / clone registry docs (optional, for reference)

```bash
git clone https://github.com/modelcontextprotocol/registry.git
# Reference examples under docs/reference/server-json/
```

### 2. Install the publisher CLI

```bash
# TBD: verify exact CLI install command against the registry repo before running.
# Likely one of:
npx @modelcontextprotocol/publisher --help
# or
npm install -g @modelcontextprotocol/publisher
```

### 3. Add `mcpName` to `package.json`

The registry verifies npm ownership by checking that `package.json.mcpName` matches
`server.json.name`. Add the field to `package.json`:

```json
{
  "name": "stellar-mcp-x402",
  "version": "0.2.0",
  "mcpName": "io.github.siriuslattice/stellarmcp",
  ...
}
```

Then republish to npm:

```bash
pnpm build
npm publish
```

### 4. Authenticate

GitHub authentication is the easiest path. Run the publisher CLI's login flow:

```bash
npx @modelcontextprotocol/publisher login github
# Opens browser / device-code flow; grants the CLI permission to publish under
# io.github.siriuslattice/*
```

### 5. Publish

From the repo root:

```bash
npx @modelcontextprotocol/publisher publish
# Reads ./server.json, validates it against the schema, POSTs to the registry API.
```

On success the CLI prints the registry URL of the new entry. The listing will be
live at:

```
https://registry.modelcontextprotocol.io/servers/io.github.siriuslattice/stellarmcp
```

## Validation (pre-submit)

Before running the publish CLI, verify the file locally.

### Confirm it is valid JSON

```bash
python3 -m json.tool server.json > /dev/null && echo OK
```

### Confirm version matches package.json

```bash
node -e "
const pkg = require('./package.json');
const sj = require('./server.json');
if (pkg.version !== sj.version) { console.error('VERSION MISMATCH', pkg.version, sj.version); process.exit(1); }
console.log('version match:', sj.version);
"
```

### Confirm `mcpName` matches `server.json.name`

```bash
node -e "
const pkg = require('./package.json');
const sj = require('./server.json');
if (pkg.mcpName !== sj.name) { console.error('mcpName MISMATCH', pkg.mcpName, sj.name); process.exit(1); }
console.log('mcpName match:', sj.name);
"
```

### Validate against the JSON Schema

The schema is published at
<https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json>.
Any JSON Schema validator will do. Example using `ajv`:

```bash
npx ajv-cli validate \
  -s https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json \
  -d server.json
```

> TBD: if `ajv-cli` rejects the schema URL (it sometimes chokes on `$id` /
> `$schema` drafts), download the schema file locally and pass it as a path.

### Dry-run the publisher

```bash
npx @modelcontextprotocol/publisher publish --dry-run
```

## PR / Issue Template (if the registry asks for a GitHub notification)

Some registries also request a companion GitHub issue on the `modelcontextprotocol/registry`
repo for discoverability. If required:

```
Title: Add StellarMCP — Stellar blockchain data tools (17 tools, x402-monetized)

## Server Name
io.github.siriuslattice/stellarmcp

## npm Package
stellar-mcp-x402

## Repository
https://github.com/siriuslattice/stellarmcp

## What it does
17 read-only Stellar blockchain tools for AI agents — accounts, DEX orderbooks,
payments, transactions, trade history, liquidity pools, Soroban SEP-41 tokens,
and multi-oracle prices aggregated across SDEX and Reflector. Every tool call
can be micropaid via x402 settled in USDC on Stellar itself.

## Installation
npx stellar-mcp-x402

## Transports
- stdio (default, free)
- HTTP REST with x402 payment gating
- MCP-over-HTTP (StreamableHTTPServerTransport)

## Compliance
- [x] MIT licensed
- [x] Public repository
- [x] npm published (stellar-mcp-x402@0.2.0)
- [x] Uses @modelcontextprotocol/sdk ^1.28.0
- [x] All tools documented in server.json
- [x] 132 tests passing
```

## Post-Submission

After `mcp-publisher publish` returns success:

1. **Verify the listing**: open
   `https://registry.modelcontextprotocol.io/v0/servers?search=stellarmcp` and
   confirm the entry appears.
2. **Expected review timeline**: the registry is mostly automated. Schema
   validation and ownership verification happen synchronously during publish.
   Curation / featuring on the marketplace UI may take longer. TBD: confirm
   whether there is a moderation queue before entries become public.
3. **If publish fails**:
   - **Schema error**: re-run local validation, fix, republish.
   - **Name ownership error**: verify `mcpName` is in published `package.json`
     (it must be in the actually-published tarball, not just the git repo).
   - **Auth error**: re-run `mcp-publisher login github`.
4. **Announce**: post in the hackathon Discord, tag SDF folks, link from the
   DoraHacks BUIDL.

## Updating an Existing Listing

When releasing a new version of StellarMCP:

1. Bump `package.json` `version` (e.g. `0.2.0` → `0.3.0`).
2. Bump `server.json` `version` to the same value.
3. Bump `packages[0].version` inside `server.json` to match.
4. If any new env vars, tools, or transports were added, update
   `packages[0].environmentVariables` and `_meta` accordingly.
5. Run the pre-submit validation steps above.
6. `npm publish` the new version to npm.
7. Run `npx @modelcontextprotocol/publisher publish` again. The registry treats
   same-name + higher-version submissions as an update, not a duplicate.

> TBD: verify whether the registry supports yanking / deleting old versions, or
> whether the history is append-only. Assume append-only for now.

## Uncertain / TBD items

Items marked **TBD** in this doc should be double-checked against the registry
source before running the publish command the first time:

- Exact `mcp-publisher` CLI install command (npx vs global install).
- Whether `ajv-cli` successfully validates the live schema URL without local
  download.
- Whether there is a moderation queue before entries become publicly visible.
- Whether old versions can be yanked.
- Whether a parallel PR / issue on `modelcontextprotocol/registry` is still
  required alongside the API publish.
- Whether `remotes[].url` pointing at `localhost:4021/mcp` is acceptable or
  should be removed for a pure-stdio listing (arguably it should be removed
  since a local URL cannot be contacted by the registry or other clients).

## References

- Official MCP Registry repo: <https://github.com/modelcontextprotocol/registry>
- Generic `server.json` reference:
  <https://github.com/modelcontextprotocol/registry/blob/main/docs/reference/server-json/generic-server-json.md>
- `server.json` CHANGELOG:
  <https://github.com/modelcontextprotocol/registry/blob/main/docs/reference/server-json/CHANGELOG.md>
- Schema (2025-12-11):
  <https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json>
- Registry API docs: <https://registry.modelcontextprotocol.io/docs>
- Package type reference:
  <https://modelcontextprotocol.io/registry/package-types>
- MCP Specification: <https://modelcontextprotocol.io/>
- Our `server.json`: [`../server.json`](../server.json)
- npm package: <https://www.npmjs.com/package/stellar-mcp-x402>
- GitHub repo: <https://github.com/siriuslattice/stellarmcp>
