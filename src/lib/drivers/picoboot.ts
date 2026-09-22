/**
 * RP2040 and RP2350 in BOOTSEL mode over WebUSB, speaking the bootrom's
 * PICOBOOT protocol: 32-byte command packets on a bulk OUT endpoint, a data
 * phase in the direction the command dictates, and a zero-length packet the
 * other way as the acknowledgement.
 */

import { ELF_MACHINE, loadableSegments, parseElf } from '../image/elf'
import { hex, mergeSegments, totalBytes, type Segment } from '../image/segments'
import { UF2_FAMILIES, isE10Marker, parseUf2, uf2Families, uf2Segments } from '../image/uf2'
import type { Binary } from '../types'
import { FlashAborted, throwIfAborted, type Driver, type FlashHandlers } from './types'

export const RP_VENDOR = 0x2e8a
export const RP_BOOTSEL_PRODUCTS: Record<number, string> = {
  0x0003: 'RP2040',
  0x000f: 'RP2350',
}

/** XIP window. Anything outside it runs from RAM and is not ours to write. */
export const RP_FLASH_START = 0x10000000
export const RP_FLASH_END = 0x20000000

const MAGIC = 0x431fd10b
const SECTOR = 4096
const CHUNK = 4096

const CMD = {
  EXCLUSIVE_ACCESS: 0x01,
  REBOOT: 0x02,
  FLASH_ERASE: 0x03,
  READ: 0x84,
  WRITE: 0x05,
  EXIT_XIP: 0x06,
  ENTER_CMD_XIP: 0x07,
  REBOOT2: 0x0a,
} as const

const IF_RESET = 0x41
const CMD_STATUS = 0x42

const STATUS_TEXT: Record<number, string> = {
  1: 'unknown command',
  2: 'invalid command length',
  3: 'invalid transfer length',
  4: 'invalid address',
  5: 'bad alignment',
  6: 'interleaved write',
  7: 'rebooting',
  8: 'unknown error',
  9: 'invalid state',
}

function u32le(values: number[]) {
  const out = new Uint8Array(values.length * 4)
  const view = new DataView(out.buffer)
  values.forEach((value, index) => view.setUint32(index * 4, value >>> 0, true))
  return out
}

/** Lays out one picoboot_cmd struct. */
export function encodeCommand(id: number, args: Uint8Array, transferLength: number, token: number) {
  if (args.length > 16) throw new Error('PICOBOOT arguments exceed 16 bytes')

  const packet = new Uint8Array(32)
  const view = new DataView(packet.buffer)
  view.setUint32(0, MAGIC, true)
  view.setUint32(4, token >>> 0, true)
  packet[8] = id
  packet[9] = args.length
  view.setUint32(12, transferLength >>> 0, true)
  packet.set(args, 16)

  return packet
}

export type FlashRun = { start: number; data: Uint8Array }

/**
 * Groups segments into sector-aligned runs, padded with 0xFF so that writing
 * a run is the same as writing only its live bytes into freshly erased flash.
 */
export function planFlash(segments: Segment[]): FlashRun[] {
  const merged = mergeSegments(segments)
  const runs: FlashRun[] = []

  for (const segment of merged) {
    const start = Math.floor(segment.address / SECTOR) * SECTOR
    const end = Math.ceil((segment.address + segment.data.length) / SECTOR) * SECTOR
    const last = runs[runs.length - 1]

    if (last && start < last.start + last.data.length) {
      // Shares a sector with the previous run: extend it.
      const grown = new Uint8Array(end - last.start).fill(0xff)
      grown.set(last.data)
      grown.set(segment.data, segment.address - last.start)
      last.data = grown
    } else {
      const data = new Uint8Array(end - start).fill(0xff)
      data.set(segment.data, segment.address - start)
      runs.push({ start, data })
    }
  }

  return runs
}

export type PicobootInterface = { interfaceNumber: number; epIn: number; epOut: number }

/**
 * Finds the bootrom's PICOBOOT interface from the descriptors alone, so it
 * works before the device is opened: vendor class, subclass 0, protocol 0, one
 * bulk endpoint each way. Vendor and product ids cannot do this job. Firmware
 * built with the Pico SDK carries a vendor-class "reset" interface too, with
 * protocol 1 and no endpoints, and Arduino-Pico firmware on a Pico 2 reuses
 * the RP2350 BOOTSEL product id outright while exposing only CDC serial.
 */
export function findPicobootInterface(device: USBDevice): PicobootInterface | null {
  const configurations = device.configuration ? [device.configuration] : device.configurations

  for (const configuration of configurations) {
    for (const iface of configuration.interfaces) {
      for (const alternate of iface.alternates) {
        if (alternate.interfaceClass !== 0xff || alternate.interfaceSubclass !== 0 || alternate.interfaceProtocol !== 0) continue

        const bulkIn = alternate.endpoints.find((ep) => ep.direction === 'in' && ep.type === 'bulk')
        const bulkOut = alternate.endpoints.find((ep) => ep.direction === 'out' && ep.type === 'bulk')
        if (bulkIn && bulkOut) {
          return { interfaceNumber: iface.interfaceNumber, epIn: bulkIn.endpointNumber, epOut: bulkOut.endpointNumber }
        }
      }
    }
  }

  return null
}

/** One PICOBOOT session. Exported so the protocol can be driven outside the flash flow, e.g. from a hardware harness. */
export class Picoboot {
  private token = 1
  private interfaceNumber = 0
  private epIn = 0
  private epOut = 0

  constructor(private device: USBDevice) {}

  get chip() {
    return RP_BOOTSEL_PRODUCTS[this.device.productId] ?? 'RP2xxx'
  }

  async open() {
    await this.device.open()
    if (!this.device.configuration) await this.device.selectConfiguration(1)

    const iface = findPicobootInterface(this.device)
    if (!iface) {
      throw new Error(`This ${this.chip} is running firmware, not the bootloader. Reboot it into BOOTSEL, then add it again`)
    }

    this.interfaceNumber = iface.interfaceNumber
    this.epIn = iface.epIn
    this.epOut = iface.epOut

    await this.device.claimInterface(this.interfaceNumber)
    // The empty payload is explicit because not every WebUSB implementation treats it as optional.
    await this.device.controlTransferOut(
      { requestType: 'vendor', recipient: 'interface', request: IF_RESET, value: 0, index: this.interfaceNumber },
      new Uint8Array(0),
    )
  }

  async close() {
    await this.device.releaseInterface(this.interfaceNumber).catch(() => undefined)
    await this.device.close().catch(() => undefined)
  }

  private async status() {
    const result = await this.device.controlTransferIn(
      { requestType: 'vendor', recipient: 'interface', request: CMD_STATUS, value: 0, index: this.interfaceNumber },
      16,
    )
    return result.data ? result.data.getUint32(4, true) : 8
  }

  private async fail(what: string) {
    const code = await this.status().catch(() => 8)
    await this.device.clearHalt('in', this.epIn).catch(() => undefined)
    await this.device.clearHalt('out', this.epOut).catch(() => undefined)
    throw new Error(`${what} failed: ${STATUS_TEXT[code] ?? `status ${code}`}`)
  }

  private async command(name: string, id: number, args: Uint8Array, payload?: Uint8Array, readLength = 0) {
    const isRead = (id & 0x80) !== 0
    const transferLength = isRead ? readLength : payload?.length ?? 0

    this.token += 1
    const sent = await this.device.transferOut(this.epOut, encodeCommand(id, args, transferLength, this.token))
    if (sent.status !== 'ok') await this.fail(name)

    if (isRead) {
      const chunks: Uint8Array[] = []
      let received = 0

      while (received < readLength) {
        const result = await this.device.transferIn(this.epIn, readLength - received)
        if (result.status !== 'ok' || !result.data) await this.fail(name)
        const bytes = new Uint8Array(result.data!.buffer, result.data!.byteOffset, result.data!.byteLength)
        if (bytes.length === 0) break
        chunks.push(bytes)
        received += bytes.length
      }

      // Acknowledge with a zero-length OUT packet.
      await this.device.transferOut(this.epOut, new Uint8Array(0))

      const out = new Uint8Array(received)
      let offset = 0
      for (const chunk of chunks) {
        out.set(chunk, offset)
        offset += chunk.length
      }
      return out
    }

    if (payload && payload.length > 0) {
      const result = await this.device.transferOut(this.epOut, new Uint8Array(payload))
      if (result.status !== 'ok') await this.fail(name)
    }

    // The device acknowledges with a zero-length IN packet.
    const ack = await this.device.transferIn(this.epIn, 64)
    if (ack.status !== 'ok') await this.fail(name)

    return new Uint8Array(0)
  }

  exclusiveAccess() {
    return this.command('Exclusive access', CMD.EXCLUSIVE_ACCESS, new Uint8Array([1]))
  }

  exitXip() {
    return this.command('Exit XIP', CMD.EXIT_XIP, new Uint8Array(0))
  }

  enterCmdXip() {
    return this.command('Enter XIP', CMD.ENTER_CMD_XIP, new Uint8Array(0))
  }

  erase(address: number, size: number) {
    return this.command(`Erase ${hex(address)}`, CMD.FLASH_ERASE, u32le([address, size]))
  }

  write(address: number, data: Uint8Array) {
    return this.command(`Write ${hex(address)}`, CMD.WRITE, u32le([address, data.length]), data)
  }

  read(address: number, size: number) {
    return this.command(`Read ${hex(address)}`, CMD.READ, u32le([address, size]), undefined, size)
  }

  async reboot() {
    // The board drops off the bus mid-acknowledgement, so a failure here is expected.
    try {
      if (this.chip === 'RP2350') {
        await this.command('Reboot', CMD.REBOOT2, u32le([0, 500, 0, 0]))
      } else {
        await this.command('Reboot', CMD.REBOOT, u32le([0, 0, 500]))
      }
    } catch {
      // ignored
    }
  }
}

function inFlash(segment: Segment) {
  return segment.address >= RP_FLASH_START && segment.address + segment.data.length <= RP_FLASH_END
}

function prepare(binary: Binary, chip: string, log: FlashHandlers['onLog']): Segment[] {
  let segments: Segment[]

  switch (binary.format) {
    case 'bin':
      segments = [{ address: RP_FLASH_START, data: binary.data }]
      break

    case 'uf2': {
      const blocks = parseUf2(binary.data)
      const known = uf2Families(blocks)
        .map((id) => UF2_FAMILIES[id])
        .filter((family) => family !== undefined)

      if (known.length > 0 && !known.some((family) => family.chip === chip)) {
        const chips = [...new Set(known.map((family) => family.chip))]
        throw new Error(`This UF2 is built for ${chips.join(', ')}, not ${chip}`)
      }

      if (blocks.some(isE10Marker)) {
        log('info', 'Skipping the RP2350-E10 marker block at 0x10FFFF00. It only steers drag-and-drop downloads')
      }

      segments = uf2Segments(blocks)
      break
    }

    case 'elf': {
      const elf = parseElf(binary.data)
      if (elf.machine !== ELF_MACHINE.ARM && elf.machine !== ELF_MACHINE.RISCV) {
        throw new Error('ELF is not built for an Arm or RISC-V core')
      }
      segments = mergeSegments(loadableSegments(elf))
      break
    }

    default:
      throw new Error(`${binary.format.toUpperCase()} files cannot be written to an ${chip}`)
  }

  const flash = segments.filter(inFlash)
  const skipped = segments.length - flash.length

  if (flash.length === 0) throw new Error('This image runs from RAM. streambits writes flash only')
  if (skipped > 0) log('warn', `Skipping ${skipped} segment${skipped > 1 ? 's' : ''} outside flash`)

  return flash
}

export const picobootDriver: Driver = {
  async flash(target, job, handlers, signal) {
    if (target.kind !== 'usb') throw new Error('RP boards are flashed over USB in BOOTSEL mode')

    const pico = new Picoboot(target.device)

    try {
      handlers.onStage('connect')
      await pico.open()
      await pico.exclusiveAccess()
      await pico.exitXip()
      throwIfAborted(signal)
      handlers.onLog('ok', `${pico.chip} is in BOOTSEL mode`)

      const runs = planFlash(prepare(job.binary, pico.chip, handlers.onLog))
      const total = totalBytes(runs.map((run) => ({ address: run.start, data: run.data })))
      handlers.onLog('info', `${runs.length} region${runs.length > 1 ? 's' : ''}, ${total} bytes including sector padding`)

      handlers.onStage('erase')
      let erased = 0
      for (const run of runs) {
        throwIfAborted(signal)
        await pico.erase(run.start, run.data.length)
        erased += run.data.length
        handlers.onProgress(erased / total)
      }
      handlers.onLog('ok', 'Erased')

      handlers.onStage('write')
      let written = 0
      for (const run of runs) {
        for (let offset = 0; offset < run.data.length; offset += CHUNK) {
          throwIfAborted(signal)
          const chunk = run.data.subarray(offset, offset + CHUNK)
          await pico.write(run.start + offset, chunk)
          written += chunk.length
          handlers.onProgress(written / total)
        }
      }
      handlers.onLog('ok', `Wrote ${written} bytes`)

      handlers.onStage('verify')
      await pico.enterCmdXip()
      let checked = 0
      for (const run of runs) {
        for (let offset = 0; offset < run.data.length; offset += CHUNK) {
          throwIfAborted(signal)
          const expected = run.data.subarray(offset, offset + CHUNK)
          const actual = await pico.read(run.start + offset, expected.length)

          for (let index = 0; index < expected.length; index += 1) {
            if (actual[index] !== expected[index]) {
              throw new Error(`Verify failed at ${hex(run.start + offset + index)}`)
            }
          }

          checked += expected.length
          handlers.onProgress(checked / total)
        }
      }
      handlers.onLog('ok', 'Read back matches')

      handlers.onStage('reset')
      await pico.reboot()

      return { chip: pico.chip }
    } catch (error) {
      if (signal.aborted) throw new FlashAborted()
      throw error
    } finally {
      await pico.close()
    }
  },
}
