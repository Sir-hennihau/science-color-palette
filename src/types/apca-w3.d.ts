/**
 * Minimal declarations for the reference APCA implementation.
 *
 * Used only as a test oracle — our own implementation in
 * `src/engine/contrast/apca.ts` is what ships — so this covers just the two
 * functions the oracle sweep calls.
 */
declare module 'apca-w3' {
  /** Screen luminance from an 8-bit sRGB triple. */
  export function sRGBtoY(rgb: [number, number, number]): number

  /**
   * Signed lightness contrast. Positive for dark text on a light background,
   * negative for the reverse. `places` of -1 returns a raw number.
   */
  export function APCAcontrast(textY: number, bgY: number, places?: number): number | string
}
