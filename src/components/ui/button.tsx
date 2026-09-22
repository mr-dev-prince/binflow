import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cx } from '@/lib/cx'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

/**
 * Playarka's button chrome. `primary` is the brand-orange CTA: a solid fill
 * with a lighter top edge. `secondary` a hairline outline, `ghost` a quiet
 * fill, `danger` the destructive tint. Weight 400, no shadows.
 */
const VARIANTS: Record<Variant, string> = {
  primary:
    'border border-playarka-600 bg-primary bg-linear-to-b from-white/10 to-transparent text-primary-foreground hover:bg-playarka-600',
  secondary: 'border border-border text-foreground hover:bg-foreground/5',
  ghost: 'text-muted-foreground hover:bg-foreground/10 hover:text-foreground',
  danger: 'border border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/15',
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
        'inline-flex cursor-pointer select-none items-center justify-center rounded-md whitespace-nowrap',
        'transition-[background-color,color,border-color,filter] duration-150 ease-out active:translate-y-px',
        'focus-visible:focus-outline outline-none',
        'disabled:pointer-events-none disabled:opacity-50',
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
