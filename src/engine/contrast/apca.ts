/**
 * APCA — the Accessible Perceptual Contrast Algorithm (SAPC 0.0.98G-4g).
 *
 * WCAG 2.x is polarity-blind and notoriously overstates contrast for dark
 * pairs, so the tool reports both: WCAG for compliance, APCA for whether text
 * is actually readable. APCA is *not* a ratified standard — it was removed from
 * the WCAG 3 drafts and the algorithm there is still undetermined — which is
 * exactly why it supplements the WCAG numbers rather than replacing them.
 *
 * Implemented from the published constants (the reference package's licence is
 * bespoke and its releases are stale); the reference is used as a test oracle
 * instead, which also gives us an independent check we would not otherwise have.
 *
 * Note APCA defines its own luminance: a plain 2.4 power with slightly
 * different coefficients, deliberately unlike WCAG's piecewise curve. The two
 * must never be interchanged.
 */

import { hexToRgb8 } from '../color/space.ts'

const MAIN_TRC = 2.4
const S_RCO = 0.2126729
const S_GCO = 0.7151522
const S_BCO = 0.072175

const NORM_BG = 0.56
const NORM_TXT = 0.57
const REV_TXT = 0.62
const REV_BG = 0.65

const BLK_THRS = 0.022
const BLK_CLMP = 1.414
const SCALE_BOW = 1.14
const SCALE_WOB = 1.14
const LO_BOW_OFFSET = 0.027
const LO_WOB_OFFSET = 0.027
const DELTA_Y_MIN = 0.0005
const LO_CLIP = 0.1

/** APCA screen luminance of an 8-bit sRGB triple. */
export function apcaY(r: number, g: number, b: number): number {
  return (
    S_RCO * Math.pow(r / 255, MAIN_TRC) +
    S_GCO * Math.pow(g / 255, MAIN_TRC) +
    S_BCO * Math.pow(b / 255, MAIN_TRC)
  )
}

/** APCA screen luminance of a hex colour. */
export function apcaYFromHex(hex: string): number {
  const c = hexToRgb8(hex)
  return apcaY(c.r, c.g, c.b)
}

function softClampBlack(y: number): number {
  return y > BLK_THRS ? y : y + Math.pow(BLK_THRS - y, BLK_CLMP)
}

/**
 * Lightness contrast `Lc` of text on a background, from APCA luminances.
 *
 * The sign carries the polarity: positive for dark text on a light background,
 * negative for light text on dark. Magnitude runs to about 106.
 */
export function apcaLcFromY(textY: number, bgY: number): number {
  const txt = softClampBlack(textY)
  const bg = softClampBlack(bgY)

  if (Math.abs(bg - txt) < DELTA_Y_MIN) return 0

  if (bg > txt) {
    const sapc = (Math.pow(bg, NORM_BG) - Math.pow(txt, NORM_TXT)) * SCALE_BOW
    return sapc < LO_CLIP ? 0 : (sapc - LO_BOW_OFFSET) * 100
  }

  const sapc = (Math.pow(bg, REV_BG) - Math.pow(txt, REV_TXT)) * SCALE_WOB
  return sapc > -LO_CLIP ? 0 : (sapc + LO_WOB_OFFSET) * 100
}

/** Signed `Lc` for text drawn on a background, both as hex colours. */
export function apcaLc(text: string, bg: string): number {
  return apcaLcFromY(apcaYFromHex(text), apcaYFromHex(bg))
}

/**
 * The conventional APCA levels. Unlike WCAG's pass/fail, these describe what a
 * given contrast is usable *for*.
 */
export const APCA_THRESHOLDS = {
  /** Preferred for body text. */
  bodyPreferred: 90,
  /** Minimum for body text. */
  bodyMinimum: 75,
  /** Roughly the perceptual equivalent of WCAG 4.5:1; non-body text. */
  fluentText: 60,
  /** Roughly WCAG 3:1; large headlines (36px, or 24px bold). */
  largeText: 45,
  /** Absolute floor for any text, including placeholders. */
  anyText: 30,
  /** Floor for non-text elements; below this a shape is effectively invisible. */
  nonText: 15,
} as const

export type ApcaLevel = keyof typeof APCA_THRESHOLDS

/** Highest APCA level an absolute `Lc` satisfies, or `null` if below all of them. */
export function apcaLevelFor(lc: number): ApcaLevel | null {
  const abs = Math.abs(lc)
  if (abs >= APCA_THRESHOLDS.bodyPreferred) return 'bodyPreferred'
  if (abs >= APCA_THRESHOLDS.bodyMinimum) return 'bodyMinimum'
  if (abs >= APCA_THRESHOLDS.fluentText) return 'fluentText'
  if (abs >= APCA_THRESHOLDS.largeText) return 'largeText'
  if (abs >= APCA_THRESHOLDS.anyText) return 'anyText'
  if (abs >= APCA_THRESHOLDS.nonText) return 'nonText'
  return null
}
