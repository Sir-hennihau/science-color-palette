/**
 * Helpers shared by the exporters.
 */

import type { OklchTuple } from '../types.ts'

/** Build a token name, keeping it safe for CSS identifiers. */
export function tokenName(prefix: string, ramp: string, label: number): string {
  const parts = [prefix, slug(ramp), String(label)].filter(Boolean)
  return parts.join('-')
}

/** Reduce a ramp name to lowercase, hyphen-separated form. */
export function slug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Format an OKLCH colour as CSS.
 *
 * Lightness as a percentage and chroma to three decimals, matching how the
 * function is normally written by hand; hue is dropped for greys, where it
 * carries no meaning.
 */
export function formatOklch(oklch: OklchTuple): string {
  const l = `${round(oklch.l * 100, 2)}%`
  const c = round(oklch.c, 4)
  if (c === 0) return `oklch(${l} 0 0)`
  return `oklch(${l} ${c} ${round(oklch.h, 2)})`
}

function round(value: number, places: number): number {
  const factor = 10 ** places
  return Math.round(value * factor) / factor
}
