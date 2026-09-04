/**
 * The URL is the single source of truth for a palette.
 *
 * Keeping the whole configuration in typed search params costs almost nothing
 * and buys a lot: a palette is shareable by copying the address bar, survives a
 * refresh, and the browser's own back button becomes undo. It also makes the
 * app trivially testable, since any state can be reached by navigating to it.
 *
 * Seeds are packed as `635bff.x` rather than nested JSON to keep the address
 * readable; a five-seed palette with every control changed still fits in around
 * 200 characters.
 */

import { z } from 'zod'
import {
  MAX_FAMILIES,
  MAX_HUE_DRIFT,
  MAX_SEEDS,
  MAX_STEPS,
  MIN_FAMILIES,
  MIN_STEPS,
  type ChromaPreset,
  type PaletteConfig,
  type SeedMode,
} from '../engine/index.ts'

/** `rrggbb` then `.x` for exact or `.h` for harmonize. */
const PACKED_SEED = /^[0-9a-f]{6}\.(x|h)$/

export const DEFAULT_SEED = '635bff.h'

export const paletteSearchSchema = z.object({
  seeds: z
    .array(z.string().regex(PACKED_SEED))
    .min(1)
    .max(MAX_SEEDS)
    .default([DEFAULT_SEED])
    .catch([DEFAULT_SEED]),
  families: z
    .number()
    .int()
    .min(MIN_FAMILIES)
    .max(MAX_FAMILIES)
    .default(10)
    .catch(10),
  steps: z.number().int().min(MIN_STEPS).max(MAX_STEPS).default(11).catch(11),
  chroma: z.enum(['vivid', 'natural', 'muted']).default('natural').catch('natural'),
  drift: z.number().min(-MAX_HUE_DRIFT).max(MAX_HUE_DRIFT).default(0).catch(0),
  tint: z.number().min(0).max(1).default(0.5).catch(0.5),
})

export type PaletteSearch = z.infer<typeof paletteSearchSchema>

export const SEARCH_DEFAULTS: PaletteSearch = {
  seeds: [DEFAULT_SEED],
  families: 10,
  steps: 11,
  chroma: 'natural',
  drift: 0,
  tint: 0.5,
}

export interface UnpackedSeed {
  hex: string
  mode: SeedMode
}

export function unpackSeed(packed: string): UnpackedSeed {
  const [hex, flag] = packed.split('.')
  return { hex: `#${hex}`, mode: flag === 'x' ? 'exact' : 'harmonize' }
}

export function packSeed(seed: UnpackedSeed): string {
  return `${seed.hex.replace('#', '').toLowerCase()}.${seed.mode === 'exact' ? 'x' : 'h'}`
}

export function unpackSeeds(packed: string[]): UnpackedSeed[] {
  return packed.map(unpackSeed)
}

/** Translate the URL state into the engine's configuration. */
export function toEngineConfig(search: PaletteSearch): PaletteConfig {
  return {
    seeds: unpackSeeds(search.seeds).map((seed) => ({
      color: seed.hex,
      mode: seed.mode,
    })),
    spectrum: { families: search.families },
    ladder: { steps: search.steps },
    chroma: { preset: search.chroma as ChromaPreset },
    hueDrift: search.drift,
    neutrals: { enabled: true, tintStrength: search.tint },
  }
}
