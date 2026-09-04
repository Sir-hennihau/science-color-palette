/**
 * The spectrum: a full set of colour families walking the hue circle.
 *
 * A palette is more useful as a *range* than as a set of assigned jobs. Naming
 * a ramp "danger" decides how it may be used; naming it "red" leaves that to
 * the designer, who can then reach for red-600 in a destructive button and
 * red-50 in a highlight without fighting the vocabulary. This is how the
 * palettes people actually build design systems on are shaped.
 *
 * Every family is anchored on the seeds and spaced around the circle from
 * there, so the whole spectrum belongs to the colours that were typed in rather
 * than being a fixed rainbow with the brand colour bolted on.
 */

import { hueDelta, hueDistance, normalizeHue, oklchFromHex } from './color/space.ts'

/**
 * Hue anchors for naming, defined by a well-known colour rather than a number.
 *
 * Giving the hex and deriving the angle keeps the table honest: "blue" means
 * the hue of a colour everyone agrees is blue, and it cannot drift out of step
 * with the conversion code.
 */
const NAME_ANCHORS: ReadonlyArray<{ name: string; hex: string }> = [
  { name: 'red', hex: '#ef4444' },
  { name: 'orange', hex: '#f97316' },
  { name: 'amber', hex: '#f59e0b' },
  { name: 'yellow', hex: '#eab308' },
  { name: 'lime', hex: '#84cc16' },
  { name: 'green', hex: '#22c55e' },
  { name: 'emerald', hex: '#10b981' },
  { name: 'teal', hex: '#14b8a6' },
  { name: 'cyan', hex: '#06b6d4' },
  { name: 'sky', hex: '#0ea5e9' },
  { name: 'blue', hex: '#3b82f6' },
  { name: 'indigo', hex: '#6366f1' },
  { name: 'violet', hex: '#8b5cf6' },
  { name: 'purple', hex: '#a855f7' },
  { name: 'fuchsia', hex: '#d946ef' },
  { name: 'pink', hex: '#ec4899' },
  { name: 'rose', hex: '#f43f5e' },
]

let namedHues: Array<{ name: string; hue: number }> | null = null

/** Naming anchors with their hues, computed once. */
export function nameAnchors(): ReadonlyArray<{ name: string; hue: number }> {
  if (!namedHues) {
    namedHues = NAME_ANCHORS.map((anchor) => ({
      name: anchor.name,
      hue: oklchFromHex(anchor.hex).h,
    }))
  }
  return namedHues
}

export const MIN_FAMILIES = 3
export const MAX_FAMILIES = 16
export const DEFAULT_FAMILIES = 10

/** Hues closer than this read as the same colour, so they are merged. */
const MIN_SEPARATION = 10

export interface SpectrumFamily {
  /** Hue in degrees. */
  hue: number
  /** A colour name, e.g. `teal`. */
  name: string
  /** Index of the seed this family was anchored on, if any. */
  seedIndex?: number
}

/**
 * Lay out the families.
 *
 * Seed hues are fixed anchors. The remaining families are shared out among the
 * arcs between those anchors in proportion to how wide each arc is, then spaced
 * evenly inside it — so a single seed yields an evenly spaced circle starting at
 * that colour, and two seeds 30 degrees apart put most of the spectrum in the
 * wide arc where there is actually room for distinct colours.
 */
export function planSpectrum(seedHues: number[], families: number): SpectrumFamily[] {
  const anchors = dedupeAnchors(seedHues)
  if (anchors.length === 0) return []

  const count = Math.max(anchors.length, Math.min(MAX_FAMILIES, families))
  const arcs = buildArcs(anchors)
  const extras = allocate(count - anchors.length, arcs.map((arc) => arc.size))

  const placed: Array<{ hue: number; seedIndex?: number }> = anchors.map((anchor) => ({
    hue: anchor.hue,
    seedIndex: anchor.seedIndex,
  }))

  arcs.forEach((arc, i) => {
    const extra = extras[i]
    for (let j = 0; j < extra; j++) {
      placed.push({ hue: normalizeHue(arc.start + (arc.size * (j + 1)) / (extra + 1)) })
    }
  })

  return assignNames(orderFromFirstSeed(placed, anchors[0].hue))
}

interface Anchor {
  hue: number
  seedIndex: number
}

function dedupeAnchors(seedHues: number[]): Anchor[] {
  const anchors: Anchor[] = []

  seedHues.forEach((hue, seedIndex) => {
    if (!Number.isFinite(hue)) return
    const normalized = normalizeHue(hue)
    // Two seeds of nearly the same hue cannot anchor two distinct families.
    if (anchors.some((a) => hueDistance(a.hue, normalized) < MIN_SEPARATION)) return
    anchors.push({ hue: normalized, seedIndex })
  })

  return anchors
}

interface Arc {
  start: number
  size: number
}

function buildArcs(anchors: Anchor[]): Arc[] {
  if (anchors.length === 1) {
    // One anchor leaves a single arc all the way round to itself, which makes
    // the even-spacing case fall out of the same formula as every other.
    return [{ start: anchors[0].hue, size: 360 }]
  }

  const sorted = [...anchors].sort((a, b) => a.hue - b.hue)

  return sorted.map((anchor, i) => {
    const next = sorted[(i + 1) % sorted.length]
    const size = i === sorted.length - 1 ? 360 - anchor.hue + next.hue : next.hue - anchor.hue
    return { start: anchor.hue, size }
  })
}

/**
 * Share `total` extra families among arcs in proportion to their width.
 *
 * Largest-remainder rather than plain rounding, so the parts always add up to
 * the whole and the result does not depend on iteration order.
 */
function allocate(total: number, sizes: number[]): number[] {
  if (total <= 0) return sizes.map(() => 0)

  const sum = sizes.reduce((a, b) => a + b, 0)
  if (sum <= 0) return sizes.map(() => 0)

  const exact = sizes.map((size) => (size / sum) * total)
  const counts = exact.map(Math.floor)
  let left = total - counts.reduce((a, b) => a + b, 0)

  const order = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index)

  for (const entry of order) {
    if (left <= 0) break
    counts[entry.index]++
    left--
  }

  return counts
}

/**
 * Order the families as a walk around the circle beginning at the first seed.
 *
 * Putting the seed first keeps the colour someone typed at the top of their
 * palette, and continuing round the wheel from there means the rest reads as a
 * progression rather than an arbitrary list.
 */
function orderFromFirstSeed(
  placed: Array<{ hue: number; seedIndex?: number }>,
  startHue: number,
): Array<{ hue: number; seedIndex?: number }> {
  return [...placed].sort((a, b) => {
    const da = normalizeHue(a.hue - startHue)
    const db = normalizeHue(b.hue - startHue)
    return da - db || a.hue - b.hue
  })
}

/**
 * Give each family the closest colour name that is still free.
 *
 * Assigned globally best-match-first rather than family by family, so a family
 * sitting squarely on "teal" keeps that name even if an earlier one in the list
 * would also have settled for it.
 */
function assignNames(
  placed: Array<{ hue: number; seedIndex?: number }>,
): SpectrumFamily[] {
  const anchors = nameAnchors()

  const pairs: Array<{ family: number; anchor: number; distance: number }> = []
  placed.forEach((family, familyIndex) => {
    anchors.forEach((anchor, anchorIndex) => {
      pairs.push({
        family: familyIndex,
        anchor: anchorIndex,
        distance: hueDistance(family.hue, anchor.hue),
      })
    })
  })

  pairs.sort(
    (a, b) => a.distance - b.distance || a.family - b.family || a.anchor - b.anchor,
  )

  const names = new Array<string | null>(placed.length).fill(null)
  const taken = new Set<number>()

  for (const pair of pairs) {
    if (names[pair.family] !== null || taken.has(pair.anchor)) continue
    names[pair.family] = anchors[pair.anchor].name
    taken.add(pair.anchor)
  }

  return placed.map((family, index) => ({
    hue: Number(family.hue.toFixed(2)),
    // More families than there are names is possible; fall back to the angle,
    // which is at least unambiguous.
    name: names[index] ?? `hue-${Math.round(family.hue)}`,
    ...(family.seedIndex === undefined ? {} : { seedIndex: family.seedIndex }),
  }))
}

/**
 * Conventional interface roles, matched to the nearest family.
 *
 * Offered as a note rather than baked into the ramp names. The palette stays a
 * range of colours the designer assigns; this just saves them working out which
 * of their reds is closest to the red people expect for an error.
 */
export const ROLE_HUES: ReadonlyArray<{ role: string; hex: string }> = [
  { role: 'danger', hex: '#ef4444' },
  { role: 'warning', hex: '#f59e0b' },
  { role: 'success', hex: '#22c55e' },
  { role: 'info', hex: '#0ea5e9' },
]

export interface RoleHint {
  role: string
  family: string
  /** How far the family sits from the conventional hue, in degrees. */
  offset: number
}

export function suggestRoles(families: SpectrumFamily[]): RoleHint[] {
  if (families.length === 0) return []

  return ROLE_HUES.map(({ role, hex }) => {
    const target = oklchFromHex(hex).h
    let best = families[0]

    for (const family of families) {
      if (hueDistance(family.hue, target) < hueDistance(best.hue, target)) best = family
    }

    return {
      role,
      family: best.name,
      // Rounding a tiny negative offset yields -0, which JSON writes as 0 and
      // so breaks the round trip the engine promises.
      offset: noNegativeZero(Number(hueDelta(target, best.hue).toFixed(1))),
    }
  })
}

function noNegativeZero(value: number): number {
  return Object.is(value, -0) ? 0 : value
}
