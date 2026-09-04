/**
 * Colour-space primitives.
 *
 * All conversions are implemented directly on numbers rather than routed
 * through a library: the solver evaluates these thousands of times per
 * generation, the contrast contracts depend on bit-exact reproducibility, and
 * keeping our own implementation lets culori act as an independent oracle in
 * tests instead of being both the implementation and its own check.
 *
 * Parsing arbitrary CSS colour strings is the one job delegated to culori.
 */

import {
  useMode,
  modeRgb,
  modeHsl,
  modeHsv,
  modeHwb,
  modeLab,
  modeLch,
  modeOklab,
  modeOklch,
  modeP3,
  parse as culoriParse,
} from 'culori/fn'

import { ACHROMATIC_C } from '../constants.ts'

// ---------------------------------------------------------------------------
// Representations
// ---------------------------------------------------------------------------

/** Non-linear sRGB, channels 0..1. */
export interface Rgb {
  r: number
  g: number
  b: number
}

/** Linear-light sRGB, channels 0..1 (may fall outside when out of gamut). */
export interface LinRgb {
  r: number
  g: number
  b: number
}

export interface Oklab {
  L: number
  a: number
  b: number
}

/** OKLCH. `h` is degrees in [0, 360); it is meaningless when `c` is ~0. */
export interface Oklch {
  l: number
  c: number
  h: number
}

// ---------------------------------------------------------------------------
// sRGB transfer function
// ---------------------------------------------------------------------------

/** sRGB electro-optical transfer function (gamma-encoded -> linear light). */
export function srgbToLinear(v: number): number {
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
}

/** Inverse transfer function (linear light -> gamma-encoded). */
export function linearToSrgb(v: number): number {
  return v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055
}

/**
 * Relative luminance coefficients. These are the values WCAG 2.x specifies, and
 * they are used for both the solver target and the reported metric so the two
 * can never disagree by more than 8-bit quantisation.
 *
 * WCAG's text uses a 0.03928 breakpoint where the sRGB spec uses 0.04045; the
 * two differ only for inputs strictly between them, which no 8-bit channel
 * value can produce, so `srgbToLinear` above is equivalent for our inputs.
 */
const YR = 0.2126
const YG = 0.7152
const YB = 0.0722

/** Relative luminance of a linear-light RGB triple. */
export function yFromLinear(lin: LinRgb): number {
  return YR * lin.r + YG * lin.g + YB * lin.b
}

/** Relative luminance of a gamma-encoded sRGB triple. */
export function yFromRgb(rgb: Rgb): number {
  return (
    YR * srgbToLinear(rgb.r) +
    YG * srgbToLinear(rgb.g) +
    YB * srgbToLinear(rgb.b)
  )
}

// ---------------------------------------------------------------------------
// OKLab <-> linear sRGB (Ottosson 2020)
// ---------------------------------------------------------------------------

export function linearToOklab(lin: LinRgb): Oklab {
  const l = 0.4122214708 * lin.r + 0.5363325363 * lin.g + 0.0514459929 * lin.b
  const m = 0.2119034982 * lin.r + 0.6806995451 * lin.g + 0.1073969566 * lin.b
  const s = 0.0883024619 * lin.r + 0.2817188376 * lin.g + 0.6299787005 * lin.b

  const l_ = Math.cbrt(l)
  const m_ = Math.cbrt(m)
  const s_ = Math.cbrt(s)

  return {
    L: 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  }
}

export function oklabToLinear(lab: Oklab): LinRgb {
  const l_ = lab.L + 0.3963377774 * lab.a + 0.2158037573 * lab.b
  const m_ = lab.L - 0.1055613458 * lab.a - 0.0638541728 * lab.b
  const s_ = lab.L - 0.0894841775 * lab.a - 1.291485548 * lab.b

  const l = l_ * l_ * l_
  const m = m_ * m_ * m_
  const s = s_ * s_ * s_

  return {
    r: 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    b: -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  }
}

// ---------------------------------------------------------------------------
// OKLCH <-> OKLab
// ---------------------------------------------------------------------------

const DEG = 180 / Math.PI

export function oklabToOklch(lab: Oklab): Oklch {
  const c = Math.sqrt(lab.a * lab.a + lab.b * lab.b)
  if (c < 1e-9) return { l: lab.L, c: 0, h: 0 }
  return { l: lab.L, c, h: normalizeHue(Math.atan2(lab.b, lab.a) * DEG) }
}

export function oklchToOklab(lch: Oklch): Oklab {
  const rad = (lch.h * Math.PI) / 180
  return { L: lch.l, a: lch.c * Math.cos(rad), b: lch.c * Math.sin(rad) }
}

// ---------------------------------------------------------------------------
// Composed conversions (hot paths keep the intermediate objects minimal)
// ---------------------------------------------------------------------------

export function oklchToLinear(lch: Oklch): LinRgb {
  return oklabToLinear(oklchToOklab(lch))
}

export function oklchToRgb(lch: Oklch): Rgb {
  const lin = oklchToLinear(lch)
  return {
    r: linearToSrgb(lin.r),
    g: linearToSrgb(lin.g),
    b: linearToSrgb(lin.b),
  }
}

export function rgbToOklch(rgb: Rgb): Oklch {
  return oklabToOklch(
    linearToOklab({
      r: srgbToLinear(rgb.r),
      g: srgbToLinear(rgb.g),
      b: srgbToLinear(rgb.b),
    }),
  )
}

/**
 * Relative luminance of an OKLCH colour, evaluated without leaving linear
 * light. This is the solver's objective function.
 */
export function yFromOklch(lch: Oklch): number {
  return yFromLinear(oklchToLinear(lch))
}

/** Lightness of the achromatic colour with the given luminance. */
export function achromaticL(y: number): number {
  return Math.cbrt(Math.max(0, y))
}

// ---------------------------------------------------------------------------
// CIELAB lightness <-> relative luminance
// ---------------------------------------------------------------------------

const LSTAR_EPSILON = 216 / 24389 // (6/29)^3
const LSTAR_KAPPA = 24389 / 27 // (29/3)^3

/** CIELAB L* from relative luminance (D65, Yn = 1). */
export function lstarFromY(y: number): number {
  const t = Math.max(0, y)
  return t <= LSTAR_EPSILON ? LSTAR_KAPPA * t : 116 * Math.cbrt(t) - 16
}

/** Relative luminance from CIELAB L*. Inverse of {@link lstarFromY}. */
export function yFromLstar(lstar: number): number {
  if (lstar <= 8) return lstar / LSTAR_KAPPA
  const f = (lstar + 16) / 116
  return f * f * f
}

// ---------------------------------------------------------------------------
// 8-bit quantisation and hex
// ---------------------------------------------------------------------------

export interface Rgb8 {
  r: number
  g: number
  b: number
}

/** Round a 0..1 sRGB triple to 8-bit integers, clamping to [0, 255]. */
export function quantize(rgb: Rgb): Rgb8 {
  return {
    r: clamp255(Math.round(rgb.r * 255)),
    g: clamp255(Math.round(rgb.g * 255)),
    b: clamp255(Math.round(rgb.b * 255)),
  }
}

function clamp255(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v
}

export function rgb8ToHex(c: Rgb8): string {
  return `#${hexByte(c.r)}${hexByte(c.g)}${hexByte(c.b)}`
}

function hexByte(v: number): string {
  return v.toString(16).padStart(2, '0')
}

export function hexToRgb8(hex: string): Rgb8 {
  const h = hex.slice(1)
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  }
}

export function rgb8ToRgb(c: Rgb8): Rgb {
  return { r: c.r / 255, g: c.g / 255, b: c.b / 255 }
}

/** Relative luminance of a hex colour, computed on the shipped 8-bit values. */
export function yFromHex(hex: string): number {
  return yFromRgb(rgb8ToRgb(hexToRgb8(hex)))
}

export function oklchFromHex(hex: string): Oklch {
  return rgbToOklch(rgb8ToRgb(hexToRgb8(hex)))
}

// ---------------------------------------------------------------------------
// Hue helpers
// ---------------------------------------------------------------------------

/** Wrap a hue angle into [0, 360). */
export function normalizeHue(h: number): number {
  const wrapped = h % 360
  return wrapped < 0 ? wrapped + 360 : wrapped
}

/** Signed shortest-arc difference `to - from`, in (-180, 180]. */
export function hueDelta(from: number, to: number): number {
  let d = normalizeHue(to) - normalizeHue(from)
  if (d > 180) d -= 360
  if (d <= -180) d += 360
  return d
}

/** Unsigned shortest-arc distance between two hues, in [0, 180]. */
export function hueDistance(a: number, b: number): number {
  return Math.abs(hueDelta(a, b))
}

/** Circular mean of two hues along the shorter arc. */
export function hueMidpoint(a: number, b: number): number {
  return normalizeHue(a + hueDelta(a, b) / 2)
}

// ---------------------------------------------------------------------------
// Colour difference
// ---------------------------------------------------------------------------

/** Euclidean distance in OKLab, the `deltaEOK` used by CSS Color 4. */
export function deltaEOK(a: Oklch, b: Oklch): number {
  const la = oklchToOklab(a)
  const lb = oklchToOklab(b)
  const dL = la.L - lb.L
  const da = la.a - lb.a
  const db = la.b - lb.b
  return Math.sqrt(dL * dL + da * da + db * db)
}

// ---------------------------------------------------------------------------
// Parsing user input
// ---------------------------------------------------------------------------

const toCuloriRgb = useMode(modeRgb)
useMode(modeHsl)
useMode(modeHsv)
useMode(modeHwb)
useMode(modeLab)
useMode(modeLch)
useMode(modeOklab)
useMode(modeOklch)
useMode(modeP3)

export interface ParsedColor {
  /** The input reduced to an 8-bit sRGB hex string. */
  hex: string
  /** True when the input was outside sRGB and had to be clipped to fit. */
  clipped: boolean
}

/**
 * Parse any CSS colour string into an 8-bit sRGB hex.
 *
 * Out-of-sRGB inputs (wide-gamut `color()`, extreme `oklch()`) are reported via
 * `clipped` so callers can surface that the seed was not representable. The
 * clip here is a plain channel clamp; perceptual gamut mapping happens later,
 * in the ramp pipeline, where a hue-preserving result matters.
 */
export function parseColor(input: string): ParsedColor | null {
  const parsed = culoriParse(input.trim())
  if (!parsed) return null

  const rgb = toCuloriRgb(parsed)
  if (!rgb) return null

  const r = rgb.r ?? 0
  const g = rgb.g ?? 0
  const b = rgb.b ?? 0
  const clipped =
    r < -1e-6 || r > 1 + 1e-6 || g < -1e-6 || g > 1 + 1e-6 || b < -1e-6 || b > 1 + 1e-6

  return {
    hex: rgb8ToHex(
      quantize({
        r: Math.min(1, Math.max(0, r)),
        g: Math.min(1, Math.max(0, g)),
        b: Math.min(1, Math.max(0, b)),
      }),
    ),
    clipped,
  }
}

/** True when a colour's chroma is low enough that its hue carries no meaning. */
export function isAchromatic(lch: Oklch): boolean {
  return lch.c < ACHROMATIC_C
}
