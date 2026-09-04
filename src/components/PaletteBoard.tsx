import { useEffect, useRef, useState } from 'react'

import { WarningMark } from './StatusMarks.tsx'
import { usePaletteSession } from '../lib/palette-session.tsx'
import { copyText } from '../lib/browser.ts'
import { WCAG_THRESHOLDS, type Ramp, type ResolvedLadder, type Swatch } from '../engine/index.ts'

/**
 * The palette itself, and the first thing on screen.
 *
 * Swatches carry their own label and hex in whichever of black or white the
 * engine judged more legible on them, so the grid reads as colour rather than
 * as a table of colour. Structural marks are reserved for real information: a
 * ring means the shade is the user's own colour, kept exactly, and a warning
 * mark means the shade falls short of the contrast its position implies.
 *
 * A palette is a comparison, so the whole of it has to be in one view: a ramp
 * you have to scroll to cannot be judged against the one at the top. Names sit
 * in a gutter beside their row rather than on a line above it, and the swatch
 * height is measured to the screen (`useFittedSwatchHeight`) so the default
 * eleven families land inside the fold instead of a screen and a half.
 */
export function PaletteBoard({ onCopied }: { onCopied: (message: string) => void }) {
  const { palette } = usePaletteSession()

  // The spectrum reads as one progression, so it is presented as one list in
  // the order the engine walked the wheel: the colours that were typed first,
  // then round the circle from there. Greys sit apart because they are the
  // palette's foundation rather than a point on that circle.
  const families = palette.ramps.filter((r) => r.role !== 'neutral')
  const neutrals = palette.ramps.filter((r) => r.role === 'neutral')

  const { ref, swatchHeight } = useFittedSwatchHeight()

  return (
    <div
      ref={ref}
      className="flex flex-col gap-2"
      style={
        swatchHeight === null
          ? undefined
          : {
              ['--swatch-h' as string]: `${swatchHeight}px`,
              // A short band has room for the shade number or the hex, not
              // both, and the number is the one the ramp is read by.
              ['--hex-vis' as string]: swatchHeight < HEX_MIN_SWATCH ? 'none' : 'inline',
            }
      }
    >
      <ContractLegend ladder={palette.resolved.ladder} />
      <RampGroup ramps={families} onCopied={onCopied} />
      {neutrals.length > 0 && (
        <RampGroup ramps={neutrals} heading="Greys" separated onCopied={onCopied} />
      )}
    </div>
  )
}

/** The gutter that carries each ramp's name, and the legend's matching indent. */
const ROW_LAYOUT = 'sm:grid sm:grid-cols-[10.5rem_minmax(0,1fr)] sm:gap-x-3'

/** How short a swatch may get before its own label stops fitting. */
const MIN_SWATCH = 32
/** Past this it is just a big rectangle; the extra height buys nothing. */
const MAX_SWATCH = 80
/** Below this a band holds one line of text, and it is the shade number. */
const HEX_MIN_SWATCH = 44
/** Breathing room under the last row, so the fold is not flush with it. */
const BOTTOM_GUTTER = 12

/**
 * Fit the rows to whatever screen this is.
 *
 * The space left for the board is not knowable at build time — the header, the
 * control band and the legend all change height with the window, the number of
 * seeds and the step count — so it is measured rather than guessed. Nothing
 * about the markup is hardcoded here either: everything in the board that is
 * not a row is whatever height is left once the rows are subtracted from it.
 *
 * A row is as tall as the taller of its two sides, and a seeded family has a
 * note to make in its gutter, so the answer is not a division — raising the
 * swatch height does nothing for a row the gutter is already stretching. The
 * largest height that still fits is found by searching for it, which lands in
 * one pass rather than converging over several renders.
 *
 * Below `sm` the board is a single narrow column that was never going to fit a
 * screen anyway; it keeps the fixed height from the stylesheet.
 */
function useFittedSwatchHeight() {
  const ref = useRef<HTMLDivElement>(null)
  const [swatchHeight, setSwatchHeight] = useState<number | null>(null)

  // No dependency list: the space above the board moves whenever the controls
  // do — another seed, a wrapped band — and those arrive as ordinary renders.
  // Measuring is cheap and settles immediately, since the height it produces
  // is not one of its own inputs.
  useEffect(() => {
    const measure = () => {
      const el = ref.current
      if (!el) return

      if (window.innerWidth < 640) {
        setSwatchHeight(null)
        return
      }

      const rows = [...el.querySelectorAll<HTMLElement>('[data-ramp]')]
      if (rows.length === 0) return

      // What each row's gutter needs regardless of how tall its swatches are.
      const gutters = rows.map((row) => row.firstElementChild?.getBoundingClientRect().height ?? 0)
      const box = el.getBoundingClientRect()
      const rowsHeight = rows.reduce((sum, row) => sum + row.getBoundingClientRect().height, 0)
      const chrome = box.height - rowsHeight
      const room = window.innerHeight - box.top - BOTTOM_GUTTER - chrome

      const fits = (height: number) =>
        gutters.reduce((sum, gutter) => sum + Math.max(gutter, height), 0) <= room

      let low = MIN_SWATCH
      let high = MAX_SWATCH
      let best = MIN_SWATCH
      while (low <= high) {
        const middle = Math.floor((low + high) / 2)
        if (fits(middle)) {
          best = middle
          low = middle + 1
        } else {
          high = middle - 1
        }
      }

      setSwatchHeight((previous) => (previous === best ? previous : best))
    }

    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  })

  return { ref, swatchHeight }
}

/**
 * Which columns carry a promise, marked on the board itself.
 *
 * The most useful thing this tool knows is "which shade is safe for body text",
 * and it used to be a table two screens further down. Because every ramp climbs
 * the same scale, the answer is a *column* rather than a colour — so one legend
 * above the board marks it for every family at once, and the shade numbers stop
 * being arbitrary the moment you see which three are load-bearing.
 *
 * Driven from the ladder's own contracts, so a step count where none of them
 * land on a shade correctly shows nothing rather than a comfortable fiction.
 */
function ContractLegend({ ladder }: { ladder: ResolvedLadder }) {
  const contracts = new Map(ladder.contracts.map((contract) => [contract.index, contract]))
  if (contracts.size === 0) return null

  const sentence = ladder.contracts
    .map((contract) => `${ladder.labels[contract.index]} ${useFor(contract.target)}`)
    .join(' · ')

  return (
    <div className={ROW_LAYOUT}>
      {/* Narrow screens cannot fit a caption under a column, so the same fact
          is stated as a sentence — and it carries the accessible name at every
          width, since a grid of loose words reads poorly aloud. */}
      <p className="border-b border-line pb-2 text-[12px] text-ink-muted sm:sr-only">
        <span className="text-ink">Guaranteed on white and on shade {ladder.labels[0]}:</span>{' '}
        <span className="tabular">{sentence}</span>
      </p>

      <div aria-hidden="true" className="hidden sm:block" />

      <div
        aria-hidden="true"
        className="hidden grid-cols-[repeat(var(--steps),minmax(0,1fr))] gap-px border-b border-line pb-1 sm:grid"
        style={{ ['--steps' as string]: ladder.steps }}
      >
        {/* Only the marked columns carry anything. Every swatch prints its own
            shade number a few pixels below, so repeating all eleven here would
            be a ruler nobody needs beside a ruler they already have. */}
        {ladder.labels.map((label, index) => {
          const contract = contracts.get(index)
          if (!contract) return <div key={label} />

          return (
            <div key={label} className="flex flex-col gap-0.5">
              <span className="tabular text-[10px] font-medium leading-none">{label}</span>
              <span className="h-0.5 w-full bg-ink" />
              <span className="text-[10px] leading-tight text-ink-muted">
                {useFor(contract.target)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** What a contract ratio is good for, in the fewest words that stay true. */
function useFor(target: number): string {
  if (target >= WCAG_THRESHOLDS.aaa) return 'body AAA'
  if (target >= WCAG_THRESHOLDS.aa) return 'body text'
  return 'large text'
}

function RampGroup({
  ramps,
  heading,
  separated,
  onCopied,
}: {
  ramps: Ramp[]
  heading?: string
  separated?: boolean
  onCopied: (message: string) => void
}) {
  if (ramps.length === 0) return null

  return (
    // Rows sit all but flush, so eleven ramps read as one block to compare
    // down a column rather than as eleven separate objects.
    <section className={`flex flex-col gap-0.5 ${separated ? 'border-t border-line pt-1.5' : ''}`}>
      {/* The rule above is the whole visual separation; the heading is here
          for the document outline, where a rule says nothing. */}
      {heading && <h2 className="sr-only">{heading}</h2>}
      {ramps.map((ramp) => (
        <RampRow key={ramp.role} ramp={ramp} onCopied={onCopied} />
      ))}
    </section>
  )
}

function RampRow({ ramp, onCopied }: { ramp: Ramp; onCopied: (message: string) => void }) {
  const { select, selected } = usePaletteSession()
  const broken = ramp.report.brokenGuarantees.length > 0

  return (
    <div className={`flex flex-col gap-1 ${ROW_LAYOUT} sm:items-start`} data-ramp={ramp.name}>
      {/* The name and everything qualifying it stack in the gutter beside the
          row rather than on a line above it, which is most of what buys the
          whole palette a place on one screen. */}
      <div className="flex items-baseline gap-x-2 gap-y-0.5 flex-wrap sm:min-w-0 sm:pt-0.5">
        <h3 className="text-[14px] font-medium leading-none">{ramp.name}</h3>

        {ramp.hue !== null && (
          <span className="tabular text-[11px] leading-none text-ink-faint">
            {ramp.hue.toFixed(0)}°
          </span>
        )}

        {ramp.seed && <YoursBadge />}

        <div className="flex flex-wrap items-baseline gap-x-2 text-[11px] leading-tight sm:basis-full">
          {ramp.seed && <SeedNote ramp={ramp} />}

          {!ramp.report.usesSharedLadder && (
            <span className="text-ink-faint">own scale</span>
          )}

          {broken && (
            <span className="text-warn inline-flex items-center gap-1">
              <WarningMark />
              {ramp.report.brokenGuarantees.map((b) => b.label).join(', ')} below contrast
            </span>
          )}
        </div>
      </div>

      <div
        className="grid w-full gap-px"
        style={{ gridTemplateColumns: `repeat(${ramp.swatches.length}, minmax(0, 1fr))` }}
      >
        {ramp.swatches.map((swatch) => (
          <SwatchButton
            key={swatch.index}
            ramp={ramp}
            swatch={swatch}
            isSelected={selected.ramp === ramp.role && selected.index === swatch.index}
            onSelect={async () => {
              select({ ramp: ramp.role, index: swatch.index })
              const ok = await copyText(swatch.hex)
              onCopied(ok ? `Copied ${swatch.hex}` : `Selected ${swatch.hex}`)
            }}
          />
        ))}
      </div>
    </div>
  )
}

/** Marks a family that came from a colour the user supplied. */
function YoursBadge() {
  return (
    <span className="border border-ink px-1 py-px text-[10px] font-medium leading-none">
      yours
    </span>
  )
}

function SeedNote({ ramp }: { ramp: Ramp }) {
  const seed = ramp.seed!

  if (seed.mode === 'exact') {
    return (
      <span className="text-ink-muted">
        <span className="tabular">{seed.input}</span> kept exactly at {seed.slotLabel}
      </span>
    )
  }

  const moved = seed.delta.magnitude !== 'none' && seed.delta.magnitude !== 'subtle'

  return (
    <span className="text-ink-muted">
      <span className="tabular">{seed.input}</span>
      {moved ? ` adjusted at ${seed.slotLabel}` : ` matched at ${seed.slotLabel}`}
    </span>
  )
}

/**
 * Labels are drawn in `onHexWcag` rather than the perceptually preferred
 * `onHex`. At 10px this is the right call: WCAG's caution about text on
 * mid-tones is warranted at that size, and it keeps the tool's own interface
 * conformant with the standard it reports against.
 */
function SwatchButton({
  ramp,
  swatch,
  isSelected,
  onSelect,
}: {
  ramp: Ramp
  swatch: Swatch
  isSelected: boolean
  onSelect: () => void
}) {
  const failed = swatch.guarantees.some((g) => !g.met)

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={isSelected}
      aria-label={`${ramp.name} ${swatch.label}, ${swatch.hex}${
        swatch.isSeed ? ', your colour kept exactly' : ''
      }${failed ? ', below the usual contrast for this position' : ''}. Copies on click.`}
      className="group relative flex h-16 flex-col justify-between p-1 text-left transition-transform hover:z-10 hover:scale-[1.04] sm:h-[var(--swatch-h,5rem)] sm:p-1.5"
      style={{ backgroundColor: swatch.hex, color: swatch.onHexWcag }}
    >
      <span className="tabular text-[10px] font-medium leading-none">{swatch.label}</span>

      <span className="flex items-center justify-between gap-0.5">
        <span className="tabular hidden text-[9.5px] leading-none sm:[display:var(--hex-vis,inline)]">
          {swatch.hex.slice(1)}
        </span>
        {failed && <WarningMark />}
      </span>

      {swatch.isSeed && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 border-2"
          style={{ borderColor: swatch.onHexWcag }}
        />
      )}

      {isSelected && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 outline-2 outline-offset-2 outline-ink"
        />
      )}
    </button>
  )
}
