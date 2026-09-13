/** WebUSB access to Raspberry Pi boards sitting in BOOTSEL mode. */

import { RP_BOOTSEL_PRODUCTS, RP_VENDOR } from './drivers/picoboot'

const FILTERS: USBDeviceFilter[] = Object.keys(RP_BOOTSEL_PRODUCTS).map((productId) => ({
  vendorId: RP_VENDOR,
  productId: Number(productId),
}))

export function isUsbSupported() {
  return typeof navigator !== 'undefined' && 'usb' in navigator
}

export function isBootselDevice(device: USBDevice) {
  return device.vendorId === RP_VENDOR && device.productId in RP_BOOTSEL_PRODUCTS
}

export function describeUsb(device: USBDevice) {
  const chip = RP_BOOTSEL_PRODUCTS[device.productId] ?? 'RP2xxx'
  const ids = `USB ${device.vendorId.toString(16).toUpperCase().padStart(4, '0')}:${device.productId
    .toString(16)
    .toUpperCase()
    .padStart(4, '0')}`

  return { chip, detail: `${chip} BOOTSEL · ${ids}` }
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
