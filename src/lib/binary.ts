import { ELF_MACHINE, isElf, loadableSegments, parseElf } from './image/elf'
import { UF2_FAMILIES, isUf2, parseUf2, uf2Families, uf2Segments } from './image/uf2'
import type { Binary, BinaryFormat, ImageHint } from './types'

/**
 * Formats are read from the file itself rather than its extension, so a binary
 * renamed on the way out of a build still lands in the right pipeline.
 */
function detectFormat(data: Uint8Array, name: string): BinaryFormat {
  if (isElf(data)) return 'elf'
  if (isUf2(data)) return 'uf2'
  if (data[0] === 0x3a) return 'hex' // Intel HEX records all start with ':'
  if (name.toLowerCase().endsWith('.hex')) return 'hex'

  return 'bin'
}

/** Looks inside the file to say which boards it fits and whether it can be written at all. */
function inspect(data: Uint8Array, format: BinaryFormat): ImageHint {
  if (data.length === 0) return { family: 'unknown', problem: 'This file is empty' }

  try {
    switch (format) {
      case 'uf2': {
        const blocks = parseUf2(data)
        const known = uf2Families(blocks)
          .map((id) => UF2_FAMILIES[id])
          .filter((family) => family !== undefined)
        const chips = [...new Set(known.map((family) => family.chip))]

        return {
          family: known.length === 0 ? 'unknown' : known.every((f) => f.family === known[0].family) ? known[0].family : 'unknown',
          chip: chips.length === 1 ? chips[0] : undefined,
          segments: uf2Segments(blocks).length,
        }
      }

      case 'elf': {
        const elf = parseElf(data)
        const family = elf.machine === ELF_MACHINE.XTENSA ? 'esp' : elf.machine === ELF_MACHINE.ARM ? 'rp' : 'unknown'

        return { family, segments: loadableSegments(elf).length }
      }

      case 'hex':
        return { family: 'unknown', problem: 'Intel HEX is not supported yet. Export a .bin, .uf2 or .elf instead' }

      default:
        return { family: 'unknown' }
    }
  } catch (error) {
    return { family: 'unknown', problem: `Could not read this ${format.toUpperCase()}: ${(error as Error).message}` }
  }
}

async function digestOf(buffer: ArrayBuffer) {
  const hash = await crypto.subtle.digest('SHA-256', buffer)

  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export async function readBinary(file: File): Promise<Binary> {
  const buffer = await file.arrayBuffer()
  const data = new Uint8Array(buffer)
  const format = detectFormat(data, file.name)

  return {
    name: file.name,
    bytes: file.size,
    format,
    digest: await digestOf(buffer),
    loadedAt: Date.now(),
    data,
    hint: inspect(data, format),
  }
}

/** Anything that would make pressing Flash a mistake. */
export function warningFor(binary: Binary) {
  return binary.hint.problem ?? null
}
