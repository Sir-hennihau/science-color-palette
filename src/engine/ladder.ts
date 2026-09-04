/**
 * The lightness ladder — the backbone of the whole palette.
 *
 * A shade ramp is fundamentally a light-to-dark staircase, and every ramp in
 * the palette climbs the *same* staircase. Because the WCAG contrast ratio
 * depends on relative luminance alone, pinning a step's luminance pins its
 * contrast exactly: step 6 of the blues and step 6 of the yellows are equally
 * readable on white, even though they look nothing alike. That shared-ladder
 * property is what makes a guarantee like "six steps apart clears 4.5:1" true
 * rather than approximately true. The number itself is always measured on the
 * shipped hexes rather than assumed; `palette.test.ts` pins it.
 *
 * The ladder is one continuous monotone curve through a handful of anchors,
 * sampled at however many steps the user asked for. Three of those anchors are
 * *contracts*: their luminance is derived from a target contrast ratio, so a
 * step landing on one is solved to hit that ratio.
 */

import {
  LADDER_FEASIBLE_GAP,
  LADDER_MIN_GAP,
  LADDER_STRAIN_L,
  LIGHTEST_Y_MARGIN,
  MARGIN_Y,
} from './constants.ts'
import { lstarFromY, yFromLstar } from './color/space.ts'
import { yForRatioBelow, yForRatioOnBlack } from './contrast/wcag.ts'
import { monotoneCubic, type Point } from './curves/pchip.ts'
import {
  EngineError,
  type EngineWarning,
  type LadderAnchor,
  type LadderConfig,
  type LadderContract,
  type ResolvedLadder,
} from './types.ts'

export const MIN_STEPS = 5
export const MAX_STEPS = 15
export const DEFAULT_STEPS = 11
export const DEFAULT_LIGHTEST_L = 97.8
export const DEFAULT_DARKEST_L = 13

/**
 * Interior anchors of the default ladder.
 *
 * The three contrast anchors sit at 0.5, 0.6 and 0.7 so that an 11-step ramp —
 * whose steps land on exactly those positions — gets shades 500, 600 and 700
 * guaranteed at 3:1, 4.5:1 and 7:1. The remaining anchors shape the curve:
 * real-world ramps compress toward white rather than stepping evenly, which is
 * what keeps the light end from looking chunky.
 *
 * Those three are measured against the ramp's own shade 50, not against pure
 * white. Anchoring on white looks stricter and is in fact weaker: shade 50 sits
 * at about 1.06:1 against white, so a step solved to exactly 4.5:1 on white
 * lands at 4.30:1 on the lightest shade — and `bg-*-50` is the background these
 * colours are actually used on. Measured on the generated palette, moving the
 * anchors buys a full step on all three promises (4.5:1 at six steps apart
 * rather than seven) for a shift of about 1.5 L*. A contract against the
 * lightest shade implies the same one against white, so nothing is given up.
 */
const DEFAULT_INTERIOR_ANCHORS: readonly LadderAnchor[] = [
  { t: 0.1, lstar: 94 },
  { t: 0.3, lstar: 82 },
  { t: 0.5, ratioOnLightest: 3 },
  { t: 0.6, ratioOnLightest: 4.5 },
  { t: 0.7, ratioOnLightest: 7 },
  { t: 0.9, lstar: 21 },
]

/** Tolerance for deciding a sampled step landed on an anchor. */
const T_MATCH_EPSILON = 1e-9

interface ResolvedAnchor {
  t: number
  lstar: number
  /** Present when this anchor came from a contrast ratio. */
  contract?: { kind: LadderContract['kind']; target: number; y: number }
}

/**
 * Turn anchors into (t, L*) points, converting contrast ratios into exact
 * luminances.
 *
 * Contract luminances are biased by {@link MARGIN_Y} in whichever direction
 * makes the requirement easier. Solving a step to land precisely on its
 * threshold is not enough: rounding the result to 8 bits can nudge it a hair
 * under, turning a 4.5:1 promise into 4.49:1.
 */
function resolveAnchors(cfg: LadderConfig): ResolvedAnchor[] {
  const lightestL = cfg.lightestL ?? DEFAULT_LIGHTEST_L
  const darkestL = cfg.darkestL ?? DEFAULT_DARKEST_L
  const interior = cfg.anchors ?? DEFAULT_INTERIOR_ANCHORS

  // What the lightest shade will be worth once it has itself been rounded to 8
  // bits. Pessimistic on purpose: a contract measured against it has two
  // quantised ends, not one.
  const lightestY = Math.max(0, yFromLstar(lightestL) - LIGHTEST_Y_MARGIN)

  const resolved: ResolvedAnchor[] = [{ t: 0, lstar: lightestL }]

  for (const anchor of interior) {
    if (anchor.t <= 0 || anchor.t >= 1) {
      throw new EngineError(
        'INVALID_CONFIG',
        `Ladder anchor t must be strictly between 0 and 1, got ${anchor.t}.`,
        { t: anchor.t },
      )
    }
    resolved.push(resolveAnchor(anchor, lightestY))
  }

  resolved.push({ t: 1, lstar: darkestL })
  resolved.sort((a, b) => a.t - b.t)

  for (let i = 1; i < resolved.length; i++) {
    if (resolved[i].lstar >= resolved[i - 1].lstar) {
      throw new EngineError(
        'ANCHORS_NOT_MONOTONE',
        'Ladder anchors must decrease in lightness from t=0 to t=1, so shades ' +
          `run light to dark. Anchor at t=${resolved[i].t} (L* ${resolved[i].lstar.toFixed(2)}) ` +
          `is not darker than the one at t=${resolved[i - 1].t} ` +
          `(L* ${resolved[i - 1].lstar.toFixed(2)}).`,
        { t: resolved[i].t },
      )
    }
  }

  return resolved
}

function resolveAnchor(anchor: LadderAnchor, lightestY: number): ResolvedAnchor {
  if (anchor.ratioOnLightest !== undefined) {
    const y = below(lightestY, anchor.ratioOnLightest, anchor.t, 'the lightest shade')
    return {
      t: anchor.t,
      lstar: lstarFromY(y),
      contract: { kind: 'ratioOnLightest', target: anchor.ratioOnLightest, y },
    }
  }

  if (anchor.ratioOnWhite !== undefined) {
    const y = below(1, anchor.ratioOnWhite, anchor.t, 'white')
    return {
      t: anchor.t,
      lstar: lstarFromY(y),
      contract: { kind: 'ratioOnWhite', target: anchor.ratioOnWhite, y },
    }
  }

  if (anchor.ratioOnBlack !== undefined) {
    const y = yForRatioOnBlack(anchor.ratioOnBlack) + MARGIN_Y
    if (y > 1) {
      throw new EngineError(
        'INVALID_CONFIG',
        `Ladder anchor at t=${anchor.t} asks for ${anchor.ratioOnBlack}:1 on black, which is ` +
          'more contrast than any colour can reach.',
        { t: anchor.t, ratio: anchor.ratioOnBlack },
      )
    }
    return {
      t: anchor.t,
      lstar: lstarFromY(y),
      contract: { kind: 'ratioOnBlack', target: anchor.ratioOnBlack, y },
    }
  }

  if (anchor.lstar === undefined) {
    throw new EngineError(
      'INVALID_CONFIG',
      `Ladder anchor at t=${anchor.t} needs one of lstar, ratioOnLightest, ratioOnWhite ` +
        'or ratioOnBlack.',
      { t: anchor.t },
    )
  }

  return { t: anchor.t, lstar: anchor.lstar }
}

/**
 * Luminance for a contract that must sit `ratio` below `reference`.
 *
 * Biased by {@link MARGIN_Y} toward the safe side. A negative result means the
 * reference is not light enough to support the ratio at all — nothing is darker
 * than black — which is a configuration error rather than something to clamp
 * silently into a promise that cannot hold.
 */
function below(reference: number, ratio: number, t: number, surface: string): number {
  const y = yForRatioBelow(reference, ratio) - MARGIN_Y

  if (y < 0) {
    throw new EngineError(
      'INVALID_CONFIG',
      `Ladder anchor at t=${t} asks for ${ratio}:1 against ${surface}, which is more ` +
        'contrast than that background can give — even black falls short.',
      { t, ratio },
    )
  }

  return y
}

/**
 * Shade label for a position on the ramp.
 *
 * Rounding to the nearest 25 reproduces the familiar 50/100/.../900/950 set for
 * an 11-step ramp and stays unique and ordered for every step count in range.
 */
export function labelForT(t: number): number {
  const raw = Math.round((1000 * t) / 25) * 25
  return Math.min(950, Math.max(50, raw))
}

/** Build the ladder for `steps` shades. */
export function buildLadder(cfg: LadderConfig = {}): ResolvedLadder {
  const steps = cfg.steps ?? DEFAULT_STEPS

  if (!Number.isInteger(steps) || steps < MIN_STEPS || steps > MAX_STEPS) {
    throw new EngineError(
      'STEPS_OUT_OF_RANGE',
      `Step count must be a whole number between ${MIN_STEPS} and ${MAX_STEPS}, got ${steps}.`,
      { steps },
    )
  }

  const anchors = resolveAnchors(cfg)
  const curve = monotoneCubic(anchors.map((a): Point => ({ x: a.t, y: a.lstar })))

  const t: number[] = []
  const labels: number[] = []
  const lstar: number[] = []
  const yTargets: number[] = []
  const contracts: LadderContract[] = []

  for (let i = 0; i < steps; i++) {
    const ti = i / (steps - 1)
    t.push(ti)
    labels.push(labelForT(ti))

    const anchor = anchors.find((a) => Math.abs(a.t - ti) < T_MATCH_EPSILON)

    if (anchor?.contract) {
      // Use the contract's luminance directly rather than round-tripping it
      // through L*, so the target is exact by construction.
      lstar.push(lstarFromY(anchor.contract.y))
      yTargets.push(anchor.contract.y)
      contracts.push({ index: i, kind: anchor.contract.kind, target: anchor.contract.target })
    } else {
      const l = anchor ? anchor.lstar : curve.at(ti)
      lstar.push(l)
      yTargets.push(yFromLstar(l))
    }
  }

  assertUniqueLabels(labels, steps)

  return { steps, t, labels, lstar, yTargets, contracts }
}

function assertUniqueLabels(labels: number[], steps: number): void {
  for (let i = 1; i < labels.length; i++) {
    if (labels[i] <= labels[i - 1]) {
      throw new EngineError(
        'STEPS_OUT_OF_RANGE',
        `Step count ${steps} produces duplicate shade labels (${labels[i - 1]}, ${labels[i]}).`,
        { steps },
      )
    }
  }
}

export interface WarpResult {
  ladder: ResolvedLadder
  warnings: EngineWarning[]
}

/**
 * Reshape the ladder so `index` sits at exactly `seedLstar`.
 *
 * This is what `exact` mode needs: the seed keeps its own lightness, and the
 * rest of the ramp bends smoothly to accommodate it instead of the seed being
 * dragged onto the nearest rung. A displacement bump — zero at both ends, equal
 * to the required shift at the seed — is added to the curve, so distant shades
 * stay where they were and neighbours move just enough to stay evenly spaced.
 *
 * Contracts are carried through unchanged. They are no longer guaranteed, which
 * is the whole trade of this mode; the pipeline re-measures them on the final
 * colours and reports any that no longer hold.
 */
export function warpLadderForSeed(
  ladder: ResolvedLadder,
  index: number,
  seedLstar: number,
): WarpResult {
  const warnings: EngineWarning[] = []
  const n = ladder.steps

  // A ramp still has to run light to dark, so the pinned step must leave room
  // for the shades on either side of it. Asking for black at the lightest slot
  // is not a tight fit but a geometric impossibility; the pin is moved as
  // little as possible and the caller is told the colour cannot be held here.
  const minPin = (n - 1 - index) * LADDER_FEASIBLE_GAP
  const maxPin = 100 - index * LADDER_FEASIBLE_GAP
  const pinned = Math.min(Math.max(seedLstar, minPin), maxPin)

  if (Math.abs(pinned - seedLstar) > 1e-9) {
    warnings.push({
      code: 'SEED_SLOT_INFEASIBLE',
      message:
        `This colour is too ${seedLstar < pinned ? 'dark' : 'light'} to sit at shade ` +
        `${ladder.labels[index]} and still leave room for the other shades. ` +
        'Pick a shade nearer the matching end of the ramp, or switch this seed to Harmonize.',
      context: { label: ladder.labels[index], requestedL: Number(seedLstar.toFixed(2)) },
    })
  }

  const shift = pinned - ladder.lstar[index]

  if (Math.abs(shift) < 1e-9) {
    return { ladder, warnings }
  }

  const bumpPoints: Point[] = []
  if (index > 0) bumpPoints.push({ x: 0, y: 0 })
  bumpPoints.push({ x: ladder.t[index], y: shift })
  if (index < n - 1) bumpPoints.push({ x: 1, y: 0 })

  const bump = monotoneCubic(bumpPoints)
  const lstar = ladder.lstar.map((l, i) => l + bump.at(ladder.t[i]))
  lstar[index] = pinned

  const repair = repairMonotone(lstar, index)
  if (repair.compressed) {
    warnings.push({
      code: 'SEED_WARP_COMPRESSED',
      message:
        'Keeping this colour exactly leaves little lightness room on one side of ' +
        'the ramp, so those shades are spaced more tightly than usual.',
      context: { label: ladder.labels[index] },
    })
  }

  const strain = Math.max(...lstar.map((l, i) => Math.abs(l - ladder.lstar[i])))
  if (strain > LADDER_STRAIN_L) {
    warnings.push({
      code: 'SEED_WARP_STRAIN',
      message:
        `Keeping this colour exactly shifts other shades by up to ${strain.toFixed(1)} ` +
        'points of lightness, so this ramp no longer lines up with the rest of the palette.',
      context: { label: ladder.labels[index], strain: Number(strain.toFixed(2)) },
    })
  }

  return {
    ladder: {
      ...ladder,
      lstar,
      yTargets: lstar.map(yFromLstar),
    },
    warnings,
  }
}

/**
 * Force a strictly decreasing sequence with the pinned index held fixed.
 *
 * Each side of the pin gets its own spacing, reduced below the preferred gap
 * only when there genuinely is not enough lightness range left on that side.
 * Every step is then confined between a floor that preserves the gap to its
 * neighbour and a ceiling that reserves room for the steps beyond it, which
 * makes the result feasible for any seed at any slot — pure white pinned to the
 * darkest rung included.
 */
function repairMonotone(lstar: number[], pin: number): { compressed: boolean } {
  const n = lstar.length
  let compressed = false

  const above = pin
  if (above > 0) {
    const gap = Math.min(LADDER_MIN_GAP, (100 - lstar[pin]) / above)
    if (gap < LADDER_MIN_GAP - 1e-12) compressed = true
    for (let i = pin - 1; i >= 0; i--) {
      const floor = lstar[i + 1] + gap
      const ceiling = 100 - i * gap
      lstar[i] = Math.min(Math.max(lstar[i], floor), ceiling)
    }
  }

  const below = n - 1 - pin
  if (below > 0) {
    const gap = Math.min(LADDER_MIN_GAP, lstar[pin] / below)
    if (gap < LADDER_MIN_GAP - 1e-12) compressed = true
    for (let i = pin + 1; i < n; i++) {
      const ceiling = lstar[i - 1] - gap
      const floor = (n - 1 - i) * gap
      lstar[i] = Math.max(Math.min(lstar[i], ceiling), floor)
    }
  }

  return { compressed }
}

/** Index of the step whose lightness is closest to `lstar`. */
export function nearestSlot(ladder: ResolvedLadder, lstar: number): number {
  let best = 0
  let bestDistance = Infinity
  let bestCentrality = Infinity

  for (let i = 0; i < ladder.steps; i++) {
    const distance = Math.abs(ladder.lstar[i] - lstar)
    const centrality = Math.abs(ladder.t[i] - 0.5)

    if (
      distance < bestDistance - 1e-12 ||
      (Math.abs(distance - bestDistance) <= 1e-12 && centrality < bestCentrality)
    ) {
      best = i
      bestDistance = distance
      bestCentrality = centrality
    }
  }

  return best
}

/** Index of the step carrying `label`, or -1. */
export function slotForLabel(ladder: ResolvedLadder, label: number): number {
  return ladder.labels.indexOf(label)
}
