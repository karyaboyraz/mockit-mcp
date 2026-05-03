# Tools Reference

Four MCP tools. All schemas use `additionalProperties: false`, so unknown fields are rejected.

---

## `generate_screen`

Generate a new mockup from a text brief.

### Input

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `prompt` | string | ✓ | — | Detailed brief: what app, what screen, what content, what UI elements |
| `name` | string | ✓ | — | Short name for the screen, e.g. `"Main"`, `"Settings"`, `"Onboarding"` |
| `project` | string | | `"default"` | Project name — groups related screens on disk |
| `design_system` | string | | — | Optional design-system spec: colors, fonts, voice. If omitted, the model invents one consistent with the prompt |

### Output

- An inline PNG image (the rendered mockup, 780×1688 by default).
- A text block summarizing the saved screen: ID, paths, model, cost, tokens.

### Example

> Use generate_screen to design a fitness tracker dashboard. Three concentric activity rings, a weekly bar chart, and a recent workouts list. Premium dark mode with neon accents.

The PNG appears inline. The HTML, PNG, and JSON metadata are saved to `designs/{project}/{name}-{id8}.{html,png,json}`.

### Tips

- **Lead with the app's purpose.** "Fitness tracker for runners who care about heart-rate zones" beats "fitness app".
- **Pick a vibe.** Editorial / Industrial / Playful / Brutalist / Minimal / Tactile.
- **Describe the layout top-to-bottom.** Concrete sections produce concrete output.
- **Use real numbers and copy.** "$14,200" beats "{price}". "6.2 km · 32 min · 412 kcal" beats placeholders.
- **Avoid real-world brand names.** The system prompt steers the model toward fictional brands; explicitly naming a real one is asking for trademark exposure.

See [System Prompt](system-prompt.md) for the design rules baked into every generation.

---

## `iterate_screen`

Refine an existing screen with feedback. Tracks parent/child relationships.

### Input

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `screen_id` | string | ✓ | — | Screen UUID returned by `generate_screen` or `iterate_screen` |
| `feedback` | string | ✓ | — | What to change: `"make the hero card larger"`, `"use orange accent"`, `"add a sticky header"`, etc. |
| `name` | string | | `"<original> (v2)"` | Optional new name for the iteration |

### Output

Same as `generate_screen` — PNG + text summary. The summary includes `Iterated from: <parent-id>`.

### Example

> iterate_screen on the fitness dashboard — replace the chart with heart-rate over time, and add a "share workout" button below.

The new screen is saved with a fresh UUID; the JSON metadata records `"parentId": "<original-id>"`.

### Notes

- The feedback is passed alongside the **previous HTML** so the model edits the previous version rather than starting from scratch.
- The original `prompt` and `design_system` are preserved across iterations.
- You can iterate on iterations — chain as deep as you like.

---

## `list_screens`

List saved screens, optionally filtered by project.

### Input

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `project` | string | | — | Filter by project name; omit to list all |

### Output

A text block, one screen per line, sorted newest-first:

```
- [<uuid>] <project> / <name>  (<ISO timestamp>)  ← <parent-uuid-prefix>
```

The `←` arrow only appears for iterations.

---

## `get_screen`

Fetch metadata (and optionally the full HTML) for a specific screen.

### Input

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `screen_id` | string | ✓ | — | Screen UUID |
| `include_html` | boolean | | `false` | Include the full HTML source in the response |

### Output

A JSON block with all metadata: project, name, prompt, design system, parent ID, token usage, model, cost, paths.

If `include_html: true`, a second block contains the full HTML (large — typically 10–18 KB).

### Example use cases

- **Re-port to SwiftUI:** fetch the HTML, ask Claude to translate the structure into SwiftUI views.
- **Audit cost:** look at the `tokens` field across screens.
- **Inspect history:** trace iteration parents back to the original.
