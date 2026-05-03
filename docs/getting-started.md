# Getting Started

This walks you through installing `mockit-mcp` locally with the **CLI backend** (the default — uses your existing Claude Code subscription, no extra API key).

If you can't have the `claude` CLI on your host (e.g. a container with no terminal session), use the [API backend](configuration.md#api-backend) instead.

---

## Prerequisites

- **Node.js 20 or later** — `node --version` should print `v20.x` or higher
- **claude CLI installed and logged in** — open a terminal and run `claude`. If it asks you to log in, log in. After that, `mockit-mcp` will reuse the same session via subprocess.
- **About 200 MB of disk** for the Playwright Chromium binary (one-time download)

---

## Install

```bash
git clone https://github.com/karyaboyraz/mockit-mcp.git
cd mockit-mcp
npm install
npx playwright install chromium
npm run build
```

The build compiles TypeScript to `dist/`. You should see no output other than the `tsc` step.

## Register with Claude Code

```bash
claude mcp add mockit -- node "$(pwd)/dist/server.js"
```

That's it. Restart your Claude Code session (close and reopen the terminal) so it discovers the new MCP server.

## Verify

Open a fresh Claude Code session and ask:

> Use `generate_screen` to design a minimal weather card for "San Francisco" — current 64°F, partly cloudy. Premium dark mode.

You should see:

1. A loading indicator while the prompt runs (60–90 seconds on Opus 4.7 the first time, faster on subsequent calls because of prompt caching).
2. A PNG image inline in the chat (390×844 mockup at 2x device scale).
3. A path to the saved HTML, e.g. `designs/default/weather-card-a1b2c3d4.html`.

If the PNG looks like an iOS weather app, you're done.

## What happens behind the scenes

1. Claude Code calls the `generate_screen` tool with your prompt.
2. `mockit-mcp` spawns `claude` as a subprocess in headless mode (`-p`) with the [tuned system prompt](system-prompt.md) attached.
3. Claude returns raw HTML + Tailwind classes.
4. Playwright headless Chromium loads the HTML at 390×844, waits for fonts and Tailwind JIT, takes a screenshot.
5. The PNG and HTML are saved to `designs/{project}/`, plus a JSON metadata file.
6. The PNG is returned to Claude Code, which displays it inline.

For the deeper view, see [Architecture](architecture.md).

## Next steps

- Generate more screens — different apps, different vibes. The system prompt enforces premium iOS aesthetics by default.
- Iterate on a screen with feedback: `iterate_screen` takes the screen ID + a feedback string (`"make the hero card smaller"`) and produces a new version.
- See [Tools Reference](tools.md) for all four tools.
- See [Configuration](configuration.md) for environment variables (cheaper model, custom viewport, HTTP transport, etc.).
