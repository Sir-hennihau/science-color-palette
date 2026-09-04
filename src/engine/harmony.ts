/**
 * Colour harmony, computed on a perceptual hue circle.
 *
 * The classic artist's wheel and the RGB wheel disagree about what
 * "complementary" even means — red's opposite is green on one and cyan on the
 * other — and neither matches how vision actually works, which pairs red
 * against green and blue against yellow through opponent channels. Rotating in
 * OKLCH hue is the closest practical approximation: it is at least perceptually
 * spaced, so a 120 degree step looks like a 120 degree step everywhere on the
 * circle, which is not true in HSL.
 *
 * The part most generators get wrong is what happens *after* the rotation.
 * Lightness and chroma cannot be carried across: the complement of a vivid dark
 * blue lands on yellow, where no dark vivid colour exists. So an accent hue is
 * only ever a hue — the ramp is solved from scratch against the shared ladder,
 * which puts it at the same lightness as everything else and gives it whatever
 * chroma that hue can actually manage.
 */

import { hueDistance, normalizeHue } from './color/space.ts'
import { chromaCeilingCurve, chromaCurve } from './curves/chroma.ts'
import { hueCurve } from './curves/hue.ts'
import { generateRamp, type RampSpec } from './ramp.ts'
import { solveStep } from './solve.ts'
import { oklchToRgb, quantize, rgb8ToHex } from './color/space.ts'
import type {
  EngineWarning,
  HarmonyKind,
  HarmonySuggestion,
  Ramp,
  ResolvedConfig,
} from './types.ts'

/** Hue offsets each scheme adds, relative to the primary. */
const SCHEME_OFFSETS: Record<HarmonyKind, number[]> = {
  complementary: [180],
  analogous: [-30, 30],
  triadic: [120, -120],
  'split-complementary': [150, 210],
  tetradic: [90, 180, 270],
}

/** The hue separation each scheme is "about", for scoring how well seeds fit. */
const SCHEME_IDEAL_SEPARATION: Record<HarmonyKind, number> = {
  complementary: 180,
  analogous: 30,
  triadic: 120,
  'split-complementary': 150,
  tetradic: 90,
}

const SCHEME_LABEL: Record<HarmonyKind, string> = {
  complementary: 'complementary',
  analogous: 'analogous',
  triadic: 'triadic',
  'split-complementary': 'split-complementary',
  tetradic: 'tetradic',
}

export const ALL_HARMONY_KINDS = Object.keys(SCHEME_OFFSETS) as HarmonyKind[]

/** Hues a scheme adds around `primaryHue`. */
export function harmonyHues(kind: HarmonyKind, primaryHue: number): number[] {
  return SCHEME_OFFSETS[kind].map((offset) => normalizeHue(primaryHue + offset))
}

/**
 * Suggest schemes that would complete the palette.
 *
 * With one seed every scheme is available, so all are offered. With two or more
 * the existing hue relationship is read first: seeds already 175 degrees apart
 * are a complementary pair and want flanking analogous hues, not another
 * opposite. Confidence reflects how cleanly the seeds match the scheme's own
 * geometry.
 */
export function suggestHarmonies(resolved: ResolvedConfig): HarmonySuggestion[] {
  const hues = resolved.seeds.filter((s) => !s.achromatic).map((s) => s.oklch.h)

  if (hues.length === 0) return []

  const primary = hues[0]

  if (hues.length === 1) {
    return ALL_HARMONY_KINDS.map((kind) =>
      buildSuggestion(kind, harmonyHues(kind, primary), 1, singleSeedRationale(kind), resolved),
    )
  }

  if (hues.length === 2) {
    return twoSeedSuggestions(hues[0], hues[1], resolved)
  }

  return [fillLargestGap(hues, resolved)]
}

function singleSeedRationale(kind: HarmonyKind): string {
  switch (kind) {
    case 'complementary':
      return 'One hue directly opposite, for maximum separation between two roles.'
    case 'analogous':
      return 'Two neighbouring hues, for a calm palette that reads as one family.'
    case 'triadic':
      return 'Two hues evenly spaced around the circle, balanced and lively.'
    case 'split-complementary':
      return 'Two hues flanking the opposite, softer than a straight complement.'
    case 'tetradic':
      return 'Three hues at right angles, for palettes needing several distinct roles.'
  }
}

function twoSeedSuggestions(
  first: number,
  second: number,
  resolved: ResolvedConfig,
): HarmonySuggestion[] {
  const separation = hueDistance(first, second)

  if (separation < 20) {
    return [
      buildSuggestion(
        'complementary',
        harmonyHues('complementary', first),
        confidenceFor('complementary', separation),
        `Your two seeds are only ${separation.toFixed(0)} degrees apart, so they will read ` +
          'as the same colour. An opposite hue gives the palette somewhere to go.',
        resolved,
      ),
      buildSuggestion(
        'triadic',
        harmonyHues('triadic', first),
        0.6,
        'Two evenly spaced hues, if you want three clearly distinct colours.',
        resolved,
      ),
    ]
  }

  if (separation < 50) {
    return [
      buildSuggestion(
        'complementary',
        harmonyHues('complementary', first),
        0.85,
        `Your seeds are an analogous pair ${separation.toFixed(0)} degrees apart. One ` +
          'opposite hue completes them without disturbing that relationship.',
        resolved,
      ),
      buildSuggestion(
        'triadic',
        harmonyHues('triadic', first),
        0.5,
        'A wider spread, if the two seeds feel too close.',
        resolved,
      ),
    ]
  }

  if (separation < 105) {
    return [
      buildSuggestion(
        'tetradic',
        [normalizeHue(first + 180), normalizeHue(second + 180)],
        confidenceFor('tetradic', separation),
        `Opposites of both seeds, completing the rectangle they already start ` +
          `(${separation.toFixed(0)} degrees apart).`,
        resolved,
      ),
    ]
  }

  if (separation < 150) {
    // Two thirds of a triad: the third hue is opposite their midpoint.
    const third = normalizeHue(first + hueDistanceSigned(first, second) / 2 + 180)
    return [
      buildSuggestion(
        'triadic',
        [third],
        confidenceFor('triadic', separation),
        `Your seeds are ${separation.toFixed(0)} degrees apart, most of a triad. One more ` +
          'hue opposite their midpoint spaces all three evenly.',
        resolved,
      ),
    ]
  }

  return [
    buildSuggestion(
      'analogous',
      [normalizeHue(first - 25), normalizeHue(first + 25)],
      confidenceFor('complementary', separation),
      `Your seeds are already near opposites (${separation.toFixed(0)} degrees). Hues ` +
        'flanking the primary add depth without introducing a fourth direction.',
      resolved,
    ),
    buildSuggestion(
      'split-complementary',
      harmonyHues('split-complementary', first),
      0.5,
      'Softening the opposite into two hues either side of it.',
      resolved,
    ),
  ]
}

function fillLargestGap(hues: number[], resolved: ResolvedConfig): HarmonySuggestion {
  const sorted = [...hues].sort((a, b) => a - b)

  let gapStart = sorted[sorted.length - 1]
  let gapSize = 360 - sorted[sorted.length - 1] + sorted[0]

  for (let i = 1; i < sorted.length; i++) {
    const size = sorted[i] - sorted[i - 1]
    if (size > gapSize) {
      gapSize = size
      gapStart = sorted[i - 1]
    }
  }

  const hue = normalizeHue(gapStart + gapSize / 2)
  const kind = nearestScheme(gapSize / 2)

  return buildSuggestion(
    kind,
    [hue],
    0.7,
    `The widest gap between your hues is ${gapSize.toFixed(0)} degrees; this fills its ` +
      'middle so the palette is evenly spread.',
    resolved,
  )
}

function nearestScheme(separation: number): HarmonyKind {
  let best: HarmonyKind = 'complementary'
  let bestDistance = Infinity

  for (const kind of ALL_HARMONY_KINDS) {
    const distance = Math.abs(SCHEME_IDEAL_SEPARATION[kind] - separation)
    if (distance < bestDistance) {
      bestDistance = distance
      best = kind
    }
  }

  return best
}

function confidenceFor(kind: HarmonyKind, separation: number): number {
  const ideal = SCHEME_IDEAL_SEPARATION[kind]
  return Math.max(0, 1 - Math.abs(separation - ideal) / 22.5)
}

function hueDistanceSigned(from: number, to: number): number {
  const forward = normalizeHue(to - from)
  return forward <= 180 ? forward : forward - 360
}

/**
 * Build a suggestion, including one solved swatch per hue as a preview.
 *
 * Previews are a single mid-ramp solve rather than a whole ramp: the point is
 * to let someone see the colour before committing, and generating full ramps
 * for schemes nobody accepted would be most of the work for nothing.
 */
function buildSuggestion(
  kind: HarmonyKind,
  hues: number[],
  confidence: number,
  rationale: string,
  resolved: ResolvedConfig,
): HarmonySuggestion {
  const curve = chromaCurve(resolved.chromaPoints)
  const ceiling = chromaCeilingCurve(resolved.chromaPoints)
  const midIndex = Math.floor((resolved.ladder.steps - 1) / 2)

  return {
    kind,
    hues: hues.map((h) => Number(normalizeHue(h).toFixed(2))),
    confidence: Number(Math.min(1, Math.max(0, confidence)).toFixed(3)),
    rationale,
    preview: hues.map((hue) => {
      const solved = solveStep({
        yTarget: resolved.ladder.yTargets[midIndex],
        hue,
        fraction: curve.at(resolved.ladder.t[midIndex]),
        ceiling: ceiling.at(resolved.ladder.t[midIndex]),
        gamut: resolved.gamut,
      })
      return {
        hue: Number(normalizeHue(hue).toFixed(2)),
        hex: rgb8ToHex(quantize(oklchToRgb(solved))),
      }
    }),
  }
}

/**
 * Generate accent ramps for the requested schemes.
 *
 * Each hue is solved against the shared ladder, so an accent's shade 600 has
 * the same lightness — and therefore the same contrast — as every other 600 in
 * the palette.
 */
export function generateAccentRamps(
  resolved: ResolvedConfig,
  suggestions: HarmonySuggestion[],
): Ramp[] {
  const kinds = new Set<HarmonyKind>(resolved.harmony.include)

  if (resolved.harmony.auto && suggestions.length > 0) {
    const best = suggestions.reduce((a, b) => (b.confidence > a.confidence ? b : a))
    kinds.add(best.kind)
  }

  if (kinds.size === 0) return []

  const seedHues = resolved.seeds.filter((s) => !s.achromatic).map((s) => s.oklch.h)
  if (seedHues.length === 0) return []

  const ramps: Ramp[] = []
  const used = [...seedHues]

  for (const kind of ALL_HARMONY_KINDS) {
    if (!kinds.has(kind)) continue

    const suggestion = suggestions.find((s) => s.kind === kind)
    const hues = suggestion ? suggestion.hues : harmonyHues(kind, seedHues[0])

    let ordinal = 0
    for (const hue of hues) {
      // Skip a hue the palette already covers; a near-duplicate accent adds
      // nothing but confusion.
      if (used.some((existing) => hueDistance(existing, hue) < 12)) continue

      ordinal++
      used.push(hue)
      ramps.push(buildAccentRamp(kind, ordinal, hue, resolved, hues.length > 1))
    }
  }

  return ramps
}

function buildAccentRamp(
  kind: HarmonyKind,
  ordinal: number,
  hue: number,
  resolved: ResolvedConfig,
  numbered: boolean,
): Ramp {
  const name = numbered ? `${SCHEME_LABEL[kind]}-${ordinal}` : SCHEME_LABEL[kind]
  const warnings: EngineWarning[] = []

  const spec: RampSpec = {
    role: `accent-${name}`,
    name,
    hue,
    ladder: resolved.ladder,
    fraction: chromaCurve(resolved.chromaPoints),
    ceiling: chromaCeilingCurve(resolved.chromaPoints),
    hueCurve: hueCurve(hue, resolved.hueDrift, 0.5),
    usesSharedLadder: true,
    gamut: resolved.gamut,
    warnings,
  }

  return generateRamp(spec)
}
