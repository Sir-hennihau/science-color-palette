import { usePaletteSession } from '../lib/palette-session.tsx'
import { APCA_THRESHOLDS, WCAG_THRESHOLDS, apcaLc, wcagContrastHex } from '../engine/index.ts'

/**
 * Contrast, measured two ways.
 *
 * WCAG 2 is the ruler with legal force, so it decides pass and fail. APCA is
 * the better predictor of what a reader can actually make out, so it sits
 * alongside rather than instead — and where the two disagree, seeing both is
 * the point.
 *
 * Pass and fail are never carried by colour alone: every mark is an icon and a
 * word as well.
 */
export function ContrastPanel() {
  const { palette } = usePaletteSession()

  return (
    <div className="flex flex-col gap-8">
      <StepDistanceTable />
      <RampTable />
    </div>
  )

  function StepDistanceTable() {
    const table = palette.sharedPairTable
    if (table.length === 0) return null

    const aa = table.find((e) => e.minWcag >= WCAG_THRESHOLDS.aa)
    const aaLarge = table.find((e) => e.minWcag >= WCAG_THRESHOLDS.aaLarge)

    return (
      <section className="flex flex-col gap-3">
        <div>
          <h3 className="text-[14px] font-medium">Distance between shades</h3>
          <p className="mt-1 max-w-[62ch] text-[12.5px] text-ink-muted">
            Every ramp shares one lightness scale, so these hold for any two shades from any two
            ramps — pick by number and the contrast follows.
            {aa && aaLarge && (
              <>
                {' '}
                In this palette, {aaLarge.distance} steps apart is enough for large text and{' '}
                {aa.distance} for body text.
              </>
            )}
          </p>
        </div>

        <table className="w-full max-w-lg border-collapse text-[12.5px]">
          <caption className="sr-only">
            Worst-case contrast for each number of steps between shades
          </caption>
          <thead>
            <tr className="border-b border-line text-left">
              <th scope="col" className="py-1.5 pr-3 font-medium">
                Steps apart
              </th>
              <th scope="col" className="py-1.5 pr-3 text-right font-medium">
                At least
              </th>
              <th scope="col" className="py-1.5 pr-3 text-right font-medium">
                APCA
              </th>
              <th scope="col" className="py-1.5 font-medium">
                Good for
              </th>
            </tr>
          </thead>
          <tbody>
            {table.map((entry) => (
              <tr key={entry.distance} className="border-b border-line/60">
                <td className="tabular py-1.5 pr-3">{entry.distance}</td>
                <td className="tabular py-1.5 pr-3 text-right">{entry.minWcag.toFixed(2)}:1</td>
                <td className="tabular py-1.5 pr-3 text-right text-ink-muted">
                  Lc {Math.round(entry.minApcaLc)}
                </td>
                <td className="py-1.5 text-ink-muted">{useFor(entry.minWcag)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    )
  }

  function RampTable() {
    return (
      <section className="flex flex-col gap-3">
        <div>
          <h3 className="text-[14px] font-medium">Each shade against white and black</h3>
          <p className="mt-1 max-w-[62ch] text-[12.5px] text-ink-muted">
            The first shade in each ramp that clears each level. Judge a palette on both surfaces —
            a colour that works on white often fails on black.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[46rem] border-collapse text-[12.5px]">
            <caption className="sr-only">
              First shade of each ramp meeting each contrast level, on white and on black
            </caption>
            <thead>
              <tr className="border-b border-line text-left">
                <th scope="col" rowSpan={2} className="py-1.5 pr-3 align-bottom font-medium">
                  Ramp
                </th>
                <th scope="colgroup" colSpan={3} className="py-1.5 pr-3 font-medium">
                  On white
                </th>
                <th scope="colgroup" colSpan={3} className="py-1.5 pr-3 font-medium">
                  On black
                </th>
              </tr>
              <tr className="border-b border-line text-left text-ink-muted">
                {['Large', 'Body', 'Body AAA', 'Large', 'Body', 'Body AAA'].map((label, i) => (
                  <th scope="col" key={i} className="py-1 pr-3 font-normal">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {palette.ramps.map((ramp) => (
                <tr key={ramp.role} className="border-b border-line/60">
                  <th scope="row" className="py-1.5 pr-3 text-left font-normal">
                    <span className="flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        className="h-3 w-3 shrink-0 border border-line"
                        style={{
                          backgroundColor:
                            ramp.swatches[Math.min(6, ramp.swatches.length - 1)].hex,
                        }}
                      />
                      {ramp.name}
                    </span>
                  </th>
                  {(
                    [
                      ramp.report.firstOnWhite.aaLarge,
                      ramp.report.firstOnWhite.aa,
                      ramp.report.firstOnWhite.aaa,
                      ramp.report.firstOnBlack.aaLarge,
                      ramp.report.firstOnBlack.aa,
                      ramp.report.firstOnBlack.aaa,
                    ] as Array<number | null>
                  ).map((label, i) => (
                    <td key={i} className="tabular py-1.5 pr-3">
                      {label === null ? (
                        <span className="text-ink-faint">none</span>
                      ) : (
                        <span>{label}</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    )
  }
}

function useFor(ratio: number): string {
  if (ratio >= WCAG_THRESHOLDS.aaa) return 'Body text, to the strictest level'
  if (ratio >= WCAG_THRESHOLDS.aa) return 'Body text'
  if (ratio >= WCAG_THRESHOLDS.aaLarge) return 'Large text, icons, borders'
  return 'Decoration only'
}

/**
 * A single pair, measured both ways. Used by the swatch inspector.
 */
export function PairReadout({
  foreground,
  background,
  label,
}: {
  foreground: string
  background: string
  label: string
}) {
  const ratio = wcagContrastHex(foreground, background)
  const lc = Math.abs(apcaLc(foreground, background))

  const level =
    ratio >= WCAG_THRESHOLDS.aaa
      ? 'AAA'
      : ratio >= WCAG_THRESHOLDS.aa
        ? 'AA'
        : ratio >= WCAG_THRESHOLDS.aaLarge
          ? 'AA large'
          : 'Fail'

  const passes = ratio >= WCAG_THRESHOLDS.aaLarge

  return (
    <div className="grid grid-cols-[1fr_auto_auto_auto] items-baseline gap-x-2 border-b border-line/60 py-1">
      <span className="truncate text-[12px] text-ink-muted">{label}</span>
      <span className="tabular text-[12px]">{ratio.toFixed(2)}:1</span>
      <span className="tabular text-[11px] text-ink-muted">{Math.round(lc)}</span>
      <Badge passes={passes} label={level} />
    </div>
  )
}

function Badge({ passes, label }: { passes: boolean; label: string }) {
  return (
    <span
      className={[
        'inline-flex shrink-0 items-center justify-end gap-1 whitespace-nowrap text-[11px]',
        passes ? 'text-pass' : 'text-fail',
      ].join(' ')}
    >
      {passes ? <TickMark /> : <CrossMark />}
      {label}
    </span>
  )
}

function TickMark() {
  return (
    <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" aria-hidden="true">
      <path
        d="M2 6.4l2.6 2.6L10 3.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

function CrossMark() {
  return (
    <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" aria-hidden="true">
      <path d="M2.6 2.6l6.8 6.8M9.4 2.6l-6.8 6.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

/** APCA level names, exposed so the inspector can describe an Lc value. */
export function apcaDescription(lc: number): string {
  const abs = Math.abs(lc)
  if (abs >= APCA_THRESHOLDS.bodyPreferred) return 'comfortable for body text'
  if (abs >= APCA_THRESHOLDS.bodyMinimum) return 'usable for body text'
  if (abs >= APCA_THRESHOLDS.fluentText) return 'usable for headings and labels'
  if (abs >= APCA_THRESHOLDS.largeText) return 'large text only'
  if (abs >= APCA_THRESHOLDS.anyText) return 'the floor for any text'
  if (abs >= APCA_THRESHOLDS.nonText) return 'shapes and borders only'
  return 'effectively invisible'
}
