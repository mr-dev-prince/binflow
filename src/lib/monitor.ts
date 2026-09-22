/**
 * Reads whatever a board prints on its serial port and keeps the last lines for
 * the Serial tab of the activity sheet.
 *
 * A port can only be open once, so the monitor and the flasher take turns:
 * useFlasher detaches this before handing a port to a driver and attaches again
 * when the run is over. Lines arrive far faster than React wants to render, so
 * the buffer is mutated in place and a fresh snapshot is published on a timer.
 */

import { pulseReset } from './serial'

/** Lines kept in the buffer. Older ones fall off the top. */
const LINE_LIMIT = 2000

/** Output still missing its newline is shown after this long, so prompts appear. */
const IDLE_MS = 250

/** Output with no newline in sight is cut here rather than growing forever. */
const LINE_MAX = 4096

/** Renders are coalesced to this interval so a chatty board cannot swamp React. */
const FLUSH_MS = 80

/** 74880 is the ESP8266 boot rom rate; the rest are the usual suspects. */
export const BAUD_RATES = [9600, 19200, 38400, 57600, 74880, 115200, 230400, 460800, 921600]

export const DEFAULT_BAUD = 115200

export type MonitorLine = { id: number; at: number; text: string }

export type MonitorStatus = 'off' | 'opening' | 'on'

export type MonitorSnapshot = {
  /** Board the monitor is on, or was last on. */
  deviceId: string | null
  baud: number
  status: MonitorStatus
  error: string | null
  lines: MonitorLine[]
}

const EMPTY: MonitorSnapshot = {
  deviceId: null,
  baud: DEFAULT_BAUD,
  status: 'off',
  error: null,
  lines: [],
}

/** Colour and cursor escapes: ESP-IDF sends them, a log pane cannot use them. */
const ANSI = /\u001b\[[0-9;?]*[ -/]*[@-~]/g

/** Everything unprintable except tab, which carries real layout. */
const CONTROL = /[\u0000-\u0008\u000b-\u001f\u007f]/g

export class SerialMonitor {
  private listeners = new Set<() => void>()
  private snapshot: MonitorSnapshot = EMPTY

  private lines: MonitorLine[] = []
  private nextId = 0
  /** The last line has no newline yet, so more text belongs to it. */
  private open = false
  /** The whole current unterminated line, rendered or not. */
  private pending = ''
  /** The previous chunk ended on a carriage return, so drop a leading newline. */
  private afterCr = false

  private port: SerialPort | null = null
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null
  private pump: Promise<void> | null = null

  private deviceId: string | null = null
  private baud = DEFAULT_BAUD
  private status: MonitorStatus = 'off'
  private error: string | null = null

  private flushTimer: ReturnType<typeof setTimeout> | null = null
  private idleTimer: ReturnType<typeof setTimeout> | null = null

  /** Pending release of a predecessor's port; attach() waits for it. */
  private handoff: Promise<void> | null = null
  /** The port vanished under the reader, as opposed to being closed on purpose. */
  private lost = false

  /**
   * A predecessor is the instance a hot reload is replacing. It still owns an
   * open port and the lock on its reader, so nothing here could open that port
   * again until it lets go. Its selection carries over; its lines do not.
   */
  constructor(predecessor?: SerialMonitor) {
    if (!predecessor) return

    const { deviceId, baud } = predecessor.getSnapshot()
    this.deviceId = deviceId
    this.baud = baud
    this.snapshot = { ...EMPTY, deviceId, baud }
    this.handoff = predecessor.detach().catch(() => undefined)
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot = () => this.snapshot

  getServerSnapshot = () => EMPTY

  /** The board being read right now, as opposed to the one last selected. */
  get watching() {
    return this.port ? this.deviceId : null
  }

  /** True when the last port went away mid-read, so the selected board is one to pick up again. */
  get lostPort() {
    return this.lost
  }

  async attach(deviceId: string, port: SerialPort, baud = this.baud) {
    await this.handoff
    await this.detach()

    this.lost = false
    this.deviceId = deviceId
    this.baud = baud
    this.status = 'opening'
    this.error = null
    this.publish()

    try {
      await this.openPort(port, baud)
    } catch (error) {
      this.status = 'off'
      this.error = (error as Error).message
      this.publish()
      throw error
    }

    // Native USB firmware, Pico SDK and Arduino-Pico included, only transmits
    // while DTR says a terminal is listening. RTS goes up with it: on the ESP
    // auto-reset circuit both lines asserted is a normal run state, and only a
    // mixed pair holds EN low or pulls IO0 down.
    await port.setSignals({ dataTerminalReady: true, requestToSend: true }).catch(() => undefined)

    this.port = port
    this.status = 'on'
    this.publish()
    this.pump = this.read(port)
  }

  /**
   * Opens the port. One this page already holds open, because whatever opened
   * it has been replaced or forgot to close it, is closed and opened again so
   * the baud rate applies. When its streams are locked a reader is still
   * running somewhere, and only a page reload can free it.
   */
  private async openPort(port: SerialPort, baud: number) {
    const options: SerialOptions = { baudRate: baud, bufferSize: 8 * 1024 }

    try {
      await port.open(options)
    } catch (error) {
      if ((error as DOMException).name !== 'InvalidStateError') throw error
      if (port.readable?.locked || port.writable?.locked) {
        throw new Error('The port is already open elsewhere on this page. Reload the page to release it')
      }

      await port.close()
      await port.open(options)
    }
  }

  async detach() {
    const port = this.port
    this.port = null

    if (port) {
      await this.reader?.cancel().catch(() => undefined)
      await this.pump?.catch(() => undefined)
      await port.close().catch(() => undefined)
    }

    this.pump = null
    this.status = 'off'
    this.commit()
    this.publish()
  }

  /** Used when a board is unplugged, released or about to be rebooted. */
  async detachDevice(deviceId: string) {
    if (this.deviceId === deviceId && this.port) await this.detach()
  }

  /** Remembers which board the Serial tab is pointed at. */
  select(deviceId: string) {
    if (this.port) return

    this.deviceId = deviceId
    this.error = null
    this.publish()
  }

  async setBaud(baud: number) {
    const port = this.port
    const deviceId = this.deviceId

    if (port && deviceId) {
      await this.attach(deviceId, port, baud)
      return
    }

    this.baud = baud
    this.publish()
  }

  /** Reboots the board so its boot log is not missed. Needs the port open. */
  async reset() {
    if (!this.port) return

    try {
      await pulseReset(this.port)
      this.note('reset')
    } catch (error) {
      this.note(`reset failed: ${(error as Error).message}`)
    }
  }

  clear() {
    this.lines = []
    // Whatever is half-typed stays in `pending`; it just needs a new line to go in.
    this.open = false
    this.publish()
  }

  /** A line from streambits itself rather than from the board. */
  note(text: string) {
    this.commit()
    this.write(`— ${text} —`, true)
  }

  private async read(port: SerialPort) {
    const decoder = new TextDecoder()

    while (this.port === port && port.readable) {
      const reader = port.readable.getReader()
      this.reader = reader
      /** A parity, framing or overflow error ends the stream but not the port. */
      let recoverable = false

      try {
        for (;;) {
          const { value, done } = await reader.read()
          if (done) break
          if (value?.length) this.feed(decoder.decode(value, { stream: true }))
        }
      } catch (error) {
        recoverable = this.port === port

        if (recoverable) {
          this.note((error as Error).message)
          await new Promise((resolve) => setTimeout(resolve, 50))
        }
      } finally {
        reader.releaseLock()
        this.reader = null
      }

      // Only an error is worth a fresh reader; a closed stream is the end.
      if (!recoverable) break
    }

    this.commit()

    // port.readable goes null when the board is pulled out mid-read.
    if (this.port === port) {
      this.port = null
      this.lost = true
      this.status = 'off'
      this.error = 'The board went away'
      this.note('disconnected')
      await port.close().catch(() => undefined)
      this.publish()
    }
  }

  private feed(raw: string) {
    let chunk = raw
    if (this.afterCr && chunk.startsWith('\n')) chunk = chunk.slice(1)
    this.afterCr = chunk.endsWith('\r')

    // A bare carriage return is how firmware redraws a line; treat it as a
    // line of its own rather than letting it pile up inside one.
    this.pending += chunk.replace(/\r\n?/g, '\n').replace(ANSI, '').replace(CONTROL, '')

    for (let cut = this.pending.indexOf('\n'); cut !== -1; cut = this.pending.indexOf('\n')) {
      this.write(this.pending.slice(0, cut), true)
      this.pending = this.pending.slice(cut + 1)
    }

    if (this.pending.length >= LINE_MAX) {
      this.write(this.pending, true)
      this.pending = ''
    }

    if (this.idleTimer) clearTimeout(this.idleTimer)
    this.idleTimer = this.pending ? setTimeout(() => this.show(), IDLE_MS) : null
  }

  /** Renders the unterminated line, leaving it open for the rest of its text. */
  private show() {
    if (this.pending) this.write(this.pending, false)
  }

  /** Ends the unterminated line, so what follows cannot overwrite it. */
  private commit() {
    if (!this.pending) return

    this.write(this.pending, true)
    this.pending = ''
  }

  private write(text: string, terminated: boolean) {
    if (this.open) {
      // The open line is always the last one, so it can be swapped in place.
      this.lines[this.lines.length - 1] = { ...this.lines[this.lines.length - 1], text }
    } else {
      this.lines.push({ id: (this.nextId += 1), at: Date.now(), text })
      if (this.lines.length > LINE_LIMIT) this.lines.splice(0, this.lines.length - LINE_LIMIT)
    }

    this.open = !terminated
    this.schedule()
  }

  /** Data is published on a timer; everything else takes effect at once. */
  private schedule() {
    if (this.flushTimer) return

    this.flushTimer = setTimeout(() => {
      this.flushTimer = null
      this.publish()
    }, FLUSH_MS)
  }

  private publish() {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer)
      this.flushTimer = null
    }

    this.snapshot = {
      deviceId: this.deviceId,
      baud: this.baud,
      status: this.status,
      error: this.error,
      lines: this.lines.slice(),
    }

    this.listeners.forEach((listener) => listener())
  }
}

/**
 * One page, one open port: the monitor is shared rather than per component.
 * In development a hot reload evaluates this module again while the previous
 * instance still owns the port, so it is handed over rather than orphaned.
 */
const shared = globalThis as { __streambitsMonitor?: SerialMonitor }
export const monitor = new SerialMonitor(shared.__streambitsMonitor)
shared.__streambitsMonitor = monitor
