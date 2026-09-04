/**
 * Config resolution: apply defaults, normalise seed colours, and derive
 * everything the generator needs, so the rest of the engine never has to deal
 * with optional fields or unparsed input.
 */

import { isAchromatic, oklchFromHex, parseColor, yFromHex } from './color/space.ts'
import { clampHueDrift } from './curves/hue.ts'
import { resolveChromaPoints } from './curves/chroma.ts'
import { buildLadder } from './ladder.ts'
import {
  DEFAULT_FAMILIES,
  MAX_FAMILIES,
  MIN_FAMILIES,
} from './spectrum.ts'
import {
  EngineError,
  type PaletteConfig,
  type ResolvedConfig,
  type ResolvedSeed,
  type SeedInput,
} from './types.ts'

export const MAX_SEEDS = 5

export const DEFAULT_NEUTRAL_TINT = 0.5

/** Turn a user config into a fully specified one. */
export function resolveConfig(config: PaletteConfig): ResolvedConfig {
  if (!config || !Array.isArray(config.seeds) || config.seeds.length === 0) {
    throw new EngineError('NO_SEEDS', 'A palette needs at least one seed colour.')
  }

  if (config.seeds.length > MAX_SEEDS) {
    throw new EngineError(
      'TOO_MANY_SEEDS',
      `A palette supports at most ${MAX_SEEDS} seed colours, got ${config.seeds.length}.`,
      { count: config.seeds.length },
    )
  }

  const seeds = config.seeds.map((seed, index) => resolveSeed(seed, index))
  const ladder = buildLadder(config.ladder ?? {})
  const families = config.spectrum?.families ?? DEFAULT_FAMILIES

  if (!Number.isInteger(families) || families < MIN_FAMILIES || families > MAX_FAMILIES) {
    throw new EngineError(
      'FAMILIES_OUT_OF_RANGE',
      `Family count must be a whole number between ${MIN_FAMILIES} and ${MAX_FAMILIES}, ` +
        `got ${families}.`,
      { families },
    )
  }

  return {
    seeds,
    ladder,
    chromaPoints: resolveChromaPoints(config.chroma),
    hueDrift: clampHueDrift(config.hueDrift),
    neutrals: {
      enabled: config.neutrals?.enabled ?? true,
      tintStrength: clamp01(config.neutrals?.tintStrength ?? DEFAULT_NEUTRAL_TINT),
    },
    families,
    gamut: config.gamut ?? 'srgb',
  }
}

function resolveSeed(seed: SeedInput, index: number): ResolvedSeed {
  const raw = typeof seed.color === 'string' ? seed.color : ''
  const parsed = parseColor(raw)

  if (!parsed) {
    throw new EngineError(
      'INVALID_COLOR',
      `Could not read "${raw}" as a colour. Try a hex value like #635bff.`,
      { seed: index, color: raw },
    )
  }

  const oklch = oklchFromHex(parsed.hex)

  return {
    hex: parsed.hex,
    input: raw,
    mode: seed.mode === 'exact' ? 'exact' : 'harmonize',
    index,
    ...(typeof seed.name === 'string' && seed.name ? { name: seed.name } : {}),
    oklch,
    y: yFromHex(parsed.hex),
    achromatic: isAchromatic(oklch),
    clipped: parsed.clipped,
    ...(typeof seed.slot === 'number' ? { slot: seed.slot } : {}),
    // Rotating a hue toward the first seed makes no sense for the first seed.
    blendHue: index > 0 && seed.blendHue === true,
  }
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0
  return Math.min(1, Math.max(0, v))
}

// ---------------------------------------------------------------------------
// Serialisation
// ---------------------------------------------------------------------------

/**
 * Canonical JSON for a config: keys sorted, so the same palette always produces
 * the same string and it can be used as a cache key or a permalink.
 */
export function serializeConfig(config: PaletteConfig): string {
  return JSON.stringify(sortKeys(config))
}

/** Parse a canonical config string, validating it in the process. */
export function parseConfig(serialized: string): PaletteConfig {
  let parsed: unknown
  try {
    parsed = JSON.parse(serialized)
  } catch {
    throw new EngineError('INVALID_CONFIG', 'Config is not valid JSON.')
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new EngineError('INVALID_CONFIG', 'Config must be an object.')
  }

  const config = parsed as PaletteConfig
  // Resolving throws on anything malformed, which is exactly the validation we
  // want; the original object is returned so it round-trips unchanged.
  resolveConfig(config)
  return config
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value === null || typeof value !== 'object') return value

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))

  return Object.fromEntries(entries.map(([k, v]) => [k, sortKeys(v)]))
}
