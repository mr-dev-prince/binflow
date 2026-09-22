/**
 * Builds an ESP32-family application image from an ELF, mirroring esptool's
 * elf2image: common header, extended header, segments arranged so that every
 * flash-mapped segment lands 64 KB aligned in the file, XOR checksum, SHA-256.
 */

import { ELF_MACHINE, SHT_FINI_ARRAY, SHT_INIT_ARRAY, SHT_PROGBITS, type Elf } from './elf'
import type { Segment } from './segments'

export type EspChip = {
  name: string
  imageChipId: number
  irom: [number, number]
  drom: [number, number]
  xtensa: boolean
}

/** Values lifted from esptool's target definitions. */
export const ESP_CHIPS: Record<string, EspChip> = {
  ESP32: { name: 'ESP32', imageChipId: 0, irom: [0x400d0000, 0x40400000], drom: [0x3f400000, 0x3f800000], xtensa: true },
  'ESP32-S2': { name: 'ESP32-S2', imageChipId: 2, irom: [0x40080000, 0x40b80000], drom: [0x3f000000, 0x3f3f0000], xtensa: true },
  'ESP32-S3': { name: 'ESP32-S3', imageChipId: 9, irom: [0x42000000, 0x44000000], drom: [0x3c000000, 0x3e000000], xtensa: true },
  'ESP32-C2': { name: 'ESP32-C2', imageChipId: 12, irom: [0x42000000, 0x42400000], drom: [0x3c000000, 0x3c400000], xtensa: false },
  'ESP32-C3': { name: 'ESP32-C3', imageChipId: 5, irom: [0x42000000, 0x42800000], drom: [0x3c000000, 0x3c800000], xtensa: false },
  'ESP32-C6': { name: 'ESP32-C6', imageChipId: 13, irom: [0x42000000, 0x42800000], drom: [0x42000000, 0x42800000], xtensa: false },
  'ESP32-C61': { name: 'ESP32-C61', imageChipId: 20, irom: [0x42000000, 0x42800000], drom: [0x42000000, 0x42800000], xtensa: false },
  'ESP32-C5': { name: 'ESP32-C5', imageChipId: 23, irom: [0x42000000, 0x44000000], drom: [0x42000000, 0x44000000], xtensa: false },
  'ESP32-H2': { name: 'ESP32-H2', imageChipId: 16, irom: [0x42000000, 0x42800000], drom: [0x42000000, 0x42800000], xtensa: false },
  'ESP32-P4': { name: 'ESP32-P4', imageChipId: 18, irom: [0x40000000, 0x4c000000], drom: [0x40000000, 0x4c000000], xtensa: false },
}

/** Default location of the factory app partition in the standard partition tables. */
export const ESP_APP_OFFSET = 0x10000

/** Where a whole-flash image starts: bootloader, partition table, otadata and app in one file. */
export const ESP_FLASH_BASE = 0x0

const PARTITION_TABLE_OFFSET = 0x8000

/**
 * A bare app image is just code, so 0x8000 holds whatever the linker put there.
 * The 0xAA50 partition-table magic sitting at that offset instead means the file
 * spans the flash from 0x0 and must be written there, not at the app offset.
 */
export function isFullFlashImage(data: Uint8Array) {
  return (
    data.length > PARTITION_TABLE_OFFSET + 1 &&
    data[PARTITION_TABLE_OFFSET] === 0xaa &&
    data[PARTITION_TABLE_OFFSET + 1] === 0x50
  )
}

const IMAGE_MAGIC = 0xe9
const CHECKSUM_SEED = 0xef
const IROM_ALIGN = 0x10000
const SEG_HEADER_LEN = 8
const FLASH_MODE_DIO = 2
const FLASH_SIZE_4MB_FREQ_40M = 0x20
const WP_PIN_DISABLED = 0xee

function inRange(address: number, [start, end]: [number, number]) {
  return address >= start && address < end
}

export function isEspFlashAddress(address: number, chip: EspChip) {
  return inRange(address, chip.irom) || inRange(address, chip.drom)
}

function padTo4(data: Uint8Array) {
  const remainder = data.length % 4
  if (remainder === 0) return data
  const padded = new Uint8Array(data.length + (4 - remainder))
  padded.set(data)
  return padded
}

/** The sections esptool turns into image segments: initialised, allocated, non-empty. */
export function espSections(elf: Elf): Array<Segment & { name: string }> {
  const kinds = new Set([SHT_PROGBITS, SHT_INIT_ARRAY, SHT_FINI_ARRAY])

  const sections = elf.sections
    .filter((section) => kinds.has(section.type) && section.address !== 0 && section.data.length > 0)
    .map((section) => ({ name: section.name, address: section.address, data: padTo4(section.data) }))

  // Join sections that run into each other within the same memory type.
  const merged: Array<Segment & { name: string }> = []
  for (const section of sections) {
    const last = merged[merged.length - 1]
    if (last && last.address + last.data.length === section.address) {
      const joined = new Uint8Array(last.data.length + section.data.length)
      joined.set(last.data)
      joined.set(section.data, last.data.length)
      last.data = joined
    } else {
      merged.push({ ...section })
    }
  }

  return merged
}

class Writer {
  private chunks: Uint8Array[] = []
  length = 0

  write(bytes: Uint8Array) {
    this.chunks.push(bytes)
    this.length += bytes.length
  }

  u8(value: number) {
    this.write(new Uint8Array([value & 0xff]))
  }

  u16(value: number) {
    this.write(new Uint8Array([value & 0xff, (value >>> 8) & 0xff]))
  }

  u32(value: number) {
    this.write(new Uint8Array([value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff]))
  }

  zeros(count: number) {
    if (count > 0) this.write(new Uint8Array(count))
  }

  bytes() {
    const out = new Uint8Array(this.length)
    let offset = 0
    for (const chunk of this.chunks) {
      out.set(chunk, offset)
      offset += chunk.length
    }
    return out
  }
}

function checksumOf(data: Uint8Array, seed: number) {
  let checksum = seed
  for (const byte of data) checksum ^= byte
  return checksum
}

export async function elfToEspImage(elf: Elf, chip: EspChip): Promise<Uint8Array> {
  const expectXtensa = elf.machine === ELF_MACHINE.XTENSA
  if (elf.machine !== ELF_MACHINE.XTENSA && elf.machine !== ELF_MACHINE.RISCV) {
    throw new Error('ELF is not built for an ESP32 (neither Xtensa nor RISC-V)')
  }
  if (expectXtensa !== chip.xtensa) {
    throw new Error(`ELF is built for ${expectXtensa ? 'Xtensa' : 'RISC-V'} but ${chip.name} is ${chip.xtensa ? 'Xtensa' : 'RISC-V'}`)
  }

  const sections = espSections(elf)
  if (sections.length === 0) throw new Error('ELF has no loadable sections')

  const flash = sections.filter((s) => isEspFlashAddress(s.address, chip)).sort((a, b) => a.address - b.address)
  const ram = sections.filter((s) => !isEspFlashAddress(s.address, chip)).sort((a, b) => a.address - b.address)

  // Under a unified bus the app descriptor must come first so the bootloader finds it.
  const appdesc = flash.findIndex((s) => s.name === '.flash.appdesc')
  if (appdesc > 0) flash.unshift(...flash.splice(appdesc, 1))

  for (let index = 1; index < flash.length; index += 1) {
    if (Math.floor(flash[index].address / IROM_ALIGN) === Math.floor(flash[index - 1].address / IROM_ALIGN)) {
      throw new Error('Two flash sections share one 64 KB mapping page. Check the linker script')
    }
  }

  const out = new Writer()
  let checksum = CHECKSUM_SEED
  let segmentCount = 0

  // Common header. Segment count is patched at the end.
  out.u8(IMAGE_MAGIC)
  out.u8(0)
  out.u8(FLASH_MODE_DIO)
  out.u8(FLASH_SIZE_4MB_FREQ_40M)
  out.u32(elf.entry)

  // Extended header.
  out.u8(WP_PIN_DISABLED)
  out.u8(0)
  out.u8(0)
  out.u8(0)
  out.u16(chip.imageChipId)
  out.u8(0) // min chip rev
  out.u16(0) // min chip rev full
  out.u16(0xffff) // max chip rev full
  out.zeros(4)
  out.u8(1) // append digest

  const saveSegment = (segment: Segment) => {
    out.u32(segment.address)
    out.u32(segment.data.length)
    out.write(segment.data)
    checksum = checksumOf(segment.data, checksum)
    segmentCount += 1
  }

  const paddingNeeded = (segment: Segment) => {
    const alignPast = (segment.address % IROM_ALIGN) - SEG_HEADER_LEN
    let pad = IROM_ALIGN - (out.length % IROM_ALIGN) + alignPast
    if (pad === 0 || pad === IROM_ALIGN) return 0
    pad -= SEG_HEADER_LEN
    if (pad < 0) pad += IROM_ALIGN
    return pad
  }

  const ramQueue = ram.map((s) => ({ address: s.address, data: s.data }))

  while (flash.length > 0) {
    const segment = flash[0]
    const pad = paddingNeeded(segment)

    if (pad > 0) {
      if (ramQueue.length > 0 && pad > SEG_HEADER_LEN) {
        const head = ramQueue[0]
        const take = Math.min(pad, head.data.length)
        saveSegment({ address: head.address, data: head.data.subarray(0, take) })
        head.address += take
        head.data = head.data.subarray(take)
        if (head.data.length === 0) ramQueue.shift()
        if (take < pad) saveSegment({ address: 0, data: new Uint8Array(pad - take) })
      } else {
        saveSegment({ address: 0, data: new Uint8Array(pad) })
      }
      continue
    }

    if ((out.length + SEG_HEADER_LEN) % IROM_ALIGN !== segment.address % IROM_ALIGN) {
      throw new Error('Internal error: flash segment misaligned')
    }

    let data = segment.data
    if (chip.name === 'ESP32') {
      // Old second-stage bootloaders skipped the last MMU page when a segment
      // overran a page boundary by less than 0x24 bytes.
      const remainder = (out.length + SEG_HEADER_LEN + data.length) % IROM_ALIGN
      if (remainder < 0x24) {
        const padded = new Uint8Array(data.length + (0x24 - remainder))
        padded.set(data)
        data = padded
      }
    }

    saveSegment({ address: segment.address, data })
    flash.shift()
  }

  for (const segment of ramQueue) saveSegment(segment)

  // Pad to 16 bytes with the checksum in the final byte.
  out.zeros(15 - (out.length % 16))
  out.u8(checksum)

  const body = out.bytes()
  body[1] = segmentCount

  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', body))
  const image = new Uint8Array(body.length + digest.length)
  image.set(body)
  image.set(digest, body.length)

  return image
}
