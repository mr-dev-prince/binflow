/** Builds small ELF32 little-endian files for tests. */

type Section = { name: string; type: number; flags: number; address: number; data: Uint8Array }
type Segment = { type: number; vaddr: number; paddr: number; data: Uint8Array; memsz?: number }

export function buildElf(options: { machine: number; entry: number; sections: Section[]; segments: Segment[] }) {
  const { machine, entry, sections, segments } = options

  // String table for section names, null section first.
  const names = ['', ...sections.map((s) => s.name), '.shstrtab']
  const nameOffsets: number[] = []
  const strtab: number[] = []
  for (const name of names) {
    nameOffsets.push(strtab.length)
    strtab.push(...new TextEncoder().encode(name), 0)
  }

  const headerSize = 52
  const phentsize = 32
  const shentsize = 40
  const phnum = segments.length
  const shnum = sections.length + 2 // null + sections + shstrtab

  // Layout: header, program headers, section data blobs, strtab, section headers.
  let cursor = headerSize + phnum * phentsize
  const sectionOffsets = sections.map((s) => {
    const offset = cursor
    cursor += s.data.length
    return offset
  })
  const segmentOffsets = segments.map((s) => {
    const offset = cursor
    cursor += s.data.length
    return offset
  })
  const strtabOffset = cursor
  cursor += strtab.length
  const shoff = cursor
  cursor += shnum * shentsize

  const out = new Uint8Array(cursor)
  const view = new DataView(out.buffer)

  out.set([0x7f, 0x45, 0x4c, 0x46, 1, 1, 1], 0)
  view.setUint16(16, 2, true) // ET_EXEC
  view.setUint16(18, machine, true)
  view.setUint32(20, 1, true)
  view.setUint32(24, entry, true)
  view.setUint32(28, headerSize, true) // phoff
  view.setUint32(32, shoff, true)
  view.setUint16(40, headerSize, true)
  view.setUint16(42, phentsize, true)
  view.setUint16(44, phnum, true)
  view.setUint16(46, shentsize, true)
  view.setUint16(48, shnum, true)
  view.setUint16(50, shnum - 1, true) // shstrndx

  segments.forEach((segment, index) => {
    const base = headerSize + index * phentsize
    view.setUint32(base, segment.type, true)
    view.setUint32(base + 4, segmentOffsets[index], true)
    view.setUint32(base + 8, segment.vaddr, true)
    view.setUint32(base + 12, segment.paddr, true)
    view.setUint32(base + 16, segment.data.length, true)
    view.setUint32(base + 20, segment.memsz ?? segment.data.length, true)
    view.setUint32(base + 24, 5, true)
    view.setUint32(base + 28, 4, true)
    out.set(segment.data, segmentOffsets[index])
  })

  sections.forEach((section, index) => out.set(section.data, sectionOffsets[index]))
  out.set(strtab, strtabOffset)

  const writeSection = (slot: number, fields: { name: number; type: number; flags: number; addr: number; offset: number; size: number }) => {
    const base = shoff + slot * shentsize
    view.setUint32(base, fields.name, true)
    view.setUint32(base + 4, fields.type, true)
    view.setUint32(base + 8, fields.flags, true)
    view.setUint32(base + 12, fields.addr, true)
    view.setUint32(base + 16, fields.offset, true)
    view.setUint32(base + 20, fields.size, true)
  }

  writeSection(0, { name: 0, type: 0, flags: 0, addr: 0, offset: 0, size: 0 })
  sections.forEach((section, index) =>
    writeSection(index + 1, {
      name: nameOffsets[index + 1],
      type: section.type,
      flags: section.flags,
      addr: section.address,
      offset: sectionOffsets[index],
      size: section.data.length,
    }),
  )
  writeSection(shnum - 1, { name: nameOffsets[names.length - 1], type: 3, flags: 0, addr: 0, offset: strtabOffset, size: strtab.length })

  return out
}

export function pattern(length: number, seed = 1) {
  return Uint8Array.from({ length }, (_, index) => (index * 7 + seed) & 0xff)
}
