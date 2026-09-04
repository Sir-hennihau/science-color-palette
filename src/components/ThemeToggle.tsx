import { useEffect, useState } from 'react'

import { applyTheme, readTheme, type ThemeChoice } from '../lib/browser.ts'

/**
 * Light, dark and auto.
 *
 * Shared by the tool and the reading pages, because a colour tool that changes
 * appearance when you navigate to its documentation has just moved the ground
 * under the samples. The initial value is read in an effect rather than during
 * render: a pre-paint script has already set the class on `<html>`, and asking
 * the DOM about it while rendering would disagree with the prebuilt shell.
 */
export function ThemeToggle() {
  const [choice, setChoice] = useState<ThemeChoice>('system')

  useEffect(() => setChoice(readTheme()), [])

  const set = (next: ThemeChoice) => {
    setChoice(next)
    applyTheme(next)
  }

  return (
    <div role="group" aria-label="Appearance" className="flex border border-line">
      {(['light', 'dark', 'system'] as const).map((option, index) => (
        <button
          key={option}
          type="button"
          aria-pressed={choice === option}
          onClick={() => set(option)}
          className={[
            'px-2 py-1 text-[11.5px]',
            index > 0 ? 'border-l border-line' : '',
            choice === option ? 'bg-inverse-bg text-inverse-ink' : 'text-ink-muted hover:text-ink',
          ].join(' ')}
        >
          {option === 'light' ? 'Light' : option === 'dark' ? 'Dark' : 'Auto'}
        </button>
      ))}
    </div>
  )
}
