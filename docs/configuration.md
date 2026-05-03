# Configuration

All configuration is via environment variables. Defaults are sensible — most users only need to set `CLAUDE_BACKEND` (and possibly `ANTHROPIC_API_KEY` if using the API backend).

See [`.env.example`](../.env.example) in the repo root for a copy-pasteable template.

---

## Backend selection

| Variable | Default | Notes |
|----------|---------|-------|
| `CLAUDE_BACKEND` | `cli` | `cli` spawns the local `claude` CLI; `api` uses the Anthropic SDK directly. |

### CLI backend

Spawns `claude -p` as a subprocess. Uses your existing Claude Code subscription — counts against subscription quota, no per-call charge.

| Variable | Default | Notes |
|----------|---------|-------|
| `CLAUDE_CLI_PATH` | `claude` | Path to the `claude` binary on `PATH` (or absolute path) |
| `CLAUDE_CLI_MODEL` | (CLI default) | Override which model the CLI uses, e.g. `claude-sonnet-4-6` |
| `CLAUDE_CLI_TIMEOUT_MS` | `180000` | Subprocess timeout in milliseconds |

### API backend

Uses the Anthropic SDK with your API key. Bills per call (~$0.50–0.95 per generation on Opus 4.7).

| Variable | Default | Notes |
|----------|---------|-------|
| `ANTHROPIC_API_KEY` | — | **Required** when `CLAUDE_BACKEND=api` |
| `ANTHROPIC_MODEL` | `claude-opus-4-7` | If your account doesn't have Opus access, set to `claude-sonnet-4-6` or `claude-haiku-4-5` |

---

## Storage

| Variable | Default | Notes |
|----------|---------|-------|
| `DESIGNS_DIR` | `./designs` | Where HTML, PNG, and JSON metadata are persisted |

Storage layout:

```
designs/
└── {project-slug}/
    ├── {name-slug}-{id8}.html   # id8 = first 8 chars of the screen UUID
    ├── {name-slug}-{id8}.png
    └── {name-slug}-{id8}.json   # full UUID, prompt, parent ID, tokens, model, cost
```

---

## Render viewport

The Playwright headless Chromium uses these dimensions. Default targets an iPhone-class viewport at 2x device scale, so the saved PNG is 780×1688.

| Variable | Default | Notes |
|----------|---------|-------|
| `VIEWPORT_WIDTH` | `390` | CSS pixels |
| `VIEWPORT_HEIGHT` | `844` | CSS pixels |
| `DEVICE_SCALE` | `2` | Final PNG width = `VIEWPORT_WIDTH × DEVICE_SCALE` |
| `PLAYWRIGHT_NO_SANDBOX` | `auto` | `auto` enables Chromium sandbox outside containers; set `true` to force-disable, `false` to force-enable |

For other form factors:

- iPad: `820 × 1180 @2`
- Apple Watch: `184 × 224 @2`
- Android phone: `412 × 915 @2.6`

---

## MCP transport

| Variable | Default | Notes |
|----------|---------|-------|
| `MCP_TRANSPORT` | `stdio` | `stdio` for direct Claude Code use; `http` for shared / network deployment |
| `HTTP_PORT` | `7821` | Port to bind when `MCP_TRANSPORT=http` |
| `HTTP_HOST` | `127.0.0.1` | Bind interface; non-loopback values **require** `MCP_HTTP_TOKEN` (the server refuses to start otherwise) |
| `MCP_HTTP_TOKEN` | — | Bearer token; required when binding to a non-loopback interface. Generate with `openssl rand -hex 32` |

See [Deployment](deployment.md) for the full HTTP transport rationale.

---

## Examples

### Local CLI, default everything

```bash
# nothing — defaults work
```

### Local API with cheaper model

```bash
CLAUDE_BACKEND=api
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-6
```

### iPad rendering

```bash
VIEWPORT_WIDTH=820
VIEWPORT_HEIGHT=1180
```

### Public HTTP deployment

```bash
MCP_TRANSPORT=http
HTTP_HOST=0.0.0.0
MCP_HTTP_TOKEN=$(openssl rand -hex 32)
CLAUDE_BACKEND=api
ANTHROPIC_API_KEY=sk-ant-...
```

The server now binds to `0.0.0.0:7821` and requires `Authorization: Bearer $MCP_HTTP_TOKEN` for any `/mcp` request. `/health` remains public.
