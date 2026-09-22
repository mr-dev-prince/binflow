import { cx } from '@/lib/cx'

/**
 * The product mark: a pulse train of bits with the next one still on its way,
 * which is what the app watches on the wire. Drawn rather than borrowed from
 * the icon set so it keeps its weight next to the wordmark. Ink tile, brand
 * orange dot: the same pairing as the Playarka wordmark.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <span
      className={cx(
        'relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-foreground',
        className,
      )}
    >
      <svg aria-hidden="true" className="relative h-6 w-6" fill="none" viewBox="0 0 24 24">
        <path
          d="M3.8 15.4H6.6V9h4v6.4h4V9h1.4"
          stroke="var(--background)"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.3"
        />
        <circle cx="19.8" cy="9" fill="var(--playarka-500)" r="1.7" />
      </svg>
    </span>
  )
}
