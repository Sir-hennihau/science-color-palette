/**
 * Hue along a ramp.
 *
 * OKLCH is hue-stable enough that holding one number constant produces a ramp
 * that reads as a single colour family from top to bottom — which is the whole
 * reason to work in it rather than CIELAB, where deep blues visibly swing
 * toward purple as lightness drops.
 *
 * A small deliberate drift is still offered: hand-tuned palettes often warm
 * their light shades and cool their dark ones slightly, and it is a useful
 * escape hatch for the residual non-uniformity OKLab does have at high chroma
 * in the blue region.
 */

import { normalizeHue } from '../color/space.ts'

export interface HueCurve {
  at(t: number): number
  readonly base: number
  readonly driftPerRamp: number
  readonly tRef: number
}

/**
 * Build a hue curve.
 *
 * `driftPerRamp` is the total rotation in degrees across the full ramp, applied
 * around `tRef` so that the hue is exactly `base` at that position. Anchoring
 * the drift matters for `exact` mode, where `tRef` is the seed's own step and
 * the seed's hue must survive untouched.
 */
export function hueCurve(base: number, driftPerRamp: number, tRef = 0.5): HueCurve {
  return {
    at: (t: number) => normalizeHue(base + driftPerRamp * (t - tRef)),
    base,
    driftPerRamp,
    tRef,
  }
}

export const MAX_HUE_DRIFT = 30

/** Clamp a requested drift into the supported range. */
export function clampHueDrift(drift: number | undefined): number {
  if (drift === undefined || !Number.isFinite(drift)) return 0
  return Math.min(MAX_HUE_DRIFT, Math.max(-MAX_HUE_DRIFT, drift))
}
