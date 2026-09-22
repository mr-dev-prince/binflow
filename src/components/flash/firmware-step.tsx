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
  /** True while a run is in flight. */
  disabled: boolean
  /** Why the step cannot be used yet, e.g. no board connected. Null when it can. */
  blocker: string | null
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

export function FirmwareStep({ binary, reading, disabled, blocker, espOffset, onEspOffset, onFile, onClear }: FirmwareStepProps) {
  const warning = binary ? warningFor(binary) : null
  const off = disabled || blocker !== null

  return (
    <Step
      actions={
        binary ? (
          <Button disabled={off} onClick={onClear}>
            Change
          </Button>
        ) : undefined
      }
      disabled={blocker !== null}
      done={Boolean(binary) && !warning}
      number={2}
      status={
        reading ? 'Reading file…' : blocker ?? (binary ? (warning ? 'Cannot be written' : 'Ready to write') : 'No file chosen')
      }
      title="Firmware"
    >
      {binary ? (
        <div className="flex flex-1 flex-col gap-3">
          <div className="flex items-center gap-3 rounded-md border border-border bg-background px-4 py-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <FileIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-foreground">{binary.name}</p>
              <p className="text-xs text-muted-foreground">Loaded {new Date(binary.loadedAt).toLocaleTimeString()}</p>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-2">
            {[
              ['Size', formatBytes(binary.bytes)],
              ['Format', binary.format.toUpperCase()],
              ['Target', targetOf(binary)],
              ['SHA-256', binary.digest.slice(0, 8)],
            ].map(([term, value]) => (
              <div className="rounded-md border border-border bg-muted/40 px-3 py-2.5" key={term}>
                <dt className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground/60">{term}</dt>
                <dd className="mt-0.5 truncate font-mono text-sm text-foreground" title={term === 'SHA-256' ? binary.digest : undefined}>
                  {value}
                </dd>
              </div>
            ))}
          </dl>

          {binary.format === 'bin' && binary.hint.family !== 'rp' ? (
            <label className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2.5">
              <span>
                <span className="block font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground/60">ESP write offset</span>
                <span className="block text-xs text-muted-foreground">Raw .bin only. A Pico always starts at the flash base.</span>
              </span>
              <input
                className="w-28 rounded-sm border border-input bg-background px-2 py-1 text-right font-mono text-sm text-foreground focus:bg-muted outline-none disabled:cursor-not-allowed disabled:opacity-50"
                defaultValue={`0x${espOffset.toString(16).toUpperCase()}`}
                disabled={off}
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
            <p className="flex items-start gap-2 rounded-md border border-playarka-500/25 bg-playarka-500/10 px-3 py-2.5 text-sm text-playarka-500">
              <AlertIcon className="mt-0.5 shrink-0" />
              {warning}
            </p>
          ) : null}
        </div>
      ) : (
        <FileDrop
          accept=".bin,.uf2,.elf"
          className="flex-1"
          disabled={off || reading}
          hint="bin · uf2 · elf"
          onFile={onFile}
        />
      )}
    </Step>
  )
}
