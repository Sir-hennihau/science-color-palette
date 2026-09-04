/**
 * The two ways a seed colour can become a ramp.
 *
 * `harmonize` treats the typed colour as an *intention*. It keeps the hue and
 * the sense of colourfulness, but puts the shade on the ladder's lightness and
 * the curve's chroma. The ramp is then internally perfect and shares its
 * lightness with every other ramp in the palette, so all the contrast
 * guarantees hold — at the cost of the primary being merely close to what was
 * typed. The report says exactly how close.
 *
 * `exact` treats the typed colour as a *requirement* — a brand colour, usually.
 * It ships byte for byte, and the ramp bends around it: the lightness ladder is
 * warped so the seed's step sits at the seed's own lightness, the chroma curve
 * is rescaled to pass through the seed's own colourfulness, and the hue curve
 * is anchored on the seed's hue. The result looks deliberate rather than like
 * one shade was pasted into someone else's ramp. What it cannot do is keep the
 * contrast promises, since those come from the lightness it just gave up; any
 * that break are measured and reported.
 */

import { DELTA_BANDS } from './constants.ts'
import {
  deltaEOK,
  hueDelta,
  lstarFromY,
  normalizeHue,
  type Oklch,
} from './color/space.ts'
import { chromaCeilingCurve, chromaCurve, constantCeiling, warpChromaCurve } from './curves/chroma.ts'
import { hueCurve } from './curves/hue.ts'
import { nearestSlot, slotForLabel, warpLadderForSeed } from './ladder.ts'
import { generateRamp, type RampSpec } from './ramp.ts'
import { chromaFractionOf } from './solve.ts'
import {
  EngineError,
  type EngineWarning,
  type Ramp,
  type ResolvedConfig,
  type ResolvedSeed,
  type SeedDelta,
} from './types.ts'

/** Largest hue rotation applied when blending one colour toward another. */
export const MAX_BLEND_ROTATION = 15

/**
 * Rotate `hue` toward `target`, by half the gap but never more than 15 degrees.
 *
 * Borrowed from Material's colour blending: enough to make an unrelated colour
 * feel like it belongs to the palette, not enough to stop it being the colour
 * it was.
 */
export function blendTowardHue(hue: number, target: number): number {
  const delta = hueDelta(hue, target)
  const rotation = Math.min(MAX_BLEND_ROTATION, Math.abs(delta) / 2)
  return normalizeHue(hue + Math.sign(delta) * rotation)
}

/** Describe the gap between what was typed and what the palette uses. */
export function describeDelta(from: Oklch, to: Oklch): SeedDelta {
  const eok = deltaEOK(from, to)

  return {
    eok,
    dL: to.l - from.l,
    dC: to.c - from.c,
    dH: hueDelta(from.h, to.h),
    magnitude:
      eok < DELTA_BANDS.none
        ? 'none'
        : eok < DELTA_BANDS.subtle
          ? 'subtle'
          : eok < DELTA_BANDS.noticeable
            ? 'noticeable'
            : 'large',
  }
}

/** Build the ramp for one seed, in whichever mode it asked for. */
export function generateSeedRamp(
  seed: ResolvedSeed,
  resolved: ResolvedConfig,
  primaryHue: number | null,
): Ramp {
  const warnings: EngineWarning[] = []

  if (seed.clipped) {
    warnings.push({
      code: 'SEED_CLIPPED',
      message:
        `"${seed.input}" is outside the range a standard screen can show, so it was ` +
        `brought in to ${seed.hex}.`,
      context: { input: seed.input, hex: seed.hex },
    })
  }

  const hue = seedHue(seed, primaryHue)
  const slot = resolveSlot(seed, resolved, warnings)

  return seed.mode === 'exact'
    ? buildExactRamp(seed, resolved, hue, slot, warnings)
    : buildHarmonizedRamp(seed, resolved, hue, slot, warnings)
}

function seedHue(seed: ResolvedSeed, primaryHue: number | null): number | null {
  if (seed.achromatic) return null
  if (seed.blendHue && primaryHue !== null) return blendTowardHue(seed.oklch.h, primaryHue)
  return seed.oklch.h
}

/** Which step the seed belongs on. */
function resolveSlot(
  seed: ResolvedSeed,
  resolved: ResolvedConfig,
  warnings: EngineWarning[],
): number {
  const { ladder } = resolved

  if (seed.slot !== undefined) {
    const index = slotForLabel(ladder, seed.slot)
    if (index < 0) {
      throw new EngineError(
        'SLOT_NOT_FOUND',
        `There is no shade ${seed.slot} in an ${ladder.steps}-step ramp. ` +
          `Available shades: ${ladder.labels.join(', ')}.`,
        { slot: seed.slot, steps: ladder.steps },
      )
    }
    return index
  }

  const index = nearestSlot(ladder, lstarFromY(seed.y))

  // A seed at the very top or bottom of the ramp has almost no room to become a
  // ramp; say so rather than quietly producing something washed out.
  if (index === 0 || index === ladder.steps - 1) {
    warnings.push({
      code: 'SEED_AT_RAMP_END',
      message:
        `${seed.name} is ${index === 0 ? 'very light' : 'very dark'}, so it lands on shade ` +
        `${ladder.labels[index]} and the ramp extends mostly in one direction. ` +
        'A mid-lightness seed gives a fuller range.',
      context: { label: ladder.labels[index] },
    })
  }

  return index
}

function buildHarmonizedRamp(
  seed: ResolvedSeed,
  resolved: ResolvedConfig,
  hue: number | null,
  slot: number,
  warnings: EngineWarning[],
): Ramp {
  const spec: RampSpec = {
    role: seed.role,
    name: seed.name,
    hue,
    ladder: resolved.ladder,
    fraction: chromaCurve(resolved.chromaPoints),
    ceiling: chromaCeilingCurve(resolved.chromaPoints),
    hueCurve: hue === null ? null : hueCurve(hue, resolved.hueDrift, 0.5),
    usesSharedLadder: true,
    gamut: resolved.gamut,
    warnings,
  }

  const ramp = generateRamp(spec)
  const snapped = ramp.swatches[slot]
  const delta = describeDelta(seed.oklch, snapped.oklch)

  return {
    ...ramp,
    seed: {
      input: seed.hex,
      mode: 'harmonize',
      slotLabel: snapped.label,
      delta,
    },
    report: {
      ...ramp.report,
      warnings: [...ramp.report.warnings, ...harmonizeNotes(seed, snapped.label, delta)],
    },
  }
}

function harmonizeNotes(
  seed: ResolvedSeed,
  slotLabel: number,
  delta: SeedDelta,
): EngineWarning[] {
  if (delta.magnitude === 'none' || delta.magnitude === 'subtle') return []

  return [
    {
      code: 'SEED_HARMONIZED',
      message:
        `${seed.name} ${slotLabel} is a ${delta.magnitude} step from ${seed.hex} — the ` +
        'ramp keeps its lightness and colourfulness consistent with the rest of the ' +
        'palette. Switch this seed to Exact to keep your colour unchanged.',
      context: {
        hex: seed.hex,
        label: slotLabel,
        deltaEOK: Number(delta.eok.toFixed(4)),
      },
    },
  ]
}

function buildExactRamp(
  seed: ResolvedSeed,
  resolved: ResolvedConfig,
  hue: number | null,
  slot: number,
  warnings: EngineWarning[],
): Ramp {
  const baseCurve = chromaCurve(resolved.chromaPoints)

  // Measure the ideal first: the colour `harmonize` would have produced at this
  // step. That is what the reported delta is against, so the user can see what
  // holding their colour actually costs.
  const idealSpec: RampSpec = {
    role: seed.role,
    name: seed.name,
    hue,
    ladder: resolved.ladder,
    fraction: baseCurve,
    ceiling: chromaCeilingCurve(resolved.chromaPoints),
    hueCurve: hue === null ? null : hueCurve(hue, resolved.hueDrift, 0.5),
    usesSharedLadder: true,
    gamut: resolved.gamut,
    warnings: [],
  }
  const ideal = generateRamp(idealSpec).swatches[slot]

  const { ladder, warnings: warpWarnings } = warpLadderForSeed(
    resolved.ladder,
    slot,
    lstarFromY(seed.y),
  )

  const t = ladder.t[slot]
  const fraction =
    seed.achromatic || hue === null
      ? baseCurve
      : warpChromaCurve(baseCurve, t, chromaFractionOf(seed.oklch, resolved.gamut))

  const spec: RampSpec = {
    role: seed.role,
    name: seed.name,
    hue,
    ladder,
    fraction,
    // Anchoring the drift on the seed's own step keeps its hue untouched.
    hueCurve: hue === null ? null : hueCurve(hue, resolved.hueDrift, t),
    // An exact seed's own colourfulness is the reference, so the light-end
    // ceiling is scaled to pass through it rather than overriding it.
    ceiling: seed.achromatic
      ? constantCeiling(0)
      : exactCeiling(resolved, t, seed.oklch.c),
    seedInsert: { index: slot, hex: seed.hex },
    usesSharedLadder: false,
    gamut: resolved.gamut,
    warnings: [...warnings, ...warpWarnings],
  }

  const ramp = generateRamp(spec)

  return {
    ...ramp,
    seed: {
      input: seed.hex,
      mode: 'exact',
      slotLabel: ramp.swatches[slot].label,
      delta: describeDelta(seed.oklch, ideal.oklch),
    },
  }
}

/**
 * Light-end chroma ceiling for an exact ramp.
 *
 * The default ceiling exists to stop the lightest shades picking up more colour
 * than a hue's volatile envelope warrants. An exact seed overrides that
 * judgement: if the colour that has to be kept is itself more colourful than
 * the ceiling at its position, the ceiling is lifted proportionally so the
 * shades around the seed are not forced duller than the seed itself.
 */
function exactCeiling(resolved: ResolvedConfig, t: number, seedChroma: number) {
  const base = chromaCeilingCurve(resolved.chromaPoints)
  const at = base.at(t)
  if (at <= 1e-9 || seedChroma <= at) return base

  const scale = seedChroma / at
  return {
    at: (x: number) => base.at(x) * scale,
    points: base.points,
  }
}
