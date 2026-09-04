/**
 * The three status marks.
 *
 * Colour is never the signal in this interface, only the redundant channel, so
 * every pass, fail and warning is drawn as well as coloured and always sits
 * next to a word. Collected here because they had been copied into three files
 * and had begun to drift apart in stroke weight.
 */

export function TickMark() {
  return (
    <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 shrink-0" aria-hidden="true">
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

export function CrossMark() {
  return (
    <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 shrink-0" aria-hidden="true">
      <path
        d="M2.6 2.6l6.8 6.8M9.4 2.6l-6.8 6.8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function WarningMark() {
  return (
    <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 shrink-0" aria-hidden="true">
      <path d="M6 1 11.2 10.5H0.8z" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M6 4.4v2.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="6" cy="8.7" r="0.7" fill="currentColor" />
    </svg>
  )
}
