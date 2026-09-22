import type { ReactNode } from 'react'
import { cx } from '@/lib/cx'
import { CheckIcon } from './icons'

type StepProps = {
  number: number
  title: string
  /** Short status shown under the title, e.g. "2 boards connected". */
  status?: ReactNode
  done?: boolean
  /** The step cannot be used yet; the header stays readable, the body dims. */
  disabled?: boolean
  actions?: ReactNode
  children: ReactNode
  className?: string
}

export function Step({ number, title, status, done, disabled, actions, children, className }: StepProps) {
  return (
    <section
      data-disabled={disabled || undefined}
      className={cx('flex flex-col rounded-lg border border-border bg-card text-card-foreground lg:min-h-0', className)}
    >
      <header className="flex shrink-0 items-center gap-3 px-6 pt-5 pb-4">
        <span
          className={cx(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border font-mono text-xs transition-colors',
            done
              ? 'border-primary bg-primary text-primary-foreground'
              : disabled
                ? 'border-border bg-muted text-muted-foreground'
                : 'border-primary/20 bg-primary/10 text-primary',
          )}
        >
          {done ? <CheckIcon className="h-4 w-4" /> : String(number).padStart(2, '0')}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base tracking-tight text-foreground">{title}</h2>
          {status ? <p className="truncate text-sm text-muted-foreground">{status}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </header>
      <div className={cx('flex min-h-0 flex-1 flex-col px-6 pb-6 transition-opacity', disabled && 'opacity-60')}>
        {children}
      </div>
    </section>
  )
}
