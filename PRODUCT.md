# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary: product designers** choosing a palette for a product or brand. They
arrive with one or two colours they already care about — a brand hex, or a
starting intention — and they want the resulting palette to look right and to be
accessible without having to do the colour maths themselves.

They are not assumed to arrive knowing colour science. They are assumed to be
willing to learn it here: **teaching the theory is part of the product**, so the
vocabulary of luminance, chroma envelopes and gamut stays in the interface and
is explained rather than removed. A designer should leave a session understanding
*why* shade 600 is readable in every hue, not just holding the hex codes.

Developers and design-system engineers use the exports, but the palette-making
decisions are designed for the designer.

## Product Purpose

Turn one or two colours into a complete, defensible palette: a spectrum of named
hue families walking the hue circle from the user's colour, each with a shade
ramp, plus tinted greys — placed so that a given shade number carries the same
contrast in every hue.

**Success is adoption.** The measure is other people using it for real palettes
and exporting from it, not the elegance of the method in isolation. Reach and
usefulness are the goal; the rigour exists to make the output trustworthy enough
to adopt.

## Positioning

Shades are placed by **relative luminance** — the only quantity WCAG contrast
depends on. Pinning a step's luminance pins its contrast exactly, and every ramp
climbs the same ladder, so "N steps apart clears 4.5:1" is *true* rather than
roughly true. Three ladder anchors are contracts derived from target ratios
(3:1, 4.5:1, 7:1), and the guarantees are re-measured on the shipped hex values.

A neighbouring HSL- or hand-tuned-palette tool cannot truthfully claim this. The
reference palettes are demonstrably inconsistent here: Tailwind's `yellow-500`
sits 20.3 L\* above its `blue-500` (75.9 against 55.6), so the yellow reaches
only 1.92:1 on white and fails 3:1 while the blue passes at 3.68:1, despite the
shared number implying they are interchangeable.

Two further positions follow from it:

- **Chroma is governed by the hue's own envelope**, so one set of curves gives a
  yellow ramp that peaks light and a blue ramp that peaks dark with no
  hue-specific special cases.
- **Where the promise cannot be kept, it is reported, never hidden.** `exact`
  seed mode ships a brand colour byte-for-byte and bends the ramp around it,
  which costs the contrast contracts; the broken guarantees are measured on the
  shipped colour and surfaced.

## Operating Context

- **The tool is still its own front door.** `/` is the working interface, not a
  landing page: someone arriving at the root gets the palette, and the tool has
  to be understandable there. What changed is that the *depth* now has somewhere
  to live. Two reading routes sit beside it — `/how-to`, a reference for every
  value the tool reports, and `/about`, the method and the sources it came from.
  Both are reachable from a three-word navigation in the header and from links
  in the tool's own footnote.

  The division is deliberate and worth keeping: anything a user needs **to make
  the palette** stays in the tool, and the reading pages only ever explain what
  the tool already shows. A number that exists only on `/how-to` is a bug in the
  tool. This is what lets the tool stay dense without becoming unexplained, and
  it serves the "teaching the theory is part of the product" commitment above
  without pushing the theory into the working surface.
- The whole configuration lives in **typed URL search params**, so a palette is
  shareable by copying the address, survives a refresh, and the browser's back
  button is undo. A colour-picker drag previews locally and commits once on
  release, so one gesture is one history entry.
- Output leaves as **CSS variables, Tailwind v4, JSON, W3C design tokens, or
  CSV**. JSON and CSV are also offered as a direct download — the "just give me
  the file" path into a build script or a spreadsheet.
- Deployed as a static build to GitHub Pages as a **project page served from a
  sub-path** (`/<repo>/`), which is why `BASE_PATH` drives both Vite's `base`
  and the router's `basepath`.

## Capabilities and Constraints

Confirmed capabilities: seed one or two (up to `MAX_SEEDS`) colours in either
**Adjust** (harmonize) or **Keep exact** mode; choose family count and shade
count; three colourfulness presets; hue drift across a ramp up to 60°; grey
tint strength; per-swatch inspection with two "text on this colour" answers
(`onHex` perceptual/APCA, `onHexWcag` provably ≥ 4.58:1); a contrast panel; a
"Limits of each hue" panel drawing the chroma envelopes with each ramp's path
through them; role *hints* naming the family nearest each conventional role;
light/dark/auto appearance.

Terminology: **families** (hues), **shades** (steps within a family), the
**ladder** (the shared luminance staircase), the **envelope** (the chroma a hue
can reach at a given lightness), **Adjust** and **Keep exact** for the two seed
modes.

Technical constraints the stack already fixes: pure-TypeScript engine with no
framework or DOM dependency, importing only `culori` and only to parse CSS
colour strings, so `culori` can serve as an independent test oracle; engine
output must be plain JSON; `tsc --noEmit` is the only static gate and it is
strict.

**Explicitly not binding** — these are current decisions, revisable, and were
offered as commitments and declined:

- The achromatic interface. The shell is currently grey on purpose (a tinted UI
  biases the colour judgement being made) but this is a design decision, not a
  product commitment.
- "Nothing is named after a job." No `danger`/`success` ramp exists today and
  roles are advice, but this stance is open to change.
- Client-only, static, no accounts. True of the current build; not ruled out for
  the future.

**Deliberately not built yet** (do not present as available): Display-P3 output
(the envelope maths is parameterised by gamut and `getEnvelope(hue, 'display-p3')`
works and is tested, but the pipeline emits sRGB only); automatic per-hue hue
drift (the control exists, defaults to none); colour-vision-deficiency
simulation; automatic per-hue chroma peak; warping family spacing for equal
*distinguishability* rather than equal hue spacing.

**Undecided:** licensing — there is no LICENSE file in the repository, and none
may be implied.

## Brand Commitments

- **The name is "Science Color Palette."** Binding. It is the repository name,
  the deploy URL and the header.
- **Every stated number must be computed or verified.** Contrast ratios, the
  Tailwind `yellow-500` comparison, the APCA figures, the test count — no claim
  may be invented, estimated or rounded into something more impressive. This is
  the product's core credibility and is binding.
- Voice, as observed in the shipped copy: plain, direct, willing to explain the
  mechanism, and honest about limits ("advice rather than assignment", "never
  hidden"). Prose currently uses British spelling ("colour", "colourfulness")
  while code and export identifiers use "color" — a current convention, not a
  confirmed commitment.

## Evidence on Hand

Real and verifiable:

- The engine's own output — every claim in the interface is measured on the
  shipped hex values at generation time.
- 214 engine tests (`pnpm test`): unit tests cross-checked against `culori`
  and the `apca-w3` reference package as dev-only oracles; `calibration.test.ts`
  pinning the chroma curves against hand-tuned reference ramps *and* the places
  we deliberately diverge; golden snapshots; property tests over ~250 generated
  configs.
- `scripts/e2e.mjs` — 43 browser checks including axe, run over all three
  routes in both themes. 43/43 passes against a static build.
- The comparison against reference palettes (Tailwind) is real and reproducible.

Absent — must not be fabricated: user research, usage or adoption numbers,
testimonials, case studies, press, named customers, pricing, a license, or any
claim of endorsement by a standards body. APCA in particular is **not** a
ratified standard — it was removed from the WCAG 3 drafts — and must always be
presented as supplementing the WCAG numbers, never replacing them.

## Product Principles

1. **A promise is measured on what ships, or it is not made.** Guarantees are
   re-checked on the final hex values, and anything that breaks is surfaced with
   a warning rather than quietly dropped.
2. **Explain the mechanism, don't just deliver the output.** The user leaving
   with an understanding of why the palette holds together is part of the
   deliverable, not a nice-to-have.
3. **A palette is a range, not a set of assignments.** Give the user the
   spectrum and tell them what sits nearest each conventional role; let them
   decide what it means.
4. **The primary user is a designer, so the maths is never their homework.**
   Depth is offered and explained; it is never a prerequisite for a good result.
5. **Adoption is the test.** A correct method nobody uses has failed. Choose the
   usable option over the clever one when they conflict.

## Accessibility & Inclusion

**Binding: the tool's own interface must meet WCAG 2.2 AA, in both light and
dark themes.** A tool that measures contrast failing its own audit is
disqualifying — which is why the UI uses `onHexWcag` for its own labels, why
`--app-ink-faint` is set to clear 4.5:1 (it labels 11px hue angles and axes,
which is body text as far as WCAG is concerned), and why pass/fail marks never
rely on colour alone: every badge carries an icon and a word.

Also in place: `prefers-reduced-motion` honoured, visible `:focus-visible`
outlines, `aria-live` announcements for copy/save actions, labelled control
groups.

The axe run in `scripts/e2e.mjs` checks the `wcag2a`/`wcag2aa`/`wcag21a`/
`wcag21aa`/`wcag22a`/`wcag22aa` tag sets in both themes, so the harness matches
the commitment above rather than trailing it. All 34 checks pass with 2.2 AA
included, `target-size` among them.

Colour-vision-deficiency simulation is not implemented, and the tool makes no
claim about CVD-safe output.
