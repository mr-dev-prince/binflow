/** WebUSB access to Raspberry Pi boards sitting in BOOTSEL mode. */

import { RP_BOOTSEL_PRODUCTS, RP_VENDOR, findPicobootInterface } from './drivers/picoboot'

/**
 * The picker matches class filters against every interface, not just the
 * device, so this admits a bootrom and nothing else on a Raspberry Pi id. A
 * Pico 2 running Arduino-Pico firmware shares the RP2350 BOOTSEL product id
 * but has only CDC interfaces, and used to show up here as a bootloader.
 */
const FILTERS: USBDeviceFilter[] = [{ vendorId: RP_VENDOR, classCode: 0xff, subclassCode: 0, protocolCode: 0 }]

export function isUsbSupported() {
  return typeof navigator !== 'undefined' && 'usb' in navigator
}

/** True only for a board sitting in the bootrom, judged by its interfaces rather than its product id. */
export function isBootselDevice(device: USBDevice) {
  return device.vendorId === RP_VENDOR && findPicobootInterface(device) !== null
}

export function describeUsb(device: USBDevice) {
  const chip = RP_BOOTSEL_PRODUCTS[device.productId] ?? 'RP2xxx'
  const ids = `USB ${device.vendorId.toString(16).toUpperCase().padStart(4, '0')}:${device.productId
    .toString(16)
    .toUpperCase()
    .padStart(4, '0')}`

  return { chip, detail: `${chip} BOOTSEL · ${ids}` }
}

/**
 * A replugged board comes back as a fresh USBDevice, so object identity is not
 * enough to recognise it. The serial number is burned into the chip.
 */
export function isSameUsb(a: USBDevice, b: USBDevice) {
  if (a === b) return true
  if (!a.serialNumber || a.serialNumber !== b.serialNumber) return false

  return a.vendorId === b.vendorId && a.productId === b.productId
}

/** Opens the browser's USB picker filtered to BOOTSEL devices. Null when cancelled. */
export async function requestBootsel(): Promise<USBDevice | null> {
  try {
    return await navigator.usb.requestDevice({ filters: FILTERS })
  } catch (error) {
    if ((error as DOMException).name === 'NotFoundError') return null
    throw error
  }
}

export async function grantedBootsel() {
  const devices = await navigator.usb.getDevices()
  return devices.filter(isBootselDevice)
}
