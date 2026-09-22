'use client'

import { Badge, type Tone } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { PlugIcon, RefreshIcon, TrashIcon } from '@/components/ui/icons'
import { ProgressBar } from '@/components/ui/progress-bar'
import { StatusDot } from '@/components/ui/status-dot'
import { Step } from '@/components/ui/step'
import { formatPercent } from '@/lib/format'
import type { Device, DeviceState } from '@/lib/types'
import type { Support } from '@/lib/use-flasher'
import { chipLabel } from './family'

const STATE_LABEL: Record<DeviceState, { label: string; tone: Tone }> = {
  ready: { label: 'Connected', tone: 'ready' },
  busy: { label: 'Flashing', tone: 'busy' },
  flashed: { label: 'Flashed', tone: 'ok' },
  failed: { label: 'Failed', tone: 'error' },
  offline: { label: 'Unplugged', tone: 'neutral' },
}

type BoardStepProps = {
  devices: Device[]
  availableCount: number
  support: Support
  running: boolean
  onOpenPicker: () => void
  onRelease: (id: string) => void
  onReboot: (id: string) => void
  onRecheck: (id: string) => void
}

export function BoardStep({
  devices,
  availableCount,
  support,
  running,
  onOpenPicker,
  onRelease,
  onReboot,
  onRecheck,
}: BoardStepProps) {
  const online = devices.filter((device) => device.state !== 'offline').length
  const supported = support.serial === true || support.usb === true
  const unsupported = support.serial === false && support.usb === false

  const status = unsupported
    ? 'Not available in this browser'
    : online === 0
      ? availableCount > 0
        ? `${availableCount} board${availableCount > 1 ? 's' : ''} ready to connect`
        : 'Nothing connected yet'
      : `${online} board${online > 1 ? 's' : ''} connected`

  return (
    <Step
      actions={
        devices.length > 0 ? (
          <Button disabled={!supported || running} icon={<PlugIcon />} onClick={onOpenPicker}>
            Add
            {availableCount > 0 ? (
              <span className="rounded-full bg-caramel/15 px-1.5 font-mono text-[10px] text-caramel">{availableCount}</span>
            ) : null}
          </Button>
        ) : undefined
      }
      done={online > 0}
      number={1}
      status={status}
      title="Board"
    >
      {unsupported ? (
        <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-line bg-sand/30">
          <EmptyState icon={<PlugIcon className="h-5 w-5" />} title="This browser cannot reach USB boards">
            Open streambits in Chrome or Edge on a desktop computer.
          </EmptyState>
        </div>
      ) : devices.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-line bg-sand/30 py-6">
          <EmptyState icon={<PlugIcon className="h-5 w-5" />} title="Plug your board into a USB port">
            {availableCount > 0
              ? `${availableCount} board${availableCount > 1 ? 's are' : ' is'} waiting to be connected.`
              : 'ESP32 boards connect as-is. Hold BOOTSEL while plugging in a Pico.'}
          </EmptyState>
          <Button disabled={!supported} onClick={onOpenPicker} size="md" variant="primary">
            {availableCount > 0 ? 'Choose a board' : 'Connect a board'}
          </Button>
        </div>
      ) : (
        <ul className="pane-scroll -mx-2 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2">
          {devices.map((device) => {
            const { label, tone } = STATE_LABEL[device.state]
            const needsBootsel = device.transport === 'serial' && device.family === 'rp' && device.state !== 'offline'

            return (
              <li className="flex flex-col gap-2.5 rounded-2xl border border-line bg-paper/70 px-4 py-3" key={device.id}>
                <div className="flex items-center gap-3">
                  <StatusDot pulse={device.state === 'busy'} tone={tone} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-ink">{device.name}</p>
                      <span className="truncate font-mono text-[10px] uppercase tracking-wider text-ink-faint">{chipLabel(device)}</span>
                    </div>
                    <p className="truncate font-mono text-[11px] text-ink-muted">{device.detail}</p>
                  </div>
                  <Badge tone={tone}>
                    {label}
                    {device.state === 'busy' && device.progress !== null ? ` ${formatPercent(device.progress)}` : ''}
                  </Badge>
                  <Button
                    aria-label={`Disconnect ${device.name}`}
                    className="-mr-2"
                    disabled={running}
                    icon={<TrashIcon />}
                    onClick={() => onRelease(device.id)}
                    title="Disconnect"
                    variant="ghost"
                  />
                </div>
                {device.state === 'busy' && device.progress !== null ? (
                  <ProgressBar label={`${device.name} progress`} tone="busy" value={device.progress} />
                ) : null}
                {device.state === 'offline' ? (
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-sand/50 px-3 py-2">
                    <p className="text-xs leading-relaxed text-ink-muted">Plug this board back in, then look for it again.</p>
                    <Button disabled={running} icon={<RefreshIcon />} onClick={() => onRecheck(device.id)}>
                      Check again
                    </Button>
                  </div>
                ) : null}
                {needsBootsel ? (
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-caramel/25 bg-caramel/10 px-3 py-2">
                    <p className="text-xs leading-relaxed text-cocoa">This Pico is running firmware. It flashes from BOOTSEL mode.</p>
                    <Button disabled={running} icon={<RefreshIcon />} onClick={() => onReboot(device.id)}>
                      Reboot
                    </Button>
                  </div>
                ) : null}
                {device.note ? (
                  <p className={device.state === 'failed' ? 'text-xs text-brick' : 'text-xs text-ink-muted'}>{device.note}</p>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </Step>
  )
}
