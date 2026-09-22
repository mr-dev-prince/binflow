import { cx } from '@/lib/cx'
import type { Tone } from './badge'

const TONES: Record<Tone, string> = {
  neutral: 'bg-muted-foreground/40',
  ready: 'bg-foreground',
  busy: 'bg-playarka-500',
  ok: 'bg-success',
  error: 'bg-destructive',
}

export function StatusDot({ tone = 'neutral', pulse }: { tone?: Tone; pulse?: boolean }) {
  return (
    <span className="relative flex h-2 w-2 shrink-0">
      {pulse ? (
        <span className={cx('absolute inline-flex h-full w-full animate-ping rounded-full opacity-60', TONES[tone])} />
      ) : null}
      <span className={cx('relative inline-flex h-2 w-2 rounded-full', TONES[tone])} />
    </span>
  )
}
