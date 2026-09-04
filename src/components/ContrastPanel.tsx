import { CrossMark, TickMark, WarningMark } from './StatusMarks.tsx'
import { usePaletteSession } from '../lib/palette-session.tsx'
import {
  APCA_THRESHOLDS,
  WCAG_THRESHOLDS,
  apcaLc,
  wcagContrastHex,
  type LevelLabels,
  type Ramp,
} from '../engine/index.ts'

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

  /**
   * What a difference of N shade numbers is worth.
   *
   * Ten rows, of which four say "decoration only" and three say the same thing
   * as each other. The three thresholds are the whole answer, so they are
   * stated as the answer; the table behind them is for checking the working.
   */
  function StepDistanceTable() {
    const table = palette.sharedPairTable
    if (table.length === 0) return null

    const thresholds: Array<[string, number]> = [
      ['Large text, icons, borders', WCAG_THRESHOLDS.aaLarge],
      ['Body text', WCAG_THRESHOLDS.aa],
      ['Body text, strictest level', WCAG_THRESHOLDS.aaa],
    ]

    return (
      <section className="flex flex-col gap-3">
        <div>
          <h3 className="text-[14px] font-medium">Distance between shades</h3>
          <p className="mt-1 max-w-[62ch] text-[12.5px] text-ink-muted">
            Every ramp shares one lightness scale, so these hold for any two shades from any two
            ramps — pick by number and the contrast follows.
          </p>
        </div>

        <dl className="grid w-fit grid-cols-[auto_auto] gap-x-6 gap-y-1">
          {thresholds.map(([label, ratio]) => {
            const entry = table.find((e) => e.minWcag >= ratio)

            return (
              <div key={label} className="col-span-2 grid grid-cols-subgrid items-baseline">
                <dt className="text-[12.5px] text-ink-muted">{label}</dt>
                <dd className="text-[12.5px] font-medium">
                  {entry ? (
                    <>
                      <span className="tabular">{entry.distance}</span> steps apart
                      <span className="tabular ml-2 font-normal text-ink-muted">
                        {entry.minWcag.toFixed(2)}:1
                      </span>
                    </>
                  ) : (
                    <span className="font-normal text-ink-faint">
                      not reachable in {table.length + 1} shades
                    </span>
                  )}
                </dd>
              </div>
            )
          })}
        </dl>

        <details className="group border-t border-line pt-2">
          <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 text-[12.5px] text-ink-muted hover:text-ink [&::-webkit-details-marker]:hidden">
            <Chevron />
            Show every distance
          </summary>

          <table className="mt-3 w-full max-w-lg border-collapse text-[12.5px]">
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
        </details>
      </section>
    )
  }

  /**
   * The first shade of each ramp that clears each level.
   *
   * This was a twelve-row table in which every row was identical, because that
   * is precisely what the shared scale guarantees — twelve rows of evidence for
   * a fact stated once. So the answer is stated once, deviations are named, and
   * the full table stays a click away for anyone who wants to see it rather
   * than be told it.
   */
  function RampTable() {
    const ramps = palette.ramps
    if (ramps.length === 0) return null

    const groups = new Map<string, typeof ramps>()
    for (const ramp of ramps) {
      const key = signature(ramp)
      groups.set(key, [...(groups.get(key) ?? []), ramp])
    }

    // The shared answer is whichever pattern most ramps agree on; anything else
    // is a ramp that gave up the shared scale, and is worth naming.
    const shared = [...groups.entries()].sort((a, b) => b[1].length - a[1].length)[0]
    const agreeing = shared[1]
    const exceptions = ramps.filter((ramp) => !agreeing.includes(ramp))
    const answer = agreeing[0].report

    return (
      <section className="flex flex-col gap-3">
        <div>
          <h3 className="text-[14px] font-medium">Each shade against white and black</h3>
          <p className="mt-1 max-w-[62ch] text-[12.5px] text-ink-muted">
            The first shade that clears each level. Judge a palette on both surfaces — a colour that
            works on white often fails on black.
          </p>
        </div>

        <div className="flex flex-wrap gap-x-10 gap-y-4">
          <Answer title="On white" levels={answer.firstOnWhite} />
          <Answer title="On black" levels={answer.firstOnBlack} />
        </div>

        <p className="max-w-[62ch] text-[12.5px] text-ink-muted">
          {agreeing.length === ramps.length ? (
            <>Identical in all {ramps.length} ramps — that is what the shared scale buys.</>
          ) : (
            <>
              True in {agreeing.length} of {ramps.length} ramps.
            </>
          )}
        </p>

        {exceptions.length > 0 && (
          <ul className="flex max-w-[62ch] flex-col gap-1">
            {exceptions.map((ramp) => (
              <li key={ramp.role} className="flex items-start gap-1.5 text-[12.5px] text-warn">
                <span className="mt-0.5">
                  <WarningMark />
                </span>
                <span>
                  <span className="font-medium">{ramp.name}</span> differs:{' '}
                  <span className="tabular">{describe(ramp.report.firstOnWhite)}</span> on white,{' '}
                  <span className="tabular">{describe(ramp.report.firstOnBlack)}</span> on black.
                  {!ramp.report.usesSharedLadder && ' It uses its own lightness scale.'}
                </span>
              </li>
            ))}
          </ul>
        )}

        <details className="group border-t border-line pt-2">
          <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 text-[12.5px] text-ink-muted hover:text-ink [&::-webkit-details-marker]:hidden">
            <Chevron />
            Show all {ramps.length} ramps
          </summary>

          <div className="mt-3 overflow-x-auto">
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
                {ramps.map((ramp) => (
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
        </details>
      </section>
    )
  }
}

/** The three answers for one surface, as a small labelled block. */
function Answer({ title, levels }: { title: string; levels: LevelLabels }) {
  const rows: Array<[string, number | null]> = [
    ['Large text, icons', levels.aaLarge],
    ['Body text', levels.aa],
    ['Body text, strictest', levels.aaa],
  ]

  return (
    <div>
      <h4 className="text-[12px] font-medium">{title}</h4>
      <dl className="mt-1.5 flex flex-col gap-1">
        {rows.map(([label, shade]) => (
          <div key={label} className="flex items-baseline gap-2.5">
            <dt className="text-[12.5px] text-ink-muted">{label}</dt>
            <dd className="tabular text-[12.5px] font-medium">
              {shade === null ? <span className="text-ink-faint">none</span> : `shade ${shade}`}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function signature(ramp: Ramp): string {
  const { firstOnWhite: w, firstOnBlack: b } = ramp.report
  return `${w.aaLarge}/${w.aa}/${w.aaa}|${b.aaLarge}/${b.aa}/${b.aaa}`
}

function describe(levels: LevelLabels): string {
  return [levels.aaLarge, levels.aa, levels.aaa].map((v) => v ?? '—').join(' / ')
}

function Chevron() {
  return (
    <svg
      viewBox="0 0 10 10"
      className="h-2 w-2 shrink-0 transition-transform group-open:rotate-90"
      aria-hidden="true"
    >
      <path
        d="M3.5 1L7.5 5l-4 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
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
