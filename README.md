<div align="center">
  <img src="assets/banner.svg" alt="mockit-mcp" width="100%"/>

  <h1>mockit-mcp</h1>

  <p><strong>Turn text prompts into premium iOS mobile UI mockups.</strong></p>
  <p>An MCP server that pairs Claude (Opus 4.7 by default) with a Playwright renderer to generate <em>screenshot-grade</em> mobile app designs from natural language.</p>

  <p>
    <a href="#install"><img src="https://img.shields.io/badge/install-quick%20start-0A84FF?style=for-the-badge" alt="Install"/></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-34C759?style=for-the-badge" alt="MIT License"/></a>
    <img src="https://img.shields.io/badge/Node.js-%E2%89%A520-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js 20+"/>
    <img src="https://img.shields.io/badge/MCP-1.0-BF5AF2?style=for-the-badge" alt="MCP 1.0"/>
  </p>
</div>

---

## What it does

Ask Claude Code (or any MCP client):

> *Design the main screen for a luxury watch collection app. Premium dark mode, gold accents, hero card with a Submariner photo, 2-column grid of 4 watches, bottom tab bar.*

`mockit-mcp` returns a real PNG mockup (sized 390×844 @2x for iPhone 15 Pro) **and** the underlying HTML/Tailwind source — so you can iterate visually and port to SwiftUI when you're ready to build.

It's not a static template engine and it's not generic AI slop. The system prompt is hand-tuned for premium iOS aesthetics: real content, SVG icons (no emoji), tasteful gradients in place of stock photos, iOS HIG type scale, and tonal layering instead of heavy shadows.

<div align="center">
  <table>
    <tr>
      <td align="center"><img src="examples/screens/watchvault.png" width="280" alt="Watch collection app"/><br/><sub><b>Watch collection</b></sub></td>
      <td align="center"><img src="examples/screens/volumetrik.png" width="280" alt="Volume calculator app"/><br/><sub><b>Volume calculator</b></sub></td>
    </tr>
  </table>
  <p><sub>Generated from a single prompt each. See <a href="examples/">examples/</a>.</sub></p>
</div>

## Highlights

- **Two backends, same tools.** Use the local `claude` CLI (subscription, $0 extra) or the Anthropic API (key + per-call pricing). Switch with one env var.
- **Real PNG output.** Headless Chromium via Playwright. Configurable viewport — iPhone, iPad, Apple Watch, custom.
- **Iterative refinement.** `iterate_screen` takes a screen ID + feedback ("make the hero card smaller") and produces a new version, tracking parent/child.
- **Disk-backed library.** Every generation saves HTML + PNG + JSON metadata. Browse, filter, re-export.
- **MCP standard.** Works with Claude Code, Claude Desktop, Cursor, Windsurf, or any MCP client.
- **Stdio + HTTP transports.** Run locally for dev, or as a network service for shared / containerized use.

## Tools

| Tool | Description |
|------|-------------|
| `generate_screen` | Text brief → PNG + HTML. Optional `design_system` and `project` fields. |
| `iterate_screen`  | Take a previous `screen_id` + `feedback` string, produce a new version. |
| `list_screens`    | List screens, optionally filtered by project. |
| `get_screen`      | Fetch metadata (or full HTML) for a specific screen. |

## Install

### Prerequisites

- **Node.js 20+**
- **Either** the `claude` CLI logged in (`cli` backend, default) **or** an Anthropic API key (`api` backend)
- Playwright's Chromium download (~170 MB, one-time)

### Quick start (CLI backend, recommended for local dev)

```bash
git clone https://github.com/USER/mockit-mcp.git
cd mockit-mcp
npm install
npx playwright install chromium
npm run build
```

Add to Claude Code:

```bash
claude mcp add mockit -- node "$(pwd)/dist/server.js"
```

Done. No API key needed — it uses your existing `claude` CLI session.

### API backend (no `claude` CLI on host)

```bash
echo "CLAUDE_BACKEND=api" > .env
echo "ANTHROPIC_API_KEY=sk-ant-..." >> .env
npm run build
claude mcp add mockit -- node "$(pwd)/dist/server.js"
```

### Docker (HTTP transport, for shared deployment)

```bash
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env
echo "CLAUDE_BACKEND=api" >> .env
docker compose up -d --build
```

Then point any client at `http://<host>:7821/mcp`:

```bash
claude mcp add --transport http mockit http://<host>:7821/mcp
```

## Usage

In any MCP client, just ask:

> *Design a fitness tracker dashboard. Show today's ring progress, a weekly chart, and a list of recent workouts. Dark mode, neon green accent.*

The PNG appears inline. The HTML is saved to `designs/{project}/{name}-{id}.html`.

For follow-ups:

> *iterate_screen on that fitness dashboard — replace the chart with heart-rate over time, and add a "share workout" button below.*

See [`examples/`](examples/) for prompt patterns and full outputs.

## Configuration

All optional. See [`.env.example`](.env.example) for the full list.

| Env | Default | Notes |
|-----|---------|-------|
| `CLAUDE_BACKEND` | `cli` | `cli` uses the `claude` CLI; `api` uses Anthropic SDK directly |
| `ANTHROPIC_API_KEY` | — | Required only for `api` backend |
| `ANTHROPIC_MODEL` | `claude-opus-4-7` | API backend only |
| `CLAUDE_CLI_PATH` | `claude` | Path to the `claude` binary |
| `CLAUDE_CLI_TIMEOUT_MS` | `180000` | Subprocess timeout |
| `MCP_TRANSPORT` | `stdio` | `stdio` or `http` |
| `HTTP_PORT` | `7821` | HTTP transport port |
| `DESIGNS_DIR` | `./designs` | Where outputs are persisted |
| `VIEWPORT_WIDTH` | `390` | Render width (iPhone 15 Pro) |
| `VIEWPORT_HEIGHT` | `844` | Render height |
| `DEVICE_SCALE` | `2` | Retina factor |

## Cost

Per generation: ~3K input tokens (system prompt) + ~6-12K output tokens depending on screen complexity.

| Backend | First call | Cached follow-up |
|---------|-----------|------------------|
| `cli`   | counts against your Claude Code subscription quota | same, but cache hits cost ~80% less |
| `api`   | ~$0.30 (Opus 4.7) | ~$0.05 |

System-prompt caching is on by default (5-minute TTL).

## Architecture

```
┌─────────────────┐
│   MCP Client    │  (Claude Code, Cursor, Windsurf, …)
└────────┬────────┘
         │ tool call: generate_screen({ prompt, ... })
         ▼
┌─────────────────────────────────────────────────────┐
│  mockit-mcp                                          │
│                                                      │
│  ┌──────────────┐    ┌────────────────────────┐    │
│  │  Backend     │    │  Renderer              │    │
│  │              │    │                        │    │
│  │ ► cli   ─────┼──► │  Playwright (headless  │    │
│  │ ► api   ─────┘    │  Chromium @ iPhone     │    │
│  │  → HTML+Tailwind  │  viewport)             │    │
│  └──────────────┘    │  → PNG screenshot      │    │
│                      └────────────────────────┘    │
│                                                      │
│  ┌────────────────────────────────────────────┐    │
│  │ Storage (disk): HTML + PNG + JSON metadata │    │
│  └────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

## Storage layout

```
designs/
└── {project-slug}/
    ├── {name-slug}-{id}.html
    ├── {name-slug}-{id}.png
    └── {name-slug}-{id}.json   # prompt, parent ID, tokens, model, cost
```

## Tuning the design voice

The hand-tuned system prompt lives in [`src/system-prompt.ts`](src/system-prompt.ts). It's where the iOS HIG enforcement, the no-stock-photo rule, the SF Pro fallback chain, and the editorial typography preferences are encoded. Want Material You instead, or a desktop dashboard voice? Edit it.

## Development

```bash
npm run dev    # tsx watch mode, stdio transport
npm run http   # tsx watch mode, http transport on :7821
npm run build  # compile to dist/
```

## Roadmap

- [ ] Watch / iPad / Android viewport presets
- [ ] Multi-screen flow generation (onboarding sequences)
- [ ] HTML → SwiftUI / Jetpack Compose port tool
- [ ] Design system import (Tailwind config, design tokens)
- [ ] Image references (use `--image` for visual inspiration)
- [ ] Variant generation (3-5 alternatives per prompt)

## Contributing

Issues and PRs welcome — see [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)

## Acknowledgements

Built on top of:
- [Anthropic Claude](https://claude.com/) — the model that does the heavy lifting
- [Model Context Protocol](https://modelcontextprotocol.io/) — the integration standard
- [Playwright](https://playwright.dev/) — the renderer
- [Tailwind CSS](https://tailwindcss.com/) — via CDN, in every generated screen
