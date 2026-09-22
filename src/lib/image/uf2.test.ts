import { describe, expect, test } from 'bun:test'
import { E10_MARKER_ADDRESS, UF2_FAMILY_ABSOLUTE, isE10Marker, isUf2, parseUf2, uf2Families, uf2Segments } from './uf2'

const RP2040 = 0xe48bff56
const RP2350 = 0xe48bff59

function block(targetAddr: number, data: Uint8Array, blockNo: number, numBlocks: number, family = RP2040, flags = 0x2000) {
  const out = new Uint8Array(512)
  const view = new DataView(out.buffer)
  view.setUint32(0, 0x0a324655, true)
  view.setUint32(4, 0x9e5d5157, true)
  view.setUint32(8, flags, true)
  view.setUint32(12, targetAddr, true)
  view.setUint32(16, data.length, true)
  view.setUint32(20, blockNo, true)
  view.setUint32(24, numBlocks, true)
  view.setUint32(28, family, true)
  out.set(data, 32)
  view.setUint32(508, 0x0ab16f30, true)
  return out
}

function concat(parts: Uint8Array[]) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

describe('uf2', () => {
  const a = Uint8Array.from({ length: 256 }, (_, i) => i)
  const b = Uint8Array.from({ length: 256 }, (_, i) => 255 - i)
  const c = Uint8Array.from({ length: 100 }, () => 0x42)

  const file = concat([
    block(0x10000000, a, 0, 3),
    block(0x10000100, b, 1, 3),
    block(0x10004000, c, 2, 3),
  ])

  test('detects the magic', () => {
    expect(isUf2(file)).toBe(true)
    expect(isUf2(a)).toBe(false)
  })

  test('parses blocks and families', () => {
    const blocks = parseUf2(file)
    expect(blocks).toHaveLength(3)
    expect(blocks[2].payloadSize).toBe(100)
    expect(uf2Families(blocks)).toEqual([RP2040])
  })

  test('merges adjacent blocks into segments', () => {
    const segments = uf2Segments(parseUf2(file))
    expect(segments).toHaveLength(2)
    expect(segments[0].address).toBe(0x10000000)
    expect(segments[0].data.length).toBe(512)
    expect(segments[0].data[300]).toBe(b[44])
    expect(segments[1].address).toBe(0x10004000)
    expect(segments[1].data.length).toBe(100)
  })

  test('skips blocks flagged as not main flash', () => {
    const withExtra = concat([block(0x10000000, a, 0, 2), block(0x20000000, c, 1, 2, RP2040, 0x2001)])
    expect(uf2Segments(parseUf2(withExtra))).toHaveLength(1)
  })

  test('drops the RP2350-E10 marker block picotool appends', () => {
    const marker = block(E10_MARKER_ADDRESS, new Uint8Array(256).fill(0xef), 1, 2, UF2_FAMILY_ABSOLUTE)
    const blocks = parseUf2(concat([block(0x10000000, a, 0, 2, RP2350), marker]))

    expect(blocks.map(isE10Marker)).toEqual([false, true])
    expect(uf2Families(blocks)).toEqual([RP2350, UF2_FAMILY_ABSOLUTE])

    const segments = uf2Segments(blocks)
    expect(segments).toHaveLength(1)
    expect(segments[0].address).toBe(0x10000000)
  })

  test('keeps absolute blocks that are not the marker', () => {
    const blocks = parseUf2(concat([block(0x10000000, a, 0, 2, RP2350), block(0x10100000, c, 1, 2, UF2_FAMILY_ABSOLUTE)]))

    expect(uf2Segments(blocks)).toHaveLength(2)
  })

  test('rejects a corrupt block', () => {
    const bad = new Uint8Array(file)
    bad[512 + 508] = 0
    expect(() => parseUf2(bad)).toThrow('end magic')
  })
})
