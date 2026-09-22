export type DeviceState = 'ready' | 'busy' | 'flashed' | 'failed' | 'offline'

export type Transport = 'serial' | 'usb'

/** Chip family a board belongs to, as far as we can tell before talking to it. */
export type Family = 'esp' | 'rp' | 'unknown'

export type Device = {
  id: string
  /** Always "Board". Boards are told apart by their detail line, never a number. */
  name: string
  /** Vendor and USB ids when the port exposes them. */
  detail: string
  transport: Transport
  family: Family
  /** Exact chip once a driver has talked to it, e.g. "ESP32-S3" or "RP2040". */
  chip?: string
  state: DeviceState
  /** 0-1 while a flash is in flight, otherwise null. */
  progress: number | null
  note?: string
}

export type BinaryFormat = 'bin' | 'hex' | 'uf2' | 'elf'

/** What the file itself says about where it belongs. */
export type ImageHint = {
  family: Family
  chip?: string
  segments?: number
  /** Why the file cannot be flashed as-is, if anything. */
  problem?: string
}

export type Binary = {
  name: string
  bytes: number
  format: BinaryFormat
  digest: string
  loadedAt: number
  data: Uint8Array
  hint: ImageHint
}

export type FlashStage = 'connect' | 'erase' | 'write' | 'verify' | 'reset'

export type LogLevel = 'info' | 'ok' | 'warn' | 'error'

export type LogEntry = {
  id: number
  at: number
  level: LogLevel
  scope: string
  message: string
}
