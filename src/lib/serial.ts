/**
 * Thin wrapper over the Web Serial API. Everything the rest of the app knows
 * about a serial board comes through here.
 */

import type { Family } from './types'

const VENDORS: Record<number, string> = {
  0x303a: 'Espressif',
  0x0483: 'STMicroelectronics',
  0x2e8a: 'Raspberry Pi',
  0x1915: 'Nordic Semiconductor',
  0x10c4: 'Silicon Labs',
  0x0403: 'FTDI',
  0x1a86: 'WCH',
  0x2341: 'Arduino',
  0x239a: 'Adafruit',
  0x1b4f: 'SparkFun',
  0x16c0: 'Teensy',
  0x067b: 'Prolific',
}

export function isSerialSupported() {
  return typeof navigator !== 'undefined' && 'serial' in navigator
}

function hex(value: number) {
  return value.toString(16).toUpperCase().padStart(4, '0')
}

export function describePort(port: SerialPort) {
  const { usbVendorId, usbProductId } = port.getInfo()

  if (usbVendorId === undefined) return 'Serial port'

  const vendor = VENDORS[usbVendorId]
  const ids = `USB ${hex(usbVendorId)}:${hex(usbProductId ?? 0)}`

  return vendor ? `${vendor} · ${ids}` : ids
}

/** Best guess before any protocol has run. Bridges like CP210x stay unknown and get tried as ESP. */
export function familyOfPort(port: SerialPort): Family {
  const { usbVendorId } = port.getInfo()
  if (usbVendorId === 0x303a) return 'esp'
  if (usbVendorId === 0x2e8a) return 'rp'
  return 'unknown'
}

/** Opens the browser's port picker. Resolves null when the operator cancels. */
export async function requestPort(): Promise<SerialPort | null> {
  try {
    return await navigator.serial.requestPort()
  } catch (error) {
    if ((error as DOMException).name === 'NotFoundError') return null
    throw error
  }
}

/** Ports the operator has already granted access to in this origin. */
export function grantedPorts() {
  return navigator.serial.getPorts()
}

/** A granted port keeps showing up after it is unplugged, so ask whether it is really there. */
export function isPortPresent(port: SerialPort) {
  return port.connected !== false
}

/**
 * Pulses the reset line of an open port so the board reboots and prints its
 * boot log again. On the usual ESP auto-reset circuit RTS asserted with DTR
 * clear drives EN low; raising both together releases it with IO0 high, so
 * the chip starts the app rather than the bootloader. DTR ends up asserted,
 * which native USB firmware needs before it will transmit at all. Boards wired
 * without the circuit see only a blip on DTR and carry on.
 */
export async function pulseReset(port: SerialPort) {
  await port.setSignals({ dataTerminalReady: false, requestToSend: true })
  await new Promise((resolve) => setTimeout(resolve, 100))
  await port.setSignals({ dataTerminalReady: true, requestToSend: true })
}

/**
 * Pico SDK firmware built with USB stdio reboots into BOOTSEL when its CDC
 * port is opened at 1200 baud. The board then reappears as a USB device.
 */
export async function rebootToBootsel(port: SerialPort) {
  await port.open({ baudRate: 1200 })
  await new Promise((resolve) => setTimeout(resolve, 150))
  await port.close().catch(() => undefined)
}
