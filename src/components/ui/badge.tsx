import type { ReactNode } from 'react'
import { cx } from '@/lib/cx'

export type Tone = 'neutral' | 'ready' | 'busy' | 'ok' | 'error'

/**
 * Status tones on the Playarka palette: ink for a settled board, brand orange
 * for one being written, green for a finished write, red for a failed one.
 */
export const TONE_CLASSES: Record<Tone, string> = {
  neutral: 'border-border bg-muted text-muted-foreground',
  ready: 'border-border bg-card text-foreground',
  busy: 'border-playarka-500/25 bg-playarka-500/10 text-playarka-500',
  ok: 'border-success/25 bg-success/10 text-success',
  error: 'border-destructive/25 bg-destructive/10 text-destructive',
}

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] leading-4 tabular-nums',
        TONE_CLASSES[tone],
      )}
    >
      {children}
    </span>
  )
}
