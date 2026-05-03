# Examples

Real outputs from `mockit-mcp`. All generated from a single prompt — no manual editing — using the default system prompt and the `cli` backend (Claude Opus 4.7).

## Watch collection app

<img src="screens/watchvault.png" width="320" alt="Watch collection app screen"/>

**Prompt** *(abridged)*:

> Luxury watch collection manager app. Editorial luxury magazine aesthetic, Hodinkee-inspired. Photography-first, dark mode with muted gold (#C9A961) accent, Playfair Display + Inter + Space Grotesk type stack.
>
> Layout: Top wordmark, summary card (12 watches / $284,500 / +8.2% YTD), filter chips, FEATURED section with a hero card showing a Submariner Date dial as SVG (concentric bezel rings, lume dot, hour markers, ROLEX SUBMARINER text), then a 2-column COLLECTION grid of 4 watches (GMT Master II, Royal Oak 15500ST, Speedmaster Professional, Nautilus 5711) with gradient placeholders evoking each watch. Floating "+ Add Watch" pill, bottom tab bar.

Notable: the Submariner dial is drawn as an inline SVG — concentric bezel, lume pip at 12, GMT-style hands, date window. No external assets.

## Volume / cubage calculator (Turkish)

<img src="screens/volumetrik.png" width="320" alt="Volume calculator app screen"/>

**Prompt** *(abridged)*:

> Türkçe hacim/kübaj hesaplama uygulaması. Industrial precision aesthetic, light mode (warm off-white #F8F7F4), construction safety orange #FF6B1A accent. Plus Jakarta Sans + Space Grotesk.
>
> Layout: Wordmark + history icon, ŞEKİL SEÇ section with an "AR ile Tara" pill (dashed gold border) and 5 horizontally-scrollable shape cards (Küp/Kutu selected with orange border + tint, Silindir, Koni, Havuz, Düzensiz with AI badge). ÖLÇÜLER section with cm/M/inch toggle and three input cards (Uzunluk 4.50, Genişlik 3.20, Yükseklik 2.80). HACİM result card on a soft orange gradient: "40.32 m³" in Space Grotesk 64pt, with "≈ 40,320 litre · 8 standart bidon" below. MALZEME TAHMİNİ rows (Beton C25 96.8 ton, Kum 64.5 ton, Su 40,320 L), big "PDF Teklif Oluştur" CTA, and a Pro hint.

Notable: full Turkish localization including idiomatic terms (ölçüler, hacim, malzeme, teklif, sahada-anlaşılır references like *standart bidon*).

## Prompt patterns that work

A few habits that produce consistently good results:

- **Lead with the app's purpose and audience.** "Luxury watch collection for serious collectors" beats "watch app".
- **Pick a vibe.** Editorial / Industrial / Playful / Brutalist / Minimal / Tactile. The system prompt already enforces premium iOS aesthetics, but a vibe nudges flavor.
- **Specify the type system explicitly** if you want non-default fonts. The system prompt includes Inter, Space Grotesk, Playfair Display, and Plus Jakarta Sans by default.
- **Describe the layout top-to-bottom**, listing each section's purpose and content. The model maps these to real Tailwind layouts.
- **Use real numbers and copy.** "$14,200" beats "{price}". "126610LN" beats "{ref}".
- **For non-English UIs, write the labels in the target language** — the model handles diacritics correctly when you do (e.g., *Ölçüler*, *Yükseklik*).
- **Skip stock-photo placeholders.** The system prompt already replaces images with tasteful gradient meshes; just describe the subject ("a deep navy bezel evoking a dive watch").

## Re-running these locally

```bash
# After install (see main README)
claude mcp add mockit -- node "$(pwd)/dist/server.js"
```

Then in Claude Code:

> *Use generate_screen to make a luxury watch collection app — premium dark, gold accents, hero Submariner card, 4-watch grid.*

Adjust prompts, then `iterate_screen` for refinements.
