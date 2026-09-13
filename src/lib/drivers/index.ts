import type { Family } from '../types'
import { espDriver } from './esp'
import { picobootDriver } from './picoboot'
import type { Driver, Target } from './types'

export function driverFor(target: Target, family: Family): Driver {
  if (target.kind === 'usb') return picobootDriver

  if (family === 'rp') {
    throw new Error('This Pico is running firmware. Reboot it into BOOTSEL mode, then add it as a USB device')
  }

  // Serial ports from Espressif or a USB-UART bridge: let esptool find out what is there.
  return espDriver
}

export * from './types'
