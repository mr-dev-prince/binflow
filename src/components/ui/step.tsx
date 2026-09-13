import type { ReactNode } from 'react'
import { cx } from '@/lib/cx'
import { CheckIcon } from './icons'

type StepProps = {
  number: number
  title: string
  /** Short status shown under the title, e.g. "2 boards connected". */
  status?: ReactNode
  done?: boolean
  actions?: ReactNode
  children: ReactNode
  className?: string
}

export function Step({ number, title, status, done, actions, children, className }: StepProps) {
  return (
    <section
      className={cx('flex flex-col rounded-3xl border border-line bg-card shadow-card lg:min-h-0', className)}
    >
      <header className="flex shrink-0 items-center gap-3 px-6 pt-5 pb-4">
        <span
          className={cx(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border font-mono text-xs transition-colors',
            done ? 'border-moss bg-moss text-paper' : 'border-line bg-sand text-cocoa',
          )}
        >
          {done ? <CheckIcon className="h-4 w-4" /> : String(number).padStart(2, '0')}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold tracking-tight text-ink">{title}</h2>
          {status ? <p className="truncate text-sm text-ink-muted">{status}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </header>
      <div className="flex min-h-0 flex-1 flex-col px-6 pb-6">{children}</div>
    </section>
  )
}
