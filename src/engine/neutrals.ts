/**
 * The neutral ramp.
 *
 * Greys are where most palettes quietly fall apart. A pure grey next to a
 * saturated brand colour reads as dead, so good systems tint their neutrals
 * very slightly toward the primary hue — enough that the greys feel related,
 * far too little to read as coloured.
 *
 * The tint is an *absolute* chroma cap rather than a share of the envelope.
 * That is the opposite of how the colour ramps work, and deliberately so: a
 * fraction of the available chroma would make neutrals near a high-chroma hue
 * noticeably colourful and neutrals near a weak hue invisible. A fixed ceiling
 * gives the same restraint at every hue. The envelope still applies where it
 * has to — at the very ends of the ramp there is barely any chroma to be had,
 * so the tint tapers out on its own.
 */

import { chromaCurve, constantCeiling } from './curves/chroma.ts'
import { hueCurve } from './curves/hue.ts'
import { generateRamp, type RampSpec } from './ramp.ts'
import type { Ramp, ResolvedConfig } from './types.ts'

/**
 * Chroma ceiling at full tint strength.
 *
 * Comparable to the chroma Material gives its neutral palettes, and about the
 * point where a grey starts to read as "warm" or "cool" rather than as a
 * colour in its own right.
 */
export const NEUTRAL_MAX_CHROMA = 0.028

/** Generate the neutral ramp, tinted toward `primaryHue` if there is one. */
export function generateNeutralRamp(
  resolved: ResolvedConfig,
  primaryHue: number | null,
): Ramp {
  const tint = resolved.neutrals.tintStrength
  const hue = tint > 0 ? primaryHue : null

  const spec: RampSpec = {
    role: 'neutral',
    name: 'neutral',
    hue,
    ladder: resolved.ladder,
    // The ceiling does the work; the curve just shapes the taper. Asking for a
    // generous share keeps the ceiling in charge everywhere except the extremes.
    fraction: chromaCurve({ light: 0.9, peak: 0.9, dark: 0.9, ceilingScale: 1 }),
    hueCurve: hue === null ? null : hueCurve(hue, 0, 0.5),
    ceiling: constantCeiling(hue === null ? 0 : NEUTRAL_MAX_CHROMA * tint),
    usesSharedLadder: true,
    gamut: resolved.gamut,
    warnings: [],
  }

  return generateRamp(spec)
}
