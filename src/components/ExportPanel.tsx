import { useMemo, useState } from 'react'

import { usePaletteSession } from '../lib/palette-session.tsx'
import { copyText, downloadText } from '../lib/browser.ts'
import { EXPORT_FORMATS, exportPalette, type ExportFormat } from '../engine/index.ts'

export function ExportPanel({ onCopied }: { onCopied: (message: string) => void }) {
  const { palette } = usePaletteSession()
  const [format, setFormat] = useState<ExportFormat>('css')

  const descriptor = EXPORT_FORMATS.find((d) => d.format === format)!
  const code = useMemo(() => exportPalette(palette, format), [palette, format])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-px border-b border-line">
        {EXPORT_FORMATS.map((option) => (
          <button
            key={option.format}
            type="button"
            aria-pressed={format === option.format}
            onClick={() => setFormat(option.format)}
            className={[
              'px-3 py-1.5 text-[12.5px]',
              format === option.format
                ? 'border-b-2 border-ink font-medium'
                : 'border-b-2 border-transparent text-ink-muted hover:text-ink',
            ].join(' ')}
          >
            {option.title}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-[58ch] text-[12.5px] text-ink-muted">{descriptor.description}</p>

        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={async () => {
              const ok = await copyText(code)
              onCopied(ok ? `Copied ${descriptor.title}` : 'Could not reach the clipboard')
            }}
            className="border border-line px-2.5 py-1 text-[12px] hover:border-ink"
          >
            Copy
          </button>
          <button
            type="button"
            onClick={() => {
              downloadText(descriptor.filename, code, descriptor.mimeType)
              onCopied(`Saved ${descriptor.filename}`)
            }}
            className="border border-line px-2.5 py-1 text-[12px] hover:border-ink"
          >
            Save file
          </button>
        </div>
      </div>

      <pre
        tabIndex={0}
        aria-label={`${descriptor.title} output`}
        className="tabular max-h-[26rem] overflow-auto border border-line bg-surface p-3 text-[11.5px] leading-relaxed"
      >
        {code}
      </pre>
    </div>
  )
}
