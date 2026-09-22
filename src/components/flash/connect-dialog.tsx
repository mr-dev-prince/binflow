'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PlugIcon, TrashIcon } from '@/components/ui/icons'
import { Modal } from '@/components/ui/modal'
import { StatusDot } from '@/components/ui/status-dot'
import type { Device } from '@/lib/types'
import type { Support } from '@/lib/use-flasher'
import { chipLabel } from './family'

type ConnectDialogProps = {
  open: boolean
  available: Device[]
  support: Support
  onClose: () => void
  onConnect: (id: string) => void
  onForget: (id: string) => void
  /** Open the browser's pickers. Each resolves true when a board was chosen. */
  onPickSerial: () => Promise<boolean>
  onPickBootsel: () => Promise<boolean>
}

export function ConnectDialog({
  open,
  available,
  support,
  onClose,
  onConnect,
  onForget,
  onPickSerial,
  onPickBootsel,
}: ConnectDialogProps) {
  const [picking, setPicking] = useState<'serial' | 'usb' | null>(null)

  const pick = async (kind: 'serial' | 'usb') => {
    setPicking(kind)
    const chosen = await (kind === 'serial' ? onPickSerial() : onPickBootsel())
    setPicking(null)
    if (chosen) onClose()
  }

  return (
    <Modal
      description="Boards your browser already knows are listed here. Plug one in and it appears on its own."
      footer={
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            <Button
              className="w-full"
              disabled={support.serial !== true || picking !== null}
              icon={<PlugIcon />}
              onClick={() => pick('serial')}
              size="md"
              variant="primary"
            >
              {picking === 'serial' ? 'Waiting…' : 'Serial port'}
            </Button>
            <Button
              className="w-full"
              disabled={support.usb !== true || picking !== null}
              icon={<PlugIcon />}
              onClick={() => pick('usb')}
              size="md"
              variant="primary"
            >
              {picking === 'usb' ? 'Waiting…' : 'Pico in BOOTSEL'}
            </Button>
          </div>
          <p className="text-center text-xs leading-relaxed text-muted-foreground/60">
            ESP boards, and a Pico that is running firmware, show up as serial ports. A Pico flashes from BOOTSEL: connect it
            over serial and press Reboot, or hold the button while plugging it in.
          </p>
        </div>
      }
      onClose={onClose}
      open={open}
      title="Connect a board"
    >
      {available.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border bg-muted/40 px-4 py-8 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-md bg-primary/10 text-primary">
            <PlugIcon className="h-5 w-5" />
          </span>
          <p className="text-sm text-foreground">No boards found yet</p>
          <p className="max-w-[30ch] text-sm text-muted-foreground">Connect one over USB, then find it with a button below.</p>
        </div>
      ) : (
        <ul className="pane-scroll -mx-1 flex max-h-72 flex-col gap-2 overflow-y-auto px-1">
          {available.map((device) => (
            <li
              className="flex items-center gap-3 rounded-md border border-border bg-background px-4 py-3 transition-colors hover:border-muted-foreground/40"
              key={device.id}
            >
              <StatusDot tone="ready" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm text-foreground">{device.name}</p>
                  <Badge tone={device.transport === 'usb' ? 'ready' : 'neutral'}>{chipLabel(device)}</Badge>
                </div>
                <p className="truncate font-mono text-[11px] text-muted-foreground">{device.detail}</p>
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
                title="Forget this device"
                variant="ghost"
              />
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}
