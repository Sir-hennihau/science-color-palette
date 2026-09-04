# Science Color Palette

Enter one or two colours, get a full palette: a spectrum of named colour
families walking the hue circle from yours, each with a shade ramp, plus tinted
greys — all built so that a given shade number carries the same contrast in
every hue.

Nothing is named after a job. There is no ramp called "danger"; there is a red,
and what it means is up to you. A palette is more useful as a range than as a
set of assignments, and it is the shape the palettes people actually build
design systems on take.

```bash
pnpm install
pnpm dev        # http://localhost:3000
pnpm test       # engine suite, 187 tests
pnpm typecheck
pnpm build      # static output in dist/client
```

## Why this is not just HSL with extra steps

Computers describe colour as RGB, which is a description of what a screen
should emit. Eyes do not work that way, and three consequences shape everything
here.

**Equal numbers are not equal lightness.** Pure yellow and pure blue are both
"50% lightness" in HSL, yet yellow is blinding and blue is dark. So shades are
placed by *relative luminance* instead — the one quantity WCAG contrast depends
on. Pin a step's luminance and you have pinned its contrast against any
background exactly.

**Every ramp climbs the same staircase.** Because the luminance of step 6 is the
same whether it is blue or yellow, shade 600 is readable on white in every hue.
That is what makes advice like "six steps apart clears 4.5:1" true rather than
roughly true, and it is what the tool reports. For contrast, the reference
palettes are inconsistent here: Tailwind's yellow-500 sits 15 L\* above its
blue-500, so its yellow-500 fails 3:1 on white while blue-500 passes, despite
the shared number implying they are interchangeable.

**Some colours do not exist.** There is no dark vivid yellow; blue is most vivid
when dark. For each hue the tool computes the *chroma envelope* — every colour a
screen can show at that hue — and asks for a share of it rather than an absolute
amount. One set of curves then produces a yellow ramp that peaks light and a
blue ramp that peaks dark, with no hue-specific special cases. The "Limits of
each hue" tab draws these envelopes with each ramp's path through them.

Colours are solved in OKLCH, whose constant-hue lines hold together far better
than CIELAB's (where deep blues visibly swing toward purple as they darken).
Every output is checked against what a screen can actually display, because
browsers clip out-of-gamut colours rather than mapping them.

**Two rules shape chroma, not one.** Through the middle and dark end it is a
share of the envelope. Near white that breaks down: just past a hue's cusp the
envelope collapses so steeply that a share is no restraint at all, so the light
steps are held by an absolute ceiling instead — set to the *median* chroma the
reference palettes reach at each step, not the maximum. Using the maximum let
teal and green run two to three times too colourful in their lightest shades
while blue, whose envelope is modest up there anyway, came out right. The two
rules end up splitting the work: blue never touches the ceiling and is shaped
entirely by its envelope share, while teal and green are held by the ceiling
through the light half.

## The spectrum

Your colours are fixed anchors on the hue circle. The remaining families are
shared out among the arcs between them in proportion to how wide each arc is,
then spaced evenly inside it. So one colour gives an evenly spaced ring starting
at yours, and two colours 30 degrees apart put most of the spectrum in the wide
arc — where there is actually room for distinguishable colours — rather than
crowding the narrow one.

Families are named by the closest free colour name, matched best-first so a
family sitting squarely on "teal" keeps it. The names are defined by a
well-known hex rather than an angle, so "blue" means the hue of a colour
everyone agrees is blue and cannot drift out of step with the conversion code.

The walk starts at your first colour and continues round the wheel, which keeps
what you typed at the top of your palette and makes the rest read as a
progression. If you do need conventional roles, the tool notes which family
sits nearest each of them, and how far off it is — advice rather than
assignment.

## The two seed modes

This is the choice the tool is built around.

**Adjust** treats your colour as an intention. It keeps the hue and the sense of
colourfulness but moves the shade onto the shared luminance ladder, so every
contrast guarantee holds. Your primary ends up *close to* what you typed, and
the report says how close.

**Keep exact** treats your colour as a requirement — a brand colour. It ships
byte for byte, and the ramp bends around it: the ladder is warped so the seed's
step sits at the seed's own lightness, the chroma curve is rescaled to pass
through its colourfulness, and the hue curve is anchored on its hue. The result
looks deliberate rather than like one shade was pasted into someone else's ramp.
What it cannot do is keep the contrast promises, since those come from the
lightness it just gave up. Any that break are measured and reported, never
hidden.

## Contrast, measured two ways

WCAG 2.x decides pass and fail, because it is the standard with legal force.
APCA sits alongside it as the better predictor of what a reader can actually
make out. Where they disagree, seeing both is the point: on a mid blue like
`#6092ff`, WCAG scores black text at 7.05:1 against white at 2.98:1 and prefers
black, while APCA scores black at Lc 48 against white at Lc 61 and prefers
white — and white is plainly the readable one. Each swatch therefore carries
both a perceptual recommendation (`onHex`) and a provably-conformant one
(`onHexWcag`, always at least 4.58:1).

APCA is not a ratified standard: it was removed from the WCAG 3 drafts and the
algorithm there is still undetermined. It supplements the WCAG numbers rather
than replacing them.

## Layout

```
src/
  engine/          pure TypeScript, no framework or DOM
    color/         conversions, gamut, per-hue chroma envelope
    contrast/      WCAG 2.x and APCA
    curves/        monotone interpolation, chroma and hue curves
    ladder.ts      the shared luminance staircase
    solve.ts       luminance target + envelope -> a colour
    spectrum.ts    laying out and naming the colour families
    seeds.ts       the two seed modes
    export/        CSS, Tailwind v4, JSON, W3C design tokens
    __tests__/
  components/      the interface
  lib/             URL state, palette session, browser capabilities
  routes/          one route; the tool is the page
scripts/           screenshot and end-to-end drivers
```

The engine imports nothing but `culori`, and only for parsing CSS colour
strings. The colour maths is implemented directly: the solver runs thousands of
conversions per keystroke, the contrast guarantees need bit-exact
reproducibility, and keeping our own implementation frees culori to act as an
independent oracle in the tests rather than being both the implementation and
its own check.

## Everything you can change is in one band at the top

Colours first and with the most room, because they are the only thing you have
to supply; the rest — how many families, how many shades, colourfulness, hue
drift, grey tint — are adjustments to what those colours already produced.
Nothing that shapes the result is hidden off to one side or below the fold.

## State lives in the URL

The whole configuration is held in typed search params. A palette is shareable
by copying the address, survives a refresh, and the browser's back button is
undo. A colour-picker drag previews locally and commits once on release, so one
gesture is one history entry.

## Verifying

```bash
pnpm test                      # engine: unit, calibration, golden, property
pnpm typecheck
pnpm dev &
node scripts/e2e.mjs           # 34 checks: URL round-trips, drag, export, axe
node scripts/screenshot.mjs    # captures light, dark, mobile to /tmp/scp-shots
```

`scripts/e2e.mjs` accepts `APP_URL`, so the same checks run against the static
build: `pnpm build && pnpm preview --port 4200`, then
`APP_URL=http://localhost:4200 node scripts/e2e.mjs`.

The engine tests are worth knowing about in three groups. **Calibration** tests
assert the chroma curves against hand-tuned reference ramps, and also assert
where we deliberately part company with them. **Golden** snapshots catch output
changing when nobody meant it to — a diff there means reviewing the new colours
and bumping `ALGORITHM_VERSION`. **Property** tests run every invariant over
hundreds of generated configurations; they are what caught the APCA/WCAG
disagreement above.

## Deliberately left out

Wide-gamut Display-P3 output. The envelope maths is already parameterised by
gamut and the P3 matrices are in place — `getEnvelope(hue, 'display-p3')` works
and is tested — but the pipeline still emits sRGB only.

Automatic hue drift. Hand-tuned palettes rotate hue across a ramp, and by more
than intuition suggests: Tailwind's yellow turns about 44 degrees from its
lightest shade to its darkest, which is what makes its dark shades read as brown
rather than olive. The control is there and goes to 60 degrees, but choosing a
value per hue automatically needs a model this does not have yet, so it defaults
to none.

Colour-vision-deficiency simulation, and a per-hue automatic chroma peak.

Warping the spacing so families are equally *distinguishable* rather than
equally spaced in hue. Even OKLCH spacing is already perceptual, but hue
discrimination is not quite uniform around the circle, and the reference
palettes are visibly denser in the blue-green region than in the oranges.
