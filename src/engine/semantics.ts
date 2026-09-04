/**
 * Semantic ramps: success, warning, danger, info.
 *
 * These hues are not a design choice so much as a convention — a red error and
 * a green success are learned, and a palette that reassigns them is actively
 * harmful. So the hues are anchored, and only nudged: each is rotated at most
 * 15 degrees toward the primary, which is enough to make them feel part of the
 * same palette while leaving them unmistakably red, amber, green and blue.
 *
 * The rotation each hue is allowed is capped per role, because these are
 * learned conventions and enough rotation breaks them — see
 * SEMANTIC_MAX_ROTATION.
 *
 * They ride the same lightness ladder as everything else, so a danger 600 has
 * exactly the contrast a primary 600 does. One consequence is worth stating
 * plainly rather than hiding: a contrast-safe dark amber is brown. That is not
 * a bug in the generator, it is what the gamut allows — there is no dark vivid
 * yellow — and every accessible design system has the same brown in it.
 */

import { hueDistance } from './color/space.ts'
import { chromaCeilingCurve, chromaCurve } from './curves/chroma.ts'
import { hueCurve } from './curves/hue.ts'
import { generateRamp, type RampSpec } from './ramp.ts'
import { SEMANTIC_MAX_ROTATION } from './config.ts'
import { blendTowardHue } from './seeds.ts'
import type { EngineWarning, Ramp, ResolvedConfig, SemanticRole } from './types.ts'

const SEMANTIC_ORDER: readonly SemanticRole[] = ['success', 'warning', 'danger', 'info']

/** Hue separation below which a semantic colour is confusable with the primary. */
const COINCIDENCE_DEGREES = 25

/** Generate the semantic ramps. */
export function generateSemanticRamps(
  resolved: ResolvedConfig,
  primaryHue: number | null,
): Ramp[] {
  if (!resolved.semantics.enabled) return []

  return SEMANTIC_ORDER.map((role) => buildSemanticRamp(role, resolved, primaryHue))
}

function buildSemanticRamp(
  role: SemanticRole,
  resolved: ResolvedConfig,
  primaryHue: number | null,
): Ramp {
  const anchor = resolved.semantics.hues[role]
  const hue =
    resolved.semantics.harmonize && primaryHue !== null
      ? blendTowardHue(anchor, primaryHue, SEMANTIC_MAX_ROTATION[role])
      : anchor

  const warnings: EngineWarning[] = []

  if (primaryHue !== null && hueDistance(hue, primaryHue) < COINCIDENCE_DEGREES) {
    warnings.push({
      code: 'SEMANTIC_NEAR_PRIMARY',
      message:
        `The ${role} colour sits close to your primary hue, so a ${role} message may not ` +
        'stand out. Consider a different primary, or set this hue explicitly.',
      context: { role, hue: Number(hue.toFixed(2)) },
    })
  }

  const spec: RampSpec = {
    role,
    name: role,
    hue,
    ladder: resolved.ladder,
    fraction: chromaCurve(resolved.chromaPoints),
    ceiling: chromaCeilingCurve(resolved.chromaPoints),
    hueCurve: hueCurve(hue, resolved.hueDrift, 0.5),
    usesSharedLadder: true,
    gamut: resolved.gamut,
    warnings,
  }

  return generateRamp(spec)
}
