# Architecture

What happens between "user types a prompt" and "PNG appears in the chat".

---

## High-level pipeline

```
┌─────────────────┐
│   MCP Client    │  Claude Code, Claude Desktop, Cursor, Windsurf, …
└────────┬────────┘
         │ tool call: generate_screen({ prompt, name, project?, design_system? })
         ▼
┌─────────────────────────────────────────────────────┐
│  mockit-mcp                                          │
│                                                      │
│  ┌───────────────────────┐                          │
│  │  Backend dispatcher   │  picks cli OR api        │
│  │   src/claude.ts       │                          │
│  └──────────┬────────────┘                          │
│             │                                        │
│   ┌─────────┴─────────┐                             │
│   ▼                   ▼                             │
│  cli                  api                           │
│  spawn `claude -p`    Anthropic SDK                 │
│  src/claude-cli.ts    src/claude-api.ts             │
│   │                    │                            │
│   └─────────┬──────────┘                            │
│             ▼                                        │
│  ┌────────────────────────┐                         │
│  │  HTML + Tailwind       │                         │
│  │  (raw text from model) │                         │
│  └──────────┬─────────────┘                         │
│             │                                        │
│             ▼                                        │
│  ┌────────────────────────┐                         │
│  │   Renderer             │                         │
│  │   src/renderer.ts      │                         │
│  │                        │                         │
│  │   Playwright headless  │                         │
│  │   Chromium @ 390×844   │                         │
│  │   network allowlist    │                         │
│  │                        │                         │
│  │   → screenshot PNG     │                         │
│  └──────────┬─────────────┘                         │
│             │                                        │
│             ▼                                        │
│  ┌────────────────────────┐                         │
│  │   Storage              │                         │
│  │   src/storage.ts       │                         │
│  │                        │                         │
│  │   designs/{project}/   │                         │
│  │     name-id8.html      │                         │
│  │     name-id8.png       │                         │
│  │     name-id8.json      │                         │
│  └────────────────────────┘                         │
└─────────────────────────────────────────────────────┘
         │
         ▼ inline image + text summary
   [MCP Client renders PNG in-thread]
```

---

## Source layout

| File | Responsibility |
|------|----------------|
| `src/server.ts` | MCP server, tool registration, transport selection (stdio / http), HTTP auth middleware |
| `src/claude.ts` | Backend dispatcher — picks `cli` or `api` based on env |
| `src/claude-cli.ts` | Spawns `claude` CLI as a subprocess; pipes prompt via stdin; reads JSON envelope from stdout |
| `src/claude-api.ts` | Anthropic SDK wrapper; uses prompt caching for the system prompt |
| `src/system-prompt.ts` | The hand-tuned design system prompt — see [System Prompt](system-prompt.md) |
| `src/renderer.ts` | Playwright launch, page setup, network allowlist, screenshot |
| `src/storage.ts` | Disk persistence (HTML + PNG + JSON), slug helpers, list/get |
| `src/types.ts` | Shared `GenerateInput`, `GenerateResult`, `Backend` types |

Total: ~600 lines of TypeScript.

---

## Backend dispatch

The dispatcher reads `CLAUDE_BACKEND` once at startup:

```ts
const BACKEND = (process.env.CLAUDE_BACKEND ?? "cli") as Backend;
```

`api` lazily imports the SDK so the `cli` path doesn't pay the load cost of `@anthropic-ai/sdk` (and so a missing API key in `cli` mode never errors).

Both backends return the same `GenerateResult`:

```ts
interface GenerateResult {
  html: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  model: string;
  costUsd?: number;       // CLI only — parsed from `claude -p --output-format json`
  durationMs?: number;    // CLI only
}
```

---

## Renderer

Playwright Chromium is launched once per process and reused across requests. Each render gets a fresh `BrowserContext` for isolation.

Key choices:

- **iPhone-class user agent** so user-agent-sniffing scripts inside model HTML behave correctly.
- **`waitUntil: "networkidle"`** so Tailwind CDN's JIT compile finishes before the screenshot.
- **Extra 400 ms wait** after `document.fonts.ready` — empirical, gives Inter / Space Grotesk / Playfair time to swap in.
- **Network allowlist** — only `cdn.tailwindcss.com`, `fonts.googleapis.com`, `fonts.gstatic.com`, and `data:` URIs reach the network. Everything else is `route.abort()`'d. This bounds the renderer's exposure if the model produces hostile HTML.
- **Sandbox enforcement** is `auto` by default — disabled inside containers (`MOCKIT_IN_CONTAINER=1` or `GITHUB_ACTIONS=true`), enabled on bare-metal hosts.

---

## Storage

UUIDs are generated with `crypto.randomUUID()`. Filenames truncate to the first 8 hex characters for human-readability:

```
designs/<slug(project)>/<slug(name)>-<id8>.{html,png,json}
```

`slug()` is a strict `[a-z0-9-]` lowercaser with `..` and `/` stripped — path traversal is not possible from user input.

The JSON metadata file is the source of truth. HTML and PNG can be regenerated from it (the prompt is stored).

---

## Transports

### stdio

- The default.
- Works as a child process of an MCP client.
- One server instance per client; trivially isolated.

### HTTP (StreamableHTTPServerTransport)

- Express + `@modelcontextprotocol/sdk`'s `StreamableHTTPServerTransport`.
- `sessionIdGenerator: undefined` — stateless. Every request runs independently.
- `/mcp` is the JSON-RPC endpoint. `/health` returns `{"ok": true, "transport": "http"}` (always public).
- Refuses to start if `HTTP_HOST` is non-loopback and `MCP_HTTP_TOKEN` is unset.
- Bearer-token comparison uses `crypto.timingSafeEqual` with a length-prefix check.

See [Security](security.md) for the threat model.

---

## Error surfaces

- **Model returns no HTML** → `extractHtml` throws; the tool returns an error block.
- **Browser binary missing** → renderer throws with a hint pointing at `npx playwright install chromium`.
- **Subprocess timeout** → `runCli` rejects after `CLAUDE_CLI_TIMEOUT_MS`. Default 3 minutes; raise it on slow hosts.
- **CLI not logged in** → `claude` exits non-zero; `mockit-mcp` returns a sanitized stderr (paths redacted) with a hint to log in.
