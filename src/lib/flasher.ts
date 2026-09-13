import { driverFor } from './drivers'
import type { FlashHandlers, FlashJob, Target } from './drivers'
import type { Family, FlashStage } from './types'

export { FlashAborted } from './drivers'
export type { FlashHandlers, FlashJob, Target } from './drivers'

export const FLASH_STAGES: FlashStage[] = ['connect', 'erase', 'write', 'verify', 'reset']

export const STAGE_LABELS: Record<FlashStage, string> = {
  connect: 'Connect',
  erase: 'Erase',
  write: 'Write',
  verify: 'Verify',
  reset: 'Reset',
}

/** Picks the protocol driver for the board and runs the whole job through it. */
export function flashDevice(target: Target, family: Family, job: FlashJob, handlers: FlashHandlers, signal: AbortSignal) {
  return driverFor(target, family).flash(target, job, handlers, signal)
}
