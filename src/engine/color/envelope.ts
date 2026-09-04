/**
 * The per-hue chroma envelope — the reason a palette cannot be built by
 * scaling numbers linearly.
 *
 * For a fixed hue, the displayable colours form a roughly triangular slice in
 * the (lightness, chroma) plane whose apex is the *cusp*: the most colourful
 * version of that hue. The cusp sits at high lightness for yellow (there is no
 * dark vivid yellow) and at low lightness for blue (whose most vivid form is
 * dark). Expressing a ramp's chroma as a fraction of this envelope is what lets
 * one set of curves produce sensible results for every hue.
 *
 * Each hue's envelope is sampled once and cached. The solver then reads it by
 * interpolation, which is both far cheaper than re-deriving the boundary and
 * far more accurate than the classic cusp-triangle approximation.
 */

import {
  CMAX_ITERATIONS,
  CMAX_SCAN_ITERATIONS,
  CMAX_SEARCH_LIMIT,
  CUSP_HUE_QUANTUM,
  CUSP_REFINE_ITERATIONS,
  CUSP_SCAN_SAMPLES,
  ENVELOPE_CUSP_SAMPLES,
  ENVELOPE_SAMPLES,
} from '../constants.ts'
import type { GamutId } from './gamut.ts'
import { inGamut } from './gamut.ts'
import { normalizeHue } from './space.ts'

export interface Cusp {
  /** Lightness at which this hue reaches its maximum chroma. */
  readonly l: number
  /** That maximum chroma. */
  readonly c: number
  /** Slope of the lower envelope edge, `c / l`. */
  readonly s: number
  /** Slope of the upper envelope edge, `c / (1 - l)`. */
  readonly t: number
  /** The quantised hue this cusp was computed at. */
  readonly hue: number
}

export interface Envelope {
  readonly hue: number
  readonly gamut: GamutId
  readonly cusp: Cusp
  /** Sample lightnesses, ascending, including the cusp's own lightness. */
  readonly sampleL: readonly number[]
  /** Maximum chroma at each sample lightness. */
  readonly sampleC: readonly number[]
  /**
   * `bucket[k]` is the sample interval containing lightness `k / ENVELOPE_SAMPLES`.
   *
   * The samples are not evenly spaced — the cusp and the run above it are
   * inserted — so arithmetic alone cannot locate the right interval. This turns
   * the lookup back into a table read plus a step or two, which matters because
   * the solver reads the envelope forty times per step per ramp.
   */
  readonly bucket: readonly number[]
}

/**
 * Largest in-gamut chroma at an exact (lightness, hue), by bisection.
 *
 * Returns the *first* boundary crossing walking outward from the achromatic
 * axis, which guarantees every chroma below the result is displayable.
 *
 * That distinction matters in the blue region. A constant-hue line is straight
 * in OKLab, but the sRGB boundary is curved, so the ray can leave the gamut and
 * re-enter right at a cube vertex: at pure blue's lightness the red channel
 * dips to about -0.0002 just past chroma 0.266 before the ray touches the
 * vertex again at 0.313. The conservative answer is the useful one here — it is
 * the most colourful blue a ramp can actually pass through — so this is
 * deliberate, not an off-by-one to be "fixed".
 *
 * `iterations` trades precision for speed; the coarse cusp scan uses fewer
 * steps than the final refinement.
 */
export function cMaxExact(
  l: number,
  h: number,
  gamut: GamutId,
  iterations: number = CMAX_ITERATIONS,
): number {
  if (l <= 0 || l >= 1) return 0

  let lo = 0
  let hi = CMAX_SEARCH_LIMIT

  if (inGamut({ l, c: hi, h }, gamut)) return hi

  for (let i = 0; i < iterations; i++) {
    const mid = (lo + hi) / 2
    if (inGamut({ l, c: mid, h }, gamut)) {
      lo = mid
    } else {
      hi = mid
    }
  }

  return lo
}

const GOLDEN = (Math.sqrt(5) - 1) / 2

const cache = new Map<string, Envelope>()

/**
 * Sample and cache a hue's envelope.
 *
 * A coarse scan brackets the cusp before golden-section refinement, so the
 * result does not depend on the envelope being perfectly unimodal — it is very
 * nearly so in practice, but the scan removes the assumption.
 *
 * Results are cached per (gamut, hue). The hue is quantised *before* any search
 * runs, so a cache hit and a cache miss are guaranteed to produce the same
 * numbers and caching can never perturb generated output.
 */
export function getEnvelope(h: number, gamut: GamutId): Envelope {
  const hue = quantizeHue(h)
  const key = `${gamut}|${hue}`

  const hit = cache.get(key)
  if (hit) return hit

  const cusp = searchCusp(hue, gamut)

  // A uniform grid, plus the cusp itself, plus a denser run from the cusp to
  // white. Including the cusp matters: it is the one point where the envelope
  // has a kink, and interpolating across a kink is what would otherwise cost
  // accuracy. The denser run matters for the opposite reason — above the cusp
  // the boundary is smooth but steeply convex, which is where a chord between
  // grid points strays *outside* the gamut rather than inside it.
  const raw: number[] = []
  for (let i = 0; i <= ENVELOPE_SAMPLES; i++) {
    raw.push(i / ENVELOPE_SAMPLES)
  }
  if (cusp.l > 0 && cusp.l < 1) {
    raw.push(cusp.l)
    for (let k = 1; k < ENVELOPE_CUSP_SAMPLES; k++) {
      raw.push(cusp.l + (k * (1 - cusp.l)) / ENVELOPE_CUSP_SAMPLES)
    }
  }
  raw.sort((a, b) => a - b)

  // Distinct lightnesses only: an inserted sample can land on a grid point, and
  // a zero-width interval would make interpolation meaningless.
  const sampleL: number[] = []
  for (const l of raw) {
    if (sampleL.length === 0 || l - sampleL[sampleL.length - 1] > 1e-9) sampleL.push(l)
  }

  const sampleC = sampleL.map((l) =>
    Math.abs(l - cusp.l) < 1e-12 ? cusp.c : cMaxExact(l, hue, gamut),
  )

  const bucket: number[] = []
  for (let k = 0, i = 0; k <= ENVELOPE_SAMPLES; k++) {
    const l = k / ENVELOPE_SAMPLES
    while (i < sampleL.length - 2 && sampleL[i + 1] <= l) i++
    bucket.push(i)
  }

  const envelope: Envelope = { hue, gamut, cusp, sampleL, sampleC, bucket }
  cache.set(key, envelope)
  return envelope
}

function searchCusp(hue: number, gamut: GamutId): Cusp {
  let bestIndex = 0
  let bestC = -1
  for (let i = 0; i < CUSP_SCAN_SAMPLES; i++) {
    const l = i / (CUSP_SCAN_SAMPLES - 1)
    const c = cMaxExact(l, hue, gamut, CMAX_SCAN_ITERATIONS)
    if (c > bestC) {
      bestC = c
      bestIndex = i
    }
  }

  const step = 1 / (CUSP_SCAN_SAMPLES - 1)
  let lo = Math.max(0, (bestIndex - 1) * step)
  let hi = Math.min(1, (bestIndex + 1) * step)

  let x1 = hi - GOLDEN * (hi - lo)
  let x2 = lo + GOLDEN * (hi - lo)
  let f1 = cMaxExact(x1, hue, gamut)
  let f2 = cMaxExact(x2, hue, gamut)

  for (let i = 0; i < CUSP_REFINE_ITERATIONS; i++) {
    if (f1 > f2) {
      hi = x2
      x2 = x1
      f2 = f1
      x1 = hi - GOLDEN * (hi - lo)
      f1 = cMaxExact(x1, hue, gamut)
    } else {
      lo = x1
      x1 = x2
      f1 = f2
      x2 = lo + GOLDEN * (hi - lo)
      f2 = cMaxExact(x2, hue, gamut)
    }
  }

  const l = (lo + hi) / 2
  const c = cMaxExact(l, hue, gamut)

  return { l, c, s: l > 0 ? c / l : 0, t: l < 1 ? c / (1 - l) : 0, hue }
}

/** Locate a hue's cusp. */
export function findCusp(h: number, gamut: GamutId): Cusp {
  return getEnvelope(h, gamut).cusp
}

function quantizeHue(h: number): number {
  const normalized = normalizeHue(h)
  const quantized = Math.round(normalized / CUSP_HUE_QUANTUM) * CUSP_HUE_QUANTUM
  // Rounding can land exactly on 360; fold it back to the canonical 0.
  return normalizeHue(Number(quantized.toFixed(2)))
}

/**
 * Maximum chroma at `l`, read off the sampled envelope.
 *
 * Below the cusp the boundary is concave — scaling linear RGB by `k` scales
 * OKLab by the cube root of `k`, so the gamut is a cone from black and
 * `cMax(l)/l` can only fall as `l` rises. A chord therefore sits *below* the
 * true surface, and interpolation errs toward colours that are certainly
 * displayable.
 *
 * Above the cusp that reverses: the boundary is convex there, so a chord sits
 * above it. {@link ENVELOPE_CUSP_SAMPLES} is what keeps that overshoot small
 * enough to be irrelevant. The solver still checks gamut membership and falls
 * back to the exact boundary, and the pipeline maps to gamut after that, so
 * neither error can reach the output — but the sampling is what stops those
 * backstops from ever having to fire.
 */
export function cMaxAt(l: number, envelope: Envelope): number {
  if (l <= 0 || l >= 1) return 0

  const { sampleL, sampleC, bucket } = envelope
  const n = sampleL.length

  // The bucket table lands on the interval holding the grid point at or below
  // `l`; anything inserted between there and `l` is a step or two away.
  let i = bucket[Math.min(ENVELOPE_SAMPLES, Math.max(0, Math.floor(l * ENVELOPE_SAMPLES)))]
  while (i < n - 2 && sampleL[i + 1] < l) i++

  const span = sampleL[i + 1] - sampleL[i]
  if (span <= 0) return sampleC[i]

  const f = (l - sampleL[i]) / span
  return sampleC[i] + f * (sampleC[i + 1] - sampleC[i])
}

/**
 * Ottosson's cusp-triangle approximation of the envelope.
 *
 * Retained because it is the cheapest possible sketch of a hue's limits and is
 * what the science view draws, but deliberately *not* what the solver uses: its
 * straight edges misjudge the curved boundary by up to about 0.03 chroma, which
 * is enough to push a vivid step out of gamut.
 */
export function cMaxTriangle(l: number, cusp: Cusp): number {
  if (l <= 0 || l >= 1) return 0
  const lower = cusp.s * l
  const upper = cusp.t * (1 - l)
  return lower < upper ? lower : upper
}

/** Clear the envelope cache. Test-only; production never needs to invalidate. */
export function clearEnvelopeCache(): void {
  cache.clear()
}
