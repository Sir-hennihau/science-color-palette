---
name: Science Color Palette
description: An achromatic instrument for judging colour — the room is grey so the sample is the only thing you see.
colors:
  booth-white: "#ffffff"
  booth-panel: "#f6f6f7"
  recessed-grey: "#ececee"
  hairline: "#e3e3e5"
  scored-line: "#c9c9cd"
  graphite-ink: "#18181b"
  pencil-grey: "#6b6b73"
  faint-pencil: "#74747c"
  inverted-ground: "#18181b"
  inverted-ink: "#fafafa"
  verified-green: "#1d6f42"
  flagged-red: "#a12b2b"
  cautioned-amber: "#8a5a12"
typography:
  display:
    fontFamily: "IBM Plex Mono, ui-monospace, SFMono-Regular, monospace"
    fontSize: "17px"
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "IBM Plex Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 500
    lineHeight: 1.5
  title:
    fontFamily: "IBM Plex Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: 1.5
  body:
    fontFamily: "IBM Plex Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12.5px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "IBM Plex Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.5
  micro:
    fontFamily: "IBM Plex Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.35
  figure:
    fontFamily: "IBM Plex Mono, ui-monospace, SFMono-Regular, monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "tabular-nums"
rounded:
  none: "0"
  thumb: "1px"
  focus: "2px"
spacing:
  hairline: "1px"
  tight: "6px"
  snug: "8px"
  panel: "16px"
  band: "20px"
  group: "24px"
  section: "32px"
components:
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.graphite-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "4px 10px"
  button-primary:
    backgroundColor: "var(--cta-bg)"
    textColor: "var(--cta-ink)"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "0 10px"
    height: "36px"
  segment:
    backgroundColor: "transparent"
    textColor: "{colors.pencil-grey}"
    rounded: "{rounded.none}"
    padding: "4px 6px"
  segment-selected:
    backgroundColor: "{colors.inverted-ground}"
    textColor: "{colors.inverted-ink}"
    rounded: "{rounded.none}"
    padding: "4px 6px"
  tab:
    backgroundColor: "transparent"
    textColor: "{colors.pencil-grey}"
    rounded: "{rounded.none}"
    padding: "6px 12px"
  tab-active:
    backgroundColor: "transparent"
    textColor: "{colors.graphite-ink}"
    rounded: "{rounded.none}"
    padding: "6px 12px"
  input-hex:
    backgroundColor: "{colors.booth-white}"
    textColor: "{colors.graphite-ink}"
    typography: "{typography.figure}"
    rounded: "{rounded.none}"
    padding: "2px 6px"
    width: "6.5rem"
  swatch:
    backgroundColor: "var(--swatch-hex)"
    textColor: "var(--swatch-on-hex-wcag)"
    rounded: "{rounded.none}"
    padding: "6px"
    height: "80px"
  badge-yours:
    backgroundColor: "transparent"
    textColor: "{colors.graphite-ink}"
    rounded: "{rounded.none}"
    padding: "1px 4px"
  code-block:
    backgroundColor: "{colors.booth-panel}"
    textColor: "{colors.graphite-ink}"
    rounded: "{rounded.none}"
    padding: "12px"
---

# Design System: Science Color Palette

## Overview

**Creative North Star: "The Viewing Booth"**

Colour professionals do not judge a sample in a decorated room. They judge it in
a viewing booth: a standardised, deliberately colourless enclosure whose walls
are grey precisely so that nothing in the room contributes an opinion about the
sample. This interface is that booth. Every surface, rule, label and control is
achromatic, and the only colour on screen is the palette the user is there to
evaluate. This is not a stylistic preference that could be traded for a warmer
look — a tinted interface biases the judgement the tool exists to support, so
the achromatic shell is load-bearing.

The character is **quiet, deferential and exact**. The interface's job is to
disappear. Restraint is the entire personality: nothing competes with the
palette, nothing is decorative, and no element asks for attention it has not
earned. Where a lesser system would reach for an accent colour, a fill, a
gradient or a shadow, this one reaches for a hairline rule, a change of weight,
or inversion. Depth comes from three rule weights and two surface tones, not
from light. Corners are square everywhere — the only radii in the system are a
2px focus ring and a 1px slider thumb, both functional.

Density is professional and unapologetic in service of one rule: everything that
shapes the result sits above the palette, in a single band, so nothing is hidden
below the fold or off to one side. Type runs from 17px down to 8px, with the
working range between 11px and 12.5px. Every figure is set in mono with tabular
numerals, because figures in this tool exist to be compared in columns. The
largest type on the screen is not a headline — it is a hex code.

**Key Characteristics:**

- Achromatic shell; the generated palette is the only colour, with one derived exception
- Zero corner radius; hairline rules and inversion carry all structure
- Flat at rest — no shadow on any resting element
- Mono, tabular figures throughout; the display role *is* a figure
- Every input in one band above the palette
- Pass and fail never carried by colour alone: always an icon and a word
- Light and dark are peers, both defined token-for-token

## Colors

Thirteen greys and three muted status hues — a palette whose whole ambition is to
have no opinion. Names come from the booth: the walls, the panel, the recess, the
scored line, the pencil.

### Primary

There is no brand accent, and inventing one would break the system. The role a
primary colour normally plays — marking the main action — is filled by
**inversion** (graphite ground, near-white ink) and, in exactly one place, by a
tint derived from the user's own colour. See *The Derived Tint Rule* below.

### Neutral

- **Booth White** (`#ffffff`, dark `#121212`): the page ground. The surround
  against which all colour judgement happens.
- **Booth Panel** (`#f6f6f7`, dark `#1c1c1c`): raised-by-tone surfaces — the
  export code block, envelope plot grounds.
- **Recessed Grey** (`#ececee`, dark `#262626`): the pressed/hover state for
  bordered controls. Reads as a shallow indentation, not a fill.
- **Hairline** (`#e3e3e5`, dark `#303030`): the default rule. Divides everything;
  asserts nothing.
- **Scored Line** (`#c9c9cd`, dark `#464646`): the emphatic rule, for controls
  that must read as touchable and for slider tracks and plot axes.
- **Graphite Ink** (`#18181b`, dark `#ededed`): body and heading text, plot
  strokes, the focus outline, and the inverted ground.
- **Pencil Grey** (`#6b6b73`, dark `#a0a0a0`): secondary prose, hints, table
  cells that support rather than answer.
- **Faint Pencil** (`#74747c`, dark `#8a8a8a`): the quietest ink — hue angles,
  axis labels, "none" placeholders.
- **Inverted Ink** (`#fafafa`, dark `#121212`): text on the inverted ground.

### Tertiary

Status marks only, and never the sole signal. Muted deliberately so they cannot
be mistaken for palette output sitting in the chrome.

- **Verified Green** (`#1d6f42`, dark `#6bcf97`): a measured contrast pass.
- **Flagged Red** (`#a12b2b`, dark `#f08a8a`): a measured failure, and the
  border of an invalid colour field.
- **Cautioned Amber** (`#8a5a12`, dark `#e0b166`): a guarantee that slipped — a
  shade below the contrast its position implies.

### Named Rules

**The Viewing Booth Rule.** The chrome is achromatic. No accent hue, no tinted
surface, no coloured border, no coloured focus ring. Focus, selection and active
states are carried by weight, rule and inversion. The palette is the only colour
on screen.

**The Derived Tint Rule.** Chrome may take colour from the generated palette when
it is the primary action, and it must derive that colour from what the user
entered — resolved through the palette's own computed value for that seed, never
the raw input and never a hardcoded hue. Two conditions hold whenever it does:
the label is drawn in the swatch's `onHexWcag` so the element passes the standard
the tool reports against, and the tinted element never becomes the surround for
a swatch being judged. It sits above the palette, not among it.

**The Never Colour Alone Rule.** No pass, fail or warning is communicated by
colour alone. Every status mark carries an icon *and* a word: a tick with "AA", a
warning triangle with the shade numbers, a cross with "Fail".

**The Faint Still Reads Rule.** Faint Pencil is not free to be as faint as it
looks. It labels 8–11px hue angles and axis values, which WCAG treats as body
text, so it must clear 4.5:1 against its ground. Quietness stops at the
threshold, not past it.

## Typography

**Display Font:** IBM Plex Mono (with `ui-monospace`, `SFMono-Regular`, monospace)
**Body Font:** IBM Plex Sans (with `ui-sans-serif`, `system-ui`, sans-serif)
**Label/Mono Font:** IBM Plex Mono, via a `.tabular` utility that also sets
`font-variant-numeric: tabular-nums`

**Character:** One family in two voices. Plex Sans is a grotesque with enough
humanist warmth to read comfortably at 11px, and Plex Mono is its exact
companion — so switching to figures changes the *register* without changing the
voice. The pairing reads as laboratory documentation: neutral, legible, engineered,
never expressive. Weights are 400/450/500/600 sans and 400/500/600 mono; nothing
is set lighter than 400 or heavier than 600.

### Hierarchy

- **Display** (mono, 500, 17px, `-0.01em`): the inspector's hex readout, and the
  largest type in the product. It is underlined because it is also a button that
  copies. That the biggest thing on screen is a hex code is the point.
- **Headline** (sans, 500, 15px): a colour family's name in the palette board —
  the only per-section heading that competes with the swatches, and it barely does.
- **Title** (sans, 500, 14px): panel headings ("Distance between shades", "What
  each hue can physically do"). The page's `h1` is 14.5px semibold with tight
  tracking — a title, not a banner.
- **Body** (sans, 400, 12.5px): explanatory prose and table cells. Measures are
  capped between 58ch and 76ch depending on the block; the footnote runs to 74ch.
- **Label** (sans, 500, 12px): control group headings, buttons, menu items.
- **Micro** (sans, 400, 11px): hints under controls, badges, hue angles, seed
  notes. Runs down to 10.5px for seed explanations and 10px for swatch labels;
  8px for SVG axis text.
- **Figure** (mono, 400, 12px, tabular): every number, every hex, every ratio.

### Named Rules

**The Mono Figures Rule.** Every number is set in mono with tabular numerals —
ratios, Lc values, hex codes, OKLCH components, hue angles, shade labels, step
counts. Figures in this tool exist to be compared down a column, and proportional
digits break that. If it is a quantity, it is `.tabular`.

**The No Display Type Rule.** There is no hero type and no room for it. The scale
tops out at 17px, and that slot belongs to a measured value. New surfaces do not
get to introduce a 32px headline because the composition feels empty; the density
is the design.

## Layout

A full-width shell capped at 1600px, built from three stacked bands and one
sidebar. The header is a single 20px-padded row of rules and controls. Below it,
the **control band** holds every input the tool has, wrapping from a column into
a row at `lg`. Below that, a flex row splits into the main column and an 18.5rem
sidebar that becomes `sticky` at `top-0` on `lg` and collapses to a full-width
block with a top rule below it.

Spacing is a tight, consistent rhythm: 6px between a label and its control, 16px
of panel padding, 20px of band padding, 24px between control groups, 32px between
ramp groups. The palette grid uses a **1px gutter** — `gap-px` — so a ramp reads
as one continuous band of colour subdivided by the page ground rather than as a
row of separated tiles. Ramps are CSS grid with
`repeat(<step count>, minmax(0, 1fr))`, so a ramp always fills its width whether
it has 5 shades or 15.

Responsive behaviour is honest rather than elaborate: swatches are 64px tall
below `sm` and 80px at and above it; the per-swatch hex code is hidden below `sm`
where it would not fit; the wide contrast table gets a `min-w-[46rem]` and its own
horizontal scroll container rather than being reflowed into something unreadable;
the header's tagline is hidden below `md`. Envelope plots are an
`auto-fill, minmax(15rem, 1fr)` grid, so they reflow by count rather than by
breakpoint.

### Named Rules

**The Everything Above Rule.** Every input that shapes the result lives in one
band above the palette. Nothing that changes the output hides in a sidebar, a
modal, an accordion or below the fold. The colours come first and take the most
room, because they are the only thing the user must supply; everything else is an
adjustment to what those colours already produced.

**The Hairline Gutter Rule.** Swatches within a ramp are separated by exactly 1px
of page ground, never by margin, radius or shadow. The ramp is one object.

## Elevation & Depth

The system is **flat at rest**. Depth is built from two tonal surfaces (Booth
Panel above Booth White, Recessed Grey below it) and three rule weights
(Hairline, Scored Line, and full ink inversion). Nothing that stays on the page
carries a shadow: not cards, not panels, not the sticky sidebar, not the header,
not a hovered button.

A shadow appears only on something genuinely detached from the page — the colour
picker popover and the download menu, both of which float above content and need
to read as temporarily lifted. Two elements in the entire product use it.

### Shadow Vocabulary

- **Floating layer** (`box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)`):
  popovers and dropdown menus only, always paired with a Scored Line border so
  the layer still has an edge in dark mode where the shadow is nearly invisible.

### Named Rules

**The Flat-At-Rest Rule.** Surfaces are flat at rest. A shadow is permitted only
on an element that is genuinely floating above the page and will disappear again.
If it is still there after the next click, it has no shadow.

**The Rules Are The Depth Rule.** Reach for a rule weight before a surface tone,
and a surface tone before a shadow. Hairline divides, Scored Line invites touch,
inversion means active.

## Shapes

**Everything is square.** `border-radius: 0` is the system's default and its
overwhelming reality: buttons, inputs, swatches, badges, panels, popovers, code
blocks, tabs and menus all have hard corners. The form language is orthogonal —
rectangles divided by hairlines, like a specimen sheet or a spreadsheet of
measurements.

Exactly two radii exist, and both are functional rather than expressive: the
`:focus-visible` outline gets 2px so the ring does not read as a mis-drawn box,
and the range-input thumb gets 1px to keep a 4px-wide blade from looking chipped.

Borders are the primary form-giving device. Controls are defined by a 1px border
in one of two weights, and the choice is semantic: Hairline for something that
divides or contains, Scored Line for something the user is meant to press, drag
or type into. Icons are 8–14px inline SVG with 1.2–1.6px strokes, `currentColor`,
and no fills except where a dot is the mark.

### Named Rules

**The Zero Radius Rule.** New components have square corners. If a rounded corner
seems needed, the real problem is that the element is competing for attention it
should not have.

**The Two Rule Weights Rule.** A border is Hairline or Scored Line, and the
difference is meaning, not decoration: Scored Line says "you can act on this".

## Components

### Buttons

- **Shape:** Square (`border-radius: 0`), 1px bordered, never filled at rest.
- **Secondary (the default):** transparent ground, Graphite Ink label at 12px/500,
  Hairline border, 4px/10px padding. This is the workhorse — Copy link, Copy,
  Save file, Undo, Redo, Download.
- **Hover:** the border strengthens from Hairline to full Graphite Ink; nothing
  else moves. Bordered controls that sit on a panel instead take a Recessed Grey
  ground on hover (Add a colour, From screen).
- **Focus:** the global 2px Graphite Ink `:focus-visible` outline at 2px offset.
  No component overrides it.
- **Primary (one instance):** the "Pick a colour" control, 36px tall, filled with
  a shade derived from the user's own colour via the palette's computed value for
  that seed, labelled in that swatch's `onHexWcag`. Both light and dark values are
  resolved into CSS custom properties and chosen between in CSS, so it survives
  the pre-paint theme script with no theme state of its own. Governed by *The
  Derived Tint Rule*.
- **Icon buttons:** Undo/Redo and Remove use `aria-label` plus a 10–14px inline
  SVG; the remove affordance is Faint Pencil until hovered, then Graphite Ink.

### Segmented Controls

- **Style:** A single Hairline-bordered row; segments divided by an internal
  `border-l`, never by gaps or radius. 11–11.5px labels.
- **State:** The selected segment inverts — Inverted Ground with Inverted Ink.
  Unselected segments are Pencil Grey and darken to Graphite Ink on hover.
- **Semantics:** `role="group"` with an `aria-label`, and `aria-pressed` on each
  button. Used for Colourfulness, Adjust/Exact, and Light/Dark/Auto.

### Tabs

- **Style:** A row above a Hairline bottom rule, with a `gap-px` gutter. The
  active tab carries a 2px Graphite Ink bottom border and medium weight; inactive
  tabs carry a 2px *transparent* bottom border so nothing shifts on change.
- **Semantics:** buttons with `aria-pressed`, not links.

### Inputs

- **Hex field:** mono, tabular, 6.5rem wide, Booth White ground, Hairline border,
  2px/6px padding. `spellCheck` off.
- **Error:** the border becomes Flagged Red and `aria-invalid` is set, live as the
  user types. On blur an unparseable value reverts to the committed colour rather
  than being left broken; Escape reverts, Enter commits.
- **Range sliders:** restyled to read as instrument controls — a 2px Scored Line
  track and a 4px × 16px Graphite Ink blade thumb with a 1px radius, `ew-resize`
  cursor. Every slider carries `aria-label` and a human `aria-valuetext`, and its
  current value is printed as a mono figure beside its own group heading. Dragging
  previews continuously; releasing commits one history entry.

### Swatch

The signature component. A 64px (80px at `sm`) square-cornered button filled with
its own colour, labelling itself in `onHexWcag` — the WCAG-maximising choice
rather than the perceptual one, because at 10px the standard's caution about
mid-tones is warranted and the tool must pass its own audit. Shade number sits
top-left, hex code bottom-left (hidden below `sm`).

- **Hover:** scales to 1.04 and raises z-index. The only transform in the product.
- **Selected:** a 2px Graphite Ink outline at 2px offset, drawn as an overlay so
  it never displaces the grid.
- **Seed:** a 2px inset border in the swatch's own `onHexWcag`, marking the shade
  as the user's colour kept exactly.
- **Short of contract:** a warning triangle in the corner, mirrored by prose.
- **Behaviour:** clicking selects *and* copies the hex, announced through the
  live region. The `aria-label` states family, shade, hex, seed status, contrast
  status and that it copies.

### Envelope Plot

A 260×150 inline SVG on a Booth Panel ground with a Hairline border. The gamut
region is filled with 26 vertical bands sampled from the hue itself at 72% of
maximum chroma and clipped to the envelope outline, so the shape is filled with
the colour it describes rather than an abstract tint. The cusp is a 2.5px open
circle with a dashed drop line; the ramp's path is a 1.25px Graphite Ink polyline
with a filled circle per shade (larger and thicker-stroked for a seed). Axis
labels are 8px. Every plot carries `role="img"` and an `aria-label` that states
the hue, its cusp lightness and the shade count — the plot is the tool's core
argument, so it has to survive not being seen.

### Status Marks

Three 10px inline SVGs on `currentColor` — a tick, a cross, a warning triangle —
always adjacent to a word. Colour is the redundant channel, not the signal.

### Toast

A fixed, bottom-centred, square-cornered Inverted Ground block with Inverted Ink
at 12.5px, `pointer-events-none`, cleared after 2600ms. Paired with a persistent
`aria-live="polite"` region so announcements are not tied to the visual timing.

## Do's and Don'ts

### Do:

- **Do** keep the chrome achromatic. Use the Neutral scale, inversion, and rule
  weight to build every state.
- **Do** derive any tinted chrome from the user's entered colour through the
  palette's computed value for it, label it with that swatch's `onHexWcag`, and
  keep it out of the surround of anything being judged.
- **Do** set every number in mono with tabular numerals via `.tabular`.
- **Do** use square corners (`border-radius: 0`) on new components.
- **Do** pick a border weight semantically: Hairline to divide, Scored Line to
  invite action.
- **Do** put new inputs that shape the output into the top control band, with a
  12px medium heading, a mono value readout, and an 11px hint.
- **Do** pair every status colour with an icon and a word.
- **Do** give every control an `aria-label`, and sliders an `aria-valuetext` in
  plain language.
- **Do** define light and dark values together for any new token. Both themes are
  first-class.
- **Do** preview continuously and commit once on release for any dragged control,
  so one gesture is one history entry.

### Don't:

- **Don't** introduce an accent hue, a coloured focus ring, a coloured border or
  a tinted surface into the chrome.
- **Don't** put a shadow on anything that stays on the page. Shadow is for
  floating layers only, and they get a Scored Line border too.
- **Don't** round a corner. The only radii are the 2px focus ring and the 1px
  slider thumb.
- **Don't** introduce display type. The scale stops at 17px, and that slot is a
  measured value.
- **Don't** use proportional digits for a quantity.
- **Don't** communicate pass, fail or warning by colour alone.
- **Don't** move an output-shaping input below the palette, behind a disclosure,
  or into the sidebar.
- **Don't** let Faint Pencil drop below 4.5:1 against its ground, however small
  the text.
- **Don't** use `onHex` for the tool's own labels — that is the perceptual
  recommendation for the user's output. The interface uses `onHexWcag` so it
  passes the standard it reports.
- **Don't** animate anything beyond the swatch's 1.04 hover scale and simple
  colour transitions; `prefers-reduced-motion` clamps everything to 0.01ms and
  the design must not depend on motion.
