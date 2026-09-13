import { cx } from '@/lib/cx'
import type { Tone } from './badge'

const TONES: Record<Tone, string> = {
  neutral: 'bg-ink-faint',
  ready: 'bg-caramel',
  busy: 'bg-ember',
  ok: 'bg-moss',
  error: 'bg-brick',
}

type ProgressBarProps = {
  /** 0-1. */
  value: number
  tone?: Tone
  className?: string
  label?: string
}

export function ProgressBar({ value, tone = 'busy', className, label }: ProgressBarProps) {
  const clamped = Math.min(1, Math.max(0, value))

  return (
    <div
      aria-label={label}
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={Math.round(clamped * 100)}
      className={cx('h-1.5 w-full overflow-hidden rounded-full bg-sand', className)}
      role="progressbar"
    >
      <div
        className={cx('h-full rounded-full transition-[width] duration-150 ease-out', TONES[tone])}
        style={{ width: `${clamped * 100}%` }}
      />
    </div>
  )
}
