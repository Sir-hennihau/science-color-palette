/**
 * Chroma along a ramp, expressed as a *fraction of the available envelope*
 * rather than as an absolute number.
 *
 * This is the single decision that makes one set of curves work for every hue.
 * A ramp that held chroma constant would ask for colours that do not exist —
 * there is no dark vivid yellow — and one that scaled chroma with lightness
 * would leave blues washed out. Asking instead for "80% of whatever this hue
 * can manage at this lightness" yields a yellow ramp that peaks light, a blue
 * ramp that peaks dark, and a consistent sense of colourfulness across both.
 *
 * The curve rises from a modest fraction at the light end to a peak mid-ramp
 * and eases off toward the dark end, which is the shape hand-tuned palettes
 * converge on.
 */

import { monotoneCubic, type Curve, type Point } from './pchip.ts'
import type { ChromaConfig, ChromaPreset } from '../types.ts'

export interface ChromaPoints {
  light: number
  peak: number
  dark: number
}

export const CHROMA_PRESETS: Record<Exclude<ChromaPreset, 'custom'>, ChromaPoints> = {
  vivid: { light: 0.6, peak: 0.95, dark: 0.7 },
  natural: { light: 0.45, peak: 0.8, dark: 0.55 },
  muted: { light: 0.3, peak: 0.5, dark: 0.35 },
}

export const DEFAULT_CHROMA_PRESET: ChromaPreset = 'natural'

/** Resolve a chroma config into its three control fractions. */
export function resolveChromaPoints(cfg: ChromaConfig | undefined): ChromaPoints {
  const preset = cfg?.preset ?? DEFAULT_CHROMA_PRESET

  if (preset === 'custom') {
    const base = CHROMA_PRESETS.natural
    return {
      light: clampFraction(cfg?.light ?? base.light),
      peak: clampFraction(cfg?.peak ?? base.peak),
      dark: clampFraction(cfg?.dark ?? base.dark),
    }
  }

  return { ...CHROMA_PRESETS[preset] }
}

function clampFraction(v: number): number {
  if (!Number.isFinite(v)) return 0
  return Math.min(1, Math.max(0, v))
}

/** Build the fraction-of-envelope curve for a ramp. */
export function chromaCurve(points: ChromaPoints): Curve {
  return monotoneCubic([
    { x: 0, y: points.light },
    { x: 0.5, y: points.peak },
    { x: 1, y: points.dark },
  ])
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

  // A seed with no chroma cannot be reached by scaling; fall back to an
  // additive-free flat curve so the ramp stays neutral rather than blowing up.
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
