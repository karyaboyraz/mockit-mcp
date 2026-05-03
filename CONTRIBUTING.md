# Contributing to mockit-mcp

Thanks for your interest. Bug reports, design-prompt improvements, and PRs are all welcome.

## Quick orientation

The repo is small. Key files:

- `src/server.ts` — MCP server, tool registration, transport setup.
- `src/claude.ts` — backend dispatcher (cli vs api).
- `src/claude-cli.ts` — `claude` subprocess wrapper.
- `src/claude-api.ts` — Anthropic SDK wrapper.
- `src/system-prompt.ts` — **the design brain.** Most quality wins come from edits here.
- `src/renderer.ts` — Playwright headless renderer.
- `src/storage.ts` — disk persistence.

## Dev loop

```bash
npm install
npx playwright install chromium
npm run dev   # tsx watch mode, stdio transport
```

To test against Claude Code without rebuilding each time:

```bash
claude mcp add mockit-dev -- npx tsx "$(pwd)/src/server.ts"
```

## Filing a good issue

For **bugs**: include the prompt, the backend (`cli` or `api`), Node version, and the saved HTML if rendering produced something unexpected.

For **design quality** issues: include the prompt, the resulting PNG, and what you'd hoped to see. The system prompt is the lever — concrete examples help us tune it.

## Pull requests

- Keep PRs focused. One change per PR.
- Run `npx tsc --noEmit` before pushing — TypeScript must compile cleanly.
- Update [CHANGELOG.md](CHANGELOG.md) under `[Unreleased]`.
- For prompt changes, paste a before/after PNG in the PR body.
- No emoji in commit messages or code (the system prompt forbids them in generated UIs; we hold ourselves to the same bar).

## Areas where contributions especially welcome

- Viewport presets (Apple Watch, iPad, Android phones).
- Better gradient-mesh photography placeholders in the system prompt.
- HTML → SwiftUI / Jetpack Compose port tool.
- Multi-screen flow generation (`generate_flow` tool taking 3-5 screens at once).
- Prompt-engineering tweaks that demonstrably improve output quality on a representative test set.
- Documentation: more example prompts, more app categories.

## Code of conduct

Be kind, be technical, be specific. No drive-by criticism without a concrete suggestion.
