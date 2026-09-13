import type { ReactNode } from 'react'
import { cx } from '@/lib/cx'

export type Tone = 'neutral' | 'ready' | 'busy' | 'ok' | 'error'

const TONES: Record<Tone, string> = {
  neutral: 'border-line bg-sand text-ink-muted',
  ready: 'border-caramel/25 bg-caramel/10 text-caramel',
  busy: 'border-ember/25 bg-ember/10 text-ember',
  ok: 'border-moss/25 bg-moss/10 text-moss',
  error: 'border-brick/25 bg-brick/10 text-brick',
}

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4 tabular-nums',
        TONES[tone],
      )}
    >
      {children}
    </span>
  )
}
