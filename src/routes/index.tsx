import { createFileRoute, stripSearchParams, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useRef, useState } from 'react'

import { Controls } from '../components/Controls.tsx'
import { DocLink, SiteNav } from '../components/DocPage.tsx'
import { ThemeToggle } from '../components/ThemeToggle.tsx'
import { ContrastPanel } from '../components/ContrastPanel.tsx'
import { EnvelopePanel } from '../components/EnvelopePanel.tsx'
import { ExportPanel } from '../components/ExportPanel.tsx'
import { PaletteBoard } from '../components/PaletteBoard.tsx'
import { SwatchInspector } from '../components/SwatchInspector.tsx'
import { PaletteSessionProvider, usePaletteSession } from '../lib/palette-session.tsx'
import { copyText, downloadText, isBrowser } from '../lib/browser.ts'
import { EXPORT_FORMATS, exportPalette } from '../engine/index.ts'
import { SEARCH_DEFAULTS, paletteSearchSchema } from '../lib/search-schema.ts'

export const Route = createFileRoute('/')({
  // Nothing here needs a server, and rendering only on the client removes the
  // whole class of mismatches around theme, clipboard and screen picking.
  ssr: false,
  validateSearch: paletteSearchSchema,
  // Defaults are dropped from the address, so an untouched palette is just "/".
  search: { middlewares: [stripSearchParams(SEARCH_DEFAULTS)] },
  component: Page,
})

function Page() {
  const search = Route.useSearch()

  return (
    <PaletteSessionProvider search={search}>
      <Tool />
    </PaletteSessionProvider>
  )
}

type PanelName = 'contrast' | 'envelope' | 'export'

const PANELS: Array<{ name: PanelName; label: string }> = [
  { name: 'contrast', label: 'Contrast' },
  { name: 'envelope', label: 'Limits of each hue' },
  { name: 'export', label: 'Export' },
]

/** Which family sits nearest each conventional role — advice, not assignment. */
function RoleHints() {
  const { palette } = usePaletteSession()
  if (palette.roleHints.length === 0) return null

  return (
    <section className="mt-8 border-t border-line pt-4">
      <h2 className="text-[13px] font-medium">If you need conventional roles</h2>
      <p className="mt-1 max-w-[70ch] text-[12.5px] text-ink-muted">
        Nothing here is reserved for a job — these are just the families closest to the hues
        people already read as an error, a warning, a success and a note.
      </p>
      <ul className="mt-2 flex flex-wrap gap-x-6 gap-y-1">
        {palette.roleHints.map((hint) => (
          <li key={hint.role} className="text-[12.5px]">
            <span className="text-ink-muted">{hint.role}</span>{' '}
            <span className="font-medium">{hint.family}</span>
            {Math.abs(hint.offset) >= 12 && (
              <span className="tabular text-[11px] text-ink-faint">
                {' '}
                {hint.offset > 0 ? '+' : ''}
                {hint.offset}°
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

function Tool() {
  const { error, palette } = usePaletteSession()
  const [panel, setPanel] = useState<PanelName>('contrast')
  const [notice, setNotice] = useState<string | null>(null)
  const [isReady, setIsReady] = useState(false)
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Marks the point where handlers are attached and the controls will respond.
  // Painted and interactive are not the same moment, and end-to-end tests need
  // to know which one they are looking at.
  useEffect(() => setIsReady(true), [])

  const announce = useCallback((message: string) => {
    setNotice(message)
    if (noticeTimer.current) clearTimeout(noticeTimer.current)
    noticeTimer.current = setTimeout(() => setNotice(null), 2600)
  }, [])

  useEffect(() => () => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current)
  }, [])

  const advice = palette.warnings.filter((w) => w.code !== 'SEED_HARMONIZED')

  return (
    <div className="min-h-dvh" data-ready={isReady ? 'true' : undefined}>
      <Header onCopied={announce} />

      <Controls />

      <div className="mx-auto flex max-w-[1600px] flex-col lg:flex-row">
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-5">
          {error && (
            <p role="alert" className="mb-5 border border-fail px-3 py-2 text-[12.5px] text-fail">
              {error}
            </p>
          )}

          <PaletteBoard onCopied={announce} />

          {advice.length > 0 && (
            <section className="mt-8 border-t border-line pt-4">
              <h2 className="text-[13px] font-medium">Worth knowing</h2>
              <ul className="mt-2 flex max-w-[76ch] flex-col gap-1.5">
                {advice.map((warning, i) => (
                  <li key={i} className="text-[12.5px] leading-snug text-ink-muted">
                    {warning.message}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <RoleHints />

          <section className="mt-9">
            <div className="flex flex-wrap gap-px border-b border-line">
              {PANELS.map((option) => (
                <button
                  key={option.name}
                  type="button"
                  aria-pressed={panel === option.name}
                  onClick={() => setPanel(option.name)}
                  className={[
                    'px-3 py-1.5 text-[13px]',
                    panel === option.name
                      ? 'border-b-2 border-ink font-medium'
                      : 'border-b-2 border-transparent text-ink-muted hover:text-ink',
                  ].join(' ')}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="pt-5">
              {panel === 'contrast' && <ContrastPanel />}
              {panel === 'envelope' && <EnvelopePanel />}
              {panel === 'export' && <ExportPanel onCopied={announce} />}
            </div>
          </section>

          <Footnote />
        </main>

        <aside className="shrink-0 border-t border-line lg:w-[18.5rem] lg:border-l lg:border-t-0">
          <div className="lg:sticky lg:top-0">
            <SwatchInspector onCopied={announce} />
          </div>
        </aside>
      </div>

      <div aria-live="polite" className="sr-only">
        {notice}
      </div>

      {notice && (
        <div className="pointer-events-none fixed bottom-5 left-1/2 -translate-x-1/2 border border-line bg-inverse-bg px-3 py-1.5 text-[12.5px] text-inverse-ink">
          {notice}
        </div>
      )}
    </div>
  )
}

function Header({ onCopied }: { onCopied: (message: string) => void }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
      <div className="flex items-baseline gap-4">
        <h1 className="text-[14.5px] font-semibold tracking-tight">Science Color Palette</h1>
        <SiteNav />
        <p className="hidden text-[12px] text-ink-muted xl:block">
          A full colour palette from one or two colours, built on what the eye actually sees
        </p>
      </div>

      <div className="flex items-center gap-2">
        <UndoRedo />
        <button
          type="button"
          onClick={async () => {
            if (!isBrowser()) return
            const ok = await copyText(window.location.href)
            onCopied(ok ? 'Link copied — it rebuilds this exact palette' : 'Could not reach the clipboard')
          }}
          className="border border-line px-2.5 py-1 text-[12px] hover:border-ink"
        >
          Copy link
        </button>
        <ExportMenu onSaved={onCopied} />
        <ThemeToggle />
      </div>
    </header>
  )
}

/**
 * Download the palette.
 *
 * Two formats rather than the four the export panel offers: this is the "just
 * give me the file" path, and JSON and CSV are the two that go straight into
 * something else — a build script and a spreadsheet. The stylesheet formats
 * stay in the panel below, where their source can be read before it is taken.
 *
 * Labelled "Download" rather than "Export" deliberately: the panel below
 * already has an Export tab, and two controls with one word between them —
 * doing different things — is how a person ends up in the wrong place.
 */
function ExportMenu({ onSaved }: { onSaved: (message: string) => void }) {
  const { palette } = usePaletteSession()
  const [isOpen, setIsOpen] = useState(false)
  const menu = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return

    const onPointerDown = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node)) setIsOpen(false)
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

  const offered = EXPORT_FORMATS.filter((d) => d.format === 'json' || d.format === 'csv')

  return (
    <div ref={menu} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        className="flex items-center gap-1.5 border border-line px-2.5 py-1 text-[12px] hover:border-ink"
      >
        Download
        <svg viewBox="0 0 10 10" className="h-2 w-2" aria-hidden="true">
          <path
            d="M1 3.5L5 7.5l4-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {isOpen && (
        <div
          aria-label="Download the palette"
          className="absolute right-0 top-8 z-30 w-52 border border-line-strong bg-bg py-1 shadow-lg"
        >
          {offered.map((descriptor) => (
            <button
              key={descriptor.format}
              type="button"
              onClick={() => {
                downloadText(
                  descriptor.filename,
                  exportPalette(palette, descriptor.format),
                  descriptor.mimeType,
                )
                setIsOpen(false)
                onSaved(`Saved ${descriptor.filename}`)
              }}
              className="flex w-full flex-col items-start px-3 py-1.5 text-left hover:bg-sunken"
            >
              <span className="text-[12px]">{descriptor.title}</span>
              <span className="text-[11px] text-ink-muted">{descriptor.filename}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Undo and redo.
 *
 * Because the configuration lives in the URL, these are just history
 * navigation — and the same thing happens if someone reaches for the browser's
 * own back button, which many people will.
 */
function UndoRedo() {
  const navigate = useNavigate()

  return (
    <div className="flex">
      <button
        type="button"
        aria-label="Undo"
        onClick={() => isBrowser() && window.history.back()}
        className="border border-line px-2 py-1 text-[12px] hover:border-ink"
      >
        <svg viewBox="0 0 14 14" className="h-3.5 w-3.5" aria-hidden="true">
          <path
            d="M4 4L1.5 6.5 4 9M1.5 6.5h6.2A4 4 0 1 1 7.7 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
        </svg>
      </button>
      <button
        type="button"
        aria-label="Redo"
        onClick={() => isBrowser() && window.history.forward()}
        onDoubleClick={() => void navigate({ to: '/', search: SEARCH_DEFAULTS })}
        className="-ml-px border border-line px-2 py-1 text-[12px] hover:border-ink"
      >
        <svg viewBox="0 0 14 14" className="h-3.5 w-3.5" aria-hidden="true">
          <path
            d="M10 4l2.5 2.5L10 9M12.5 6.5H6.3A4 4 0 1 0 6.3 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  )
}


/**
 * The method, in one sentence, with the long version a click away.
 *
 * This used to be the whole argument in five lines of small print at the bottom
 * of a working tool, which is the least likely place anyone reads an argument.
 * It now lives on its own page and this is the door to it.
 */
function Footnote() {
  return (
    <footer className="mt-10 max-w-[74ch] border-t border-line pt-4 text-[12px] leading-relaxed text-ink-muted">
      <p>
        Shades are placed by relative luminance — the only thing WCAG contrast depends on — so the
        same shade number carries the same contrast in every hue.{' '}
        <DocLink to="/how-to">What every number means</DocLink>, or{' '}
        <DocLink to="/about">where the method comes from</DocLink>.
      </p>
    </footer>
  )
}
