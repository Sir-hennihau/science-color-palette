import { useEffect, useRef, useState } from 'react'
import { HexColorPicker } from 'react-colorful'

import { usePaletteSession } from '../lib/palette-session.tsx'
import { pickScreenColor, supportsEyeDropper } from '../lib/browser.ts'
import { HARMONY_CHOICES, type HarmonyChoice } from '../lib/search-schema.ts'
import { MAX_HUE_DRIFT, MAX_SEEDS, MAX_STEPS, MIN_STEPS, parseColor } from '../engine/index.ts'

export function Controls() {
  const { config, seeds, commit, preview, addSeed } = usePaletteSession()

  return (
    <div className="flex flex-col divide-y divide-line">
      <Section title="Your colours">
        <div className="flex flex-col gap-3">
          {seeds.map((seed, index) => (
            <SeedControl key={index} index={index} hex={seed.hex} mode={seed.mode} />
          ))}
        </div>

        {seeds.length < MAX_SEEDS && (
          <button
            type="button"
            onClick={addSeed}
            className="mt-3 w-full border border-dashed border-line-strong py-1.5 text-[12px] text-ink-muted hover:border-ink hover:text-ink"
          >
            Add a colour
          </button>
        )}
      </Section>

      <Section title="Shades" value={String(config.steps)}>
        <input
          type="range"
          min={MIN_STEPS}
          max={MAX_STEPS}
          step={1}
          value={config.steps}
          aria-label="Number of shades per ramp"
          aria-valuetext={`${config.steps} shades`}
          onChange={(e) => preview({ steps: Number(e.target.value) })}
          onPointerUp={() => commit()}
          onKeyUp={() => commit()}
        />
        <p className="text-[11.5px] text-ink-muted">
          More shades subdivide the same lightness range, so the colours you already have stay
          put.
        </p>
      </Section>

      <Section title="Colourfulness">
        <Segmented
          options={[
            { value: 'muted', label: 'Muted' },
            { value: 'natural', label: 'Natural' },
            { value: 'vivid', label: 'Vivid' },
          ]}
          value={config.chroma}
          onChange={(chroma) => commit({ chroma: chroma as typeof config.chroma })}
          label="Colourfulness"
        />
        <p className="text-[11.5px] text-ink-muted">
          A share of the colour each hue can actually reach at a given lightness, so every hue
          stays within what a screen can show.
        </p>
      </Section>

      <Section title="Hue drift" value={`${config.drift > 0 ? '+' : ''}${config.drift}°`}>
        <input
          type="range"
          min={-MAX_HUE_DRIFT}
          max={MAX_HUE_DRIFT}
          step={1}
          value={config.drift}
          aria-label="Hue drift across the ramp, in degrees"
          aria-valuetext={`${config.drift} degrees`}
          onChange={(e) => preview({ drift: Number(e.target.value) })}
          onPointerUp={() => commit()}
          onKeyUp={() => commit()}
        />
        <p className="text-[11.5px] text-ink-muted">
          Rotates hue from the lightest shade to the darkest. Hand-tuned palettes use this — it is
          what turns a dark yellow brown instead of olive.
        </p>
      </Section>

      <Section title="Harmony">
        <select
          value={config.harmony}
          aria-label="Harmony scheme"
          onChange={(e) => commit({ harmony: e.target.value as HarmonyChoice })}
          className="w-full border border-line bg-bg px-2 py-1.5 text-[12.5px]"
        >
          {HARMONY_CHOICES.map((choice) => (
            <option key={choice} value={choice}>
              {harmonyLabel(choice)}
            </option>
          ))}
        </select>
        <p className="text-[11.5px] text-ink-muted">
          Accent hues are solved from scratch on the shared lightness scale, never copied across —
          the opposite of a vivid dark blue does not exist as a vivid dark yellow.
        </p>
      </Section>

      <Section title="Neutral tint" value={config.tint === 0 ? 'none' : `${Math.round(config.tint * 100)}%`}>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={config.tint}
          aria-label="How far neutrals lean toward your primary hue"
          aria-valuetext={config.tint === 0 ? 'pure grey' : `${Math.round(config.tint * 100)} percent`}
          onChange={(e) => preview({ tint: Number(e.target.value) })}
          onPointerUp={() => commit()}
          onKeyUp={() => commit()}
        />
        <p className="text-[11.5px] text-ink-muted">
          Greys lean very slightly toward your primary so they feel related to it.
        </p>
      </Section>

      <Section title="Semantic colours">
        <label className="flex items-center gap-2 text-[12.5px]">
          <input
            type="checkbox"
            checked={config.semantics}
            onChange={(e) => commit({ semantics: e.target.checked })}
            className="h-3.5 w-3.5 accent-ink"
          />
          Include success, warning, danger and info
        </label>
      </Section>
    </div>
  )
}

function harmonyLabel(choice: HarmonyChoice): string {
  if (choice === 'none') return 'None'
  if (choice === 'auto') return 'Suggested for my colours'
  return choice.charAt(0).toUpperCase() + choice.slice(1).replace('-', ' ')
}

function Section({
  title,
  value,
  children,
}: {
  title: string
  value?: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-2 px-4 py-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[12.5px] font-medium">{title}</h2>
        {value && <span className="tabular text-[11.5px] text-ink-muted">{value}</span>}
      </div>
      {children}
    </section>
  )
}

function Segmented({
  options,
  value,
  onChange,
  label,
}: {
  options: Array<{ value: string; label: string }>
  value: string
  onChange: (value: string) => void
  label: string
}) {
  return (
    <div role="group" aria-label={label} className="flex border border-line">
      {options.map((option, index) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={[
            'flex-1 py-1.5 text-[12px]',
            index > 0 ? 'border-l border-line' : '',
            value === option.value
              ? 'bg-inverse-bg text-inverse-ink'
              : 'text-ink-muted hover:text-ink',
          ].join(' ')}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

/**
 * One seed colour.
 *
 * The two modes are the heart of the tool, so the choice is always visible
 * rather than tucked behind a menu, and the consequence of the current choice
 * is stated underneath in plain terms.
 */
function SeedControl({
  index,
  hex,
  mode,
}: {
  index: number
  hex: string
  mode: 'exact' | 'harmonize'
}) {
  const { updateSeed, removeSeed, seeds, palette } = usePaletteSession()
  const [text, setText] = useState(hex)
  const [isOpen, setIsOpen] = useState(false)
  const [canPick, setCanPick] = useState(false)
  const popover = useRef<HTMLDivElement>(null)

  // Feature detection has to wait for the client; the shell is prebuilt.
  useEffect(() => setCanPick(supportsEyeDropper()), [])

  // Follow the committed value unless the field is being edited.
  useEffect(() => setText(hex), [hex])

  useEffect(() => {
    if (!isOpen) return

    const onPointerDown = (event: PointerEvent) => {
      if (!popover.current?.contains(event.target as Node)) setIsOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [isOpen])

  const ramp = palette.ramps[index]
  const delta = ramp?.seed?.delta
  const parsed = parseColor(text)

  const commitText = () => {
    if (parsed) updateSeed(index, { hex: parsed.hex })
    else setText(hex)
  }

  return (
    <div className="flex flex-col gap-2 border border-line p-2.5">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setIsOpen((open) => !open)}
          aria-expanded={isOpen}
          aria-label={`Choose colour ${index + 1} visually, currently ${hex}`}
          className="h-7 w-7 shrink-0 border border-line-strong"
          style={{ backgroundColor: hex }}
        />

        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commitText}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitText()
            if (e.key === 'Escape') setText(hex)
          }}
          aria-label={`Colour ${index + 1} value`}
          aria-invalid={!parsed}
          spellCheck={false}
          className={[
            'tabular min-w-0 flex-1 border bg-bg px-1.5 py-1 text-[12.5px]',
            parsed ? 'border-line' : 'border-fail',
          ].join(' ')}
        />

        {canPick && (
          <button
            type="button"
            aria-label={`Pick colour ${index + 1} from the screen`}
            onClick={async () => {
              const picked = await pickScreenColor()
              if (picked) updateSeed(index, { hex: picked })
            }}
            className="shrink-0 border border-line px-1.5 py-1 text-ink-muted hover:border-ink hover:text-ink"
          >
            <svg viewBox="0 0 14 14" className="h-3.5 w-3.5" aria-hidden="true">
              <path
                d="M8.8 1.9l3.3 3.3M10.4 3.5L5.2 8.7l-.8 2.6 2.6-.8 5.2-5.2zM4.4 11.3l-1.7 1.7"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        )}

        {seeds.length > 1 && (
          <button
            type="button"
            aria-label={`Remove colour ${index + 1}`}
            onClick={() => removeSeed(index)}
            className="shrink-0 px-1 text-ink-faint hover:text-ink"
          >
            <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden="true">
              <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.4" />
            </svg>
          </button>
        )}
      </div>

      {isOpen && (
        <div ref={popover} className="relative">
          {/* react-colorful streams changes on every pointer move and has no
              release callback, so the wrapper commits when the pointer lifts.
              Without this every drag would fill the history stack. */}
          <div
            onPointerUp={() => updateSeed(index, {})}
            onLostPointerCapture={() => updateSeed(index, {})}
          >
            <HexColorPicker
              color={hex}
              onChange={(next) => updateSeed(index, { hex: next }, { preview: true })}
              style={{ width: '100%', height: 130 }}
            />
          </div>
        </div>
      )}

      <Segmented
        label={`How to treat colour ${index + 1}`}
        value={mode}
        onChange={(next) => updateSeed(index, { mode: next as 'exact' | 'harmonize' })}
        options={[
          { value: 'harmonize', label: 'Adjust' },
          { value: 'exact', label: 'Keep exact' },
        ]}
      />

      <p className="text-[11px] leading-snug text-ink-muted">
        {mode === 'exact' ? (
          <>
            Your colour ships unchanged, and the ramp bends around it. Contrast promises can slip;
            any that do are marked.
          </>
        ) : (
          <>
            Nudged onto the shared lightness scale so contrast is guaranteed.
            {delta && delta.magnitude !== 'none' && (
              <>
                {' '}
                Currently a{delta.magnitude === 'subtle' ? '' : ''} {delta.magnitude} step from
                what you entered.
              </>
            )}
          </>
        )}
      </p>
    </div>
  )
}
