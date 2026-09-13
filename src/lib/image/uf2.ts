import type { Family } from '../types'
import { mergeSegments, type Segment } from './segments'

const MAGIC_0 = 0x0a324655
const MAGIC_1 = 0x9e5d5157
const MAGIC_END = 0x0ab16f30
const BLOCK_SIZE = 512

const FLAG_NOT_MAIN_FLASH = 0x0001
const FLAG_FAMILY_ID = 0x2000

export type Uf2Block = {
  flags: number
  targetAddr: number
  payloadSize: number
  blockNo: number
  numBlocks: number
  familyId: number | null
  data: Uint8Array
}

export const UF2_FAMILIES: Record<number, { chip: string; family: Family }> = {
  0xe48bff56: { chip: 'RP2040', family: 'rp' },
  0xe48bff59: { chip: 'RP2350', family: 'rp' },
  0xe48bff5a: { chip: 'RP2350', family: 'rp' },
  0xe48bff5b: { chip: 'RP2350', family: 'rp' },
  0xe48bff57: { chip: 'RP2350', family: 'rp' }, // absolute
  0xe48bff58: { chip: 'RP2350', family: 'rp' }, // data
  0x1c5f21b0: { chip: 'ESP32', family: 'esp' },
  0xbfdd4eee: { chip: 'ESP32-S2', family: 'esp' },
  0xc47e5767: { chip: 'ESP32-S3', family: 'esp' },
  0xd42ba06c: { chip: 'ESP32-C3', family: 'esp' },
  0x2b88d29c: { chip: 'ESP32-C2', family: 'esp' },
  0x540ddf62: { chip: 'ESP32-C6', family: 'esp' },
  0x332726f6: { chip: 'ESP32-H2', family: 'esp' },
}

export function isUf2(bytes: Uint8Array) {
  if (bytes.length < 8) return false
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  return view.getUint32(0, true) === MAGIC_0 && view.getUint32(4, true) === MAGIC_1
}

export function parseUf2(bytes: Uint8Array): Uf2Block[] {
  if (bytes.length % BLOCK_SIZE !== 0) throw new Error('UF2 file length is not a multiple of 512 bytes')

  const blocks: Uf2Block[] = []

  for (let offset = 0; offset < bytes.length; offset += BLOCK_SIZE) {
    const view = new DataView(bytes.buffer, bytes.byteOffset + offset, BLOCK_SIZE)

    if (view.getUint32(0, true) !== MAGIC_0 || view.getUint32(4, true) !== MAGIC_1) {
      throw new Error(`Bad UF2 block magic at offset ${offset}`)
    }
    if (view.getUint32(508, true) !== MAGIC_END) throw new Error(`Bad UF2 end magic at offset ${offset}`)

    const flags = view.getUint32(8, true)
    const payloadSize = view.getUint32(16, true)
    if (payloadSize > 476) throw new Error(`UF2 block at offset ${offset} claims ${payloadSize} payload bytes`)

    blocks.push({
      flags,
      targetAddr: view.getUint32(12, true),
      payloadSize,
      blockNo: view.getUint32(20, true),
      numBlocks: view.getUint32(24, true),
      familyId: flags & FLAG_FAMILY_ID ? view.getUint32(28, true) : null,
      data: bytes.subarray(offset + 32, offset + 32 + payloadSize),
    })
  }

  return blocks
}

/** Distinct family ids present, in first-seen order. */
export function uf2Families(blocks: Uf2Block[]) {
  return [...new Set(blocks.map((block) => block.familyId).filter((id): id is number => id !== null))]
}

/** Flash-bound payloads joined into contiguous runs. */
export function uf2Segments(blocks: Uf2Block[]): Segment[] {
  return mergeSegments(
    blocks
      .filter((block) => !(block.flags & FLAG_NOT_MAIN_FLASH))
      .map((block) => ({ address: block.targetAddr, data: block.data })),
  )
}
