/**
 * The orchestrator: seeds in, complete palette out.
 */

import { resolveConfig } from './config.ts'
import { hueDistance } from './color/space.ts'
import { chromaCeilingCurve, chromaCurve } from './curves/chroma.ts'
import { hueCurve } from './curves/hue.ts'
import { generateNeutralRamp } from './neutrals.ts'
import { generateRamp, type RampSpec } from './ramp.ts'
import { generateSeedRamp } from './seeds.ts'
import { planSpectrum, suggestRoles, type SpectrumFamily } from './spectrum.ts'
import { ALGORITHM_VERSION, ENGINE_VERSION } from './version.ts'
import type {
  EngineWarning,
  PairEntry,
  Palette,
  PaletteConfig,
  Ramp,
  ResolvedConfig,
} from './types.ts'

/**
 * Generate a palette.
 *
 * Pure and deterministic: the same config always produces byte-identical
 * output. Throws {@link EngineError} for input it cannot work with.
 */
export function generatePalette(config: PaletteConfig): Palette {
  const resolved = resolveConfig(config)
  const warnings: EngineWarning[] = []

  // Hue comes from the seeds that actually have one. An all-grey palette stays
  // grey rather than having a spectrum invented for it.
  const chromatic = resolved.seeds.filter((seed) => !seed.achromatic)
  const primaryHue = chromatic[0]?.oklch.h ?? null

  if (primaryHue === null) {
    warnings.push({
      code: 'NO_HUE',
      message:
        'None of your colours carry a hue, so there is no spectrum to build from them. ' +
        'The palette is greyscale; add a colour with some colourfulness for a full range.',
    })
  }

  const families = planSpectrum(
    resolved.seeds.map((seed) => (seed.achromatic ? Number.NaN : seed.oklch.h)),
    resolved.families,
  )

  warnings.push(...crowdingWarnings(families, resolved))

  // A colourless seed cannot anchor a hue, but it is still a colour someone
  // asked for — and in exact mode it has to ship. So it gets a greyscale ramp
  // of its own rather than being dropped from the palette.
  const greys = resolved.seeds.filter((seed) => seed.achromatic)
  const greyRamps = greys.map((seed, i) =>
    generateSeedRamp(seed, resolved, primaryHue, seed.name ?? greyName(i)),
  )

  const familyRamps = families.map((family) =>
    family.seedIndex === undefined
      ? buildFamilyRamp(family, resolved)
      : generateSeedRamp(
          resolved.seeds[family.seedIndex],
          resolved,
          primaryHue,
          familyName(family, resolved),
        ),
  )

  const ramps: Ramp[] = [...greyRamps, ...familyRamps]

  if (resolved.neutrals.enabled) {
    ramps.push(generateNeutralRamp(resolved, primaryHue))
  }

  ensureUniqueNames(ramps)

  const sharedPairTable = combinePairTables(ramps)

  for (const ramp of ramps) {
    warnings.push(...ramp.report.warnings)
  }

  return {
    ramps,
    roleHints: suggestRoles(families),
    sharedPairTable,
    resolved,
    input: config,
    warnings,
    meta: {
      engineVersion: ENGINE_VERSION,
      algorithmVersion: ALGORITHM_VERSION,
      gamut: resolved.gamut,
    },
  }
}

function greyName(index: number): string {
  return index === 0 ? 'grey' : `grey-${index + 1}`
}

/**
 * Make every ramp name distinct.
 *
 * Names come from three places — the hue table, a caller's override and the
 * greyscale fallback — so a collision is possible even though each source is
 * internally unique. Token names have to be unique to be usable, so the later
 * one is suffixed.
 */
function ensureUniqueNames(ramps: Ramp[]): void {
  const seen = new Map<string, number>()

  for (const ramp of ramps) {
    const count = seen.get(ramp.name) ?? 0
    seen.set(ramp.name, count + 1)
    if (count === 0) continue

    ramp.name = `${ramp.name}-${count + 1}`
    ramp.role = ramp.role === 'neutral' ? 'neutral' : `family-${ramp.name}`
  }
}

/** A seed's own name wins over the one its hue would have been given. */
function familyName(family: SpectrumFamily, resolved: ResolvedConfig): string {
  if (family.seedIndex === undefined) return family.name
  return resolved.seeds[family.seedIndex].name ?? family.name
}

/** A family that was not anchored on a seed: hue in, ramp out. */
function buildFamilyRamp(family: SpectrumFamily, resolved: ResolvedConfig): Ramp {
  const spec: RampSpec = {
    role: `family-${family.name}`,
    name: family.name,
    hue: family.hue,
    ladder: resolved.ladder,
    fraction: chromaCurve(resolved.chromaPoints),
    ceiling: chromaCeilingCurve(resolved.chromaPoints),
    hueCurve: hueCurve(family.hue, resolved.hueDrift, 0.5),
    usesSharedLadder: true,
    gamut: resolved.gamut,
    warnings: [],
  }

  return generateRamp(spec)
}

/**
 * Warn when the spectrum is packed tighter than the eye can separate.
 *
 * Sixteen families around the circle leaves 22 degrees between neighbours,
 * which is not much; below about 18 they start reading as shades of each other
 * and the palette gains rows without gaining colours.
 */
function crowdingWarnings(
  families: SpectrumFamily[],
  resolved: ResolvedConfig,
): EngineWarning[] {
  if (families.length < 2) return []

  let tightest = 360
  for (let i = 0; i < families.length; i++) {
    for (let j = i + 1; j < families.length; j++) {
      tightest = Math.min(tightest, hueDistance(families[i].hue, families[j].hue))
    }
  }

  if (tightest >= 18) return []

  return [
    {
      code: 'SPECTRUM_CROWDED',
      message:
        `Two families are only ${tightest.toFixed(0)} degrees apart, so they will read as the ` +
        'same colour. Ask for fewer families, or move your colours further apart on the wheel.',
      context: { families: resolved.families, separation: Number(tightest.toFixed(1)) },
    },
  ]
}

/**
 * Combine the shared-ladder ramps' contrast tables into one.
 *
 * Every ramp on the shared ladder aims at the same luminance per step, but
 * rounding to 8 bits nudges each hue slightly differently, so their measured
 * tables are close rather than equal. Taking the worst case across all of them
 * turns the result into a statement that actually holds palette-wide: any two
 * shades this far apart, in any hue, clear at least this much.
 *
 * Ramps warped for an exact seed are excluded — they no longer sit on the
 * lightnesses the table describes, and each carries its own table instead.
 */
function combinePairTables(ramps: Ramp[]): PairEntry[] {
  const shared = ramps.filter((ramp) => ramp.report.usesSharedLadder)
  if (shared.length === 0) return []

  return shared[0].report.pairTable.map((entry, index) => {
    let worst = entry

    for (const ramp of shared) {
      const candidate = ramp.report.pairTable[index]
      if (candidate && candidate.minWcag < worst.minWcag) worst = candidate
    }

    const minApcaLc = Math.min(
      ...shared.map((ramp) => ramp.report.pairTable[index]?.minApcaLc ?? Infinity),
    )

    return { ...worst, minApcaLc }
  })
}
