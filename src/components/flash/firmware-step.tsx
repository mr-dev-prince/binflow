'use client'

import { Button } from '@/components/ui/button'
import { FileDrop } from '@/components/ui/file-drop'
import { AlertIcon, FileIcon } from '@/components/ui/icons'
import { Step } from '@/components/ui/step'
import { warningFor } from '@/lib/binary'
import { formatBytes } from '@/lib/format'
import type { Binary } from '@/lib/types'

type FirmwareStepProps = {
  binary: Binary | null
  reading: boolean
  disabled: boolean
  onFile: (file: File) => void
  onClear: () => void
}

export function FirmwareStep({ binary, reading, disabled, onFile, onClear }: FirmwareStepProps) {
  const warning = binary ? warningFor(binary) : null

  return (
    <Step
      actions={
        binary ? (
          <Button disabled={disabled} onClick={onClear}>
            Change
          </Button>
        ) : undefined
      }
      done={Boolean(binary) && !warning}
      number={2}
      status={reading ? 'Reading file…' : binary ? 'Ready to write' : 'No file chosen'}
      title="Firmware"
    >
      {binary ? (
        <div className="flex flex-1 flex-col gap-3">
          <div className="flex items-center gap-3 rounded-2xl border border-line bg-paper/70 px-4 py-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sand text-cocoa">
              <FileIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{binary.name}</p>
              <p className="text-xs text-ink-muted">Loaded {new Date(binary.loadedAt).toLocaleTimeString()}</p>
            </div>
          </div>

          <dl className="grid grid-cols-3 gap-2">
            {[
              ['Size', formatBytes(binary.bytes)],
              ['Format', binary.format.toUpperCase()],
              ['SHA-256', binary.digest.slice(0, 8)],
            ].map(([term, value]) => (
              <div className="rounded-2xl border border-line bg-sand/40 px-3 py-2.5" key={term}>
                <dt className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">{term}</dt>
                <dd className="mt-0.5 truncate font-mono text-sm text-ink" title={term === 'SHA-256' ? binary.digest : undefined}>
                  {value}
                </dd>
              </div>
            ))}
          </dl>

          {warning ? (
            <p className="flex items-start gap-2 rounded-2xl border border-ember/25 bg-ember/10 px-3 py-2.5 text-sm text-ember">
              <AlertIcon className="mt-0.5 shrink-0" />
              {warning}
            </p>
          ) : null}
        </div>
      ) : (
        <FileDrop
          accept=".bin,.hex,.uf2,.elf"
          className="flex-1"
          disabled={disabled || reading}
          hint="bin · hex · uf2"
          onFile={onFile}
        />
      )}
    </Step>
  )
}
