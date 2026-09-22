import { describe, expect, test } from 'bun:test'
import { ELF_MACHINE, SHT_PROGBITS } from './elf'
import { parseElf } from './elf'
import { buildElf, pattern } from './elf-fixture'
import { ESP_CHIPS, elfToEspImage, isEspFlashAddress, isFullFlashImage } from './esp-image'

const IROM_ALIGN = 0x10000

function readSegments(image: Uint8Array) {
  const view = new DataView(image.buffer, image.byteOffset, image.byteLength)
  const count = image[1]
  let offset = 24
  const segments: Array<{ address: number; length: number; dataOffset: number }> = []

  for (let index = 0; index < count; index += 1) {
    const address = view.getUint32(offset, true)
    const length = view.getUint32(offset + 4, true)
    segments.push({ address, length, dataOffset: offset + 8 })
    offset += 8 + length
  }

  return { segments, end: offset }
}

describe('elfToEspImage', () => {
  const chip = ESP_CHIPS['ESP32-S3']
  const irom = pattern(0x1200, 3)
  const drom = pattern(0x300, 5)
  const iram = pattern(0x84, 7)
  const dram = pattern(0x40, 11)

  const elf = buildElf({
    machine: ELF_MACHINE.XTENSA,
    entry: 0x40378000,
    sections: [
      { name: '.flash.rodata', type: SHT_PROGBITS, flags: 2, address: 0x3c000020, data: drom },
      { name: '.iram0.text', type: SHT_PROGBITS, flags: 6, address: 0x40378000, data: iram },
      { name: '.dram0.data', type: SHT_PROGBITS, flags: 3, address: 0x3fc90000, data: dram },
      { name: '.flash.text', type: SHT_PROGBITS, flags: 6, address: 0x42000020, data: irom },
      { name: '.comment', type: SHT_PROGBITS, flags: 0, address: 0, data: pattern(10) },
    ],
    segments: [],
  })

  test('classifies flash addresses', () => {
    expect(isEspFlashAddress(0x42000020, chip)).toBe(true)
    expect(isEspFlashAddress(0x3c000020, chip)).toBe(true)
    expect(isEspFlashAddress(0x40378000, chip)).toBe(false)
  })

  test('produces a well-formed image', async () => {
    const image = await elfToEspImage(parseElf(elf), chip)
    const view = new DataView(image.buffer)

    expect(image[0]).toBe(0xe9)
    expect(view.getUint32(4, true)).toBe(0x40378000)
    expect(view.getUint16(12, true)).toBe(chip.imageChipId)
    expect(image[23]).toBe(1) // append digest

    const { segments, end } = readSegments(image)

    // Every flash-mapped segment sits at a file offset congruent to its address mod 64 KB.
    const flash = segments.filter((s) => isEspFlashAddress(s.address, chip))
    expect(flash).toHaveLength(2)
    for (const segment of flash) {
      expect(segment.dataOffset % IROM_ALIGN).toBe(segment.address % IROM_ALIGN)
    }

    // All RAM bytes are present somewhere, in order.
    const ramBytes = segments
      .filter((s) => !isEspFlashAddress(s.address, chip) && s.address !== 0)
      .flatMap((s) => Array.from(image.subarray(s.dataOffset, s.dataOffset + s.length)))
    expect(ramBytes).toEqual([...Array.from(dram), ...Array.from(iram)])

    // Checksum: XOR of every segment's data, seeded with 0xEF, in the last byte before the digest.
    let checksum = 0xef
    for (const segment of segments) {
      for (const byte of image.subarray(segment.dataOffset, segment.dataOffset + segment.length)) checksum ^= byte
    }
    const padded = end + (15 - (end % 16)) + 1
    expect(image[padded - 1]).toBe(checksum)

    // SHA-256 of everything before it is appended.
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', image.slice(0, padded)))
    expect(Array.from(image.subarray(padded))).toEqual(Array.from(digest))
    expect(image.length).toBe(padded + 32)
  })

  test('refuses the wrong architecture', async () => {
    const riscv = buildElf({ machine: ELF_MACHINE.RISCV, entry: 0, sections: [], segments: [] })
    await expect(elfToEspImage(parseElf(riscv), chip)).rejects.toThrow('RISC-V')
  })
})

describe('isFullFlashImage', () => {
  function imageWith(bytes: Record<number, number>, length = 0x9000) {
    const data = new Uint8Array(length)
    data[0] = 0xe9
    for (const [offset, value] of Object.entries(bytes)) data[Number(offset)] = value
    return data
  }

  test('an app image has no partition table at 0x8000', () => {
    expect(isFullFlashImage(imageWith({ 0x8000: 0x72, 0x8001: 0x5f }))).toBe(false)
  })

  test('the 0xAA50 magic at 0x8000 marks a whole-flash image', () => {
    expect(isFullFlashImage(imageWith({ 0x8000: 0xaa, 0x8001: 0x50 }))).toBe(true)
  })

  test('a file too short to reach 0x8000 is not a whole-flash image', () => {
    expect(isFullFlashImage(imageWith({}, 0x8001))).toBe(false)
  })

  test('half the magic is not the magic', () => {
    expect(isFullFlashImage(imageWith({ 0x8000: 0xaa, 0x8001: 0x51 }))).toBe(false)
  })
})
