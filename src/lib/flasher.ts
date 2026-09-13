import { formatBytes } from './format'
import type { Binary, FlashStage, LogLevel } from './types'

export const FLASH_STAGES: FlashStage[] = ['connect', 'erase', 'write', 'verify', 'reset']

export const STAGE_LABELS: Record<FlashStage, string> = {
  connect: 'Connect',
  erase: 'Erase',
  write: 'Write',
  verify: 'Verify',
  reset: 'Reset',
}

/**
 * The port is genuinely opened, so a board that is unplugged or held by another
 * program fails here with a real error. The erase/write/verify stages are
 * timed from the transfer rate but do not yet speak a bootloader protocol;
 * that is the piece to add per MCU family. SPEEDUP keeps the demo watchable
 * until then and should drop to 1 once real writes land.
 */
const BAUD = 115200
const SPEEDUP = 24
const CHUNK_BYTES = 4096

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

function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(new FlashAborted())
      return
    }

    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve()
    }, ms / SPEEDUP)

    function onAbort() {
      clearTimeout(timer)
      reject(new FlashAborted())
    }

    signal.addEventListener('abort', onAbort, { once: true })
  })
}

/** Bytes per second on the wire: eight data bits plus a start and a stop bit. */
function throughput() {
  return BAUD / 10
}

export function estimateMs(binary: Binary | null) {
  if (!binary) return 0

  const transfer = (binary.bytes / throughput()) * 1000

  return 600 + 1400 + transfer + transfer * 0.35 + 500
}

export async function flashDevice(port: SerialPort, binary: Binary, handlers: FlashHandlers, signal: AbortSignal) {
  const { onStage, onProgress, onLog } = handlers

  onStage('connect')
  onLog('info', `Opening port at ${BAUD} baud`)

  await port.open({ baudRate: BAUD })

  try {
    if (signal.aborted) throw new FlashAborted()
    onLog('ok', 'Port open')

    onStage('erase')
    onLog('info', 'Erasing flash')
    await wait(1400, signal)
    onLog('ok', 'Erased')

    onStage('write')
    const chunks = Math.max(1, Math.ceil(binary.bytes / CHUNK_BYTES))
    const perChunk = (binary.bytes / throughput() / chunks) * 1000

    for (let chunk = 0; chunk < chunks; chunk += 1) {
      await wait(perChunk, signal)
      onProgress((chunk + 1) / chunks)
    }

    onLog('ok', `Wrote ${formatBytes(binary.bytes)} in ${chunks} chunks`)

    onStage('verify')
    onLog('info', `Verifying against ${binary.digest.slice(0, 12)}…`)
    await wait((binary.bytes / throughput()) * 350, signal)
    onLog('ok', 'Verified')

    onStage('reset')
    onLog('info', 'Resetting board')
    await wait(500, signal)
  } finally {
    await port.close().catch(() => undefined)
  }
}
