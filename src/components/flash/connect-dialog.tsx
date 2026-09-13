'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { PlugIcon, TrashIcon } from '@/components/ui/icons'
import { Modal } from '@/components/ui/modal'
import { StatusDot } from '@/components/ui/status-dot'
import type { Device } from '@/lib/types'

type ConnectDialogProps = {
  open: boolean
  available: Device[]
  onClose: () => void
  onConnect: (id: string) => void
  onForget: (id: string) => void
  /** Opens the browser's own picker. Resolves true when a board was chosen. */
  onPick: () => Promise<boolean>
}

export function ConnectDialog({ open, available, onClose, onConnect, onForget, onPick }: ConnectDialogProps) {
  const [picking, setPicking] = useState(false)

  const pick = async () => {
    setPicking(true)
    const chosen = await onPick()
    setPicking(false)
    if (chosen) onClose()
  }

  return (
    <Modal
      description="Boards your browser already knows are listed here. Plug one in and it appears on its own."
      footer={
        <div className="flex flex-col gap-2">
          <Button className="w-full" disabled={picking} icon={<PlugIcon />} onClick={pick} size="md" variant="primary">
            {picking ? 'Waiting for your browser…' : 'Find a new board'}
          </Button>
          <p className="text-center text-xs text-ink-faint">Your browser will show every serial port it can see.</p>
        </div>
      }
      onClose={onClose}
      open={open}
      title="Connect a board"
    >
      {available.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line bg-sand/40 px-4 py-8 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sand text-cocoa">
            <PlugIcon className="h-5 w-5" />
          </span>
          <p className="text-sm font-medium text-ink">No boards found yet</p>
          <p className="max-w-[30ch] text-sm text-ink-muted">Connect one over USB, then find it with the button below.</p>
        </div>
      ) : (
        <ul className="pane-scroll -mx-1 flex max-h-72 flex-col gap-2 overflow-y-auto px-1">
          {available.map((device) => (
            <li
              className="flex items-center gap-3 rounded-2xl border border-line bg-paper/70 px-4 py-3 transition-colors hover:border-ink-faint"
              key={device.id}
            >
              <StatusDot tone="ready" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{device.name}</p>
                <p className="truncate font-mono text-[11px] text-ink-muted">{device.detail}</p>
              </div>
              <Button
                onClick={() => {
                  onConnect(device.id)
                  onClose()
                }}
                variant="primary"
              >
                Connect
              </Button>
              <Button
                aria-label={`Forget ${device.name}`}
                className="-mr-2"
                icon={<TrashIcon />}
                onClick={() => onForget(device.id)}
                title="Forget this port"
                variant="ghost"
              />
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}
