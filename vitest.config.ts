import { defineConfig } from 'vitest/config'
import viteReact from '@vitejs/plugin-react'

// Deliberately does NOT include the tanstackStart() plugin: its unconditional
// optimizeDeps handling breaks Vitest (TanStack/router#6246).
export default defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [viteReact()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    benchmark: { include: ['src/**/*.bench.ts'] },
  },
})
