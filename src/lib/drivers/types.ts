import type { Binary, FlashStage, LogLevel } from '../types'

export type FlashHandlers = {
  onStage: (stage: FlashStage) => void
  onProgress: (fraction: number) => void
  onLog: (level: LogLevel, message: string) => void
}

export class FlashAborted extends Error {
  constructor() {
    super('Stopped by operator')
    this.name = 'FlashAborted'
  }
}

export function throwIfAborted(signal: AbortSignal) {
  if (signal.aborted) throw new FlashAborted()
}

/** The physical connection a driver talks through. */
export type Target = { kind: 'serial'; port: SerialPort } | { kind: 'usb'; device: USBDevice }

export type FlashJob = {
  binary: Binary
  /** Where a raw .bin lands on an ESP. RP boards always start at the flash base. */
  espOffset: number
}

export type FlashResult = {
  /** Exact chip the driver found, e.g. "ESP32-S3". */
  chip: string
}

export interface Driver {
  flash(target: Target, job: FlashJob, handlers: FlashHandlers, signal: AbortSignal): Promise<FlashResult>
}
