/**
 * Contrast reporting.
 *
 * Everything here is measured on the colours that actually ship — the quantised
 * hex values — never inferred from the luminance the solver aimed at. That
 * distinction is the whole point: a guarantee the tool cannot verify on its own
 * output is not a guarantee.
 */

import { apcaLc } from './contrast/apca.ts'
import { WCAG_THRESHOLDS, wcagContrastHex } from './contrast/wcag.ts'
import type {
  EngineWarning,
  LadderContract,
  LadderContractKind,
  LevelLabels,
  PairEntry,
  RampReport,
  StepGuarantee,
  Swatch,
} from './types.ts'

/**
 * Worst-case contrast for every step separation in a ramp.
 *
 * This is what turns the shared ladder into advice a designer can use without
 * checking anything: "six steps apart always clears 4.5:1". The minimum is
 * taken over every pair at that distance, so the statement holds everywhere in
 * the ramp rather than on average — and it is a genuine minimum, over both text
 * polarities for APCA, not just dark-on-light.
 */
export function buildPairTable(swatches: Swatch[]): PairEntry[] {
  const table: PairEntry[] = []

  for (let distance = 1; distance < swatches.length; distance++) {
    let minWcag = Infinity
    let minApcaLc = Infinity
    let pair: [number, number] = [0, distance]

    for (let i = 0; i + distance < swatches.length; i++) {
      const a = swatches[i]
      const b = swatches[i + distance]

      const ratio = wcagContrastHex(a.hex, b.hex)
      if (ratio < minWcag) {
        minWcag = ratio
        pair = [i, i + distance]
      }

      // APCA's two polarities use different exponents, so a pair scores
      // differently as dark-text-on-light than as light-text-on-dark — by up to
      // 2.3 Lc across this ladder. A minimum has to cover both.
      minApcaLc = Math.min(
        minApcaLc,
        Math.abs(apcaLc(b.hex, a.hex)),
        Math.abs(apcaLc(a.hex, b.hex)),
      )
    }

    table.push({
      distance,
      minWcag: round(minWcag, 4),
      minApcaLc: round(minApcaLc, 2),
      pair,
    })
  }

  return table
}

/** First shade label whose contrast against `background` reaches each level. */
function firstMeeting(swatches: Swatch[], background: string): LevelLabels {
  const result: LevelLabels = { aaLarge: null, aa: null, aaa: null }

  for (const swatch of swatches) {
    const ratio = wcagContrastHex(swatch.hex, background)
    if (result.aaLarge === null && ratio >= WCAG_THRESHOLDS.aaLarge) {
      result.aaLarge = swatch.label
    }
    if (result.aa === null && ratio >= WCAG_THRESHOLDS.aa) {
      result.aa = swatch.label
    }
    if (result.aaa === null && ratio >= WCAG_THRESHOLDS.aaa) {
      result.aaa = swatch.label
    }
  }

  return result
}

/**
 * The colour a contract is measured against.
 *
 * `ratioOnLightest` is the interesting one: its background is the ramp's own
 * shade 50, which is a solved colour rather than a constant, so the comparison
 * moves with the ramp.
 */
export function contractSurface(kind: LadderContractKind, lightestHex: string): string {
  if (kind === 'ratioOnWhite') return '#ffffff'
  if (kind === 'ratioOnBlack') return '#000000'
  return lightestHex
}

/** How a contract's background reads in a sentence. */
export function contractSurfaceName(kind: LadderContractKind, lightestLabel: number): string {
  if (kind === 'ratioOnWhite') return 'white'
  if (kind === 'ratioOnBlack') return 'black'
  return `shade ${lightestLabel}`
}

/**
 * Verify a step's contract against the colour that shipped.
 *
 * In `harmonize` mode these always hold — the ladder is built from them. In
 * `exact` mode they may not, because the user asked for their colour to be kept
 * instead. Either way the measurement is real.
 */
export function verifyGuarantees(
  swatch: Swatch,
  contracts: LadderContract[],
  lightestHex: string,
): StepGuarantee[] {
  return contracts
    .filter((contract) => contract.index === swatch.index)
    .map((contract) => {
      const actual = wcagContrastHex(swatch.hex, contractSurface(contract.kind, lightestHex))

      return {
        kind: contract.kind,
        target: contract.target,
        actual: round(actual, 4),
        // A hair of slack for float noise in the ratio itself, not for the
        // colour: 4.4999999 is a pass, 4.49 is not.
        met: actual >= contract.target - 1e-6,
      }
    })
}

export interface BuildReportOptions {
  swatches: Swatch[]
  usesSharedLadder: boolean
  warnings: EngineWarning[]
  /** Ramp name, used to make a broken guarantee's message specific. */
  name: string
}

export function buildRampReport(options: BuildReportOptions): RampReport {
  const { swatches, usesSharedLadder, name } = options
  const warnings = [...options.warnings]

  const brokenGuarantees = swatches.flatMap((swatch) =>
    swatch.guarantees
      .filter((guarantee) => !guarantee.met)
      .map((guarantee) => ({ ...guarantee, label: swatch.label })),
  )

  for (const broken of brokenGuarantees) {
    const alternative = firstSatisfying(swatches, broken.kind, broken.target)
    const surface = contractSurfaceName(broken.kind, swatches[0].label)

    warnings.push({
      code: 'GUARANTEE_NOT_MET',
      message:
        `${name} ${broken.label} reaches ${broken.actual.toFixed(2)}:1 on ${surface}, ` +
        `short of the ${broken.target}:1 this step normally guarantees` +
        (alternative === null
          ? '. No shade in this ramp reaches it.'
          : `. Use ${name} ${alternative} instead where that matters.`),
      context: {
        label: broken.label,
        target: broken.target,
        actual: broken.actual,
        ...(alternative === null ? {} : { alternative }),
      },
    })
  }

  return {
    pairTable: buildPairTable(swatches),
    firstOnWhite: firstMeeting(swatches, '#ffffff'),
    firstOnBlack: firstMeeting([...swatches].reverse(), '#000000'),
    brokenGuarantees,
    usesSharedLadder,
    warnings,
  }
}

/** Nearest shade label that does reach `target` against the relevant surface. */
function firstSatisfying(
  swatches: Swatch[],
  kind: LadderContractKind,
  target: number,
): number | null {
  const background = contractSurface(kind, swatches[0].hex)
  // Against a light background, darker shades pass, so scan toward the dark
  // end; against black the reverse.
  const ordered = kind === 'ratioOnBlack' ? [...swatches].reverse() : swatches

  for (const swatch of ordered) {
    if (wcagContrastHex(swatch.hex, background) >= target) return swatch.label
  }

  return null
}

function round(value: number, places: number): number {
  const factor = 10 ** places
  return Math.round(value * factor) / factor
}
