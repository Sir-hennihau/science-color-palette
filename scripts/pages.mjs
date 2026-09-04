// Turns the SPA build into something a static host can serve unaided.
// TanStack Start writes one prerendered shell; GitHub Pages has no rewrite
// rules, so it needs that shell under the two names it actually looks for:
// index.html for the site root, and 404.html for any deep link beneath it.
// .nojekyll stops Pages discarding files and folders that begin with _.
import { copyFileSync, writeFileSync } from 'node:fs'

const dir = 'dist/client'

for (const name of ['index.html', '404.html']) {
  copyFileSync(`${dir}/_shell.html`, `${dir}/${name}`)
}
writeFileSync(`${dir}/.nojekyll`, '')

console.log('pages: wrote index.html, 404.html and .nojekyll')
