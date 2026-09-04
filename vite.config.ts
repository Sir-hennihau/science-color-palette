import { defineConfig } from 'vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// GitHub Pages serves a project site from a sub-path, so the bundle has to be
// built against it. Anything hosted at the domain root can override this.
const base = process.env.BASE_PATH ?? '/'

// The tool is a purely client-side calculator: SPA mode prerenders a static
// shell so `dist/client` can be hosted anywhere without a Node server.
const config = defineConfig({
  base,
  resolve: { tsconfigPaths: true },
  plugins: [
    tanstackStart({ spa: { enabled: true } }),
    viteReact(),
    tailwindcss(),
  ],
})

export default config
