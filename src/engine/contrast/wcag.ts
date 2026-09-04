/**
 * WCAG 2.x contrast.
 *
 * This is the ruler with legal force (ADA, EAA, EN 301 549 all reference WCAG
 * 2.x), and the reason the whole ladder is anchored on relative luminance: the
 * ratio depends on nothing else, so pinning a step's luminance pins its
 * contrast against any fixed background exactly.
 */

import { yFromHex } from '../color/space.ts'

/** Contrast ratio between two relative luminances, in [1, 21]. */
export function wcagRatioFromY(a: number, b: number): number {
  const hi = Math.max(a, b)
  const lo = Math.min(a, b)
  return (hi + 0.05) / (lo + 0.05)
}

/** Contrast ratio between two hex colours. */
export function wcagContrastHex(a: string, b: string): number {
  return wcagRatioFromY(yFromHex(a), yFromHex(b))
}

/**
 * Luminance a colour must have to reach `ratio` against white.
 *
 * Inverts `(1 + 0.05) / (Y + 0.05) = ratio`. The canonical targets fall out as
 * 3:1 -> 0.3, 4.5:1 -> 0.18333, 7:1 -> 0.1.
 */
export function yForRatioOnWhite(ratio: number): number {
  return 1.05 / ratio - 0.05
}

/** Luminance a colour must have to reach `ratio` against black. */
export function yForRatioOnBlack(ratio: number): number {
  return ratio * 0.05 - 0.05
}

/** The WCAG 2.x thresholds a swatch pair can be judged against. */
export const WCAG_THRESHOLDS = {
  /** Large text (>=24px, or >=18.7px bold) and UI components / graphics. */
  aaLarge: 3,
  /** Body text at AA, and large text at AAA. */
  aa: 4.5,
  /** Body text at AAA. */
  aaa: 7,
} as const

export type WcagLevel = keyof typeof WCAG_THRESHOLDS
