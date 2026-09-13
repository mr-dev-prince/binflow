import type { Binary, BinaryFormat } from './types'

const ELF_MAGIC = [0x7f, 0x45, 0x4c, 0x46]
const UF2_MAGIC = [0x55, 0x46, 0x32, 0x0a]

/**
 * Formats are read from the file itself rather than its extension, so a binary
 * renamed on the way out of a build still lands in the right pipeline.
 */
function detectFormat(head: Uint8Array, name: string): BinaryFormat {
  if (ELF_MAGIC.every((byte, index) => head[index] === byte)) return 'elf'
  if (UF2_MAGIC.every((byte, index) => head[index] === byte)) return 'uf2'
  if (head[0] === 0x3a) return 'hex' // Intel HEX records all start with ':'
  if (name.toLowerCase().endsWith('.hex')) return 'hex'

  return 'bin'
}

async function digestOf(buffer: ArrayBuffer) {
  const hash = await crypto.subtle.digest('SHA-256', buffer)

  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export async function readBinary(file: File): Promise<Binary> {
  const buffer = await file.arrayBuffer()

  return {
    name: file.name,
    bytes: file.size,
    format: detectFormat(new Uint8Array(buffer.slice(0, 8)), file.name),
    digest: await digestOf(buffer),
    loadedAt: Date.now(),
  }
}

/** Anything that would make pressing Flash a mistake. */
export function warningFor(binary: Binary) {
  if (binary.bytes === 0) return 'This file is empty'
  if (binary.format === 'elf') return 'This is an ELF file. Convert it with objcopy before flashing'

  return null
}
