'use client'

import { useRef, useState } from 'react'
import { cx } from '@/lib/cx'
import { UploadIcon } from './icons'

type FileDropProps = {
  accept?: string
  disabled?: boolean
  onFile: (file: File) => void
  hint?: string
  className?: string
}

export function FileDrop({ accept, disabled, onFile, hint, className }: FileDropProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [over, setOver] = useState(false)

  const take = (files: FileList | null) => {
    const file = files?.[0]
    if (file) onFile(file)
  }

  return (
    <div
      className={cx(
        'flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed px-4 py-8 text-center transition-colors',
        disabled
          ? 'cursor-not-allowed border-line text-ink-faint'
          : 'cursor-pointer border-ink-faint/60 text-ink-muted hover:border-caramel hover:bg-sand/50',
        over && !disabled && 'border-caramel bg-sand text-ink',
        className,
      )}
      onClick={() => !disabled && inputRef.current?.click()}
      onDragLeave={() => setOver(false)}
      onDragOver={(event) => {
        event.preventDefault()
        if (!disabled) setOver(true)
      }}
      onDrop={(event) => {
        event.preventDefault()
        setOver(false)
        if (!disabled) take(event.dataTransfer.files)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          if (!disabled) inputRef.current?.click()
        }
      }}
      role="button"
      tabIndex={disabled ? -1 : 0}
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sand text-cocoa">
        <UploadIcon className="h-5 w-5" />
      </span>
      <div>
        <p className="text-sm font-medium text-ink">Drop a firmware file</p>
        <p className="text-sm">
          or <span className="font-medium text-ink underline decoration-ink-faint underline-offset-4">browse</span>
        </p>
      </div>
      {hint ? <p className="font-mono text-[11px] uppercase tracking-wider text-ink-faint">{hint}</p> : null}
      <input
        accept={accept}
        className="hidden"
        onChange={(event) => {
          take(event.target.files)
          event.target.value = ''
        }}
        ref={inputRef}
        type="file"
      />
    </div>
  )
}
