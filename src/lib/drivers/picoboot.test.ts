import { describe, expect, test } from 'bun:test'
import { encodeCommand, findPicobootInterface, planFlash } from './picoboot'

type Endpoint = { direction: 'in' | 'out'; type: 'bulk' | 'interrupt'; endpointNumber: number }
type Alternate = { interfaceClass: number; interfaceSubclass: number; interfaceProtocol: number; endpoints: Endpoint[] }

/** A USBDevice as WebUSB presents it before open(): descriptors only. */
function device(interfaces: Alternate[][], configured = true): USBDevice {
  const configuration = {
    configurationValue: 1,
    interfaces: interfaces.map((alternates, interfaceNumber) => ({ interfaceNumber, alternates })),
  }

  return {
    vendorId: 0x2e8a,
    productId: 0x000f,
    configuration: configured ? configuration : null,
    configurations: [configuration],
  } as unknown as USBDevice
}

const bulk = (direction: 'in' | 'out', endpointNumber: number): Endpoint => ({ direction, type: 'bulk', endpointNumber })

const massStorage: Alternate = { interfaceClass: 0x08, interfaceSubclass: 0x06, interfaceProtocol: 0x50, endpoints: [bulk('in', 1), bulk('out', 2)] }
const picoboot: Alternate = { interfaceClass: 0xff, interfaceSubclass: 0, interfaceProtocol: 0, endpoints: [bulk('out', 3), bulk('in', 4)] }

describe('findPicobootInterface', () => {
  test('finds the bootrom interface behind mass storage', () => {
    expect(findPicobootInterface(device([[massStorage], [picoboot]]))).toEqual({ interfaceNumber: 1, epIn: 4, epOut: 3 })
  })

  test('finds it on its own when mass storage is disabled in OTP', () => {
    expect(findPicobootInterface(device([[picoboot]]))).toEqual({ interfaceNumber: 0, epIn: 4, epOut: 3 })
  })

  test('reads the configuration list when the device is not configured yet', () => {
    expect(findPicobootInterface(device([[massStorage], [picoboot]], false))).not.toBeNull()
  })

  test('rejects a Pico 2 running CDC firmware on the BOOTSEL product id', () => {
    // Exactly what an Arduino-Pico build presents: 2E8A:000F, ACM control and data.
    const control: Alternate = { interfaceClass: 0x02, interfaceSubclass: 0x02, interfaceProtocol: 0, endpoints: [{ direction: 'in', type: 'interrupt', endpointNumber: 1 }] }
    const data: Alternate = { interfaceClass: 0x0a, interfaceSubclass: 0, interfaceProtocol: 0, endpoints: [bulk('out', 1), bulk('in', 2)] }

    expect(findPicobootInterface(device([[control], [data]]))).toBeNull()
  })

  test('rejects the Pico SDK reset interface, which is vendor class too', () => {
    const reset: Alternate = { interfaceClass: 0xff, interfaceSubclass: 0, interfaceProtocol: 1, endpoints: [] }

    expect(findPicobootInterface(device([[reset]]))).toBeNull()
  })
})

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
