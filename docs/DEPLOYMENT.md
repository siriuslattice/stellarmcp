# StellarMCP Production Deployment Guide

This guide walks through deploying StellarMCP to a production environment serving
real traffic on Stellar mainnet with x402 micropayments.

## Overview

StellarMCP's deployment surface is intentionally minimal: a single Node.js process
that serves HTTP on port `4021` (default). It has no database, no persistent disk,
and no background workers. All state lives in two places: the process environment
(configuration + wallet addresses) and the Stellar network itself (accounts,
balances, payments, ledgers).

The server exposes two transports — a JSON-RPC MCP endpoint at `POST /mcp` and a
REST surface under `/tools/*` with x402 payment gating — both from the same
process. A bounded in-memory cache (max 1000 entries) fronts every Horizon call,
and an Express rate limiter protects against abuse. For production you run this
behind a reverse proxy that terminates TLS, and you route monitoring at the
`/health` endpoint.

Because the process is stateless, you can restart or redeploy at any time without
data loss. Horizontal scaling is possible with caveats — see Section 9.

---

## 1. Prerequisites

| Requirement | Details |
|---|---|
| **Runtime** | Node.js 22+ **OR** Docker 24+ (pick one) |
| **Payee wallet** | Stellar mainnet account (G...) with an established USDC trustline and a minimum reserve balance of XLM |
| **Facilitator** | OpenZeppelin x402 facilitator account and API key — https://channels.openzeppelin.com/gen |
| **TLS** | Domain name with a valid TLS certificate (Let's Encrypt via nginx/Caddy is fine) |
| **Host** | VPS or container host. Minimum: 1 vCPU, 512 MB RAM, 5 GB disk. Recommended: 2 vCPU, 2 GB RAM, 20 GB disk |
| **Outbound network** | Unrestricted HTTPS to `horizon.stellar.org`, `soroban-rpc.stellar.org`, and the OpenZeppelin facilitator host |

Create the payee wallet on a trusted machine (never on the deployment host) and
fund it with the minimum XLM reserve required for a USDC trustline plus a small
buffer for any transactional costs. Do **not** deposit your treasury on this
wallet — it only needs enough XLM to function.

---

## 2. Environment Variables

StellarMCP is configured entirely via environment variables. Validation happens
at boot via Zod — invalid or missing values fail fast before the server opens
the listen socket.

| Variable | Required | Default | Production value | Notes |
|---|---|---|---|---|
| `STELLAR_NETWORK` | yes | `testnet` | `pubnet` | Selects mainnet or testnet behavior. |
| `HORIZON_URL` | no | auto | *(unset)* | Auto-derived from `STELLAR_NETWORK` — leave unset unless you run your own Horizon. |
| `TRANSPORT` | yes | `stdio` | `http` | Must be `http` for production. |
| `STELLAR_PAYEE_ADDRESS` | yes (http) | — | `G...` (your mainnet address) | Where x402 payments settle. Public — safe to store in env. |
| `OZ_FACILITATOR_URL` | yes (http) | — | `https://channels.openzeppelin.com/x402` | Use the mainnet facilitator URL in production. |
| `OZ_API_KEY` | yes (http) | — | *(secret)* | Treat as a secret. Store in a secret manager. |
| `PORT` | no | `4021` | `4021` | Internal port; the reverse proxy fronts it. |
| `HOST` | no | `0.0.0.0` | `0.0.0.0` | Leave at default so the proxy can reach it. |
| `LOG_LEVEL` | no | `info` | `info` | Use `warn` if you want less verbose logs. |
| `SOROBAN_RPC_URL` | no | auto | *(unset)* | Auto-derived from `STELLAR_NETWORK`. Override only if you run your own Soroban RPC. |
| `REFLECTOR_CONTRACT_ID` | no | — | *(optional)* | Set to enable Reflector oracle price reads. |
| `CORS_ORIGINS` | no | `*` | `https://your-frontend.example.com` | Comma-separated list of exact origins. **Do not leave as `*` on a monetized mainnet deployment.** |

### Secrets handling

`OZ_API_KEY` is the only true secret in this list. Do **not** commit a
`.env.production` file to git. Options in order of preference:

1. **Secret manager** (AWS Secrets Manager, GCP Secret Manager, HashiCorp Vault,
   Doppler, 1Password Connect) injected at container start time.
2. **Systemd `EnvironmentFile`** with `0600` permissions, owned by the service user.
3. **Docker `--env-file`** pointing at a file with `0600` permissions outside
   your git checkout.

Never echo `OZ_API_KEY` into shell history or logs.

---

## 3. Deployment Options

### Option A: Docker (recommended)

The included `Dockerfile` builds a multi-stage image on `node:22-alpine`, runs
as a non-root user, and includes a `HEALTHCHECK` wired to `/health`.

```bash
# Clone and build
git clone https://github.com/siriuslattice/stellarmcp.git
cd stellarmcp
docker build -t stellarmcp:0.2.0 .

# Create a production env file (chmod 600 !)
cat > .env.production <<'EOF'
STELLAR_NETWORK=pubnet
TRANSPORT=http
STELLAR_PAYEE_ADDRESS=G...your_mainnet_payee...
OZ_FACILITATOR_URL=https://channels.openzeppelin.com/x402
OZ_API_KEY=your_production_key
PORT=4021
HOST=0.0.0.0
LOG_LEVEL=info
CORS_ORIGINS=https://your-frontend.example.com
EOF
chmod 600 .env.production

# Run
docker run -d \
  --name stellarmcp \
  --restart unless-stopped \
  -p 4021:4021 \
  --env-file .env.production \
  stellarmcp:0.2.0

# Verify
curl http://localhost:4021/health
docker logs -f stellarmcp
```

To update:

```bash
git pull
docker build -t stellarmcp:0.2.1 .
docker stop stellarmcp && docker rm stellarmcp
docker run -d --name stellarmcp --restart unless-stopped \
  -p 4021:4021 --env-file .env.production stellarmcp:0.2.1
```

#### docker-compose alternative

```yaml
services:
  stellarmcp:
    image: stellarmcp:0.2.0
    build: .
    restart: unless-stopped
    ports:
      - "127.0.0.1:4021:4021"
    env_file: .env.production
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:4021/health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
```

Binding to `127.0.0.1` keeps the port off the public internet — the reverse
proxy on the same host handles external traffic.

### Option B: Bare Node

```bash
git clone https://github.com/siriuslattice/stellarmcp.git
cd stellarmcp
pnpm install --frozen-lockfile
pnpm build
TRANSPORT=http STELLAR_NETWORK=pubnet pnpm start
```

Fine for quick testing, but you need a process supervisor (Option C or D) to
survive reboots, panics, and log rotation in production.

### Option C: PM2

Install PM2 globally (`npm i -g pm2`), then create `ecosystem.config.cjs` in
the project root:

```javascript
module.exports = {
  apps: [{
    name: "stellarmcp",
    script: "dist/index.js",
    instances: 1,
    exec_mode: "fork",
    autorestart: true,
    max_restarts: 10,
    env: {
      NODE_ENV: "production",
      TRANSPORT: "http",
      STELLAR_NETWORK: "pubnet",
      PORT: "4021",
      HOST: "0.0.0.0",
    },
    error_file: "./logs/err.log",
    out_file: "./logs/out.log",
    time: true,
  }],
};
```

Start and persist:

```bash
pnpm build
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup   # follow the instructions printed to enable on-boot startup
```

Load the secret env vars separately (e.g. via `pm2 start ecosystem.config.cjs --env production` plus a second env file, or source them into the shell before `pm2 start`). Do **not** commit the OZ API key into `ecosystem.config.cjs`.

### Option D: systemd

Create `/etc/systemd/system/stellarmcp.service`:

```ini
[Unit]
Description=StellarMCP x402 server
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=stellarmcp
Group=stellarmcp
WorkingDirectory=/opt/stellarmcp
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
RestartSec=5
EnvironmentFile=/etc/stellarmcp/env
StandardOutput=append:/var/log/stellarmcp/out.log
StandardError=append:/var/log/stellarmcp/err.log

# Hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/log/stellarmcp
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true

[Install]
WantedBy=multi-user.target
```

Then:

```bash
sudo useradd --system --home /opt/stellarmcp --shell /usr/sbin/nologin stellarmcp
sudo mkdir -p /opt/stellarmcp /var/log/stellarmcp /etc/stellarmcp
sudo rsync -a ./ /opt/stellarmcp/      # or git clone + pnpm build as stellarmcp user
sudo install -m 600 -o stellarmcp -g stellarmcp .env.production /etc/stellarmcp/env
sudo chown -R stellarmcp:stellarmcp /opt/stellarmcp /var/log/stellarmcp

sudo systemctl daemon-reload
sudo systemctl enable --now stellarmcp
sudo systemctl status stellarmcp
journalctl -u stellarmcp -f
```

---

## 4. Network Selection

`STELLAR_NETWORK` drives automatic derivation of the upstream endpoints. In
production you almost always want:

```
STELLAR_NETWORK=pubnet
```

With that set and `HORIZON_URL` / `SOROBAN_RPC_URL` unset, the server uses:

- Horizon: `https://horizon.stellar.org`
- Soroban RPC: `https://soroban-rpc.stellar.org`

You only need to override these if you run your own infrastructure or use a
commercial RPC provider (e.g. Validation Cloud, Blockdaemon, Ankr) — in which
case set:

```
HORIZON_URL=https://horizon.your-provider.com
SOROBAN_RPC_URL=https://soroban.your-provider.com
```

Custom endpoints must return the same response shapes as the canonical Stellar
Horizon/Soroban RPC, because the client consumes JSON directly. Providers that
wrap responses in an envelope will not work without upstream changes.

For testnet staging environments, set `STELLAR_NETWORK=testnet` and point your
payee at a testnet account funded via Friendbot.

---

## 5. Reverse Proxy (TLS)

Never expose StellarMCP directly on port 443. Terminate TLS at a reverse proxy
on the same host and forward to `localhost:4021`.

### nginx

```nginx
server {
  listen 443 ssl http2;
  server_name api.your-domain.com;
  ssl_certificate /etc/letsencrypt/live/api.your-domain.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/api.your-domain.com/privkey.pem;

  location / {
    proxy_pass http://localhost:4021;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    # SSE support for /mcp GET
    proxy_buffering off;
    proxy_read_timeout 86400;
  }
}

server {
  listen 80;
  server_name api.your-domain.com;
  return 301 https://$host$request_uri;
}
```

Reload nginx after the change:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

### Caddy

```caddyfile
api.your-domain.com {
  reverse_proxy localhost:4021
}
```

Caddy provisions and renews a TLS certificate automatically — just make sure
the DNS A record points at your host before starting Caddy.

### Proxy notes

- The MCP Streamable HTTP transport uses Server-Sent Events on `GET /mcp`.
  `proxy_buffering off` and a long `proxy_read_timeout` are required so the
  proxy does not cut off long-running agent sessions.
- If you front multiple apps from the same proxy, use distinct server blocks
  and distinct upstream ports — do not collapse StellarMCP into a subpath.

---

## 6. Monitoring

### Health checks

- `GET /health` returns `{ status: "ok", ... }` with HTTP 200 when the process
  is alive. Configure UptimeRobot (or BetterStack, Pingdom, etc.) to hit this
  endpoint every 5 minutes and alert on failure.
- The Docker `HEALTHCHECK` directive makes `docker ps` and orchestrators
  surface unhealthy containers automatically.

### Logs

StellarMCP writes **structured JSON to stderr** — one line per event,
each with `ts`, `level`, `msg`, and contextual fields. This format is
parseable out of the box by:

- **Datadog** (Docker/journal log collection + JSON parsing)
- **Grafana Loki** (promtail / Docker driver)
- **AWS CloudWatch** (awslogs driver + metric filters on `level: error`)
- **Vector / Fluent Bit** (json parser + HTTP/TCP sink)

With systemd, `journalctl -u stellarmcp -o json` emits structured logs suitable
for downstream shipping.

### Alerts

At minimum, page on:

1. `/health` returning non-200 (uptime monitor).
2. Any log line with `level: "error"` in the last 5 minutes (log-based alert).
3. Container/process restarts > N per hour (process manager alert).
4. Payee wallet XLM balance falling below the reserve threshold (custom check
   against `horizon.stellar.org/accounts/<payee>`).

### On-chain visibility

Link your payee address in the runbook so operators can eyeball settlements:

```
https://stellar.expert/explorer/public/account/<YOUR_PAYEE>
```

Each successful paid call produces a USDC transfer to this address, visible
within a few seconds.

---

## 7. Backup & Restore

StellarMCP is stateless. There is no database, no upload directory, and no
local queue. The only things that need backing up:

| Item | Where | How |
|---|---|---|
| Production env file (`.env.production` or systemd `EnvironmentFile`) | Secret manager | Automated, versioned |
| Payee wallet secret (if you store it anywhere) | Hardware wallet or HSM | **Never** on the deployment host |
| Reverse proxy config + TLS certs | `/etc/nginx`, `/etc/letsencrypt` | Standard server backup |

Recommended posture:

1. Generate the payee wallet on an air-gapped or trusted machine. Write down
   the seed phrase on paper and store it offline. Only the **public** address
   goes into `STELLAR_PAYEE_ADDRESS` on the server.
2. Store `OZ_API_KEY` in a secret manager (AWS Secrets Manager, GCP Secret
   Manager, HashiCorp Vault, Doppler, 1Password Connect). Inject at container
   start via `--env-file` or the orchestrator's secret mount.
3. Stellar account state — balances, sequence number, ledger history — is
   backed up by the Stellar network itself. You never need to export or
   re-import blockchain data.
4. To rebuild a lost server: provision a fresh host, `git clone`, inject the
   secrets from your secret manager, start the service. No data migration.

---

## 8. Security Checklist

Work through this list before pointing mainnet traffic at the deployment:

- [ ] `CORS_ORIGINS` set to your actual frontend domain(s). Not `*`. Not empty.
- [ ] Rate limits appropriate for expected traffic (defaults: 60 req/min on
      free endpoints, 120 req/min on paid endpoints — tune in
      `src/transports/http.ts` if you need different numbers).
- [ ] Container runs as a non-root user (the provided `Dockerfile` does this —
      if you customize the image, preserve the `USER stellarmcp` line).
- [ ] Reverse proxy with valid TLS certificate. No plaintext HTTP in production.
- [ ] HTTP → HTTPS redirect configured at the proxy.
- [ ] Secrets in a secret manager. No plaintext `.env` on disk with `0644`
      permissions. If you must use a file, `chmod 600` and `chown` to the
      service user.
- [ ] Payee wallet holds only the minimum XLM required for the USDC trustline
      reserve plus a small operational buffer. **Not** your treasury.
- [ ] OZ facilitator API key rotation schedule documented (recommend quarterly).
- [ ] Monitoring: uptime check, log-based error alerts, process restart alerts.
- [ ] Payee balance alert configured (warn if XLM balance drops below reserve).
- [ ] Backup procedure for env files / secret manager tested at least once.
- [ ] Log retention policy set (recommend 30 days hot + 90 days cold).
- [ ] Incident response runbook drafted: who to page, how to rotate the OZ key,
      how to rotate the payee wallet, how to roll back a deploy.
- [ ] Host OS patched and `unattended-upgrades` (or equivalent) enabled.
- [ ] SSH key-only login, no password auth, fail2ban or similar.

---

## 9. Known Limits

- **In-memory cache.** The cache is bounded at 1000 entries and lives in the
  Node heap. There is no Redis backing, no shared cache between replicas, and
  no persistence across restarts. Cache warms quickly after a restart because
  most agents hit the same handful of accounts.
- **Single process.** The MCP Streamable HTTP transport tracks session state
  per process. Running multiple replicas behind a load balancer requires
  sticky sessions, or an external session store that we do not yet ship. For
  Phase 0/1, run one process per deployment.
- **Soroban RPC rate limits.** Mainnet Soroban RPC provided by SDF has
  relatively low rate limits and occasionally slow response times. For heavy
  Soroban/Reflector workloads, point `SOROBAN_RPC_URL` at a commercial
  provider with higher limits.
- **Reflector oracle discovery.** `REFLECTOR_CONTRACT_ID` must currently be
  supplied manually — the server does not auto-discover oracle contracts. See
  the Reflector documentation for the current production contract IDs.
- **No horizontal autoscaling out of the box.** You can run multiple
  independent instances behind different hostnames, but load balancing a
  single hostname across replicas is not currently supported for the `/mcp`
  endpoint.

---

## 10. Troubleshooting

### Startup fails with `ZodError: Invalid url for ozFacilitatorUrl`

Your env value is either missing or an empty string. Empty strings fail Zod's
`z.string().url()` check. Leave the variable **unset** instead of setting it
to `""`. In bash:

```bash
unset OZ_FACILITATOR_URL
```

Or remove the line entirely from your env file.

### `No oracle data available` on a price query

SDEX has no active orderbook for this asset pair on this network. Possible
causes:

- You are on testnet and the pair simply does not trade there.
- The asset code or issuer is wrong — double-check format `CODE:GISSUER`.
- The counter asset is missing — specify `counterAsset` explicitly rather than
  relying on the default.

Confirm by pulling `GET /order_book?...` directly from Horizon.

### `402 Payment Required` on every request

Expected behavior — x402 is correctly gating paid routes. Your client must:

1. Make the initial request.
2. Receive the 402 with payment requirements in the body.
3. Sign a Stellar payment meeting those requirements.
4. Retry with the `X-Payment` header containing the signed payload.

See `scripts/x402-client.ts` in the repo for a working reference client.

### `/health` returns 200 but tool calls hang

Usually means Horizon or Soroban RPC is slow or unreachable from the host.
Check:

```bash
curl -w '\nstatus=%{http_code}\ntime=%{time_total}\n' \
  https://horizon.stellar.org/
curl -w '\nstatus=%{http_code}\ntime=%{time_total}\n' \
  https://soroban-rpc.stellar.org/
```

If these are slow from the host, point at a different provider via
`HORIZON_URL` / `SOROBAN_RPC_URL`.

### Container restarts constantly

Check `docker logs stellarmcp` — most common causes:

1. Missing required env var (the process exits immediately on config failure).
2. Port 4021 already in use on the host.
3. OOM — bump the container memory limit if you set one.

### nginx returns 502 Bad Gateway

The upstream is down or on a different port. Verify:

```bash
curl http://localhost:4021/health
systemctl status stellarmcp   # or: docker ps
```

If the server is up, check the nginx `proxy_pass` target matches the actual
listening port.

### Payments arrive but the client still sees 402

The facilitator is out of sync with the settled payment. Check the OZ
facilitator status page and your API key quotas. In rare cases, the client is
signing for the wrong network — confirm `STELLAR_NETWORK` matches on both
sides (testnet vs pubnet).

---

For questions, bug reports, or grant/partnership inquiries, open an issue at
https://github.com/siriuslattice/stellarmcp or reach out via the contact
details in `README.md`.
