# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- HTTP transport: optional bearer-token auth via `MCP_HTTP_TOKEN`. Server refuses to start when binding to a non-loopback interface without a token.
- HTTP transport: `HTTP_HOST` env var (defaults to `127.0.0.1`).
- Renderer: `PLAYWRIGHT_NO_SANDBOX` env var (`auto` / `true` / `false`). In `auto` mode the sandbox is only disabled inside containers / CI.
- Renderer: friendly error message pointing to `npx playwright install chromium` when the browser binary is missing.
- Trademark disclaimer in README.

### Changed
- Upgraded `@anthropic-ai/sdk` to `^0.92.0` and `@modelcontextprotocol/sdk` to `^1.29.0`. Removed the type cast and beta header that were needed by the older SDK for prompt caching.
- Upgraded Playwright to `^1.59.1`.
- Dockerfile now uses `npm ci` (with `package-lock.json`) for reproducible builds, and the healthcheck uses `node` + `fetch` instead of `wget`.
- `docker-compose.yml` binds the HTTP port to `127.0.0.1` only by default.
- Showcase example replaced (fitness dashboard instead of the watch-collection example) to avoid third-party trademarks.
- System prompt: discourages real-world brand names in favor of fictional but believable alternatives.

### Fixed
- README pricing estimate updated to reflect realistic Opus 4.7 token usage.
- README no longer implies viewport "presets" exist for non-iPhone form factors.

### Security
- HTTP bearer-token comparison now uses `crypto.timingSafeEqual` with a length-prefix check, eliminating a timing side-channel that could otherwise leak token characters under sustained probing.
- Renderer now uses a network allowlist (Tailwind CDN + Google Fonts only). Anything else the model HTML attempts to load — tracking pixels, third-party scripts, exfil endpoints — is aborted before reaching the network.
- Dockerfile drops privileges to the non-root `pwuser` after build.
- Stderr from the `claude` CLI subprocess is path-redacted before being surfaced in MCP tool errors, so user home directories never leak into transcripts.
- HTTP request body limit lowered from 10 MB to 2 MB.

### Fixed (more)
- Cost section in README rewritten to reflect that prompt caching only discounts the system-prompt input — output tokens still bill at full Opus rate, so cache hits save cents not dollars.
- Replaced "iPhone 15 Pro" viewport phrasing with the literal "390×844 @2x (iPhone-class)". The Pro models are 393×852 @3x, so the old wording was incorrect.
- Showcase screenshots regenerated to fit cleanly inside the 390×844 viewport (the previous fitness/volumetrik PNGs cut off the bottom tab bar and the result card respectively).
- `PLAYWRIGHT_NO_SANDBOX` env var now documented in the README configuration table.
- Tool input schemas now emit `additionalProperties: false` and surface Zod `.default()` values as JSON Schema `default` fields.
- `storage.ts` no longer slugs already-slugged project directory names when looking up screens.
- README storage layout snippet now matches the actual filename format (`{name}-{id8}.html`).

## [0.1.0] - 2026-05-03

### Added
- Initial release.
- `generate_screen` MCP tool: text prompt → PNG mockup + HTML source.
- `iterate_screen` MCP tool: refine an existing screen with feedback, parent/child tracking.
- `list_screens` and `get_screen` MCP tools for browsing the design library.
- Two model backends:
  - `cli` (default): spawns the local `claude` CLI, uses subscription auth.
  - `api`: uses the Anthropic SDK directly with an API key.
- Stdio and HTTP transports.
- Hand-tuned system prompt for premium iOS aesthetics (HIG type scale, SF Pro fallbacks, no-stock-photo rule, tonal layering).
- Disk-backed storage: HTML + PNG + JSON metadata per screen.
- Docker / docker-compose deployment for HTTP transport.
- iPhone 15 Pro default viewport (390×844 @2x), configurable via env.
