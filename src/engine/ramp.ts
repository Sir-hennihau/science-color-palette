/**
 * Ramp generation: run the ladder, the chroma curve and the hue curve through
 * the solver, then measure what actually came out.
 */

import { GAMUT_MOVED_EOK, GUARANTEE_NUDGE_ATTEMPTS, GUARANTEE_NUDGE_Y } from './constants.ts'
import { mapToGamut } from './color/gamut.ts'
import {
  deltaEOK,
  hexToRgb8,
  oklchFromHex,
  oklchToRgb,
  quantize,
  rgb8ToHex,
  yFromHex,
  type Oklch,
} from './color/space.ts'
import { apcaLc } from './contrast/apca.ts'
import { wcagContrastHex } from './contrast/wcag.ts'
import type { Curve } from './curves/pchip.ts'
import type { HueCurve } from './curves/hue.ts'
import { buildRampReport, verifyGuarantees } from './report.ts'
import { solveStep } from './solve.ts'
import type {
  EngineWarning,
  GamutId,
  LadderContract,
  Ramp,
  RampRole,
  ResolvedLadder,
  Swatch,
} from './types.ts'

export interface SeedInsert {
  /** Step the seed occupies. */
  index: number
  /** The colour to place there, verbatim. */
  hex: string
}

export interface RampSpec {
  role: RampRole
  name: string
  /** Null for a fully neutral ramp. */
  hue: number | null
  ladder: ResolvedLadder
  /** Share of the available chroma at each position. */
  fraction: Curve
  /** Null when the ramp has no hue. */
  hueCurve: HueCurve | null
  /**
   * Absolute chroma cap by position. Holds the lightest shades barely tinted,
   * where a share of the envelope would vary wildly between hues, and keeps
   * tinted neutrals subtle throughout.
   */
  ceiling?: Curve
  seedInsert?: SeedInsert
  usesSharedLadder: boolean
  gamut: GamutId
  warnings: EngineWarning[]
}

/** Generate one ramp. */
export function generateRamp(spec: RampSpec): Ramp {
  const { ladder } = spec

  const solved: Array<{ oklch: Oklch; hex: string; gamutMapped: boolean; isSeed: boolean }> = []

  for (let i = 0; i < ladder.steps; i++) {
    if (spec.seedInsert && spec.seedInsert.index === i) {
      // The seed bypasses the solver entirely. This is the promise of `exact`
      // mode: the colour that was typed is the colour that ships, byte for
      // byte, whatever that costs elsewhere.
      solved.push({
        oklch: oklchFromHex(spec.seedInsert.hex),
        hex: spec.seedInsert.hex,
        gamutMapped: false,
        isSeed: true,
      })
      continue
    }

    solved.push(solveForStep(spec, i))
  }

  const lightestHex = solved[0].hex
  const darkestHex = solved[solved.length - 1].hex

  const swatches: Swatch[] = solved.map((entry, index) => {
    const swatch: Swatch = {
      index,
      label: ladder.labels[index],
      t: ladder.t[index],
      hex: entry.hex,
      oklch: { l: entry.oklch.l, c: entry.oklch.c, h: entry.oklch.h },
      rgb: hexToRgb8(entry.hex),
      wcag: {
        y: yFromHex(entry.hex),
        onWhite: wcagContrastHex(entry.hex, '#ffffff'),
        onBlack: wcagContrastHex(entry.hex, '#000000'),
        onLightest: wcagContrastHex(entry.hex, lightestHex),
        onDarkest: wcagContrastHex(entry.hex, darkestHex),
      },
      apca: {
        asTextOnWhite: apcaLc(entry.hex, '#ffffff'),
        asTextOnBlack: apcaLc(entry.hex, '#000000'),
        asBgWithBlackText: apcaLc('#000000', entry.hex),
        asBgWithWhiteText: apcaLc('#ffffff', entry.hex),
      },
      onHex: bestTextOn(entry.hex),
      isSeed: entry.isSeed,
      gamutMapped: entry.gamutMapped,
      guarantees: [],
    }

    swatch.guarantees = verifyGuarantees(swatch, ladder.contracts)
    return swatch
  })

  return {
    role: spec.role,
    name: spec.name,
    hue: spec.hue,
    swatches,
    report: buildRampReport({
      swatches,
      usesSharedLadder: spec.usesSharedLadder,
      warnings: spec.warnings,
      name: spec.name,
    }),
  }
}

/**
 * Solve one step, then make sure the colour that ships still keeps whatever
 * contract the step carries.
 *
 * The solver hits its luminance target to float precision, but the result then
 * has to survive rounding to 8 bits, which can move luminance by enough to drop
 * a 4.5:1 promise to 4.49:1. The ladder already biases contract targets to
 * absorb that; this is the backstop for the rare case where it is not enough,
 * nudging the target further into safe territory and re-solving.
 */
function solveForStep(
  spec: RampSpec,
  index: number,
): { oklch: Oklch; hex: string; gamutMapped: boolean; isSeed: boolean } {
  const { ladder } = spec
  const t = ladder.t[index]
  const hue = spec.hueCurve ? spec.hueCurve.at(t) : null
  const fraction = spec.fraction.at(t)

  const ceiling = spec.ceiling ? spec.ceiling.at(t) : undefined

  const contracts = ladder.contracts.filter((c) => c.index === index)
  let yTarget = ladder.yTargets[index]
  let attempt = 0
  let result = solveAndQuantize(yTarget, hue, fraction, ceiling, spec)

  while (attempt < GUARANTEE_NUDGE_ATTEMPTS && !contractsHold(result.hex, contracts)) {
    attempt++
    yTarget = nudge(yTarget, contracts, attempt)
    result = solveAndQuantize(yTarget, hue, fraction, ceiling, spec)
  }

  return { ...result, isSeed: false }
}

function solveAndQuantize(
  yTarget: number,
  hue: number | null,
  fraction: number,
  ceiling: number | undefined,
  spec: RampSpec,
): { oklch: Oklch; hex: string; gamutMapped: boolean } {
  const solved = solveStep({
    yTarget,
    hue,
    fraction,
    ceiling,
    gamut: spec.gamut,
  })

  // The solver already works inside the envelope, so this is a safety net
  // rather than the normal path — but it is the difference between exporting a
  // colour a browser will render faithfully and one it will silently clip.
  const mapped = mapToGamut(solved, spec.gamut)
  const gamutMapped = deltaEOK(solved, mapped) > GAMUT_MOVED_EOK

  return {
    oklch: mapped,
    hex: rgb8ToHex(quantize(oklchToRgb(mapped))),
    gamutMapped,
  }
}

function contractsHold(hex: string, contracts: LadderContract[]): boolean {
  return contracts.every((contract) => {
    const background = contract.kind === 'ratioOnWhite' ? '#ffffff' : '#000000'
    return wcagContrastHex(hex, background) >= contract.target
  })
}

/** Push a luminance target further into the safe side of its contracts. */
function nudge(yTarget: number, contracts: LadderContract[], attempt: number): number {
  const step = GUARANTEE_NUDGE_Y * attempt
  // Contracts against white want a darker colour; against black, lighter. A
  // step carrying both is satisfied by whichever direction is requested first.
  const wantsDarker = contracts.some((c) => c.kind === 'ratioOnWhite')
  return Math.min(1, Math.max(0, yTarget + (wantsDarker ? -step : step)))
}

/**
 * Black or white, whichever is more legible on this colour.
 *
 * Judged by APCA magnitude rather than WCAG ratio: this only affects the label
 * drawn on a swatch, and APCA is the better predictor of which one a reader
 * will actually find easier.
 */
function bestTextOn(hex: string): string {
  const onBlack = Math.abs(apcaLc('#000000', hex))
  const onWhite = Math.abs(apcaLc('#ffffff', hex))
  return onBlack >= onWhite ? '#000000' : '#ffffff'
}
