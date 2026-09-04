/**
 * Hue along a ramp.
 *
 * OKLCH is hue-stable enough that holding one number constant produces a ramp
 * that reads as a single colour family from top to bottom — which is the whole
 * reason to work in it rather than CIELAB, where deep blues visibly swing
 * toward purple as lightness drops.
 *
 * Measured rather than assumed. Building the same indigo family on the same
 * luminance ladder, once holding OKLCH hue and once holding CIELCH hue, the
 * CIELCH version drifts 22.5 degrees of Jzazbz hue against our 2.7 (and 14.0
 * degrees of CAM16 hue against our 12.9) — its dark end visibly turns bluer.
 * Across ten hues the same comparison puts OKLab's worst case at 1.9 degrees of
 * Jzazbz hue, against CIELAB's 21.3 and HSLuv's 9.8. CAM16 and Jzazbz disagree
 * about the blue-violet region and neither is decisive there, so the
 * oracle-independent check is the useful one: measured this way our ramps hold
 * their hue better than the hand-tuned reference palettes do — indigo 12.9
 * degrees of CAM16 hue against Tailwind indigo's 15.1, sky 6.8 against
 * Tailwind blue's 24.0, yellow 3.3 against Tailwind yellow's 52.1.
 *
 * Two cautions when repeating that measurement. Hue angle is meaningless at low
 * chroma, so the lightest shades have to be excluded — including them roughly
 * doubles every number through quantisation noise alone. And a space can only
 * be judged by an oracle from a different family; OKLab and Jzazbz are both
 * IPT-derived, so Jzazbz is predisposed to agree with it.
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

/**
 * Widest drift offered.
 *
 * Generous because hand-tuned palettes use more than intuition suggests: the
 * Tailwind yellow family rotates about 44 degrees from its lightest shade to
 * its darkest, which is what turns its dark shades brown rather than olive.
 */
export const MAX_HUE_DRIFT = 60

/** Clamp a requested drift into the supported range. */
export function clampHueDrift(drift: number | undefined): number {
  if (drift === undefined || !Number.isFinite(drift)) return 0
  return Math.min(MAX_HUE_DRIFT, Math.max(-MAX_HUE_DRIFT, drift))
}
