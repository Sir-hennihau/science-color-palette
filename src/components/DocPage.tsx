import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'

import { ThemeToggle } from './ThemeToggle.tsx'

/**
 * The frame for the two reading surfaces.
 *
 * The tool is an instrument; these are its documentation, and the booth still
 * applies — achromatic, square, hairline-ruled, every figure in mono. What
 * changes is the mode. The tool packs everything above the fold because the
 * user is adjusting; a reading page gives the prose a measure and puts
 * wayfinding where a reader looks for it.
 *
 * The largest type on these pages is still a measured value, never a headline.
 * That is the same rule the tool follows, and it is what keeps a page of prose
 * recognisably part of the same instrument.
 */

interface Section {
  id: string
  title: string
  body: ReactNode
}

export function DocPage({
  title,
  standfirst,
  sections,
}: {
  title: string
  standfirst: ReactNode
  sections: Section[]
}) {
  return (
    <div className="min-h-dvh" data-ready="true">
      <SiteHeader />

      {/* Capped well below the tool's 1600px: a reading column stranded at the
          left of a wide viewport reads as an unfinished page, and the table of
          contents is only wayfinding if it sits near what it points at. */}
      <div className="mx-auto max-w-[68rem] px-4 py-7 sm:px-5">
        <header className="max-w-[74ch] border-b border-line pb-6">
          <h1 className="text-[15px] font-semibold tracking-tight">{title}</h1>
          <p className="mt-2 text-ink-muted">{standfirst}</p>
        </header>

        <div className="flex flex-col gap-8 lg:flex-row lg:gap-12">
          <nav
            aria-label="On this page"
            className="shrink-0 border-b border-line py-5 lg:w-52 lg:border-b-0 lg:border-r lg:pr-6"
          >
            <div className="lg:sticky lg:top-5">
              <h2 className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">
                On this page
              </h2>
              <ol className="mt-2.5 flex flex-col gap-1.5">
                {sections.map((section) => (
                  <li key={section.id}>
                    <a
                      href={`#${section.id}`}
                      className="text-[12.5px] text-ink-muted underline decoration-line hover:text-ink hover:decoration-ink"
                    >
                      {section.title}
                    </a>
                  </li>
                ))}
              </ol>
            </div>
          </nav>

          <main className="min-w-0 flex-1 py-5">
            {sections.map((section) => (
              <section
                key={section.id}
                id={section.id}
                className="mb-11 scroll-mt-5 last:mb-0"
                aria-labelledby={`${section.id}-heading`}
              >
                <h2
                  id={`${section.id}-heading`}
                  className="border-b border-line pb-2 text-[15px] font-medium"
                >
                  {section.title}
                </h2>
                <div className="mt-4 flex max-w-[74ch] flex-col gap-4">{section.body}</div>
              </section>
            ))}

            <footer className="mt-12 border-t border-line pt-4 text-[12.5px] text-ink-muted">
              <p>
                Every number on this page comes from the engine, from its test suite, or from the
                comparison scripts that sit alongside them, rather than being written down by hand.{' '}
                <DocLink to="/">Back to the tool</DocLink>.
              </p>
            </footer>
          </main>
        </div>
      </div>
    </div>
  )
}

/** The header the reading pages share with the tool. */
function SiteHeader() {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
      <div className="flex items-baseline gap-4">
        <Link to="/" className="text-[14.5px] font-semibold tracking-tight no-underline">
          Science Color Palette
        </Link>
        <SiteNav />
      </div>
      <ThemeToggle />
    </header>
  )
}

/**
 * Three destinations, and no more.
 *
 * The tool was its own front door for good reasons, so the navigation stays a
 * row of plain words rather than becoming a bar that competes with the control
 * band underneath it.
 */
export function SiteNav() {
  const link = 'text-[12px] text-ink-muted no-underline hover:text-ink'
  const active = 'text-[12px] font-medium text-ink no-underline'

  return (
    <nav aria-label="Sections" className="flex items-baseline gap-3.5">
      <Link to="/" className={link} activeProps={{ className: active }} activeOptions={{ exact: true }}>
        Tool
      </Link>
      <Link to="/how-to" className={link} activeProps={{ className: active }}>
        How to read it
      </Link>
      <Link to="/about" className={link} activeProps={{ className: active }}>
        About
      </Link>
    </nav>
  )
}

/** A link in running prose. Underlined, because there is no accent to colour it. */
export function DocLink({ to, children }: { to: string; children: ReactNode }) {
  const className = 'underline decoration-line-strong hover:decoration-ink'

  if (to.startsWith('http')) {
    return (
      <a href={to} target="_blank" rel="noreferrer noopener" className={className}>
        {children}
      </a>
    )
  }

  return (
    <Link to={to} className={className}>
      {children}
    </Link>
  )
}

/**
 * The one place these pages are allowed to be loud: a measured value.
 *
 * 17px mono is the top of the scale and it belongs to a figure, exactly as it
 * does in the tool's hex readout. A page of prose earns emphasis by having
 * something worth measuring on it, not by setting a heading larger.
 */
export function Figures({
  items,
}: {
  items: Array<{ value: string; label: string; note?: string }>
}) {
  return (
    <dl className="grid grid-cols-1 gap-px border border-line bg-line sm:grid-cols-3">
      {items.map((item) => (
        <div key={item.label} className="flex flex-col gap-0.5 bg-bg p-3">
          <dt className="text-[11px] text-ink-muted">{item.label}</dt>
          {/* The note lives inside the definition, not beside it: a `div` in a
              `dl` may hold only `dt` and `dd`, and a stray sibling breaks the
              list semantics for anyone reading it with a screen reader. */}
          <dd className="flex flex-col gap-0.5">
            <span className="tabular text-[17px] font-medium leading-tight tracking-[-0.01em]">
              {item.value}
            </span>
            {item.note && (
              <span className="text-[11px] leading-snug text-ink-faint">{item.note}</span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  )
}

/** A small table of measurements, in the tool's own table grammar. */
export function DataTable({
  caption,
  columns,
  rows,
  align,
}: {
  caption: string
  columns: string[]
  rows: ReactNode[][]
  /** Column indices to set right-aligned and mono. */
  align?: number[]
}) {
  const figure = new Set(align ?? [])

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[12.5px]">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-line text-left">
            {columns.map((column, i) => (
              <th
                key={column}
                scope="col"
                className={[
                  'py-1.5 pr-3 font-medium',
                  figure.has(i) ? 'text-right' : '',
                ].join(' ')}
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r} className="border-b border-line/60">
              {row.map((cell, c) => (
                <td
                  key={c}
                  className={[
                    'py-1.5 pr-3 align-baseline',
                    figure.has(c) ? 'tabular text-right' : '',
                    c === 0 ? '' : 'text-ink-muted',
                  ].join(' ')}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * One value, explained: what it is called, where it appears, what it means.
 *
 * A definition list rather than a grid of cards. The reader arrives having seen
 * a number somewhere in the tool and wanting to know what it was, so the name
 * and its location are the entry points and the prose follows them.
 */
export function Term({
  name,
  where,
  children,
}: {
  name: string
  where: string
  children: ReactNode
}) {
  return (
    <div className="border-t border-line pt-3 first:border-t-0 first:pt-0">
      <dt className="flex flex-wrap items-baseline gap-x-2.5">
        <span className="tabular text-[13px] font-medium">{name}</span>
        <span className="text-[11px] text-ink-faint">{where}</span>
      </dt>
      <dd className="mt-1.5 flex max-w-[74ch] flex-col gap-2">{children}</dd>
    </div>
  )
}

/** A run of {@link Term}s. */
export function Terms({ children }: { children: ReactNode }) {
  return <dl className="flex flex-col gap-3.5">{children}</dl>
}

/** An inline figure inside prose, so numbers keep their tabular alignment. */
export function N({ children }: { children: ReactNode }) {
  return <span className="tabular text-ink">{children}</span>
}
