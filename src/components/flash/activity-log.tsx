'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ChevronIcon } from '@/components/ui/icons'
import { cx } from '@/lib/cx'
import { formatClock } from '@/lib/format'
import type { LogEntry, LogLevel } from '@/lib/types'

const LEVELS: Record<LogLevel, string> = {
  info: 'text-ink-muted',
  ok: 'text-moss',
  warn: 'text-ember',
  error: 'text-brick',
}

export function ActivityLog({ entries, onClear }: { entries: LogEntry[]; onClear: () => void }) {
  const [open, setOpen] = useState(false)
  const listRef = useRef<HTMLDivElement | null>(null)
  const latest = entries[entries.length - 1]

  useEffect(() => {
    if (open && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [open, entries.length])

  return (
    <footer className="shrink-0 border-t border-line bg-card/80 backdrop-blur">
      <div className="flex items-center gap-4 px-5 py-2 lg:px-6">
        <button
          aria-expanded={open}
          className="flex shrink-0 items-center gap-2 rounded-lg px-1 py-1 text-xs font-medium text-ink-muted transition-colors hover:text-ink"
          onClick={() => setOpen((value) => !value)}
          type="button"
        >
          <ChevronIcon className={cx('h-3.5 w-3.5 transition-transform', open ? 'rotate-0' : '-rotate-90')} />
          Activity
          <span className="rounded-full bg-sand px-1.5 font-mono text-[10px] tabular-nums text-ink-muted">{entries.length}</span>
        </button>

        {latest && !open ? (
          <p className="min-w-0 flex-1 truncate font-mono text-xs text-ink-muted">
            <span className="text-ink-faint">{formatClock(latest.at)}</span>
            <span className="mx-2 text-ink-faint">·</span>
            <span className={LEVELS[latest.level]}>{latest.message}</span>
          </p>
        ) : (
          <span className="flex-1" />
        )}

        {open && entries.length > 0 ? (
          <Button onClick={onClear} variant="ghost">
            Clear
          </Button>
        ) : null}
      </div>

      {open ? (
        <div className="pane-scroll h-44 overflow-y-auto border-t border-line px-5 py-2 font-mono text-xs leading-6 lg:px-6" ref={listRef}>
          {entries.length === 0 ? (
            <p className="text-ink-faint">Nothing yet.</p>
          ) : (
            entries.map((entry) => (
              <p className="flex gap-3 whitespace-nowrap" key={entry.id}>
                <span className="text-ink-faint">{formatClock(entry.at)}</span>
                <span className="w-20 shrink-0 truncate text-ink-muted">{entry.scope}</span>
                <span className={cx('truncate', LEVELS[entry.level])}>{entry.message}</span>
              </p>
            ))
          )}
        </div>
      ) : null}
    </footer>
  )
}
