/**
 * The orchestrator: seeds in, complete palette out.
 */

import { JND_EOK } from './constants.ts'
import { resolveConfig } from './config.ts'
import { deltaEOK, hueDistance } from './color/space.ts'
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

  warnings.push(...crowdingWarnings(families, resolved))
  warnings.push(...mergeWarnings(ramps))

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
 * Warn when the seeds have squeezed the wheel shut.
 *
 * This is a question about *input*: sixteen families around the circle leaves
 * 22 degrees between neighbours, which is not much, and two seeds close
 * together can push a gap below that. Below about 18 degrees they start reading
 * as shades of each other and the palette gains rows without gaining colours.
 *
 * Deliberately still an angle. It describes where the colours were asked to go,
 * which is what the person can act on. What the colours actually came out like
 * is a different question, and {@link mergeWarnings} measures that instead —
 * the two disagree more often than you would expect, because equal steps in
 * OKLCH hue are not equal perceptual steps.
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
 * Warn when the light end has fewer colours than it has rows.
 *
 * Measured on the generated colours, not inferred. The lightest shades are held
 * to a small absolute chroma — that is what gives curated palettes their barely
 * tinted 50s and 100s — so every hue is squeezed into the same narrow disc up
 * there and they run out of room to differ long before mid-ramp does. At ten
 * families half the neighbouring pairs are already within a just-noticeable
 * difference at shade 100; at sixteen almost all of them are.
 *
 * The threshold is "most of them", so the default palette stays quiet and the
 * warning means something when it does fire.
 */
function mergeWarnings(ramps: Ramp[]): EngineWarning[] {
  const families = ramps.filter((ramp) => ramp.role !== 'neutral' && ramp.hue !== null)

  // Index 1, not 0: shade 50 is nearly white in every hue by design, so it
  // would report every palette as merged and say nothing.
  const step = 1
  if (families.length < 3 || families[0].swatches.length <= step) return []

  const merged = families.filter((ramp, i) => {
    const next = families[(i + 1) % families.length]
    return (
      next !== ramp &&
      deltaEOK(ramp.swatches[step].oklch, next.swatches[step].oklch) < JND_EOK
    )
  }).length

  if (merged <= families.length / 2) return []

  return [
    {
      code: 'LIGHT_SHADES_MERGED',
      message:
        `${merged} of your ${families.length} families are indistinguishable from their ` +
        `neighbour at shade ${families[0].swatches[step].label}. The lightest shades are ` +
        'deliberately barely tinted, so they run out of room to differ before the rest of the ' +
        'ramp does — at this many families the light end has fewer colours than rows.',
      context: { families: families.length, merged },
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
