'use client'

import { useCallback, useEffect, useReducer, useRef, useState, useSyncExternalStore } from 'react'
import { FlashAborted, flashDevice, type Target } from './flasher'
import { ESP_APP_OFFSET, ESP_FLASH_BASE, isFullFlashImage } from './image/esp-image'
import { monitor } from './monitor'
import { describePort, familyOfPort, grantedPorts, isPortPresent, isSerialSupported, rebootToBootsel, requestPort } from './serial'
import type { Binary, Device, Family, FlashStage, LogEntry, LogLevel } from './types'
import { describeUsb, grantedBootsel, isSameUsb, isUsbSupported, requestBootsel } from './usb'

const LOG_LIMIT = 400

type State = {
  /** Boards the operator has connected in this screen. */
  devices: Device[]
  /** Ports and USB devices the browser knows about that are not connected here yet. */
  available: Device[]
  binary: Binary | null
  /** Where a raw .bin lands on an ESP. */
  espOffset: number
  logs: LogEntry[]
  running: boolean
  stage: FlashStage | null
  activeId: string | null
  finished: number
  startedAt: number | null
  finishedAt: number | null
}

type Action =
  | { type: 'available/add'; device: Device }
  | { type: 'available/remove'; id: string }
  | { type: 'devices/add'; device: Device }
  | { type: 'devices/remove'; id: string }
  | { type: 'devices/patch'; id: string; patch: Partial<Device> }
  | { type: 'binary/set'; binary: Binary | null }
  | { type: 'offset/set'; offset: number }
  | { type: 'log'; at: number; level: LogLevel; scope: string; message: string }
  | { type: 'log/clear' }
  | { type: 'run/start'; at: number }
  | { type: 'run/device'; id: string }
  | { type: 'run/stage'; stage: FlashStage }
  | { type: 'run/finished' }
  | { type: 'run/stop'; at: number }

type Known = {
  target: Target
  device: Device
  place: 'available' | 'connected'
  offline: boolean
}

let logId = 0

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'available/add':
      return { ...state, available: [...state.available, action.device] }
    case 'available/remove':
      return { ...state, available: state.available.filter((device) => device.id !== action.id) }
    case 'devices/add':
      return { ...state, devices: [...state.devices, action.device] }
    case 'devices/remove':
      return { ...state, devices: state.devices.filter((device) => device.id !== action.id) }
    case 'devices/patch':
      return {
        ...state,
        devices: state.devices.map((device) =>
          device.id === action.id ? { ...device, ...action.patch } : device,
        ),
      }
    case 'binary/set':
      return { ...state, binary: action.binary }
    case 'offset/set':
      return { ...state, espOffset: action.offset }
    case 'log': {
      logId += 1
      const entry: LogEntry = {
        id: logId,
        at: action.at,
        level: action.level,
        scope: action.scope,
        message: action.message,
      }

      return { ...state, logs: [...state.logs, entry].slice(-LOG_LIMIT) }
    }
    case 'log/clear':
      return { ...state, logs: [] }
    case 'run/start':
      return {
        ...state,
        running: true,
        finished: 0,
        stage: null,
        activeId: null,
        startedAt: action.at,
        finishedAt: null,
      }
    case 'run/device':
      return { ...state, activeId: action.id }
    case 'run/stage':
      return { ...state, stage: action.stage }
    case 'run/finished':
      return { ...state, finished: state.finished + 1 }
    case 'run/stop':
      return { ...state, running: false, stage: null, activeId: null, finishedAt: action.at }
    default:
      return state
  }
}

const subscribeNever = () => () => undefined

const INITIAL: State = {
  devices: [],
  available: [],
  binary: null,
  espOffset: ESP_APP_OFFSET,
  logs: [],
  running: false,
  stage: null,
  activeId: null,
  finished: 0,
  startedAt: null,
  finishedAt: null,
}

export type Support = { serial: boolean | null; usb: boolean | null }

export function useFlasher() {
  const [state, dispatch] = useReducer(reducer, INITIAL)
  /** null on the server so the first client render matches; the browser answer thereafter. */
  const serial = useSyncExternalStore(subscribeNever, isSerialSupported, () => null)
  const usb = useSyncExternalStore(subscribeNever, isUsbSupported, () => null)
  const support: Support = { serial, usb }
  const monitorState = useSyncExternalStore(monitor.subscribe, monitor.getSnapshot, monitor.getServerSnapshot)

  /** Everything the browser has shown us, with where it currently sits in the UI. */
  const knownRef = useRef(new Map<string, Known>())
  const counterRef = useRef(0)
  const abortRef = useRef<AbortController | null>(null)

  const log = useCallback(
    (level: LogLevel, scope: string, message: string) =>
      dispatch({ type: 'log', at: Date.now(), level, scope, message }),
    [],
  )

  const lookup = (target: Target) => {
    for (const known of knownRef.current.values()) {
      if (known.target.kind === 'serial' && target.kind === 'serial' && known.target.port === target.port) return known
      if (known.target.kind === 'usb' && target.kind === 'usb' && isSameUsb(known.target.device, target.device)) return known
    }
    return null
  }

  /** Registers something the browser told us about. New arrivals wait in the available list. */
  const discover = useCallback(
    (target: Target): Known => {
      const existing = lookup(target)

      if (existing) {
        // A replug hands us a new port or device object; the old one is dead.
        existing.target = target

        if (existing.place === 'connected' && existing.offline) {
          existing.offline = false
          dispatch({ type: 'devices/patch', id: existing.device.id, patch: { state: 'ready', progress: null, note: undefined } })
          log('ok', existing.device.name, 'Plugged back in')
        }

        return existing
      }

      counterRef.current += 1

      const described =
        target.kind === 'serial'
          ? { detail: describePort(target.port), family: familyOfPort(target.port), chip: undefined }
          : { ...describeUsb(target.device), family: 'rp' as Family }

      const device: Device = {
        id: `board-${counterRef.current}`,
        name: `Board ${counterRef.current}`,
        detail: described.detail,
        transport: target.kind,
        family: described.family,
        chip: described.chip,
        state: 'ready',
        progress: null,
      }
      const known: Known = { target, device, place: 'available', offline: false }

      knownRef.current.set(device.id, known)
      dispatch({ type: 'available/add', device })
      log('info', device.name, `${device.detail} available`)

      return known
    },
    [log],
  )

  /** Moves a board from the available list into the connected list. */
  const connectBoard = useCallback(
    (id: string) => {
      const known = knownRef.current.get(id)
      if (!known || known.place !== 'available') return

      known.place = 'connected'
      dispatch({ type: 'available/remove', id })
      dispatch({ type: 'devices/add', device: { ...known.device, state: 'ready', progress: null, note: undefined } })
      log('ok', known.device.name, 'Connected')
    },
    [log],
  )

  /** Opens the browser's serial picker, then connects whatever the operator chose. */
  const pickSerial = useCallback(async () => {
    try {
      const port = await requestPort()
      if (!port) return false

      const known = discover({ kind: 'serial', port })
      if (known.place === 'available') connectBoard(known.device.id)

      return true
    } catch (error) {
      log('error', 'board', `Could not connect: ${(error as Error).message}`)
      return false
    }
  }, [connectBoard, discover, log])

  /** Opens the browser's USB picker for a Pico in BOOTSEL mode. */
  const pickBootsel = useCallback(async () => {
    try {
      const device = await requestBootsel()
      if (!device) return false

      const known = discover({ kind: 'usb', device })
      if (known.place === 'available') connectBoard(known.device.id)

      return true
    } catch (error) {
      log('error', 'board', `Could not connect: ${(error as Error).message}`)
      return false
    }
  }, [connectBoard, discover, log])

  /** Puts a connected board back in the available list without revoking permission. */
  const releaseBoard = useCallback((id: string) => {
    const known = knownRef.current.get(id)
    if (!known || known.place !== 'connected') return

    void monitor.detachDevice(id)
    dispatch({ type: 'devices/remove', id })

    if (known.offline) {
      knownRef.current.delete(id)
      return
    }

    known.place = 'available'
    dispatch({ type: 'available/add', device: { ...known.device, state: 'ready', progress: null, note: undefined } })
  }, [])

  /** Revokes the browser permission so the device stops appearing. */
  const forgetBoard = useCallback(async (id: string) => {
    const known = knownRef.current.get(id)
    await monitor.detachDevice(id)
    knownRef.current.delete(id)
    dispatch({ type: 'available/remove', id })
    dispatch({ type: 'devices/remove', id })
    if (!known) return

    if (known.target.kind === 'serial' && 'forget' in known.target.port) {
      await (known.target.port as SerialPort & { forget: () => Promise<void> }).forget().catch(() => undefined)
    } else if (known.target.kind === 'usb') {
      await known.target.device.forget().catch(() => undefined)
    }
  }, [])

  /** Asks a Pico that is running firmware to drop into BOOTSEL. */
  const rebootBoard = useCallback(
    async (id: string) => {
      const known = knownRef.current.get(id)
      if (!known || known.target.kind !== 'serial') return

      try {
        await monitor.detachDevice(id)
        await rebootToBootsel(known.target.port)
        dispatch({ type: 'devices/patch', id, patch: { note: 'Rebooting into BOOTSEL. Add it as a USB device when it reappears' } })
        log('info', known.device.name, 'Sent the 1200 baud reboot. Add the BOOTSEL device from Connect a board')
      } catch (error) {
        log('error', known.device.name, `Could not reboot: ${(error as Error).message}`)
      }
    },
    [log],
  )

  /**
   * Asks the browser for its devices again. A board that was plugged back in
   * without a connect event reaching us — a slow hub, a Pico that returned in
   * BOOTSEL mode as a different device — turns up here.
   */
  const recheckBoard = useCallback(
    async (id: string) => {
      const known = knownRef.current.get(id)
      if (!known || !known.offline) return

      log('info', known.device.name, 'Looking for it again')

      try {
        if (isSerialSupported()) {
          const ports = await grantedPorts()
          ports.filter(isPortPresent).forEach((port) => discover({ kind: 'serial', port }))
        }

        if (isUsbSupported()) {
          const devices = await grantedBootsel()
          devices.forEach((device) => discover({ kind: 'usb', device }))
        }
      } catch (error) {
        log('error', known.device.name, `Could not look for it: ${(error as Error).message}`)
        return
      }

      // discover() clears the flag the moment it recognises the board.
      if (!known.offline) return

      const note =
        known.device.family === 'rp'
          ? 'Still not here. Hold BOOTSEL while plugging it in, then add it as a new board'
          : 'Still not here. Try the cable again or another USB port'

      dispatch({ type: 'devices/patch', id, patch: { note } })
      log('warn', known.device.name, note)
    },
    [discover, log],
  )

  /** Opens the port and starts reading whatever the board prints. */
  const startMonitor = useCallback(
    async (id: string) => {
      const known = knownRef.current.get(id)
      if (!known) return

      if (known.target.kind !== 'serial') {
        log('warn', known.device.name, 'A board in BOOTSEL mode has no serial console')
        return
      }

      try {
        await monitor.attach(id, known.target.port)
        log('ok', known.device.name, `Serial monitor open at ${monitor.getSnapshot().baud} baud`)
      } catch (error) {
        log('error', known.device.name, `Could not open the serial monitor: ${(error as Error).message}`)
      }
    },
    [log],
  )

  const stopMonitor = useCallback(async () => {
    const id = monitor.watching
    await monitor.detach()
    if (id) log('info', knownRef.current.get(id)?.device.name ?? 'board', 'Serial monitor closed')
  }, [log])

  const selectMonitorBoard = useCallback((id: string) => monitor.select(id), [])

  const setMonitorBaud = useCallback(async (baud: number) => {
    await monitor.setBaud(baud)
  }, [])

  const clearMonitor = useCallback(() => monitor.clear(), [])

  const resetMonitored = useCallback(() => monitor.reset(), [])

  useEffect(() => {
    const hasSerial = isSerialSupported()
    const hasUsb = isUsbSupported()

    if (!hasSerial && !hasUsb) {
      log('warn', 'streambits', 'This browser cannot reach USB or serial devices. Use Chrome or Edge on a desktop')
      return
    }

    log('info', 'streambits', 'Waiting for a board')

    const cleanups: Array<() => void> = []

    if (hasSerial) {
      grantedPorts().then((ports) => ports.forEach((port) => discover({ kind: 'serial', port })))

      const onConnect = (event: Event) => discover({ kind: 'serial', port: event.target as SerialPort })
      const onDisconnect = (event: Event) => vanish({ kind: 'serial', port: event.target as SerialPort })

      navigator.serial.addEventListener('connect', onConnect)
      navigator.serial.addEventListener('disconnect', onDisconnect)
      cleanups.push(() => {
        navigator.serial.removeEventListener('connect', onConnect)
        navigator.serial.removeEventListener('disconnect', onDisconnect)
      })
    }

    if (hasUsb) {
      grantedBootsel().then((devices) => devices.forEach((device) => discover({ kind: 'usb', device })))

      const onConnect = (event: USBConnectionEvent) => {
        if (event.device.vendorId === 0x2e8a) discover({ kind: 'usb', device: event.device })
      }
      const onDisconnect = (event: USBConnectionEvent) => vanish({ kind: 'usb', device: event.device })

      navigator.usb.addEventListener('connect', onConnect)
      navigator.usb.addEventListener('disconnect', onDisconnect)
      cleanups.push(() => {
        navigator.usb.removeEventListener('connect', onConnect)
        navigator.usb.removeEventListener('disconnect', onDisconnect)
      })
    }

    function vanish(target: Target) {
      const known = lookup(target)
      if (!known) return

      if (known.place === 'connected') {
        known.offline = true
        void monitor.detachDevice(known.device.id)
        dispatch({ type: 'devices/patch', id: known.device.id, patch: { state: 'offline', progress: null, note: undefined } })
        log('warn', known.device.name, 'Unplugged')
      } else {
        knownRef.current.delete(known.device.id)
        dispatch({ type: 'available/remove', id: known.device.id })
      }
    }

    return () => cleanups.forEach((cleanup) => cleanup())
  }, [discover, log])

  const setBinary = useCallback(
    (binary: Binary | null) => {
      dispatch({ type: 'binary/set', binary })

      if (binary) {
        const target = binary.hint.chip ?? (binary.hint.family === 'unknown' ? 'any board' : `${binary.hint.family.toUpperCase()} boards`)
        log('ok', 'firmware', `${binary.name} loaded — ${binary.format.toUpperCase()} for ${target}, sha256 ${binary.digest.slice(0, 16)}…`)
        if (binary.hint.problem) log('warn', 'firmware', binary.hint.problem)

        // A raw .bin says nothing about where it belongs, so read it rather than
        // leave the offset on whatever the last file needed. Set on both paths:
        // carrying 0x0 over to an app image is as wrong as the other way round.
        if (binary.format === 'bin' && binary.hint.family !== 'rp') {
          const whole = isFullFlashImage(binary.data)
          dispatch({ type: 'offset/set', offset: whole ? ESP_FLASH_BASE : ESP_APP_OFFSET })
          log(
            'info',
            'firmware',
            whole
              ? 'Full flash image — bootloader and partition table included. Writing at 0x0'
              : 'App image only. Writing at 0x10000',
          )
        }
      }
    },
    [log],
  )

  const setEspOffset = useCallback((offset: number) => dispatch({ type: 'offset/set', offset }), [])

  const clearLog = useCallback(() => dispatch({ type: 'log/clear' }), [])

  const abort = useCallback(() => abortRef.current?.abort(), [])

  const start = useCallback(async () => {
    const { binary, devices, espOffset } = state
    const targets = devices.filter((device) => device.state !== 'offline')

    if (!binary || targets.length === 0) return

    // Only one holder per port: the monitor steps aside for the run and comes
    // back when it is over, which is when the boot log is worth reading.
    const watched = monitor.watching

    if (watched) {
      monitor.note('paused for flashing')
      await monitor.detach()
    }

    const controller = new AbortController()
    abortRef.current = controller

    dispatch({ type: 'run/start', at: Date.now() })
    log('info', 'streambits', `Flashing ${targets.length} board${targets.length > 1 ? 's' : ''} with ${binary.name}`)

    for (const target of targets) {
      const known = knownRef.current.get(target.id)
      if (!known) continue

      dispatch({ type: 'run/device', id: target.id })
      dispatch({ type: 'devices/patch', id: target.id, patch: { state: 'busy', progress: 0, note: undefined } })

      try {
        const result = await flashDevice(
          known.target,
          target.family,
          { binary, espOffset },
          {
            onStage: (stage) => dispatch({ type: 'run/stage', stage }),
            onProgress: (progress) => dispatch({ type: 'devices/patch', id: target.id, patch: { progress } }),
            onLog: (level, message) => log(level, target.name, message),
          },
          controller.signal,
        )

        known.device = { ...known.device, chip: result.chip }
        dispatch({ type: 'devices/patch', id: target.id, patch: { state: 'flashed', progress: 1, chip: result.chip } })
        dispatch({ type: 'run/finished' })
        log('ok', target.name, 'Done')
      } catch (error) {
        const aborted = error instanceof FlashAborted
        const note = aborted ? 'Stopped' : (error as Error).message

        dispatch({ type: 'devices/patch', id: target.id, patch: { state: 'failed', progress: null, note } })
        log(aborted ? 'warn' : 'error', target.name, note)

        if (aborted) break
      }
    }

    abortRef.current = null
    dispatch({ type: 'run/stop', at: Date.now() })

    const known = watched ? knownRef.current.get(watched) : undefined

    if (watched && known?.target.kind === 'serial' && !known.offline) {
      // The board has just been reset, so let the port settle before reopening.
      await new Promise((resolve) => setTimeout(resolve, 300))
      await monitor
        .attach(watched, known.target.port)
        .catch((error: Error) => log('warn', known.device.name, `Serial monitor did not reopen: ${error.message}`))
    }
  }, [log, state])

  useEffect(() => () => abortRef.current?.abort(), [])

  return {
    state,
    support,
    monitor: monitorState,
    connectBoard,
    pickSerial,
    pickBootsel,
    releaseBoard,
    forgetBoard,
    rebootBoard,
    recheckBoard,
    startMonitor,
    stopMonitor,
    selectMonitorBoard,
    setMonitorBaud,
    clearMonitor,
    resetMonitored,
    setBinary,
    setEspOffset,
    clearLog,
    start,
    abort,
    log,
  }
}

/** Ticks while a run is in flight, then settles on the recorded duration. */
export function useElapsed(startedAt: number | null, finishedAt: number | null, running: boolean) {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!running) return

    const timer = setInterval(() => setTick(Date.now()), 250)
    return () => clearInterval(timer)
  }, [running])

  if (!startedAt) return 0
  if (running) return Math.max(0, tick - startedAt)

  return Math.max(0, (finishedAt ?? startedAt) - startedAt)
}
