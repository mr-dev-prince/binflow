import { TONE_CLASSES } from '@/components/ui/badge'
import { cx } from '@/lib/cx'
import { Logo } from '@/components/ui/logo'
import { StatusDot } from '@/components/ui/status-dot'
import type { Support } from '@/lib/use-flasher'

export function AppHeader({ support }: { support: Support }) {
  const pending = support.serial === null || support.usb === null
  const both = support.serial && support.usb
  const none = support.serial === false && support.usb === false

  const tone = pending ? 'neutral' : none ? 'error' : both ? 'ok' : 'busy'
  const label = pending
    ? 'Checking browser'
    : none
      ? 'No device access in this browser'
      : both
        ? 'Serial and USB ready'
        : support.serial
          ? 'Serial only. No WebUSB for Pico'
          : 'USB only. No Web Serial for ESP32'

  return (
    <header className="flex shrink-0 items-center justify-between gap-4 px-5 py-4 lg:px-6">
      <div className="flex items-center gap-3">
        <Logo />
        <div>
          {/* "bits" in the mono face the rest of the app uses for machine detail, in brand orange. */}
          <h1 className="text-[19px] leading-none tracking-[-0.03em] text-foreground">
            stream<span className="font-mono text-[17px] tracking-[-0.05em] text-playarka-500">bits</span>
          </h1>
          <p className="mt-1.5 font-mono text-[10px] uppercase leading-none tracking-[0.1em] text-muted-foreground">
            a playarka product
          </p>
        </div>
      </div>
      <div className={cx('flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs', TONE_CLASSES[tone])}>
        <StatusDot tone={tone} />
        {label}
      </div>
    </header>
  )
}
