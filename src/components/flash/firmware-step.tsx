'use client'

import { Button } from '@/components/ui/button'
import { FileDrop } from '@/components/ui/file-drop'
import { AlertIcon, FileIcon } from '@/components/ui/icons'
import { Step } from '@/components/ui/step'
import { warningFor } from '@/lib/binary'
import { formatBytes } from '@/lib/format'
import type { Binary } from '@/lib/types'
import { FAMILY_LABEL } from './family'

type FirmwareStepProps = {
  binary: Binary | null
  reading: boolean
  disabled: boolean
  espOffset: number
  onEspOffset: (offset: number) => void
  onFile: (file: File) => void
  onClear: () => void
}

function targetOf(binary: Binary) {
  if (binary.hint.chip) return binary.hint.chip
  if (binary.hint.family !== 'unknown') return FAMILY_LABEL[binary.hint.family]
  return 'Any board'
}

export function FirmwareStep({ binary, reading, disabled, espOffset, onEspOffset, onFile, onClear }: FirmwareStepProps) {
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
      status={reading ? 'Reading file…' : binary ? (warning ? 'Cannot be written' : 'Ready to write') : 'No file chosen'}
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

          <dl className="grid grid-cols-2 gap-2">
            {[
              ['Size', formatBytes(binary.bytes)],
              ['Format', binary.format.toUpperCase()],
              ['Target', targetOf(binary)],
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

          {binary.format === 'bin' && binary.hint.family !== 'rp' ? (
            <label className="flex items-center justify-between gap-3 rounded-2xl border border-line px-3 py-2.5">
              <span>
                <span className="block font-mono text-[10px] uppercase tracking-wider text-ink-faint">ESP write offset</span>
                <span className="block text-xs text-ink-muted">Raw .bin only. A Pico always starts at the flash base.</span>
              </span>
              <input
                className="w-28 rounded-lg border border-line bg-card px-2 py-1 text-right font-mono text-sm text-ink focus:border-caramel focus:outline-none disabled:opacity-60"
                defaultValue={`0x${espOffset.toString(16).toUpperCase()}`}
                disabled={disabled}
                inputMode="text"
                // Remount per file so the box shows the offset detected for it,
                // which an uncontrolled input would otherwise keep from the last one.
                key={`${binary.digest}:${espOffset}`}
                onChange={(event) => {
                  const raw = event.target.value.trim()
                  if (!raw) return // an empty box parses as 0, which is a real offset
                  const parsed = Number(raw)
                  if (Number.isFinite(parsed) && parsed >= 0 && parsed % 0x1000 === 0) onEspOffset(parsed)
                }}
                spellCheck={false}
              />
            </label>
          ) : null}

          {warning ? (
            <p className="flex items-start gap-2 rounded-2xl border border-ember/25 bg-ember/10 px-3 py-2.5 text-sm text-ember">
              <AlertIcon className="mt-0.5 shrink-0" />
              {warning}
            </p>
          ) : null}
        </div>
      ) : (
        <FileDrop
          accept=".bin,.uf2,.elf"
          className="flex-1"
          disabled={disabled || reading}
          hint="bin · uf2 · elf"
          onFile={onFile}
        />
      )}
    </Step>
  )
}
