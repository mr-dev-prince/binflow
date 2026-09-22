'use client'

import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { PlugIcon, RefreshIcon, StopIcon } from '@/components/ui/icons'
import { cx } from '@/lib/cx'
import { formatClock } from '@/lib/format'
import { BAUD_RATES, type MonitorSnapshot } from '@/lib/monitor'
import type { Device } from '@/lib/types'

const FIELD =
  'rounded-lg border border-line bg-card px-2 py-1 font-mono text-[11px] text-ink focus:border-caramel focus:outline-none disabled:opacity-60'

/** ESP-IDF puts its level first: "E (1234) wifi: …". Our own notes are dashed. */
function toneOf(text: string) {
  if (text.startsWith('—')) return 'text-ink-faint'
  if (/^E \(\d/.test(text)) return 'text-brick'
  if (/^W \(\d/.test(text)) return 'text-ember'
  return 'text-cocoa'
}

type SerialMonitorProps = {
  snapshot: MonitorSnapshot
  /** Connected boards that have a serial console at all. */
  boards: Device[]
  running: boolean
  /** The sheet fills the screen, so the pane takes what is left of it. */
  full: boolean
  onSelect: (id: string) => void
  onStart: (id: string) => void
  onStop: () => void
  onBaud: (baud: number) => void
  onReset: () => void
}

export function SerialMonitor({ snapshot, boards, running, full, onSelect, onStart, onStop, onBaud, onReset }: SerialMonitorProps) {
  const listRef = useRef<HTMLDivElement | null>(null)
  /** Only follow the tail while the reader is already at it. */
  const stick = useRef(true)

  const { lines, status, baud, error } = snapshot
  const listening = status === 'on'
  const selected = boards.some((board) => board.id === snapshot.deviceId) ? snapshot.deviceId : boards[0]?.id ?? null
  const reading = listening ? boards.find((board) => board.id === snapshot.deviceId) : undefined

  useEffect(() => {
    const list = listRef.current
    if (list && stick.current) list.scrollTop = list.scrollHeight
  }, [lines])

  return (
    <div className={cx('flex flex-col border-t border-line', full ? 'min-h-0 flex-1' : 'h-56')}>
      <div className="flex shrink-0 items-center gap-2 px-5 py-2 lg:px-6">
        {boards.length === 0 ? (
          <p className="text-xs text-ink-muted">
            No board with a serial console is connected. A Pico in BOOTSEL mode does not have one.
          </p>
        ) : (
          <>
            <select
              aria-label="Board to read"
              className={FIELD}
              disabled={status !== 'off'}
              onChange={(event) => onSelect(event.target.value)}
              value={selected ?? ''}
            >
              {boards.map((board) => (
                <option key={board.id} value={board.id}>
                  {board.name}
                </option>
              ))}
            </select>

            <select
              aria-label="Baud rate"
              className={FIELD}
              onChange={(event) => onBaud(Number(event.target.value))}
              value={baud}
            >
              {BAUD_RATES.map((rate) => (
                <option key={rate} value={rate}>
                  {rate} baud
                </option>
              ))}
            </select>

            {listening ? (
              <>
                <Button icon={<StopIcon />} onClick={onStop}>
                  Stop
                </Button>
                <Button icon={<RefreshIcon />} onClick={onReset} title="Pulse the reset line so the board boots again">
                  Reset board
                </Button>
              </>
            ) : (
              <Button
                disabled={running || status === 'opening' || !selected}
                icon={<PlugIcon />}
                onClick={() => selected && onStart(selected)}
                variant="primary"
              >
                {status === 'opening' ? 'Opening…' : 'Read'}
              </Button>
            )}

            <p className={cx('min-w-0 flex-1 truncate text-xs', error ? 'text-brick' : 'text-ink-muted')}>
              {error ??
                (listening
                  ? `Reading ${reading?.name ?? 'the board'} at ${baud} baud`
                  : running
                    ? 'Paused while flashing'
                    : 'Not reading')}
            </p>
          </>
        )}
      </div>

      <div
        className="pane-scroll flex-1 overflow-y-auto pb-2 font-mono text-xs leading-6"
        onScroll={(event) => {
          const list = event.currentTarget
          stick.current = list.scrollHeight - list.scrollTop - list.clientHeight < 24
        }}
        ref={listRef}
      >
        {lines.length === 0 ? (
          <p className="px-5 text-ink-faint lg:px-6">
            {listening ? 'Waiting for output. Reset the board to catch its boot log.' : 'Nothing read yet.'}
          </p>
        ) : (
          lines.map((line) => (
            <p
              className={cx(
                'flex gap-3 px-5 lg:px-6',
                // Striped by the line's own id, not its index: the pattern would
                // flip on every render once the buffer starts dropping lines.
                line.id % 2 === 0 ? 'bg-sand/70' : undefined,
              )}
              key={line.id}
            >
              <span className="shrink-0 text-ink-faint">{formatClock(line.at)}</span>
              <span className={cx('min-w-0 whitespace-pre-wrap break-words', toneOf(line.text))}>{line.text}</span>
            </p>
          ))
        )}
      </div>
    </div>
  )
}
