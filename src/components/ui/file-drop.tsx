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
        'flex flex-col items-center justify-center gap-3 rounded-md border border-dashed px-4 py-8 text-center transition-colors',
        'focus-visible:focus-outline outline-none',
        disabled
          ? 'cursor-not-allowed border-border text-muted-foreground/60'
          : 'cursor-pointer border-border text-muted-foreground hover:border-primary hover:bg-primary/5',
        over && !disabled && 'border-primary bg-primary/10 text-foreground',
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
      <span className="flex h-12 w-12 items-center justify-center rounded-md bg-primary/10 text-primary">
        <UploadIcon className="h-5 w-5" />
      </span>
      <div>
        <p className="text-sm text-foreground">Drop a firmware file</p>
        <p className="text-sm">
          or <span className="text-foreground underline decoration-muted-foreground/50 underline-offset-4">browse</span>
        </p>
      </div>
      {hint ? <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground/60">{hint}</p> : null}
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
