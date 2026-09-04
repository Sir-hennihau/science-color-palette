/**
 * The engine's public type surface.
 *
 * Everything here is plain JSON: no functions, no class instances, no values
 * that only exist at runtime. That is a deliberate constraint — the config maps
 * one-to-one onto URL search params, and the output can be snapshot-tested,
 * cached and serialised without special handling.
 */

/** Lowercase `#rrggbb`. */
export type HexColor = string

/**
 * How a seed colour is treated.
 *
 * - `harmonize` moves the seed to the scientifically ideal nearby colour: it
 *   lands on the ladder's lightness and the curve's chroma, so the ramp is
 *   internally perfect and the primary is only *similar* to what was typed.
 * - `exact` keeps the seed verbatim and reshapes the ramp around it, so the
 *   colour is preserved even where that costs a contrast guarantee. The cost is
 *   always reported, never hidden.
 */
export type SeedMode = 'exact' | 'harmonize'

/** Target display gamut. v1 emits sRGB; the envelope math is already generic. */
export type GamutId = 'srgb'

export type SeedRole = 'primary' | 'secondary' | 'tertiary' | 'quaternary' | 'quinary'

export type SemanticRole = 'success' | 'warning' | 'danger' | 'info'

export type HarmonyKind =
  | 'complementary'
  | 'analogous'
  | 'triadic'
  | 'split-complementary'
  | 'tetradic'

export type ChromaPreset = 'vivid' | 'natural' | 'muted' | 'custom'

/** A ramp's place in the palette. */
export type RampRole = SeedRole | 'neutral' | SemanticRole | `accent-${string}`

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface SeedInput {
  /** Any CSS colour string. Normalised to hex during resolution. */
  color: string
  /** Defaults to `harmonize`. */
  mode?: SeedMode
  /** Defaults to the role implied by position in the seeds array. */
  role?: SeedRole
  /** Token name used in exports. Defaults to the role. */
  name?: string
  /** Force the shade label the seed occupies. Defaults to the nearest one. */
  slot?: number
  /** Rotate this seed's hue slightly toward the primary's. Non-primary only. */
  blendHue?: boolean
}

/**
 * One pinned point on the lightness ladder.
 *
 * `lstar` anchors are aesthetic. `ratioOnWhite` / `ratioOnBlack` anchors are
 * *contracts*: they are converted to an exact luminance, so a step landing on
 * one is guaranteed to hit that contrast ratio.
 */
export interface LadderAnchor {
  /** Position along the ramp, 0 = lightest, 1 = darkest. */
  t: number
  lstar?: number
  ratioOnWhite?: number
  ratioOnBlack?: number
}

export interface LadderConfig {
  /** Number of shades, 5..15. Defaults to 11. */
  steps?: number
  /** CIELAB L* of the lightest shade. Defaults to 97.8. */
  lightestL?: number
  /** CIELAB L* of the darkest shade. Defaults to 13. */
  darkestL?: number
  /** Replaces the default interior anchors entirely. Advanced. */
  anchors?: LadderAnchor[]
}

export interface ChromaConfig {
  preset?: ChromaPreset
  /** Fraction of the available chroma at the light end. `custom` only. */
  light?: number
  /** Fraction at mid-ramp, where colourfulness peaks. `custom` only. */
  peak?: number
  /** Fraction at the dark end. `custom` only. */
  dark?: number
}

export interface NeutralsConfig {
  enabled?: boolean
  /** 0 = pure grey, 1 = as tinted as neutrals should ever get. Defaults to 0.5. */
  tintStrength?: number
}

export interface SemanticsConfig {
  enabled?: boolean
  /** Rotate semantic hues slightly toward the primary. Defaults to true. */
  harmonize?: boolean
  /** Override the OKLCH hue anchor for any semantic role. */
  hues?: Partial<Record<SemanticRole, number>>
}

export interface HarmonyConfig {
  /** Generate ramps for the best-scoring suggestion. */
  auto?: boolean
  /** Generate ramps for these specific schemes. */
  include?: HarmonyKind[]
}

export interface PaletteConfig {
  seeds: SeedInput[]
  ladder?: LadderConfig
  chroma?: ChromaConfig
  /** Degrees of hue rotation across the whole ramp. Defaults to 0. */
  hueDrift?: number
  neutrals?: NeutralsConfig
  semantics?: SemanticsConfig
  harmony?: HarmonyConfig
  gamut?: GamutId
}

// ---------------------------------------------------------------------------
// Resolved configuration (defaults applied, derived values computed)
// ---------------------------------------------------------------------------

export interface ResolvedLadder {
  steps: number
  /** Position of each step, ascending from 0. */
  t: number[]
  /** Shade labels, e.g. 50..950. */
  labels: number[]
  /** CIELAB L* of each step. */
  lstar: number[]
  /** Relative-luminance target of each step. */
  yTargets: number[]
  /** Contracts that landed exactly on a step. */
  contracts: LadderContract[]
}

export interface LadderContract {
  /** Index of the step this contract applies to. */
  index: number
  kind: 'ratioOnWhite' | 'ratioOnBlack'
  /** The contrast ratio the step is solved to reach. */
  target: number
}

export interface ResolvedConfig {
  seeds: ResolvedSeed[]
  ladder: ResolvedLadder
  chromaPoints: { light: number; peak: number; dark: number; ceilingScale: number }
  hueDrift: number
  neutrals: Required<NeutralsConfig>
  semantics: { enabled: boolean; harmonize: boolean; hues: Record<SemanticRole, number> }
  harmony: { auto: boolean; include: HarmonyKind[] }
  gamut: GamutId
}

export interface ResolvedSeed {
  hex: HexColor
  /** The colour as typed, before any clipping into sRGB. */
  input: string
  mode: SeedMode
  role: SeedRole
  name: string
  /** OKLCH of the (clipped) seed. */
  oklch: OklchTuple
  /** Relative luminance of the seed. */
  y: number
  /** True when the seed carries no meaningful hue. */
  achromatic: boolean
  /** True when the input was outside sRGB and had to be clipped. */
  clipped: boolean
  slot?: number
  blendHue: boolean
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

export interface OklchTuple {
  l: number
  c: number
  /** Degrees in [0, 360). Zero and meaningless when `c` is ~0. */
  h: number
}

export interface WcagInfo {
  /** Relative luminance of the shipped hex. */
  y: number
  onWhite: number
  onBlack: number
  /** Against the lightest step of this ramp. */
  onLightest: number
  /** Against the darkest step of this ramp. */
  onDarkest: number
}

export interface ApcaInfo {
  /** Signed Lc for this colour as text on white. */
  asTextOnWhite: number
  asTextOnBlack: number
  /** Signed Lc for black text drawn on this colour. */
  asBgWithBlackText: number
  asBgWithWhiteText: number
}

export interface StepGuarantee {
  kind: LadderContract['kind']
  target: number
  /** Measured on the shipped hex, not assumed from the solve. */
  actual: number
  met: boolean
}

export interface Swatch {
  index: number
  label: number
  t: number
  /** The shipped colour. */
  hex: HexColor
  /** The float colour the hex was quantised from. */
  oklch: OklchTuple
  rgb: { r: number; g: number; b: number }
  wcag: WcagInfo
  apca: ApcaInfo
  /** Hex to draw text in on top of this swatch, for maximum legibility. */
  onHex: HexColor
  /** True only for the verbatim seed of an `exact` ramp. */
  isSeed: boolean
  /** True when gamut mapping had to move this colour. */
  gamutMapped: boolean
  guarantees: StepGuarantee[]
}

/** How far, and in which direction, a seed moved from what was typed. */
export interface SeedDelta {
  /** Euclidean OKLab distance; ~0.02 is one just-noticeable difference. */
  eok: number
  dL: number
  dC: number
  /** Shortest-arc hue difference, signed. */
  dH: number
  magnitude: 'none' | 'subtle' | 'noticeable' | 'large'
}

export interface EngineWarning {
  code: string
  message: string
  context?: Record<string, string | number>
}

export interface PairEntry {
  /** How many steps apart the two shades are. */
  distance: number
  /** Worst WCAG ratio found at this distance anywhere in the ramp. */
  minWcag: number
  /** Worst absolute APCA Lc at this distance. */
  minApcaLc: number
  /** The step indices that produced the worst case. */
  pair: [number, number]
}

/** First shade label meeting each WCAG level, or null if none does. */
export interface LevelLabels {
  aaLarge: number | null
  aa: number | null
  aaa: number | null
}

export interface RampReport {
  /** Worst-case contrast for every step separation in this ramp. */
  pairTable: PairEntry[]
  firstOnWhite: LevelLabels
  firstOnBlack: LevelLabels
  brokenGuarantees: Array<StepGuarantee & { label: number }>
  /**
   * False when the ramp's lightness ladder was warped to accommodate an exact
   * seed, which means its steps no longer line up with the rest of the palette.
   */
  usesSharedLadder: boolean
  warnings: EngineWarning[]
}

export interface RampSeedInfo {
  input: HexColor
  mode: SeedMode
  slotLabel: number
  delta: SeedDelta
}

export interface Ramp {
  role: RampRole
  name: string
  /** Null for an achromatic ramp. */
  hue: number | null
  swatches: Swatch[]
  seed?: RampSeedInfo
  report: RampReport
}

export interface HarmonySuggestion {
  kind: HarmonyKind
  /** The hues this scheme adds, in degrees. */
  hues: number[]
  /** How well the seeds fit this scheme, 0..1. */
  confidence: number
  preview: Array<{ hue: number; hex: HexColor }>
  rationale: string
}

export interface Palette {
  ramps: Ramp[]
  suggestions: HarmonySuggestion[]
  /** Valid across every ramp whose `usesSharedLadder` is true. */
  sharedPairTable: PairEntry[]
  resolved: ResolvedConfig
  /** The config as supplied, echoed back verbatim. */
  input: PaletteConfig
  warnings: EngineWarning[]
  meta: {
    engineVersion: string
    algorithmVersion: number
    gamut: GamutId
  }
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export type EngineErrorCode =
  | 'INVALID_COLOR'
  | 'NO_SEEDS'
  | 'TOO_MANY_SEEDS'
  | 'STEPS_OUT_OF_RANGE'
  | 'SLOT_NOT_FOUND'
  | 'ANCHORS_NOT_MONOTONE'
  | 'INVALID_CONFIG'

export class EngineError extends Error {
  readonly code: EngineErrorCode
  readonly context?: Record<string, string | number>

  constructor(code: EngineErrorCode, message: string, context?: Record<string, string | number>) {
    super(message)
    this.name = 'EngineError'
    this.code = code
    this.context = context
  }
}
