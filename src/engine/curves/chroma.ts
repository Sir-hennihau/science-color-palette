/**
 * Chroma along a ramp.
 *
 * Two rules act together, because neither works alone.
 *
 * Through the middle and dark end, chroma is a *share of the available
 * envelope*. This is the decision that makes one set of curves work for every
 * hue: a ramp holding chroma constant would ask for colours that do not exist —
 * there is no dark vivid yellow — while asking for "90% of whatever this hue
 * can manage at this lightness" yields a yellow ramp that peaks light, a blue
 * ramp that peaks dark, and a consistent sense of colourfulness across both.
 *
 * Near white that rule breaks down, and measurably so. Just past a hue's cusp
 * the envelope falls away very steeply, so a barely perceptible difference in
 * lightness swings the available chroma several-fold: at L* 98 a yellow has
 * roughly 0.118 of chroma to play with, and at L* 98.6 only 0.034. A single
 * share cannot serve every hue there — matching a hand-tuned palette's lightest
 * yellow needs about 0.22 of the envelope, while its lightest blue needs all of
 * it. So the lightest steps are governed by an absolute chroma ceiling instead,
 * which is what gives curated palettes their consistently barely-tinted 50s.
 *
 * The numbers below are calibrated against the Tailwind default ramps, whose
 * chromatic families sit at 0.85 to 1.0 of the envelope for most of their
 * length — considerably bolder than intuition suggests.
 */

import { monotoneCubic, type Curve, type Point } from './pchip.ts'
import type { ChromaConfig, ChromaPreset } from '../types.ts'

export interface ChromaPoints {
  /** Share of the envelope at the light end. */
  light: number
  /** Share at mid-ramp. */
  peak: number
  /** Share at the dark end. */
  dark: number
  /** Multiplier on the light-end absolute chroma ceiling. */
  ceilingScale: number
}

export const CHROMA_PRESETS: Record<Exclude<ChromaPreset, 'custom'>, ChromaPoints> = {
  vivid: { light: 0.98, peak: 0.98, dark: 0.92, ceilingScale: 1.3 },
  natural: { light: 0.9, peak: 0.95, dark: 0.85, ceilingScale: 1 },
  muted: { light: 0.5, peak: 0.6, dark: 0.5, ceilingScale: 0.7 },
}

export const DEFAULT_CHROMA_PRESET: ChromaPreset = 'natural'

/**
 * Absolute chroma ceiling by ramp position, at `ceilingScale` 1.
 *
 * The *median* chroma each step reaches across the reference ramps, not the
 * widest. That distinction matters more than it sounds: taking the maximum lets
 * every hue reach the chroma of whichever hue happens to be most capable at
 * that lightness, which is no restraint at all. Measured against the references
 * hue by hue, it left teal and green two to three times too colourful in their
 * lightest shades while blue — whose envelope is modest up there anyway — came
 * out right.
 *
 * The two rules end up splitting the work cleanly. Blue never touches this
 * ceiling and is shaped entirely by its share of the envelope; teal and green
 * are held by the ceiling through the light half, where their envelope offers
 * far more chroma than a palette should take. Past mid-ramp the ceiling exceeds
 * anything sRGB can do and stops mattering.
 */
const CEILING_POINTS: readonly Point[] = [
  { x: 0, y: 0.016 },
  { x: 0.11, y: 0.05 },
  { x: 0.22, y: 0.09 },
  { x: 0.33, y: 0.128 },
  { x: 0.44, y: 0.16 },
  { x: 0.56, y: 0.195 },
  { x: 0.67, y: 0.23 },
  { x: 1, y: 0.4 },
]

/** Resolve a chroma config into its control values. */
export function resolveChromaPoints(cfg: ChromaConfig | undefined): ChromaPoints {
  const preset = cfg?.preset ?? DEFAULT_CHROMA_PRESET

  if (preset === 'custom') {
    const base = CHROMA_PRESETS.natural
    return {
      light: clampFraction(cfg?.light ?? base.light),
      peak: clampFraction(cfg?.peak ?? base.peak),
      dark: clampFraction(cfg?.dark ?? base.dark),
      ceilingScale: base.ceilingScale,
    }
  }

  return { ...CHROMA_PRESETS[preset] }
}

function clampFraction(v: number): number {
  if (!Number.isFinite(v)) return 0
  return Math.min(1, Math.max(0, v))
}

/** Build the share-of-envelope curve for a ramp. */
export function chromaCurve(points: ChromaPoints): Curve {
  return monotoneCubic([
    { x: 0, y: points.light },
    { x: 0.5, y: points.peak },
    { x: 1, y: points.dark },
  ])
}

/** Build the absolute chroma ceiling curve for a ramp. */
export function chromaCeilingCurve(points: ChromaPoints): Curve {
  return monotoneCubic(
    CEILING_POINTS.map((p) => ({ x: p.x, y: p.y * points.ceilingScale })),
  )
}

/** A ceiling that is the same everywhere, for ramps with a fixed chroma budget. */
export function constantCeiling(value: number): Curve {
  return monotoneCubic([{ x: 0, y: value }])
}

/**
 * Reshape a chroma curve so it passes through `fraction` at `t`.
 *
 * Used by `exact` mode: the seed's own colourfulness becomes the curve's value
 * at the seed's step, and the rest of the ramp scales smoothly toward the
 * preset's shape. The adjustment is multiplicative, which keeps every value
 * positive and preserves the preset's character instead of flattening it.
 */
export function warpChromaCurve(base: Curve, t: number, fraction: number): Curve {
  const at = base.at(t)

  // A seed with no chroma cannot be reached by scaling; fall back to a flat
  // curve so the ramp stays neutral rather than blowing up.
  if (at <= 1e-9) {
    return monotoneCubic([{ x: 0, y: fraction }])
  }

  const scale = fraction / at
  const points: Point[] = []
  if (t > 0) points.push({ x: 0, y: 1 })
  points.push({ x: t, y: scale })
  if (t < 1) points.push({ x: 1, y: 1 })

  const warp = monotoneCubic(points)

  return {
    at: (x: number) => Math.max(0, base.at(x) * warp.at(x)),
    points: base.points,
  }
}
