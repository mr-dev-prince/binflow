'use client'

import type { Tone } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AlertIcon, BoltIcon, CheckIcon, StopIcon } from '@/components/ui/icons'
import { ProgressRing } from '@/components/ui/progress-ring'
import { Step } from '@/components/ui/step'
import { cx } from '@/lib/cx'
import { FLASH_STAGES, STAGE_LABELS } from '@/lib/flasher'
import { formatDuration, formatPercent } from '@/lib/format'
import type { FlashStage } from '@/lib/types'

type FlashStepProps = {
  blocker: string | null
  running: boolean
  stage: FlashStage | null
  activeName: string | null
  progress: number
  targets: number
  finished: number
  elapsed: number
  /** True once a run has completed and nothing has changed since. */
  completed: boolean
  summary: string
  onStart: () => void
  onAbort: () => void
}

export function FlashStep({
  blocker,
  running,
  stage,
  activeName,
  progress,
  targets,
  finished,
  elapsed,
  completed,
  summary,
  onStart,
  onAbort,
}: FlashStepProps) {
  const plural = targets === 1 ? 'board' : 'boards'
  const allDone = completed && finished === targets && targets > 0
  const failedSome = completed && !allDone

  const tone: Tone = running ? 'busy' : allDone ? 'ok' : failedSome ? 'error' : 'neutral'

  const headline = running
    ? `Flashing ${activeName ?? '…'}`
    : allDone
      ? 'All done'
      : failedSome
        ? 'Finished with errors'
        : blocker
          ? 'Not ready'
          : 'Ready'

  const subline = running
    ? `${stage ? STAGE_LABELS[stage] : 'Starting'} · ${formatDuration(elapsed)}`
    : allDone
      ? `${targets} ${plural} flashed in ${formatDuration(elapsed)}`
      : failedSome
        ? `${finished} of ${targets} ${plural} flashed. Check the board list, then try again.`
        : blocker ?? summary

  return (
    <Step done={allDone} number={3} status={running ? 'In progress' : allDone ? 'Complete' : 'Writes to every connected board'} title="Flash">
      <div className="flex flex-1 flex-col">
        <div className="flex flex-1 flex-col items-center justify-center gap-6 py-2">
          <ProgressRing label="Overall progress" tone={tone} value={allDone ? 1 : progress}>
            {running ? (
              <>
                <span className="text-4xl tabular-nums tracking-tight text-foreground">{formatPercent(progress)}</span>
                <span className="mt-1 font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                  {stage ? STAGE_LABELS[stage] : 'Start'}
                </span>
              </>
            ) : allDone ? (
              <CheckIcon className="h-12 w-12 text-success" />
            ) : failedSome ? (
              <AlertIcon className="h-12 w-12 text-destructive" />
            ) : (
              <BoltIcon className={cx('h-10 w-10', blocker ? 'text-primary/40' : 'text-primary')} />
            )}
          </ProgressRing>

          <div className="max-w-[30ch] text-center">
            <p className="text-lg tracking-tight text-foreground">{headline}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{subline}</p>
          </div>

          <ol className="flex flex-wrap justify-center gap-1.5">
            {FLASH_STAGES.map((item) => {
              const current = stage ? FLASH_STAGES.indexOf(stage) : -1
              const position = FLASH_STAGES.indexOf(item)
              const state = !running ? 'idle' : position < current ? 'done' : position === current ? 'active' : 'todo'

              return (
                <li
                  className={cx(
                    'rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.1em] transition-colors',
                    state === 'idle' && 'border-border text-muted-foreground/60',
                    state === 'todo' && 'border-border text-muted-foreground/60',
                    state === 'active' && 'border-playarka-500/30 bg-playarka-500/10 text-playarka-500',
                    state === 'done' && 'border-success/25 bg-success/10 text-success',
                  )}
                  key={item}
                >
                  {STAGE_LABELS[item]}
                </li>
              )
            })}
          </ol>
        </div>

        {running ? (
          <Button className="w-full" icon={<StopIcon />} onClick={onAbort} size="lg" variant="danger">
            Stop
          </Button>
        ) : (
          <Button
            className="w-full"
            disabled={Boolean(blocker)}
            icon={<BoltIcon className="h-5 w-5" />}
            onClick={onStart}
            size="lg"
            variant="primary"
          >
            {completed && !blocker ? 'Flash again' : 'Flash'}
          </Button>
        )}
      </div>
    </Step>
  )
}
