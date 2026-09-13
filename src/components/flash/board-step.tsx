'use client'

import { Badge, type Tone } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { PlugIcon, TrashIcon } from '@/components/ui/icons'
import { ProgressBar } from '@/components/ui/progress-bar'
import { StatusDot } from '@/components/ui/status-dot'
import { Step } from '@/components/ui/step'
import { formatPercent } from '@/lib/format'
import type { Device, DeviceState } from '@/lib/types'

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
  supported: boolean | null
  running: boolean
  onOpenPicker: () => void
  onRelease: (id: string) => void
}

export function BoardStep({ devices, availableCount, supported, running, onOpenPicker, onRelease }: BoardStepProps) {
  const online = devices.filter((device) => device.state !== 'offline').length

  const status =
    supported === false
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
          <Button disabled={supported !== true || running} icon={<PlugIcon />} onClick={onOpenPicker}>
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
      {supported === false ? (
        <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-line bg-sand/30">
          <EmptyState icon={<PlugIcon className="h-5 w-5" />} title="This browser cannot reach USB boards">
            Open binflow in Chrome or Edge on a desktop computer.
          </EmptyState>
        </div>
      ) : devices.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-line bg-sand/30 py-6">
          <EmptyState icon={<PlugIcon className="h-5 w-5" />} title="Plug your board into a USB port">
            {availableCount > 0
              ? `${availableCount} board${availableCount > 1 ? 's are' : ' is'} waiting to be connected.`
              : 'Then choose it from the list of boards your browser can see.'}
          </EmptyState>
          <Button disabled={supported !== true} onClick={onOpenPicker} size="md" variant="primary">
            {availableCount > 0 ? 'Choose a board' : 'Connect a board'}
          </Button>
        </div>
      ) : (
        <ul className="pane-scroll -mx-2 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2">
          {devices.map((device) => {
            const { label, tone } = STATE_LABEL[device.state]

            return (
              <li className="flex flex-col gap-2.5 rounded-2xl border border-line bg-paper/70 px-4 py-3" key={device.id}>
                <div className="flex items-center gap-3">
                  <StatusDot pulse={device.state === 'busy'} tone={tone} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{device.name}</p>
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
                {device.note ? <p className="text-xs text-brick">{device.note}</p> : null}
              </li>
            )
          })}
        </ul>
      )}
    </Step>
  )
}
