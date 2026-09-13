/**
 * Minimal ELF32 little-endian reader. Enough for firmware images: header,
 * section headers with their names, and program headers.
 */

export const ELF_MACHINE = {
  ARM: 40,
  XTENSA: 94,
  RISCV: 243,
} as const

export const SHT_PROGBITS = 1
export const SHT_INIT_ARRAY = 14
export const SHT_FINI_ARRAY = 15
export const PT_LOAD = 1

export type ElfSection = {
  name: string
  type: number
  flags: number
  address: number
  data: Uint8Array
}

export type ElfSegment = {
  type: number
  vaddr: number
  paddr: number
  memsz: number
  data: Uint8Array
}

export type Elf = {
  machine: number
  entry: number
  sections: ElfSection[]
  segments: ElfSegment[]
}

export function isElf(bytes: Uint8Array) {
  return bytes.length >= 4 && bytes[0] === 0x7f && bytes[1] === 0x45 && bytes[2] === 0x4c && bytes[3] === 0x46
}

export function parseElf(bytes: Uint8Array): Elf {
  if (!isElf(bytes)) throw new Error('Not an ELF file')
  if (bytes[4] !== 1) throw new Error('Only 32-bit ELF files are supported')
  if (bytes[5] !== 1) throw new Error('Only little-endian ELF files are supported')

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const u16 = (offset: number) => view.getUint16(offset, true)
  const u32 = (offset: number) => view.getUint32(offset, true)

  const machine = u16(18)
  const entry = u32(24)
  const phoff = u32(28)
  const shoff = u32(32)
  const phentsize = u16(42)
  const phnum = u16(44)
  const shentsize = u16(46)
  const shnum = u16(48)
  const shstrndx = u16(50)

  const slice = (offset: number, size: number) => {
    if (offset + size > bytes.length) throw new Error('ELF file is truncated')
    return bytes.subarray(offset, offset + size)
  }

  const rawSections = Array.from({ length: shnum }, (_, index) => {
    const base = shoff + index * shentsize
    return {
      nameOffset: u32(base),
      type: u32(base + 4),
      flags: u32(base + 8),
      address: u32(base + 12),
      offset: u32(base + 16),
      size: u32(base + 20),
    }
  })

  const strings = shstrndx < rawSections.length ? slice(rawSections[shstrndx].offset, rawSections[shstrndx].size) : new Uint8Array()
  const nameAt = (offset: number) => {
    let end = offset
    while (end < strings.length && strings[end] !== 0) end += 1
    return new TextDecoder().decode(strings.subarray(offset, end))
  }

  const SHT_NOBITS = 8
  const sections: ElfSection[] = rawSections.map((raw) => ({
    name: nameAt(raw.nameOffset),
    type: raw.type,
    flags: raw.flags,
    address: raw.address,
    data: raw.type === SHT_NOBITS ? new Uint8Array() : slice(raw.offset, raw.size),
  }))

  const segments: ElfSegment[] = Array.from({ length: phnum }, (_, index) => {
    const base = phoff + index * phentsize
    const filesz = u32(base + 16)
    return {
      type: u32(base),
      vaddr: u32(base + 8),
      paddr: u32(base + 12),
      memsz: u32(base + 20),
      data: slice(u32(base + 4), filesz),
    }
  })

  return { machine, entry, sections, segments }
}

/** Loadable program segments with file-backed bytes, keyed by physical (load) address. */
export function loadableSegments(elf: Elf) {
  return elf.segments
    .filter((segment) => segment.type === PT_LOAD && segment.data.length > 0)
    .map((segment) => ({ address: segment.paddr, data: segment.data }))
}
