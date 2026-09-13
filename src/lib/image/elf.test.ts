import { describe, expect, test } from 'bun:test'
import { ELF_MACHINE, PT_LOAD, SHT_PROGBITS, isElf, loadableSegments, parseElf } from './elf'
import { buildElf, pattern } from './elf-fixture'

describe('parseElf', () => {
  const text = pattern(40)
  const data = pattern(12, 9)
  const elf = buildElf({
    machine: ELF_MACHINE.ARM,
    entry: 0x100001c1,
    sections: [
      { name: '.text', type: SHT_PROGBITS, flags: 6, address: 0x10000100, data: text },
      { name: '.data', type: SHT_PROGBITS, flags: 3, address: 0x20000000, data },
    ],
    segments: [
      { type: PT_LOAD, vaddr: 0x10000100, paddr: 0x10000100, data: text },
      { type: PT_LOAD, vaddr: 0x20000000, paddr: 0x10000200, data },
      { type: 4, vaddr: 0, paddr: 0, data: new Uint8Array(0) },
    ],
  })

  test('recognises the magic', () => {
    expect(isElf(elf)).toBe(true)
    expect(isElf(new Uint8Array([1, 2, 3, 4]))).toBe(false)
  })

  test('reads header, sections and names', () => {
    const parsed = parseElf(elf)
    expect(parsed.machine).toBe(ELF_MACHINE.ARM)
    expect(parsed.entry).toBe(0x100001c1)

    const names = parsed.sections.map((s) => s.name)
    expect(names).toEqual(['', '.text', '.data', '.shstrtab'])
    expect(parsed.sections[1].address).toBe(0x10000100)
    expect(Array.from(parsed.sections[1].data)).toEqual(Array.from(text))
  })

  test('loadable segments use the physical address', () => {
    const segments = loadableSegments(parseElf(elf))
    expect(segments).toHaveLength(2)
    expect(segments[1].address).toBe(0x10000200)
    expect(Array.from(segments[1].data)).toEqual(Array.from(data))
  })

  test('rejects 64-bit files', () => {
    const wide = new Uint8Array(elf)
    wide[4] = 2
    expect(() => parseElf(wide)).toThrow('32-bit')
  })
})
