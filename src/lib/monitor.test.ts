import { describe, expect, test } from 'bun:test'
import { SerialMonitor } from './monitor'

/**
 * A port that hands the monitor whatever the test pushes into it, with the
 * state rules Chromium enforces: a second open() is an InvalidStateError and a
 * port whose stream is locked cannot be closed.
 */
function fakePort() {
  let controller!: ReadableStreamDefaultController<Uint8Array>
  let readable: ReadableStream<Uint8Array> | null = null
  const signals: SerialOutputSignals[] = []

  const open = () => {
    readable = new ReadableStream<Uint8Array>({
      start(next) {
        controller = next
      },
    })
  }

  const port = {
    get readable() {
      return readable
    },
    open: async () => {
      if (readable) throw Object.assign(new Error('The port is already open.'), { name: 'InvalidStateError' })
      open()
    },
    close: async () => {
      if (readable?.locked) throw new TypeError('Cannot cancel a locked stream')
      readable = null
    },
    setSignals: async (next: SerialOutputSignals) => {
      signals.push(next)
    },
    getInfo: () => ({}),
  }

  return {
    port: port as unknown as SerialPort,
    push: (text: string) => controller.enqueue(new TextEncoder().encode(text)),
    finish: () => controller.close(),
    signals,
    /** Pretend code that has since been replaced opened the port and never closed it. */
    leaveOpen: open,
    isOpen: () => readable !== null,
  }
}

/** Snapshots are published on a timer, so give the store a moment to catch up. */
const settle = (ms = 140) => new Promise((resolve) => setTimeout(resolve, ms))

async function watch() {
  const { port, push, finish, signals } = fakePort()
  const monitor = new SerialMonitor()
  await monitor.attach('board-1', port)

  return { monitor, push, finish, signals, lines: () => monitor.getSnapshot().lines.map((line) => line.text) }
}

describe('serial monitor', () => {
  test('asserts DTR and RTS on attach and again after a reset pulse', async () => {
    // Native USB firmware such as Arduino-Pico drops every byte while DTR is clear.
    const { monitor, signals, lines } = await watch()

    expect(signals).toEqual([{ dataTerminalReady: true, requestToSend: true }])

    await monitor.reset()
    await settle()

    expect(signals.slice(1)).toEqual([
      { dataTerminalReady: false, requestToSend: true },
      { dataTerminalReady: true, requestToSend: true },
    ])
    expect(lines()).toEqual(['— reset —'])
    await monitor.detach()
  })

  test('joins lines that arrive in pieces', async () => {
    const { monitor, push, lines } = await watch()

    push('hello ')
    push('world\nsecond line\n')
    await settle()

    expect(lines()).toEqual(['hello world', 'second line'])
    await monitor.detach()
  })

  test('handles a CRLF split across two chunks', async () => {
    const { monitor, push, lines } = await watch()

    push('one\r')
    push('\ntwo\r\n')
    await settle()

    expect(lines()).toEqual(['one', 'two'])
    await monitor.detach()
  })

  test('a bare carriage return starts a new line', async () => {
    const { monitor, push, lines } = await watch()

    push('10%\r20%\r')
    await settle()

    expect(lines()).toEqual(['10%', '20%'])
    await monitor.detach()
  })

  test('drops ANSI colour codes and stray control bytes', async () => {
    const { monitor, push, lines } = await watch()

    push('\u001b[0;32mI (301) app: up\u001b[0m\n\u0007ping\n')
    await settle()

    expect(lines()).toEqual(['I (301) app: up', 'ping'])
    await monitor.detach()
  })

  test('shows a line with no newline yet, then completes it', async () => {
    const { monitor, push, lines } = await watch()

    push('Enter a command: ')
    await settle(400)
    expect(lines()).toEqual(['Enter a command: '])

    push('reboot\n')
    await settle()
    expect(lines()).toEqual(['Enter a command: reboot'])

    await monitor.detach()
  })

  test('keeps the tail of a chatty board and stops on detach', async () => {
    const { monitor, push, lines } = await watch()

    for (let index = 0; index < 2100; index += 1) push(`line ${index}\n`)
    await settle()

    const kept = lines()
    expect(kept.length).toBe(2000)
    expect(kept[0]).toBe('line 100')
    expect(kept[1999]).toBe('line 2099')

    await monitor.detach()
    expect(monitor.getSnapshot().status).toBe('off')
    expect(monitor.watching).toBeNull()

    // The stream is cancelled, which is what frees the port for the flasher.
    expect(() => push('after detach\n')).toThrow()
  })

  test('closes and reopens a port this page left open', async () => {
    const { port, leaveOpen, isOpen, push } = fakePort()
    leaveOpen()

    const monitor = new SerialMonitor()
    await monitor.attach('board-1', port, 9600)
    expect(monitor.getSnapshot().status).toBe('on')

    push('alive\n')
    await settle()
    expect(monitor.getSnapshot().lines.map((line) => line.text)).toEqual(['alive'])

    await monitor.detach()
    expect(isOpen()).toBe(false)
  })

  test('explains a port whose reader belongs to someone else', async () => {
    const { port, leaveOpen } = fakePort()
    leaveOpen()
    const stranger = port.readable!.getReader()

    const monitor = new SerialMonitor()
    await expect(monitor.attach('board-1', port)).rejects.toThrow('Reload the page')
    expect(monitor.getSnapshot().status).toBe('off')
    expect(monitor.getSnapshot().error).toContain('already open elsewhere')

    stranger.releaseLock()
  })

  test('takes over from the instance a hot reload replaced', async () => {
    const { port, push, isOpen } = fakePort()
    const before = new SerialMonitor()
    await before.attach('board-1', port, 9600)

    const after = new SerialMonitor(before)
    expect(after.getSnapshot()).toMatchObject({ deviceId: 'board-1', baud: 9600, status: 'off' })

    await after.attach('board-1', port)
    expect(before.watching).toBeNull()
    expect(after.watching).toBe('board-1')
    expect(isOpen()).toBe(true)

    push('hello\n')
    await settle()
    expect(after.getSnapshot().lines.map((line) => line.text)).toEqual(['hello'])

    await after.detach()
  })

  test('notices when the stream ends under it', async () => {
    const { monitor, finish, lines } = await watch()

    finish()
    await settle()

    expect(monitor.getSnapshot().status).toBe('off')
    expect(monitor.getSnapshot().error).toBe('The board went away')
    expect(monitor.lostPort).toBe(true)
    expect(lines().at(-1)).toBe('— disconnected —')
  })
})
