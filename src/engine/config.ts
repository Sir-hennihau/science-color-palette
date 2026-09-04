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
  EngineError,
  type HarmonyKind,
  type PaletteConfig,
  type ResolvedConfig,
  type SeedInput,
  type ResolvedSeed,
  type SeedRole,
  type SemanticRole,
} from './types.ts'

export const MAX_SEEDS = 5

const SEED_ROLES: readonly SeedRole[] = [
  'primary',
  'secondary',
  'tertiary',
  'quaternary',
  'quinary',
]

/**
 * OKLCH hue anchors for the semantic roles.
 *
 * Chosen to match what the conventions already are — these land on the familiar
 * red, amber, emerald and sky families — so a palette's semantic colours read
 * as "danger" and "success" without being explained.
 */
export const SEMANTIC_HUES: Record<SemanticRole, number> = {
  danger: 27,
  warning: 70,
  success: 150,
  info: 237,
}

/**
 * How far each semantic hue may be rotated toward the primary.
 *
 * Harmonising makes semantic colours feel part of the palette, but these hues
 * are learned conventions rather than aesthetic choices, and rotating them far
 * enough breaks the convention. Left at a flat 15 degrees, a yellow primary
 * pulls danger from red to orange — an error colour that reads as a warning,
 * sitting close enough to the actual warning to be confusable. Red gets the
 * least room because it is the most load-bearing of the four.
 */
export const SEMANTIC_MAX_ROTATION: Record<SemanticRole, number> = {
  danger: 6,
  warning: 12,
  success: 15,
  info: 15,
}

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

  const semanticHues: Record<SemanticRole, number> = { ...SEMANTIC_HUES }
  for (const [role, hue] of Object.entries(config.semantics?.hues ?? {})) {
    if (hue !== undefined && Number.isFinite(hue)) {
      semanticHues[role as SemanticRole] = hue
    }
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
    semantics: {
      enabled: config.semantics?.enabled ?? true,
      harmonize: config.semantics?.harmonize ?? true,
      hues: semanticHues,
    },
    harmony: {
      auto: config.harmony?.auto ?? false,
      include: dedupeHarmony(config.harmony?.include),
    },
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
  const role = seed.role ?? SEED_ROLES[index]

  return {
    hex: parsed.hex,
    input: raw,
    mode: seed.mode === 'exact' ? 'exact' : 'harmonize',
    role,
    name: typeof seed.name === 'string' && seed.name ? seed.name : role,
    oklch,
    y: yFromHex(parsed.hex),
    achromatic: isAchromatic(oklch),
    clipped: parsed.clipped,
    slot: typeof seed.slot === 'number' ? seed.slot : undefined,
    // Rotating a hue toward the primary makes no sense for the primary itself.
    blendHue: index > 0 && seed.blendHue === true,
  }
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0
  return Math.min(1, Math.max(0, v))
}

function dedupeHarmony(kinds: HarmonyKind[] | undefined): HarmonyKind[] {
  if (!kinds || kinds.length === 0) return []
  return [...new Set(kinds)]
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
