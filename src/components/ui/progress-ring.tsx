import type { ReactNode } from 'react'
import { cx } from '@/lib/cx'
import type { Tone } from './badge'

const TONES: Record<Tone, string> = {
  neutral: 'text-ink-faint',
  ready: 'text-caramel',
  busy: 'text-ember',
  ok: 'text-moss',
  error: 'text-brick',
}

type ProgressRingProps = {
  /** 0-1. */
  value: number
  tone?: Tone
  size?: number
  stroke?: number
  label?: string
  children?: ReactNode
}

export function ProgressRing({ value, tone = 'busy', size = 176, stroke = 8, label, children }: ProgressRingProps) {
  const clamped = Math.min(1, Math.max(0, value))
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius

  return (
    <div
      aria-label={label}
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={Math.round(clamped * 100)}
      className="relative shrink-0"
      role="progressbar"
      style={{ width: size, height: size }}
    >
      <svg className="-rotate-90" height={size} viewBox={`0 0 ${size} ${size}`} width={size}>
        <circle
          className="text-sand"
          cx={size / 2}
          cy={size / 2}
          fill="none"
          r={radius}
          stroke="currentColor"
          strokeWidth={stroke}
        />
        <circle
          className={cx('transition-[stroke-dashoffset] duration-200 ease-out', TONES[tone])}
          cx={size / 2}
          cy={size / 2}
          fill="none"
          r={radius}
          stroke="currentColor"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped)}
          strokeLinecap="round"
          strokeWidth={stroke}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  )
}
