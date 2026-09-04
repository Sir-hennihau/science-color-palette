import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  return createTanStackRouter({
    routeTree,
    // Vite rewrites this to the deploy sub-path, so the router agrees with the
    // asset URLs when the tool is served from a GitHub Pages project site.
    basepath: import.meta.env.BASE_URL,
    // Search params are the source of truth for the whole palette, so stable
    // object identity across navigations is what keeps generation memoised.
    defaultStructuralSharing: true,
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
