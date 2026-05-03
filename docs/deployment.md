# Deployment

Three patterns, in order of complexity:

1. **Local stdio** — Claude Code runs `mockit-mcp` as a child process. The default. No network exposure.
2. **Local HTTP** — same machine, but other clients on `localhost` can reach it. Useful for development with multiple MCP-aware tools.
3. **Networked HTTP** — Docker container, optionally remote. **Requires a bearer token.**

---

## 1. Local stdio

After [getting started](getting-started.md), you're already running this. The single command:

```bash
claude mcp add mockit -- node "$(pwd)/dist/server.js"
```

Claude Code spawns `node dist/server.js` on demand, communicates over stdin/stdout. Nothing else exposed.

---

## 2. Local HTTP

For when multiple MCP clients on the same machine want to share one `mockit-mcp` instance, or when you want to test the HTTP transport before deploying remotely.

```bash
MCP_TRANSPORT=http npm start
```

By default this binds to **127.0.0.1:7821** (loopback only). No token required because nothing outside the loopback interface can reach it.

### Add to Claude Code

```bash
claude mcp add --transport http mockit http://127.0.0.1:7821/mcp
```

### Verify

```bash
curl http://127.0.0.1:7821/health
# {"ok":true,"transport":"http"}
```

---

## 3. Networked HTTP (Docker)

When you want one `mockit-mcp` instance shared across machines.

### Required: bearer token

The server **refuses to start** if `HTTP_HOST` is non-loopback and `MCP_HTTP_TOKEN` is unset. This is the single most important guardrail — if the port leaks, the server still rejects all requests.

Generate one:

```bash
openssl rand -hex 32
# → 7c1f...e9a3   (use this as the token)
```

### `.env`

```bash
CLAUDE_BACKEND=api
ANTHROPIC_API_KEY=sk-ant-...
MCP_HTTP_TOKEN=7c1f...e9a3
```

CLI backend doesn't work cleanly inside containers (no logged-in `claude` session), so use `api`.

### Deploy

```bash
docker compose up -d --build
```

`docker-compose.yml` binds `127.0.0.1:7821:7821` by default — only the host can reach the container. To open to the LAN or the internet, change the port mapping to `0.0.0.0:7821:7821`. **The token requirement applies regardless of binding.**

### Add to a remote Claude Code

```bash
claude mcp add --transport http mockit http://<host>:7821/mcp \
  -H "Authorization: Bearer 7c1f...e9a3"
```

### Verify

```bash
# /health is always public — no auth needed
curl http://<host>:7821/health
# {"ok":true,"transport":"http"}

# /mcp requires the token
curl -X POST http://<host>:7821/mcp \
  -H "Authorization: Bearer 7c1f...e9a3" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
```

Without the right token: `401 unauthorized`. With it: a JSON-RPC response listing the four tools.

---

## Reverse proxy (recommended for public exposure)

If `mockit-mcp` is accessible from the public internet:

- **Terminate TLS at a reverse proxy** (Caddy, nginx, Cloudflare). The mockit container speaks plain HTTP internally.
- **Add rate limiting at the proxy** — `mockit-mcp` doesn't bundle rate limiting. A reasonable default is 10 requests/minute per IP for the `/mcp` endpoint (each generation costs $0.50–0.95 on Opus).
- **Don't expose `/health` publicly** if you don't want infra discovery. The proxy can route only `/mcp` and reserve `/health` for internal monitoring.

### Caddy example

```
mockit.example.com {
  reverse_proxy /mcp 127.0.0.1:7821
  rate_limit /mcp {
    zone mockit-public {
      key {remote_host}
      events 10
      window 1m
    }
  }
}
```

---

## Resource sizing

| Backend | RAM | Notes |
|---------|-----|-------|
| `cli`   | ~150 MB idle, ~400 MB during render | Each render spawns a Chromium browser context |
| `api`   | ~150 MB idle, ~400 MB during render | Same renderer footprint; the SDK itself is tiny |

Disk: ~200 MB for Chromium + ~100 MB node_modules + your `designs/` directory (each PNG ~150 KB).

CPU: render is the bottleneck — about 4 CPU-seconds on first generation (cold browser launch), 1.5 CPU-seconds on hot launches.

---

## Multi-tenant notes

`mockit-mcp` is **not** designed for multi-tenant SaaS. It assumes a single trust boundary — anyone with the bearer token can:

- Generate any prompt (your API spend)
- Read any saved screen via `get_screen`
- List all projects via `list_screens`

If you need per-user isolation, run separate instances behind the proxy and route by token.
