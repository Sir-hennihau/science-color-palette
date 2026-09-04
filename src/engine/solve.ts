/**
 * The solver: turn a luminance target into an actual colour.
 *
 * This is where the two halves of the design meet. The ladder says what
 * luminance a step must have (because that, and only that, fixes its contrast).
 * The envelope says how much chroma the hue can offer at a given lightness.
 * Those constraints are coupled — changing lightness changes the available
 * chroma, and changing chroma changes the luminance — so the step is found by
 * search rather than by formula.
 *
 * Bisection is used deliberately over a faster Newton iteration: the envelope
 * has a kink at the cusp, the bracket is exact and unconditional (lightness 0
 * is black, lightness 1 is white), and a fixed iteration count makes the result
 * bit-for-bit reproducible.
 */

import { SOLVE_L_ITERATIONS } from './constants.ts'
import { cMaxAt, cMaxExact, getEnvelope, type Envelope } from './color/envelope.ts'
import { inGamut, type GamutId } from './color/gamut.ts'
import { achromaticL, yFromOklch, type Oklch } from './color/space.ts'

export interface StepRequest {
  /** Relative luminance the step must reach. */
  yTarget: number
  /** Hue in degrees, or null for a neutral step. */
  hue: number | null
  /** Share of the hue's available chroma to use, 0..1. */
  fraction: number
  /** Optional absolute chroma cap, used to keep neutrals neutral. */
  ceiling?: number
  gamut: GamutId
}

/**
 * Solve a single step.
 *
 * The returned colour hits `yTarget` to within float precision and is
 * displayable in `gamut`.
 */
export function solveStep(request: StepRequest): Oklch {
  const { yTarget, hue, fraction, ceiling, gamut } = request

  const y = Math.min(1, Math.max(0, yTarget))

  // A neutral step has a closed form. Every row of the OKLab matrices sums to
  // one, so an achromatic colour's lightness is exactly the cube root of its
  // luminance — no search needed.
  if (hue === null || fraction <= 0 || ceiling === 0) {
    return { l: achromaticL(y), c: 0, h: 0 }
  }

  if (y <= 0) return { l: 0, c: 0, h: hue }
  if (y >= 1) return { l: 1, c: 0, h: hue }

  const envelope = getEnvelope(hue, gamut)
  const chromaAt = (l: number) => {
    const c = fraction * cMaxAt(l, envelope)
    return ceiling === undefined ? c : Math.min(c, ceiling)
  }

  const solved = bisectLightness(y, hue, chromaAt)

  // The sampled envelope errs low, so this is a rare backstop rather than the
  // normal path. When it does fire, re-solve against the exact boundary so the
  // luminance target survives the correction.
  if (inGamut(solved, gamut)) return solved

  const exactChromaAt = (l: number) => Math.min(chromaAt(l), cMaxExact(l, hue, gamut))
  return bisectLightness(y, hue, exactChromaAt)
}

/**
 * Find the lightness at which the chroma rule produces the target luminance.
 *
 * The bracket needs no validation: at lightness 0 the colour is black
 * (luminance 0) and at lightness 1 the envelope has collapsed to zero chroma,
 * leaving white (luminance 1). Any target in between is therefore reachable.
 */
function bisectLightness(
  yTarget: number,
  hue: number,
  chromaAt: (l: number) => number,
): Oklch {
  let lo = 0
  let hi = 1

  for (let i = 0; i < SOLVE_L_ITERATIONS; i++) {
    const mid = (lo + hi) / 2
    if (yFromOklch({ l: mid, c: chromaAt(mid), h: hue }) < yTarget) {
      lo = mid
    } else {
      hi = mid
    }
  }

  const l = (lo + hi) / 2
  return { l, c: chromaAt(l), h: hue }
}

/**
 * The fraction of its hue's available chroma that a colour is using.
 *
 * The inverse of the rule above, used to read a seed's character off it so an
 * `exact` ramp can be rebuilt around the seed's own colourfulness. Values above
 * 1 are possible where the sampled envelope errs low, and are left unclamped so
 * the seed's chroma is reproduced faithfully.
 */
export function chromaFractionOf(lch: Oklch, gamut: GamutId): number {
  if (lch.c <= 0) return 0
  const available = cMaxAt(lch.l, getEnvelope(lch.h, gamut))
  if (available <= 1e-9) return 0
  return lch.c / available
}

/** Expose the cached envelope for a hue, for callers that need its shape. */
export function envelopeFor(hue: number, gamut: GamutId): Envelope {
  return getEnvelope(hue, gamut)
}
