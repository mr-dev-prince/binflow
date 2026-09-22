'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ChevronIcon, CollapseIcon, ExpandIcon } from '@/components/ui/icons'
import { StatusDot } from '@/components/ui/status-dot'
import { cx } from '@/lib/cx'
import { formatClock } from '@/lib/format'
import type { MonitorSnapshot } from '@/lib/monitor'
import type { Device, LogEntry, LogLevel } from '@/lib/types'
import { SerialMonitor } from './serial-monitor'

const LEVELS: Record<LogLevel, string> = {
  info: 'text-ink-muted',
  ok: 'text-moss',
  warn: 'text-ember',
  error: 'text-brick',
}

type Tab = 'activity' | 'serial'

type ActivityLogProps = {
  entries: LogEntry[]
  onClear: () => void
  monitor: MonitorSnapshot
  /** Connected boards the monitor could read. */
  monitorBoards: Device[]
  running: boolean
  onSelectBoard: (id: string) => void
  onStartMonitor: (id: string) => void
  onStopMonitor: () => void
  onMonitorBaud: (baud: number) => void
  onClearMonitor: () => void
  onResetBoard: () => void
}

export function ActivityLog({
  entries,
  onClear,
  monitor,
  monitorBoards,
  running,
  onSelectBoard,
  onStartMonitor,
  onStopMonitor,
  onMonitorBaud,
  onClearMonitor,
  onResetBoard,
}: ActivityLogProps) {
  const [tab, setTab] = useState<Tab>('activity')
  const [open, setOpen] = useState(false)
  const [full, setFull] = useState(false)
  const listRef = useRef<HTMLDivElement | null>(null)

  const showing = open ? tab : null
  const latest = entries[entries.length - 1]
  const lastLine = monitor.lines[monitor.lines.length - 1]

  useEffect(() => {
    if (showing === 'activity' && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [showing, entries.length])

  useEffect(() => {
    if (!full) return

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFull(false)
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [full])

  /** A tab opens the sheet, and closes it again when it is the one on show. */
  const toggle = (next: Tab) => {
    const opening = !open || tab !== next

    setTab(next)
    setOpen(opening)
    if (!opening) setFull(false)
  }

  const tabClass = (which: Tab) =>
    cx(
      'flex shrink-0 items-center gap-2 rounded-lg px-2 py-1 text-xs font-medium transition-colors',
      showing === which ? 'bg-sand text-ink' : 'text-ink-muted hover:text-ink',
    )

  const count = (value: number) => (
    <span className="rounded-full bg-paper/80 px-1.5 font-mono text-[10px] tabular-nums text-ink-muted">{value}</span>
  )

  return (
    <footer
      className={cx(
        'flex flex-col border-t border-line backdrop-blur',
        // Full screen leaves the page flow rather than fighting the shell for height.
        full ? 'fixed inset-0 z-30 bg-card' : 'shrink-0 bg-card/80',
      )}
    >
      <div className="flex shrink-0 items-center gap-2 px-5 py-2 lg:px-6">
        <button aria-expanded={showing === 'activity'} className={tabClass('activity')} onClick={() => toggle('activity')} type="button">
          <ChevronIcon className={cx('h-3.5 w-3.5 transition-transform', showing === 'activity' ? 'rotate-0' : '-rotate-90')} />
          Activity
          {count(entries.length)}
        </button>

        <button aria-expanded={showing === 'serial'} className={tabClass('serial')} onClick={() => toggle('serial')} type="button">
          <ChevronIcon className={cx('h-3.5 w-3.5 transition-transform', showing === 'serial' ? 'rotate-0' : '-rotate-90')} />
          Serial
          {monitor.status === 'on' ? <StatusDot pulse tone="ok" /> : count(monitor.lines.length)}
        </button>

        {!open && tab === 'activity' && latest ? (
          <p className="min-w-0 flex-1 truncate font-mono text-xs text-ink-muted">
            <span className="text-ink-faint">{formatClock(latest.at)}</span>
            <span className="mx-2 text-ink-faint">·</span>
            <span className={LEVELS[latest.level]}>{latest.message}</span>
          </p>
        ) : !open && tab === 'serial' && lastLine ? (
          <p className="min-w-0 flex-1 truncate font-mono text-xs text-cocoa">
            <span className="text-ink-faint">{formatClock(lastLine.at)}</span>
            <span className="mx-2 text-ink-faint">·</span>
            {lastLine.text}
          </p>
        ) : (
          <span className="flex-1" />
        )}

        {showing === 'activity' && entries.length > 0 ? (
          <Button onClick={onClear} variant="ghost">
            Clear
          </Button>
        ) : null}

        {showing === 'serial' && monitor.lines.length > 0 ? (
          <Button onClick={onClearMonitor} variant="ghost">
            Clear
          </Button>
        ) : null}

        {open ? (
          <Button
            aria-label={full ? 'Leave full screen' : 'Fill the screen'}
            icon={full ? <CollapseIcon /> : <ExpandIcon />}
            onClick={() => setFull((value) => !value)}
            title={full ? 'Leave full screen (Esc)' : 'Fill the screen'}
            variant="ghost"
          />
        ) : null}
      </div>

      {showing === 'activity' ? (
        <div
          className={cx(
            'pane-scroll overflow-y-auto border-t border-line px-5 py-2 font-mono text-xs leading-6 lg:px-6',
            full ? 'min-h-0 flex-1' : 'h-44',
          )}
          ref={listRef}
        >
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

      {showing === 'serial' ? (
        <SerialMonitor
          boards={monitorBoards}
          full={full}
          onBaud={onMonitorBaud}
          onReset={onResetBoard}
          onSelect={onSelectBoard}
          onStart={onStartMonitor}
          onStop={onStopMonitor}
          running={running}
          snapshot={monitor}
        />
      ) : null}
    </footer>
  )
}
