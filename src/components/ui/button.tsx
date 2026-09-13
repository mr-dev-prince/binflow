import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cx } from '@/lib/cx'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-cocoa text-paper shadow-card hover:bg-ink disabled:bg-sand disabled:text-ink-faint disabled:shadow-none',
  secondary: 'border border-line bg-card text-cocoa hover:border-ink-faint hover:bg-sand disabled:text-ink-faint',
  ghost: 'text-ink-muted hover:bg-sand hover:text-ink disabled:text-ink-faint',
  danger: 'border border-brick/30 bg-brick/10 text-brick hover:bg-brick/15',
}

const SIZES: Record<Size, string> = {
  sm: 'h-8 gap-1.5 px-3 text-sm',
  md: 'h-10 gap-2 px-4 text-sm',
  lg: 'h-12 gap-2.5 px-6 text-base',
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
  icon?: ReactNode
}

export function Button({ variant = 'secondary', size = 'sm', icon, children, className, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        'inline-flex select-none items-center justify-center rounded-xl font-medium transition-colors',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink/60',
        'disabled:cursor-not-allowed',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
    >
      {icon}
      {children}
    </button>
  )
}
