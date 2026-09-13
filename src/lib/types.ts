export type DeviceState = 'ready' | 'busy' | 'flashed' | 'failed' | 'offline'

export type Device = {
  id: string
  /** "Board 1", "Board 2"… stable for the life of the page. */
  name: string
  /** Vendor and USB ids when the port exposes them. */
  detail: string
  state: DeviceState
  /** 0-1 while a flash is in flight, otherwise null. */
  progress: number | null
  note?: string
}

export type BinaryFormat = 'bin' | 'hex' | 'uf2' | 'elf'

export type Binary = {
  name: string
  bytes: number
  format: BinaryFormat
  digest: string
  loadedAt: number
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
