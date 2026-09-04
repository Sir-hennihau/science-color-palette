/**
 * Browser capabilities the tool uses where available.
 *
 * Every check is guarded for the case where there is no window at all: the
 * static shell is prebuilt in a server context, so a bare `window` reference at
 * module scope would break the build.
 */

export function isBrowser(): boolean {
  return typeof window !== 'undefined'
}

/** Copy text, reporting whether it worked so the caller can say so. */
export async function copyText(text: string): Promise<boolean> {
  if (!isBrowser()) return false

  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Older browsers, and any context where the async API is unavailable.
    try {
      const area = document.createElement('textarea')
      area.value = text
      area.setAttribute('readonly', '')
      area.style.position = 'fixed'
      area.style.opacity = '0'
      document.body.appendChild(area)
      area.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(area)
      return ok
    } catch {
      return false
    }
  }
}

/** Hand the viewer a file to save. */
export function downloadText(filename: string, text: string, mimeType: string): void {
  if (!isBrowser()) return

  const url = URL.createObjectURL(new Blob([text], { type: mimeType }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  // Freed on the next tick, once the navigation has been handed off.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

interface EyeDropperResult {
  sRGBHex: string
}

interface EyeDropperInstance {
  open: () => Promise<EyeDropperResult>
}

type EyeDropperConstructor = new () => EyeDropperInstance

/** Whether the screen colour picker exists here. Chromium only, for now. */
export function supportsEyeDropper(): boolean {
  return isBrowser() && 'EyeDropper' in window
}

/**
 * Pick a colour from anywhere on screen.
 *
 * Returns null when the user cancels, which is a normal outcome rather than an
 * error worth surfacing.
 */
export async function pickScreenColor(): Promise<string | null> {
  if (!supportsEyeDropper()) return null

  try {
    const Ctor = (window as unknown as { EyeDropper: EyeDropperConstructor }).EyeDropper
    const result = await new Ctor().open()
    return result.sRGBHex.toLowerCase()
  } catch {
    return null
  }
}

export type ThemeChoice = 'light' | 'dark' | 'system'

const THEME_KEY = 'scp-theme'

export function readTheme(): ThemeChoice {
  if (!isBrowser()) return 'system'
  try {
    const stored = localStorage.getItem(THEME_KEY)
    return stored === 'light' || stored === 'dark' ? stored : 'system'
  } catch {
    return 'system'
  }
}

/** Apply a theme choice and remember it. */
export function applyTheme(choice: ThemeChoice): void {
  if (!isBrowser()) return

  const dark =
    choice === 'dark' ||
    (choice === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

  document.documentElement.classList.toggle('dark', dark)

  try {
    if (choice === 'system') localStorage.removeItem(THEME_KEY)
    else localStorage.setItem(THEME_KEY, choice)
  } catch {
    // Storage can be blocked; the choice still applies for this session.
  }
}
