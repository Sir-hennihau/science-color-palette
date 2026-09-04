/**
 * Science Color Palette — palette generation engine.
 *
 * The only module the application imports. Everything inside `src/engine` is
 * pure TypeScript with no framework or DOM dependency, so it can be tested,
 * benchmarked and eventually extracted without touching the app.
 *
 * The short version of how it works: a palette is built on one shared lightness
 * ladder, because WCAG contrast depends on relative luminance alone and pinning
 * a step's luminance therefore pins its contrast exactly. Colourfulness is then
 * expressed as a share of what each hue can actually manage at that lightness,
 * which is what lets a single set of curves produce a yellow ramp that peaks
 * light and a blue one that peaks dark.
 */

export { generatePalette } from './palette.ts'
export { generateRamp, type RampSpec, type SeedInsert } from './ramp.ts'
export {
  resolveConfig,
  parseConfig,
  serializeConfig,
  SEMANTIC_HUES,
  SEMANTIC_MAX_ROTATION,
  MAX_SEEDS,
} from './config.ts'

// Ladder and step counts, for UI controls and labels.
export {
  buildLadder,
  labelForT,
  nearestSlot,
  slotForLabel,
  DEFAULT_STEPS,
  MAX_STEPS,
  MIN_STEPS,
} from './ladder.ts'

// Contrast, for panels that judge arbitrary pairs the palette did not generate.
export {
  wcagContrastHex,
  wcagRatioFromY,
  yForRatioOnBlack,
  yForRatioOnWhite,
  WCAG_THRESHOLDS,
  type WcagLevel,
} from './contrast/wcag.ts'
export {
  apcaLc,
  apcaLevelFor,
  apcaY,
  apcaYFromHex,
  APCA_THRESHOLDS,
  type ApcaLevel,
} from './contrast/apca.ts'

// Colour conversion and formatting, for pickers and inspectors.
export {
  deltaEOK,
  hueDelta,
  hueDistance,
  isAchromatic,
  lstarFromY,
  normalizeHue,
  oklchFromHex,
  oklchToRgb,
  parseColor,
  quantize,
  rgb8ToHex,
  yFromHex,
  yFromLstar,
  type Oklch,
  type ParsedColor,
} from './color/space.ts'

// The chroma envelope, for the science view.
export {
  cMaxAt,
  cMaxExact,
  cMaxTriangle,
  findCusp,
  getEnvelope,
  type Cusp,
  type Envelope,
} from './color/envelope.ts'
export { inGamut, mapToGamut } from './color/gamut.ts'

export { CHROMA_PRESETS, resolveChromaPoints, type ChromaPoints } from './curves/chroma.ts'
export { MAX_HUE_DRIFT } from './curves/hue.ts'
export { ALL_HARMONY_KINDS, harmonyHues } from './harmony.ts'
export { blendTowardHue, describeDelta, MAX_BLEND_ROTATION } from './seeds.ts'
export { NEUTRAL_MAX_CHROMA } from './neutrals.ts'

// Export formats.
export {
  EXPORT_FORMATS,
  exportCss,
  exportDtcg,
  exportJson,
  exportPalette,
  exportTailwindTheme,
  type CssOptions,
  type DtcgOptions,
  type ExportDescriptor,
  type ExportFormat,
  type JsonOptions,
  type TailwindOptions,
} from './export/index.ts'

export { ALGORITHM_VERSION, ENGINE_VERSION } from './version.ts'

export * from './types.ts'
