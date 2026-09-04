import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import type { ReactNode } from 'react'

import appCss from '../styles.css?url'

/**
 * The document shell.
 *
 * Rendered in a server context when the static shell is prebuilt, so nothing
 * here may touch a browser API during render. The theme bootstrap is an inline
 * script string for exactly that reason: it has to run before first paint to
 * avoid a flash, which no React effect can do.
 */
export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Science Color Palette' },
      {
        name: 'description',
        content:
          'Build a complete, provably accessible colour palette from one or two colours, ' +
          'using perceptually uniform colour science.',
      },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
      {
        rel: 'stylesheet',
        href:
          'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&' +
          'family=IBM+Plex+Sans:wght@400;450;500;600&display=swap',
      },
    ],
  }),
  shellComponent: RootDocument,
})

const THEME_BOOTSTRAP = `
(function () {
  try {
    var stored = localStorage.getItem('scp-theme');
    var dark = stored === 'dark' ||
      (stored !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (dark) document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`

function RootDocument({ children }: { children: ReactNode }) {
  return (
    // The bootstrap script below sets a class on this element before React
    // hydrates, which is the only way to avoid a flash of the wrong theme, so
    // the mismatch it causes is expected rather than a bug to chase.
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
