# System Prompt

The single most important file in the repo. This document explains what's in it, why it's there, and how to change it.

The prompt itself: [`src/system-prompt.ts`](../src/system-prompt.ts).

---

## What it does

Every generation sends two messages to Claude:

1. **System** — the long, hand-tuned design rulebook (this file describes its contents).
2. **User** — your `prompt` field, optionally with the `design_system` field and (for `iterate_screen`) the previous HTML + feedback.

The model returns a single self-contained HTML document. The system prompt's job is to make that document:

- iOS-aesthetic by default
- Free of model "tells" (lorem ipsum, stock-photo URLs, generic gradient headers)
- Renderable inside a 390×844 viewport without surprises
- Free of trademark exposure

---

## What it enforces

### Output contract

> Return ONLY raw HTML. No markdown fences, no commentary, no explanation. The first character of your response must be `<` and the last must be `>`.

This is reinforced by `extractHtml` in both backends, which strips `\`\`\`html` fences if the model misbehaves and slices between the first `<` and last `>` defensively.

### Render target

> 390 × 844 px at 2x device scale (an iPhone-class viewport). Design FOR this exact viewport.

Models that don't see the viewport tend to default to desktop layouts. The explicit instruction + the required scaffold below pins it.

### Required scaffold

The prompt includes a full HTML skeleton with:

- `<meta viewport="width=390, …">`
- Tailwind CDN script
- Google Fonts preconnect + the 4 default families
- `body { width: 390px; height: 844px; overflow: hidden; }`
- A status bar (9:41, signal, wifi, battery — three inline SVGs)
- A home indicator (white pill, bottom)

The model fills in the `<!-- ========== YOUR SCREEN HERE ========== -->` slot and inherits the chrome.

### Design principles

In order of importance:

1. **Premium, never generic** — avoid the AI-app-template look.
2. **Use the provided design system rigorously** — no creative liberty with palette.
3. **Real content, real numbers** — no `Lorem ipsum`, no `Card title`. **Avoid real-world trademarks**, prefer fictional but believable brand names.
4. **iOS HIG type scale** — 16-20pt body, 17pt nav titles, 11pt tab labels. Min 44pt touch targets.
5. **SVG icons, no emoji** — inline SVGs with `currentColor`, 1.5–2pt stroke.
6. **Photography placeholders** — gradient meshes, blurred radial gradients, solid muted blocks. Never `<img src="...">`.
7. **Type hierarchy** — 3-5 distinct sizes per screen, not 10.
8. **4px spacing baseline** — 4, 8, 12, 16, 20, 24, 32, 40, 48, 64.
9. **Tonal layering > shadows** — subtle background tone shifts, not heavy drop shadows.
10. **Native iOS feel** — large titles, segmented controls, bottom tabs, sheet handles, capsule pills.

### Hard avoids

The prompt explicitly forbids:

- External image URLs (`placeholder.com`, Unsplash, Picsum, etc.)
- `<img>` tags pointing anywhere other than `data:` URIs
- Material Design / Bootstrap aesthetics
- Generic SaaS dashboard look (unless explicitly requested)
- Lorem ipsum
- Emoji where SVG icons belong
- Drop shadows everywhere (max 1–2 per screen)
- Markdown code fences in the output

### Quality bar

> The screenshot of your output should be something a designer would post on Twitter / Dribbble for praise. Aim for that bar.

Soft, but it nudges the model to put in effort.

---

## Customizing the voice

If you want a different look entirely (Material You, web dashboards, brutalist, sepia-toned terminal aesthetic), you only edit one file:

```bash
$EDITOR src/system-prompt.ts
```

### Keep these intact when you edit

- The **output contract** (raw HTML, no fences) — `extractHtml` depends on it.
- The **required scaffold** (Tailwind CDN + Google Fonts) — the renderer's network allowlist only allows those hosts. Adding `unpkg.com` to the prompt without updating `src/renderer.ts`'s allowlist will break renders.
- The **viewport** — if you change `VIEWPORT_WIDTH`/`VIEWPORT_HEIGHT` env vars, also update the prompt to match. Otherwise the model designs for the wrong size.

### Things you can change freely

- Color palette guidance, type scale, spacing rhythm
- "iOS HIG" → "Material 3" / "WinUI 3" / "Web app"
- Brand voice (editorial / playful / brutalist / corporate)
- Real-content rules (e.g. allow stock-photo URLs if you have a CDN you trust)

### Things you should change carefully

- The **avoid list**. These rules eat real-world failure modes — the model will produce stock-photo URLs and emoji icons if you don't actively forbid them. Remove rules only when you know what you're letting back in.
- The **design principles** ordering. Models give more weight to earlier instructions; reordering matters.

---

## Empirical observations

A few things that surfaced during prompt iteration:

- **Models default to ROLEX / APPLE / similar** when generating a "luxury watch app". The "avoid trademarks" rule is non-negotiable for public deployments.
- **Tailwind CDN's JIT** needs ~400ms after `document.fonts.ready` to render newly-discovered classes. The renderer waits this long; cutting it shorter produces unstyled flashes.
- **Models confuse 390×844 @2x with 393×852 @3x** when given the literal model name "iPhone 15 Pro" — they design for the wrong scale. The prompt deliberately uses generic dimensions ("iPhone-class viewport") to avoid this.
- **`text-3xl` + `font-bold` + Inter** is the closest the model gets to "iOS large title" without explicit guidance. The prompt nudges the model toward Inter Display Black + tight tracking for true "iOS large title" feel.
- **Single-screen prompts** beat multi-section prompts. Asking for "an entire onboarding flow" produces 3-4 screens stacked vertically (often broken). Generate single screens, then iterate.

---

## Cost-quality knob

The system prompt is ~3K tokens. The output is ~6–12K tokens. **Output dominates the cost** on Opus.

If quality is good enough on Sonnet for a use case (often is for simpler screens), set `ANTHROPIC_MODEL=claude-sonnet-4-6` and save ~3× per call. Haiku is too small to follow this prompt's structure reliably — expect quality drops.
