import type { Device, Family } from '@/lib/types'

export const FAMILY_LABEL: Record<Family, string> = {
  esp: 'ESP32',
  rp: 'RP2040 / RP2350',
  unknown: 'Serial',
}

/** Exact chip when a driver has reported one, otherwise the family guess. */
export function chipLabel(device: Pick<Device, 'chip' | 'family'>) {
  return device.chip ?? FAMILY_LABEL[device.family]
}
