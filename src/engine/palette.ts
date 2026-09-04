/**
 * The orchestrator: seeds in, complete palette out.
 */

import { resolveConfig } from './config.ts'
import { hueDistance } from './color/space.ts'
import { generateAccentRamps, suggestHarmonies } from './harmony.ts'
import { generateNeutralRamp } from './neutrals.ts'
import { generateSemanticRamps } from './semantics.ts'
import { generateSeedRamp } from './seeds.ts'
import { ALGORITHM_VERSION, ENGINE_VERSION } from './version.ts'
import type { EngineWarning, PairEntry, Palette, PaletteConfig, Ramp } from './types.ts'

/**
 * Generate a palette.
 *
 * Pure and deterministic: the same config always produces byte-identical
 * output. Throws {@link EngineError} for input it cannot work with.
 */
export function generatePalette(config: PaletteConfig): Palette {
  const resolved = resolveConfig(config)
  const warnings: EngineWarning[] = []

  // Hue comes from the first seed that actually has one. An all-grey palette
  // stays grey rather than having a hue invented for it.
  const primaryHue = resolved.seeds.find((seed) => !seed.achromatic)?.oklch.h ?? null

  if (primaryHue === null) {
    warnings.push({
      code: 'NO_HUE',
      message:
        'None of your seeds carry a hue, so the palette is greyscale. Semantic colours ' +
        'keep their standard hues and neutrals stay untinted.',
    })
  }

  const seedRamps = resolved.seeds.map((seed) =>
    generateSeedRamp(seed, resolved, primaryHue),
  )

  warnings.push(...nearDuplicateSeedWarnings(resolved))

  const suggestions = suggestHarmonies(resolved)
  const accentRamps = generateAccentRamps(resolved, suggestions)

  const ramps: Ramp[] = [...seedRamps, ...accentRamps]

  if (resolved.neutrals.enabled) {
    ramps.push(generateNeutralRamp(resolved, primaryHue))
  }

  ramps.push(...generateSemanticRamps(resolved, primaryHue))

  const sharedPairTable = combinePairTables(ramps)

  for (const ramp of ramps) {
    warnings.push(...ramp.report.warnings)
  }

  return {
    ramps,
    suggestions,
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

/** Warn when two seeds are so close together they will read as one colour. */
function nearDuplicateSeedWarnings(
  resolved: ReturnType<typeof resolveConfig>,
): EngineWarning[] {
  const warnings: EngineWarning[] = []
  const seeds = resolved.seeds.filter((seed) => !seed.achromatic)

  for (let i = 0; i < seeds.length; i++) {
    for (let j = i + 1; j < seeds.length; j++) {
      const separation = hueDistance(seeds[i].oklch.h, seeds[j].oklch.h)
      if (separation < 12) {
        warnings.push({
          code: 'SEEDS_NEAR_DUPLICATE',
          message:
            `${seeds[i].name} and ${seeds[j].name} are only ${separation.toFixed(0)} degrees ` +
            'apart in hue, so their ramps will look nearly identical. Move one further ' +
            'around the colour circle, or drop it and use an accent instead.',
          context: {
            first: seeds[i].name,
            second: seeds[j].name,
            separation: Number(separation.toFixed(1)),
          },
        })
      }
    }
  }

  return warnings
}
