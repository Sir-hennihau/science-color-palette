/**
 * Gamut membership and gamut mapping.
 *
 * A gamut is described by the matrix taking linear sRGB to that display's
 * linear primaries, so every routine below (and the cusp search that builds on
 * it) is gamut-generic. v1 only *emits* sRGB, but the envelope math is already
 * parameterised, which is what makes a later Display-P3 mode a configuration
 * change rather than a rewrite.
 */

import { GAMUT_EPS, JND_EOK } from '../constants.ts'
import type { LinRgb, Oklch } from './space.ts'
import { deltaEOK, oklchToLinear, linearToSrgb, oklabToOklch, linearToOklab } from './space.ts'

export type GamutId = 'srgb' | 'display-p3'

type Matrix3 = readonly [
  readonly [number, number, number],
  readonly [number, number, number],
  readonly [number, number, number],
]

/**
 * Linear sRGB -> linear Display-P3 (both D65, so this is a pure primary
 * change with no chromatic adaptation).
 */
const SRGB_TO_P3: Matrix3 = [
  [0.8224621, 0.1775380, 0.0000000],
  [0.0331941, 0.9668058, 0.0000000],
  [0.0170827, 0.0723974, 0.9105199],
]

interface GamutDef {
  readonly id: GamutId
  /** `null` means the gamut *is* linear sRGB. */
  readonly fromLinearSrgb: Matrix3 | null
}

const GAMUTS: Record<GamutId, GamutDef> = {
  srgb: { id: 'srgb', fromLinearSrgb: null },
  'display-p3': { id: 'display-p3', fromLinearSrgb: SRGB_TO_P3 },
}

function applyMatrix(m: Matrix3, v: LinRgb): LinRgb {
  return {
    r: m[0][0] * v.r + m[0][1] * v.g + m[0][2] * v.b,
    g: m[1][0] * v.r + m[1][1] * v.g + m[1][2] * v.b,
    b: m[2][0] * v.r + m[2][1] * v.g + m[2][2] * v.b,
  }
}

/** Linear channel values of `lch` expressed in `gamut`'s primaries. */
export function linearInGamut(lch: Oklch, gamut: GamutId): LinRgb {
  const lin = oklchToLinear(lch)
  const def = GAMUTS[gamut]
  return def.fromLinearSrgb ? applyMatrix(def.fromLinearSrgb, lin) : lin
}

/**
 * Whether `lch` is displayable in `gamut`.
 *
 * The tolerance scales with the colour's own magnitude — see {@link GAMUT_EPS}
 * for why a fixed slack silently fails near black.
 */
export function inGamut(lch: Oklch, gamut: GamutId): boolean {
  const c = linearInGamut(lch, gamut)
  const eps = GAMUT_EPS * Math.max(Math.abs(c.r), Math.abs(c.g), Math.abs(c.b))
  return (
    c.r >= -eps &&
    c.r <= 1 + eps &&
    c.g >= -eps &&
    c.g <= 1 + eps &&
    c.b >= -eps &&
    c.b <= 1 + eps
  )
}

function clip01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

/** `lch` with each of `gamut`'s linear channels clipped into range. */
function clipToGamut(lch: Oklch, gamut: GamutId): Oklch {
  const lin = oklchToLinear(lch)
  const def = GAMUTS[gamut]

  if (!def.fromLinearSrgb) {
    return oklabToOklch(
      linearToOklab({ r: clip01(lin.r), g: clip01(lin.g), b: clip01(lin.b) }),
    )
  }

  // Clip in the destination primaries, then return to linear sRGB coordinates
  // so the result stays comparable in OKLab.
  const dest = applyMatrix(def.fromLinearSrgb, lin)
  const clipped = { r: clip01(dest.r), g: clip01(dest.g), b: clip01(dest.b) }
  const inv = invert(def.fromLinearSrgb)
  return oklabToOklch(linearToOklab(applyMatrix(inv, clipped)))
}

function invert(m: Matrix3): Matrix3 {
  const [[a, b, c], [d, e, f], [g, h, i]] = m
  const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g)
  return [
    [(e * i - f * h) / det, (c * h - b * i) / det, (b * f - c * e) / det],
    [(f * g - d * i) / det, (a * i - c * g) / det, (c * d - a * f) / det],
    [(d * h - e * g) / det, (b * g - a * h) / det, (a * e - b * d) / det],
  ]
}

const MAP_EPSILON = 0.0001

/**
 * CSS Color 4 gamut mapping: hold lightness and hue, binary-search chroma, and
 * accept a clipped candidate as soon as it is within one JND of the reduced
 * one. Implemented here rather than delegated because browsers do not run this
 * algorithm (they simply clip), so the tool has to be the one guaranteeing that
 * what it exports is displayable.
 */
export function mapToGamut(lch: Oklch, gamut: GamutId): Oklch {
  if (lch.l >= 1) return { l: 1, c: 0, h: lch.h }
  if (lch.l <= 0) return { l: 0, c: 0, h: lch.h }
  if (inGamut(lch, gamut)) return lch

  let start = 0
  let end = lch.c
  const candidate: Oklch = { l: lch.l, c: lch.c, h: lch.h }
  let clipped = clipToGamut(candidate, gamut)

  while (end - start > MAP_EPSILON) {
    candidate.c = (start + end) / 2
    clipped = clipToGamut(candidate, gamut)
    if (inGamut(candidate, gamut) || deltaEOK(candidate, clipped) <= JND_EOK) {
      start = candidate.c
    } else {
      end = candidate.c
    }
  }

  return inGamut(candidate, gamut) ? { ...candidate } : clipped
}

/** Gamma-encoded sRGB of `lch`, with channels clamped for display. */
export function oklchToDisplayRgb(lch: Oklch): { r: number; g: number; b: number } {
  const lin = oklchToLinear(lch)
  return {
    r: clip01(linearToSrgb(clip01(lin.r))),
    g: clip01(linearToSrgb(clip01(lin.g))),
    b: clip01(linearToSrgb(clip01(lin.b))),
  }
}
