# Troubleshooting

Errors you might hit, in rough order of frequency.

---

## "Not logged in · Please run `/login`"

**Cause:** The `claude` CLI on your host isn't authenticated.

**Fix:**

```bash
claude
# log in interactively, then exit
```

After a successful login, retry. `mockit-mcp` reuses the same OAuth session.

> Note: this only matters for the `cli` backend (the default). `api` backend uses `ANTHROPIC_API_KEY`.

---

## "Failed to launch Chromium: Executable doesn't exist"

**Cause:** Playwright's Chromium binary isn't installed.

**Fix:**

```bash
npx playwright install chromium
```

About 170 MB, one-time.

If you're inside a Docker container that already ships Chromium (the official `mcr.microsoft.com/playwright` image), this shouldn't happen. If it does, the `node_modules` were rebuilt against a different Playwright version than the binary ships with — re-run `npm ci` then the install command.

---

## "Refusing to start: `HTTP_HOST=...` ... `MCP_HTTP_TOKEN` is not set"

**Cause:** You bound the HTTP transport to a non-loopback interface (e.g. `0.0.0.0`) without setting a bearer token. This is intentional — see [Security](security.md).

**Fix:** Either bind to loopback only:

```bash
HTTP_HOST=127.0.0.1
```

Or set a token:

```bash
MCP_HTTP_TOKEN=$(openssl rand -hex 32)
```

---

## HTTP 401 unauthorized

**Cause:** Either no `Authorization` header, or the bearer token doesn't match.

**Fix:** Add the header to your client:

```
Authorization: Bearer <your-token>
```

Tokens are compared timing-safely; the only way they "don't match" is if they're literally different.

---

## Subprocess timeout after 180000 ms

**Cause:** The `claude` CLI took longer than 3 minutes. Common on slow networks or when the model is heavily loaded (peak hours on shared infrastructure).

**Fix:** Bump the timeout:

```bash
CLAUDE_CLI_TIMEOUT_MS=300000   # 5 minutes
```

Or switch to a faster model:

```bash
CLAUDE_CLI_MODEL=claude-sonnet-4-6
```

---

## "API output did not contain valid HTML"

**Cause:** The model returned text that doesn't have any `<...>` brackets — usually because it apologized or asked for clarification instead of generating HTML.

**Fix:** Make the prompt more concrete. The system prompt forbids preamble, but rare prompts (very short, ambiguous, or vague) still slip through. Add a layout description, real numbers, and a vibe.

Example of a prompt that often fails:
> A nice app

Example that always works:
> A fitness tracker dashboard. Three concentric activity rings (Move/Exercise/Stand), a weekly bar chart, and a recent workouts list. Premium dark mode, neon green/cyan/magenta accents.

---

## PNG looks like a desktop layout (content overflows or huge whitespace)

**Cause:** The model designed for the wrong viewport. Sometimes happens with `iterate_screen` if the original prompt didn't include the viewport hint.

**Fix:** Specify the viewport explicitly in your prompt:

> ... designed for a 390×844 mobile viewport. Single screen, no scroll.

Or update the system prompt — it already does this, so this should be rare.

---

## Renderer screenshots produce a blank or partial PNG

**Cause:** Tailwind CDN's JIT compiler hasn't finished by the time the screenshot is taken. Slow networks during the CDN fetch is the main cause.

**Fix:** Edit `src/renderer.ts` and increase the `await page.waitForTimeout(400)` to 800 or 1200.

If you frequently render in offline / restricted-network environments, consider a **future feature**: bundle Tailwind locally instead of using the CDN. Open an issue if you want this.

---

## "Cost" line in the output shows a number even though I'm using the CLI backend

**Cause:** The `claude` CLI returns a `total_cost_usd` field in its JSON output. This is the cost of the call **as if** it were billed against the Anthropic API directly. It's informational — your subscription absorbs it, you're not actually charged that amount.

If the number bothers you, edit `src/server.ts`'s `summarize()` to skip cost rendering for the `cli` backend.

---

## `npm ci` fails with EBADENGINE

**Cause:** Your Node version is below 20 (the package's minimum).

**Fix:**

```bash
node --version
# v20.x.x or higher required
```

Use `nvm` or your package manager to upgrade.

---

## Glama build fails with "container exited before health check"

**Cause:** Almost always a missing `mcp-proxy` invocation when the build spec's `cmdArguments` doesn't start with `mcp-proxy --`. Glama's deployer prepends `mcp-proxy --` automatically only when the build spec includes it.

**Fix:** Build spec's `cmdArguments` should be exactly:

```json
["mcp-proxy", "--", "node", "dist/server.js"]
```

If it's `["node", "dist/server.js"]` alone, the container starts but Glama's introspection check (which connects via HTTP) can't talk to it because `mockit-mcp` is in stdio mode.

---

## Still stuck?

Open an issue at https://github.com/karyaboyraz/mockit-mcp/issues with:

- The exact error message (full, no truncation)
- `node --version`, `npx playwright --version`, your OS
- The MCP client you're using (Claude Code? Cursor? Custom?)
- The prompt and (if a generation issue) the saved HTML

Or drop a question in [Discussions](https://github.com/karyaboyraz/mockit-mcp/discussions/new).
