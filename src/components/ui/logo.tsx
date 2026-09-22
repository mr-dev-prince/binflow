import { cx } from '@/lib/cx'

/**
 * The product mark: a pulse train of bits with the next one still on its way,
 * which is what the app watches on the wire. Drawn rather than borrowed from
 * the icon set so it keeps its weight next to the wordmark.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <span
      className={cx(
        'relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl shadow-card',
        'bg-[linear-gradient(150deg,var(--color-cocoa),var(--color-ink))] ring-1 ring-inset ring-paper/15',
        className,
      )}
    >
      {/* The light a moulded tile catches along its top edge. */}
      <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-[linear-gradient(180deg,rgb(255_255_255/0.16),transparent)]" />

      <svg aria-hidden="true" className="relative h-6 w-6" fill="none" viewBox="0 0 24 24">
        <path
          d="M3.8 15.4H6.6V9h4v6.4h4V9h1.4"
          stroke="var(--color-paper)"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.3"
        />
        <circle cx="19.8" cy="9" fill="var(--color-caramel)" r="1.7" />
      </svg>
    </span>
  )
}
