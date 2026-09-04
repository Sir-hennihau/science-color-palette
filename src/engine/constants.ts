/**
 * Every tolerance, iteration count and magic number the engine relies on.
 * Centralised so determinism and precision claims can be audited in one place.
 */

/**
 * Channel slack when testing gamut membership.
 *
 * Absorbs round-trip noise through the cube roots in the OKLab transform: pure
 * yellow, converted to OKLCH and back, lands at blue = -1.3e-7 despite being
 * exactly `#ffff00`. Still far tighter than anything that could matter — one
 * 8-bit code value is about 3e-4 in linear light even at the darkest end — so
 * this cannot admit a colour that would visibly clip.
 */
export const GAMUT_EPS = 1e-6

/** Bisection steps when solving OKLCH lightness for a luminance target. */
export const SOLVE_L_ITERATIONS = 40

/** Bisection steps when solving the exact max chroma at a given (L, hue). */
export const CMAX_ITERATIONS = 24

/** Cheaper chroma resolution used while coarsely scanning for the cusp. */
export const CMAX_SCAN_ITERATIONS = 14

/** Upper bound on chroma searches. No sRGB or P3 color exceeds this in OKLCH. */
export const CMAX_SEARCH_LIMIT = 0.5

/** Samples of L taken when bracketing a hue's cusp before refinement. */
export const CUSP_SCAN_SAMPLES = 33

/** Golden-section refinement steps applied inside the bracketed cusp interval. */
export const CUSP_REFINE_ITERATIONS = 26

/**
 * Uniform lightness samples taken per hue when caching the chroma envelope.
 * The solver interpolates these instead of re-deriving the gamut boundary.
 */
export const ENVELOPE_SAMPLES = 64

/** Hue quantum (degrees) for the cusp cache key. Cusps are computed at the
 *  quantised hue, so a cache hit can never change generated output. */
export const CUSP_HUE_QUANTUM = 0.01

/**
 * Luminance bias applied to contract anchors, in the direction that makes the
 * contrast requirement easier to satisfy. Absorbs 8-bit quantisation, which can
 * otherwise push an exactly-solved step a hair under its target ratio.
 */
export const MARGIN_Y = 0.002

/** Extra bias per retry when a quantised hex still misses its contract. */
export const GUARANTEE_NUDGE_Y = 0.0015

/** Retries allowed while nudging a step back inside its contract. */
export const GUARANTEE_NUDGE_ATTEMPTS = 3

/** Chroma below which a color is treated as achromatic (hue is meaningless). */
export const ACHROMATIC_C = 0.002

/** Preferred L* gap between adjacent ladder steps after a seed warp. */
export const LADDER_MIN_GAP = 0.5

/**
 * Smallest L* gap the ladder will ever fall back to. Pinning a seed to a slot
 * that cannot leave even this much room for the shades beyond it (black at the
 * lightest slot, say) is geometrically impossible, so the pin is moved instead
 * and the caller is told.
 */
export const LADDER_FEASIBLE_GAP = 0.1

/** L* displacement above which a warped ladder is reported as strained. */
export const LADDER_STRAIN_L = 2

/** deltaEOK above which a gamut-mapped swatch is flagged as having moved. */
export const GAMUT_MOVED_EOK = 1e-4

/** Fraction-of-envelope ceiling honoured when clamping near the gamut surface. */
export const SURFACE_FRACTION = 0.9

/** deltaEOK bands used to describe how far a seed moved. */
export const DELTA_BANDS = { none: 0.002, subtle: 0.02, noticeable: 0.06 } as const
