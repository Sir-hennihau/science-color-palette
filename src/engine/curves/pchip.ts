/**
 * Monotone piecewise cubic interpolation (Fritsch-Carlson / PCHIP, the scheme
 * MATLAB and SciPy ship).
 *
 * The lightness ladder needs a curve that passes exactly through a handful of
 * anchors and is *guaranteed* not to wiggle between them: any overshoot would
 * put two shade steps out of order and silently break the contrast guarantees
 * that depend on lightness decreasing monotonically. A plain cubic spline can
 * overshoot; this one provably cannot.
 *
 * The same primitive shapes the chroma and hue curves, where the anchors are
 * intentionally non-monotone (chroma rises to a peak and falls again). PCHIP
 * handles that too: it is monotone on every interval whose data is monotone,
 * and puts a smooth local extremum at the turning anchor.
 */

export interface Point {
  x: number
  y: number
}

export interface Curve {
  /** Evaluate the curve. Outside the anchor range the endpoints are held. */
  at(x: number): number
  readonly points: readonly Point[]
}

function sign(v: number): number {
  return v > 0 ? 1 : v < 0 ? -1 : 0
}

/**
 * Build a monotone cubic through `points`, which must be sorted by ascending
 * and distinct `x`.
 */
export function monotoneCubic(points: readonly Point[]): Curve {
  const pts = points.map((p) => ({ ...p }))
  const n = pts.length

  if (n === 0) throw new Error('monotoneCubic needs at least one point')

  if (n === 1) {
    const y = pts[0].y
    return { at: () => y, points: pts }
  }

  const h: number[] = []
  const s: number[] = []
  for (let i = 0; i < n - 1; i++) {
    const dx = pts[i + 1].x - pts[i].x
    if (dx <= 0) throw new Error('monotoneCubic needs strictly increasing x')
    h.push(dx)
    s.push((pts[i + 1].y - pts[i].y) / dx)
  }

  const d = new Array<number>(n).fill(0)

  if (n === 2) {
    d[0] = s[0]
    d[1] = s[0]
  } else {
    // Interior tangents: weighted harmonic mean of the neighbouring slopes,
    // forced to zero at a sign change so no extremum is invented.
    for (let i = 1; i < n - 1; i++) {
      if (s[i - 1] * s[i] <= 0) {
        d[i] = 0
      } else {
        const w1 = 2 * h[i] + h[i - 1]
        const w2 = h[i] + 2 * h[i - 1]
        d[i] = (w1 + w2) / (w1 / s[i - 1] + w2 / s[i])
      }
    }

    d[0] = endpointTangent(h[0], h[1], s[0], s[1])
    d[n - 1] = endpointTangent(h[n - 2], h[n - 3], s[n - 2], s[n - 3])
  }

  function at(x: number): number {
    if (x <= pts[0].x) return pts[0].y
    if (x >= pts[n - 1].x) return pts[n - 1].y

    // Anchor counts are tiny, so a linear scan beats binary-search overhead.
    let i = 0
    while (i < n - 2 && x > pts[i + 1].x) i++

    const t = (x - pts[i].x) / h[i]
    const t2 = t * t
    const t3 = t2 * t

    const h00 = 2 * t3 - 3 * t2 + 1
    const h10 = t3 - 2 * t2 + t
    const h01 = -2 * t3 + 3 * t2
    const h11 = t3 - t2

    return h00 * pts[i].y + h10 * h[i] * d[i] + h01 * pts[i + 1].y + h11 * h[i] * d[i + 1]
  }

  return { at, points: pts }
}

/**
 * One-sided three-point tangent for a curve end, clamped so the endpoint
 * segment cannot overshoot.
 */
function endpointTangent(hNear: number, hFar: number, sNear: number, sFar: number): number {
  let d = ((2 * hNear + hFar) * sNear - hNear * sFar) / (hNear + hFar)

  if (sign(d) !== sign(sNear)) {
    d = 0
  } else if (sign(sNear) !== sign(sFar) && Math.abs(d) > Math.abs(3 * sNear)) {
    d = 3 * sNear
  }

  return d
}
