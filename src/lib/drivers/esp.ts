/**
 * ESP32 family over Web Serial, using Espressif's esptool-js for the ROM
 * bootloader protocol: reset into the loader, sync, upload the flasher stub,
 * stream compressed data, ask the chip for an MD5 of what landed, hard reset.
 */

import SparkMD5 from 'spark-md5'
import { parseElf } from '../image/elf'
import { ESP_CHIPS, elfToEspImage } from '../image/esp-image'
import { hex, totalBytes, type Segment } from '../image/segments'
import { UF2_FAMILIES, parseUf2, uf2Families, uf2Segments } from '../image/uf2'
import type { Binary, LogLevel } from '../types'
import { FlashAborted, throwIfAborted, type Driver } from './types'

/** Speed after the stub is running. The ROM itself always syncs at 115200. */
const FAST_BAUD = 460800

/** A partition table at 0x8000 means the UF2 carries a whole flash layout at absolute offsets. */
function holdsPartitionTable(segments: Segment[]) {
  return segments.some((segment) => {
    const at = 0x8000 - segment.address
    return at >= 0 && at + 2 <= segment.data.length && segment.data[at] === 0xaa && segment.data[at + 1] === 0x50
  })
}

async function prepare(
  binary: Binary,
  chipName: string,
  espOffset: number,
  log: (level: LogLevel, message: string) => void,
): Promise<Segment[]> {
  switch (binary.format) {
    case 'bin':
      return [{ address: espOffset, data: binary.data }]

    case 'uf2': {
      const blocks = parseUf2(binary.data)
      const known = uf2Families(blocks)
        .map((id) => UF2_FAMILIES[id])
        .filter((family) => family !== undefined)

      if (known.length > 0 && !known.some((family) => family.chip === chipName)) {
        throw new Error(`This UF2 is built for ${known.map((f) => f.chip).join(', ')}, not ${chipName}`)
      }

      const segments = uf2Segments(blocks)

      if (holdsPartitionTable(segments)) {
        log('info', 'UF2 carries a full flash layout. Writing at absolute offsets')
        return segments
      }

      log('info', `UF2 carries an app image. Writing relative to ${hex(espOffset)}`)
      return segments.map((segment) => ({ address: segment.address + espOffset, data: segment.data }))
    }

    case 'elf': {
      const chip = ESP_CHIPS[chipName]
      if (!chip) throw new Error(`No image layout is known for ${chipName}`)

      const image = await elfToEspImage(parseElf(binary.data), chip)
      log('info', `Built a ${image.length} byte app image from the ELF`)
      return [{ address: espOffset, data: image }]
    }

    default:
      throw new Error(`${binary.format.toUpperCase()} files cannot be written to an ESP`)
  }
}

function md5Of(image: Uint8Array) {
  const buffer = image.buffer.slice(image.byteOffset, image.byteOffset + image.byteLength) as ArrayBuffer
  return SparkMD5.ArrayBuffer.hash(buffer)
}

export const espDriver: Driver = {
  async flash(target, job, handlers, signal) {
    if (target.kind !== 'serial') throw new Error('ESP boards are flashed over a serial port')

    const { ESPLoader, Transport } = await import('esptool-js')

    const transport = new Transport(target.port, false)
    const loader = new ESPLoader({
      transport,
      baudrate: FAST_BAUD,
      terminal: {
        clean: () => undefined,
        write: () => undefined,
        writeLine: (line: string) => {
          const text = line.trim()
          if (text) handlers.onLog('info', text)
        },
      },
    })

    const onAbort = () => void transport.disconnect().catch(() => undefined)
    signal.addEventListener('abort', onAbort, { once: true })

    try {
      handlers.onStage('connect')
      await loader.main()
      throwIfAborted(signal)

      const chipName = loader.chip.CHIP_NAME
      handlers.onLog('ok', `${chipName} is in the bootloader`)

      const segments = await prepare(job.binary, chipName, job.espOffset, handlers.onLog)
      const total = totalBytes(segments)
      const before = segments.map((_, index) => totalBytes(segments.slice(0, index)))

      handlers.onStage('erase')
      let verifying = false

      await loader.writeFlash({
        fileArray: segments.map((segment) => ({ data: segment.data, address: segment.address })),
        flashMode: 'keep',
        flashFreq: 'keep',
        flashSize: 'keep',
        eraseAll: false,
        compress: true,
        reportProgress: (fileIndex, written, size) => {
          const done = Math.min(written, size)
          const last = fileIndex === segments.length - 1

          if (last && done >= size) {
            verifying = true
            handlers.onStage('verify')
          } else if (!verifying) {
            handlers.onStage('write')
          }

          handlers.onProgress(Math.min(1, (before[fileIndex] + (done / size) * segments[fileIndex].data.length) / total))
        },
        calculateMD5Hash: md5Of,
      })
      throwIfAborted(signal)

      handlers.onProgress(1)
      handlers.onLog('ok', 'MD5 on the chip matches the image')

      handlers.onStage('reset')
      await loader.after('hard_reset')

      return { chip: chipName }
    } catch (error) {
      if (signal.aborted) throw new FlashAborted()
      throw error
    } finally {
      signal.removeEventListener('abort', onAbort)
      await transport.disconnect().catch(() => undefined)
    }
  },
}
