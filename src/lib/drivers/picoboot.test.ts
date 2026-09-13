import { describe, expect, test } from 'bun:test'
import { encodeCommand, planFlash } from './picoboot'

describe('encodeCommand', () => {
  test('lays out the picoboot_cmd struct', () => {
    const args = new Uint8Array([0x00, 0x00, 0x00, 0x10, 0x00, 0x10, 0x00, 0x00])
    const packet = encodeCommand(0x05, args, 4096, 7)
    const view = new DataView(packet.buffer)

    expect(packet.length).toBe(32)
    expect(view.getUint32(0, true)).toBe(0x431fd10b)
    expect(view.getUint32(4, true)).toBe(7)
    expect(packet[8]).toBe(0x05)
    expect(packet[9]).toBe(8)
    expect(view.getUint32(12, true)).toBe(4096)
    expect(Array.from(packet.subarray(16, 24))).toEqual(Array.from(args))
    expect(Array.from(packet.subarray(24))).toEqual(new Array(8).fill(0))
  })
})

describe('planFlash', () => {
  test('pads runs to whole sectors with 0xFF', () => {
    const runs = planFlash([{ address: 0x10000100, data: Uint8Array.from([1, 2, 3, 4]) }])

    expect(runs).toHaveLength(1)
    expect(runs[0].start).toBe(0x10000000)
    expect(runs[0].data.length).toBe(4096)
    expect(runs[0].data[0]).toBe(0xff)
    expect(Array.from(runs[0].data.subarray(0x100, 0x104))).toEqual([1, 2, 3, 4])
    expect(runs[0].data[0x104]).toBe(0xff)
  })

  test('joins segments that share a sector and keeps distant ones apart', () => {
    const runs = planFlash([
      { address: 0x10000000, data: new Uint8Array(100).fill(1) },
      { address: 0x10000800, data: new Uint8Array(100).fill(2) },
      { address: 0x10010000, data: new Uint8Array(5000).fill(3) },
    ])

    expect(runs).toHaveLength(2)
    expect(runs[0].data.length).toBe(4096)
    expect(runs[0].data[0x800]).toBe(2)
    expect(runs[1].start).toBe(0x10010000)
    expect(runs[1].data.length).toBe(8192)
    expect(runs[1].data[4999]).toBe(3)
    expect(runs[1].data[5000]).toBe(0xff)
  })

  test('rejects overlapping segments', () => {
    expect(() =>
      planFlash([
        { address: 0x10000000, data: new Uint8Array(10) },
        { address: 0x10000005, data: new Uint8Array(10) },
      ]),
    ).toThrow('overlap')
  })
})
