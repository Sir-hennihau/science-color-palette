# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev                    # dev server on :3000
pnpm test                   # engine suite (~200 tests, ~13s)
pnpm test:watch
pnpm typecheck              # tsc --noEmit
pnpm build                  # static output in dist/client
pnpm build:pages            # the same, plus index.html/404.html/.nojekyll
pnpm preview --port 4300    # serve the built output
pnpm generate-routes        # tsr generate, after adding a route file
```

`.github/workflows/deploy.yml` publishes `dist/client` to GitHub Pages on
every push to `master`. It is a project page served from `/<repo>/`, so the
workflow sets `BASE_PATH`; Vite's `base` and the router's `basepath` both
follow from it, and `build:pages` adds the entry points a static host needs
(the SPA build itself only writes `_shell.html`).

No linter is configured. `tsc` is the only static gate, and it is strict
(`noUnusedLocals`, `noUnusedParameters`).

Single test file or single test:

```bash
pnpm vitest run src/engine/__tests__/solve.test.ts
pnpm vitest run src/engine/__tests__/palette.test.ts -t "spreads the spectrum"
pnpm vitest run -u          # re-record golden snapshots (see below)
```

Browser checks need a server already running, and take `APP_URL` so the same
checks run against dev or the built output:

```bash
node scripts/e2e.mjs                              # 34 checks incl. axe, defaults to :3002
APP_URL=http://localhost:3000 node scripts/e2e.mjs
node scripts/screenshot.mjs                       # light/dark/mobile to /tmp/scp-shots
```

## Architecture

`src/engine/` is pure TypeScript with no framework or DOM dependency. It
imports only `culori`, and only to parse CSS colour strings — all colour maths
is implemented directly, so `culori` can serve as an *independent oracle* in
tests rather than being both the implementation and its own check.

Two boundaries to preserve:

- App code imports the engine **only** through `src/engine/index.ts`.
- The engine imports nothing outside `src/engine` except `culori`.

### The organising idea

Everything follows from one decision: **shades are placed by relative
luminance**, the only quantity WCAG contrast depends on. Pinning a step's
luminance pins its contrast exactly, and every ramp climbs the *same* ladder —
so shade 600 carries the same contrast whether it is blue or yellow. That is
what makes the reported "N steps apart clears 4.5:1" guarantees true rather
than approximate.

`ladder.ts` builds that staircase. Three of its anchors are *contracts*: their
luminance is derived from a target contrast ratio (3:1, 4.5:1, 7:1 on white),
so an 11-step ramp gets shades 500/600/700 guaranteed.

### Generation pipeline

`palette.ts` orchestrates: `config.ts` resolves → `spectrum.ts` lays out and
names the hue families → each family becomes a `RampSpec` → `ramp.ts` walks the
ladder calling `solve.ts` per step → `report.ts` measures the result.

`solve.ts` is where the two halves meet. The ladder says what luminance a step
needs; `color/envelope.ts` says how much chroma the hue can offer at a given
lightness. Those constraints are coupled, so the step is found by bisection
rather than formula.

### Chroma is governed by two rules, not one

Through the middle and dark end, chroma is a **share of the envelope** — this
is what lets one set of curves give a yellow ramp that peaks light and a blue
one that peaks dark with no hue-specific cases.

Near white that breaks down: just past a hue's cusp the envelope collapses so
steeply that a share is no restraint at all. So the light steps are held by an
**absolute ceiling** (`curves/chroma.ts`), set to the *median* chroma the
reference palettes reach per step. **Do not "simplify" this to the maximum** —
that was the original bug, and it left teal and green two to three times too
colourful in their lightest shades while blue looked fine. `calibration.test.ts`
pins both the calibration and the places we deliberately diverge from the
reference.

### The spectrum

`spectrum.ts` treats seed hues as fixed anchors and shares the remaining
families among the arcs between them in proportion to arc width. Families are
named by the nearest *free* colour name, matched globally best-first. The name
table is defined by well-known hex values rather than angles so it cannot drift
from the conversion code.

Nothing is named after a job — there is no `danger` ramp, only a red.
`roleHints` notes which family sits nearest each conventional role, as advice.

### The two seed modes (`seeds.ts`)

- **harmonize** puts the seed on the shared ladder; all guarantees hold; the
  reported `SeedDelta` says how far the colour moved.
- **exact** ships the seed byte-for-byte and bends the ramp around it (warped
  ladder, rescaled chroma curve, hue anchored on the seed). It sets
  `usesSharedLadder: false` and **may break contract guarantees** — those are
  re-measured on the shipped hex and surfaced in `report.brokenGuarantees`
  plus a warning. Never make this silent.

### App layer

State lives entirely in typed URL search params (`lib/search-schema.ts`), which
makes palettes shareable and the back button undo. `lib/palette-session.tsx`
splits committed URL state from an in-flight gesture: `preview()` renders
through a transition, `commit()` writes one history entry. The pending patch is
mirrored into a **ref** because a transition may not have flushed when a drag
ends — reading it from React state loses quick flicks.

## Gotchas

**`vitest.config.ts` deliberately omits the `tanstackStart()` plugin.** Its
unconditional `optimizeDeps` handling breaks the test runner.

**Imports use explicit `.ts`/`.tsx` extensions** (`allowImportingTsExtensions`),
and `verbatimModuleSyntax` is on, so type-only imports need `import type`.

**Engine output must be plain JSON.** `JSON.parse(JSON.stringify(palette))`
must deep-equal the palette — a property test enforces it. Two traps already
caught: a key set to explicit `undefined` (use conditional spread instead), and
`-0` from rounding a small negative (`JSON.stringify` writes it as `0`).

**Every swatch carries two "text on this colour" answers.** `onHex` is the
APCA/perceptual choice; `onHexWcag` maximises the WCAG ratio and is always
≥ 4.58:1. They genuinely differ on mid-tones, and the UI uses `onHexWcag` for
its own small labels so the tool passes its own audit.

**APCA has its own luminance formula** (plain 2.4 power, different
coefficients) — never interchange it with the WCAG one in `contrast/wcag.ts`.

**`cMaxExact` returns the *first* gamut crossing, not the outermost.** In the
blue region the straight constant-hue ray in OKLab leaves sRGB and re-enters at
the cube vertex; the conservative answer is deliberate. Not an off-by-one.

**`GAMUT_EPS` is 1e-6, not tighter.** Pure yellow round-trips to blue = −1.3e-7
through the cube roots despite being exactly `#ffff00`.

## Tests

Grouped by what they are for:

- **Unit** (`space`, `envelope`, `ladder`, `solve`, `contrast`) — cross-checked
  against `culori` and the `apca-w3` reference package, both dev-only oracles.
- **`calibration.test.ts`** — asserts the chroma curves against hand-tuned
  reference ramps, and asserts where we intentionally differ.
- **`golden.test.ts`** — full-palette snapshots. A diff means the algorithm
  moved: review the new colours, bump `ALGORITHM_VERSION` in `version.ts` (and
  the inline snapshot in the test), then `pnpm vitest run -u`.
- **`property.test.ts`** — every invariant over ~250 generated configs.
  Palettes are cached across checks since generation is deterministic; the
  first check pays for the whole run, hence the long per-test timeout.
- **`performance.test.ts`** — budget assertions, not benchmarks. Vitest 5
  removed `bench` from its main export.

`scripts/e2e.mjs` waits on a `[data-ready="true"]` attribute set by a mount
effect before interacting. "Painted" and "interactive" are different moments,
and skipping this gate is what previously hid a real race in the commit path.
Ramps expose `data-ramp` as a stable selector.
